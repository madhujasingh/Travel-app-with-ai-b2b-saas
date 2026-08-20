package com.itinera.repository;

import com.itinera.model.Hotel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HotelRepository extends JpaRepository<Hotel, String> {
    List<Hotel> findByCountryNameIgnoreCase(String countryName);
    List<Hotel> findByCityIgnoreCase(String city);

    // One-time cleanup for hotels synced before HotelCatalogService switched
    // to storing only lightweight fields in bulk (see
    // HotelCatalogService.clearHeavyContent) - a single bulk UPDATE rather
    // than loading/re-saving every row, so it stays fast and memory-safe
    // regardless of table size.
    @Modifying
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

    interface CityCount {
        String getCity();
        String getCountryName();
        Long getHotelCount();
    }
}
