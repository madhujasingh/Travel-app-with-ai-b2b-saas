package com.itinera.repository;

import com.itinera.model.Hotel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface HotelRepository extends JpaRepository<Hotel, String> {
    List<Hotel> findByCountryNameIgnoreCase(String countryName);
    List<Hotel> findByCityIgnoreCase(String city);

    // Type-ahead over 175k+ hotels. Matches name and city together so
    // "taj mumbai" works as one query.
    //
    // Deliberately avoids pg_trgm's similarity() in the ordering: the GIN
    // trigram index (db/hotel-search-index.sql) makes this fast, but the query
    // still returns correct results without it, just slowly. Depending on the
    // extension would mean search failing outright wherever it isn't installed.
    //
    // Ordering puts names that start with the term first, then earliest match
    // position, so typing "taj" ranks "Taj Palace" above "Hotel Grand Taj".
    // star_rating is text, so it is only cast when it actually looks numeric -
    // a stray non-numeric value would otherwise error the whole query.
    @Query(value =
            "SELECT * FROM hotels h " +
            "WHERE lower(h.name) LIKE lower(concat('%', :term, '%')) " +
            "   OR lower(concat(h.name, ' ', coalesce(h.city, ''))) LIKE lower(concat('%', :term, '%')) " +
            "ORDER BY " +
            "  CASE WHEN lower(h.name) LIKE lower(concat(:term, '%')) THEN 0 ELSE 1 END, " +
            "  position(lower(:term) in lower(h.name)), " +
            "  CASE WHEN h.star_rating ~ '^[0-9]+(\\.[0-9]+)?$' " +
            "       THEN cast(h.star_rating AS numeric) ELSE 0 END DESC, " +
            "  h.name " +
            "LIMIT :limit",
            nativeQuery = true)
    List<Hotel> searchByName(@Param("term") String term, @Param("limit") int limit);

    // Cities matching a typed term. The unfiltered findCityCounts is 26,500+
    // rows and 1.6MB - fine as an admin listing, far too much to ship to a
    // picker that the traveller is going to type into anyway.
    @Query(value = "SELECT INITCAP(city) AS city, INITCAP(country_name) AS countryName, COUNT(*) AS hotelCount " +
                   "FROM hotels WHERE city IS NOT NULL AND city <> '' " +
                   "  AND (lower(city) LIKE lower(concat('%', :term, '%')) " +
                   "       OR lower(country_name) LIKE lower(concat('%', :term, '%'))) " +
                   "GROUP BY INITCAP(city), INITCAP(country_name) " +
                   "ORDER BY CASE WHEN lower(INITCAP(city)) LIKE lower(concat(:term, '%')) THEN 0 ELSE 1 END, " +
                   "         COUNT(*) DESC " +
                   "LIMIT :limit", nativeQuery = true)
    List<CityCount> searchCityCounts(@Param("term") String term, @Param("limit") int limit);

    // One-time cleanup for hotels synced before HotelCatalogService switched
    // to storing only lightweight fields in bulk (see
    // HotelCatalogService.clearHeavyContent) - a single bulk UPDATE rather
    // than loading/re-saving every row, so it stays fast and memory-safe
    // regardless of table size.
    @Modifying
    @Transactional
    @Query("UPDATE Hotel h SET h.imagesJson = null, h.amenitiesJson = null, h.descriptionsJson = null, h.policiesJson = null " +
           "WHERE h.imagesJson IS NOT NULL OR h.amenitiesJson IS NOT NULL OR h.descriptionsJson IS NOT NULL OR h.policiesJson IS NOT NULL")
    int clearHeavyContent();

    // Powers the city picker in the search UI - only cities with hotels
    // actually synced into our catalog are offered, so a selection always
    // resolves to real, searchable hotel IDs. Native query + INITCAP:
    // different sync batches stored city/country in inconsistent casing
    // (e.g. "AGRA" vs "Agra"), which JPQL's plain GROUP BY would keep as
    // separate duplicate rows - normalizing case in the query itself merges
    // them into one real entry with a combined count.
    @Query(value = "SELECT INITCAP(city) AS city, INITCAP(country_name) AS countryName, COUNT(*) AS hotelCount " +
           "FROM hotels WHERE city IS NOT NULL AND city <> '' " +
           "GROUP BY INITCAP(city), INITCAP(country_name) ORDER BY INITCAP(city) ASC", nativeQuery = true)
    List<CityCount> findCityCounts();

    // Admin cleanup - trims an over-broad country sync (a full country scan
    // pulls in every city TripJack has, most never searched) down to a
    // specific set of cities worth keeping. Bulk delete, same reasoning as
    // clearHeavyContent - one statement rather than loading/deleting rows
    // one at a time.
    @Modifying
    @Transactional
    @Query("DELETE FROM Hotel h WHERE UPPER(h.countryName) = UPPER(:countryName) AND UPPER(h.city) NOT IN :keepCitiesUpper")
    int deleteByCountryNameExceptCities(@Param("countryName") String countryName, @Param("keepCitiesUpper") List<String> keepCitiesUpper);

    // Bulk-remove hotels TripJack has delisted (see HotelCatalogService.
    // deleteHotelsByTjHotelIds) - a JPQL bulk delete rather than
    // deleteAllByIdInBatch, specifically because this returns the actual
    // number of rows affected. Most ids TripJack reports as deleted were
    // never in our catalog to begin with (we only sync a fraction of their
    // global inventory), so that real count is very different from - and
    // much smaller than - the number of ids checked.
    @Modifying
    @Transactional
    @Query("DELETE FROM Hotel h WHERE h.tjHotelId IN :tjHotelIds")
    int deleteByTjHotelIdIn(@Param("tjHotelIds") List<String> tjHotelIds);

    interface CityCount {
        String getCity();
        String getCountryName();
        Long getHotelCount();
    }
}
