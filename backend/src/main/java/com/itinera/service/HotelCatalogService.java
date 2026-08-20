package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.model.Hotel;
import com.itinera.repository.HotelRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

// Downloads TripJack's V3 Hotel Static Content (fetch-hotel-mapping +
// fetch-hotel-content) into our own `hotels` table, per TripJack support's
// instructions. This is entirely separate from the dynamic pricing layer
// (Listing/Detail) - static content sync doesn't affect that, it's only
// what lets us know which hotel IDs exist so a search UI has something to
// query Listing/Detail with in the first place.
//
// Orchestration (background jobs, progress tracking) lives in
// HotelSyncJobRunner - this class only holds the TripJack-facing mechanics:
// paging the mapping endpoint, batch-fetching+saving content, and resolving
// a city name to a regionId.
@Service
public class HotelCatalogService {

    private final HotelService hotelService;
    private final HotelRepository hotelRepository;
    private final ObjectMapper objectMapper;
    private final PlatformTransactionManager transactionManager;
    private final EntityManager entityManager;
    private final DataSource dataSource;

    public HotelCatalogService(
            HotelService hotelService,
            HotelRepository hotelRepository,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager,
            EntityManager entityManager,
            DataSource dataSource
    ) {
        this.hotelService = hotelService;
        this.hotelRepository = hotelRepository;
        this.objectMapper = objectMapper;
        this.transactionManager = transactionManager;
        this.entityManager = entityManager;
        this.dataSource = dataSource;
    }

    // fetch-hotel-content: up to 100 hotel IDs per call (TripJack's own
    // limit - passing more returns a 400). Persists the LIGHTWEIGHT fields
    // only (name/city/starRating/heroImageUrl/coordinates - what search
    // results actually use) - see mapToHotelForCatalog. The full
    // images/amenities/descriptions/policies content this same TripJack
    // response carries is deliberately not stored here; it's fetched live,
    // per-hotel, only when someone opens that hotel's detail page (see
    // fetchLiveContent). Storing the full content for every hotel in bulk is
    // what pushed each row to ~10KB and the catalog to hundreds of MB for
    // relatively few cities.
    public int syncHotelContent(List<String> tjHotelIds) {
        if (tjHotelIds == null || tjHotelIds.isEmpty()) {
            return 0;
        }
        if (tjHotelIds.size() > 100) {
            throw new IllegalArgumentException("Max 100 hotel IDs per sync call");
        }

        ObjectNode payload = objectMapper.createObjectNode();
        ArrayNode idsNode = payload.putArray("hotelIds");
        tjHotelIds.forEach(idsNode::add);

        JsonNode response = hotelService.hotelContent(payload);
        int count = 0;
        for (JsonNode hotelNode : response.path("hotels")) {
            hotelRepository.save(mapToHotelForCatalog(hotelNode));
            count++;
        }
        return count;
    }

    // Fetches ONE hotel's full content (images, amenities, descriptions,
    // policies) live from TripJack and returns it without persisting -
    // powers the hotel detail screen now that the bulk catalog sync no
    // longer stores this content for every hotel up front.
    public Hotel fetchLiveContent(String tjHotelId) {
        ObjectNode payload = objectMapper.createObjectNode();
        ArrayNode idsNode = payload.putArray("hotelIds");
        idsNode.add(tjHotelId);

        JsonNode response = hotelService.hotelContent(payload);
        for (JsonNode hotelNode : response.path("hotels")) {
            return mapToHotel(hotelNode);
        }
        return null;
    }

    // One-time cleanup for hotels synced before this lightweight approach -
    // nulls the heavy content columns on every existing row, reclaiming the
    // space they were taking up. Safe: the detail screen falls back to
    // fetchLiveContent for that content regardless of whether a row still has
    // it cached, and the lightweight fields (name/city/starRating/
    // heroImageUrl/coordinates) that search results depend on are untouched.
    @Transactional
    public int clearHeavyContent() {
        return hotelRepository.clearHeavyContent();
    }

    // UPDATE ... SET column = NULL doesn't actually shrink the table on
    // disk by itself - Postgres's MVCC leaves the old row versions in place
    // until VACUUM reclaims them, which autovacuum otherwise only gets to on
    // its own schedule. VACUUM can't run inside a transaction, so this needs
    // a plain autocommit JDBC connection rather than the JPA/Hibernate
    // machinery everything else in this class uses.
    public void vacuumHotelsTable() {
        try (Connection connection = dataSource.getConnection()) {
            boolean originalAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(true);
            try (Statement statement = connection.createStatement()) {
                statement.execute("VACUUM (ANALYZE) hotels");
            } finally {
                connection.setAutoCommit(originalAutoCommit);
            }
        } catch (SQLException e) {
            throw new RuntimeException("VACUUM failed: " + e.getMessage(), e);
        }
    }

    // Real on-disk size of the hotels table (incl. indexes), for verifying
    // that clearHeavyContent/vacuumHotelsTable actually reclaimed space
    // instead of trusting a dashboard percentage that may lag or round.
    public Map<String, Object> hotelsTableStorageStats() {
        String sql = "SELECT count(*) AS row_count, " +
                "pg_size_pretty(pg_total_relation_size('hotels')) AS total_size, " +
                "pg_total_relation_size('hotels') AS total_size_bytes " +
                "FROM hotels";
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(sql)) {
            Map<String, Object> stats = new LinkedHashMap<>();
            if (rs.next()) {
                stats.put("rowCount", rs.getLong("row_count"));
                stats.put("totalSize", rs.getString("total_size"));
                stats.put("totalSizeBytes", rs.getLong("total_size_bytes"));
            }
            return stats;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to read table stats: " + e.getMessage(), e);
        }
    }

    // Runs one syncHotelContent call inside its own short transaction, then
    // flushes and clears the persistence context. Without this, a long-running
    // sync processing thousands of hotels in one request/transaction keeps
    // every saved Hotel entity (each with sizeable images/amenities/
    // descriptions/policies JSON columns) in Hibernate's first-level cache
    // for the entire run - that's what OOM-crashed the backend on an earlier
    // attempt at syncing ~10,000 hotels in one call. Scoping the transaction
    // (and the persistence context with it) to one 100-hotel batch keeps
    // memory use bounded no matter how many total hotels a job processes.
    public int syncHotelContentBatch(List<String> tjHotelIds) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Integer count = tx.execute(status -> {
            int synced = syncHotelContent(tjHotelIds);
            entityManager.flush();
            entityManager.clear();
            return synced;
        });
        return count == null ? 0 : count;
    }

    // Admin cleanup - a full country sync (see HotelSyncJobRunner.
    // startCountrySync) pulls in every city TripJack has for that country,
    // most of which nobody searches for. Trims the catalog down to just the
    // listed cities, keeping the rest of the country's search results from
    // being cluttered with places nobody's asked for.
    @Transactional
    public int pruneCountryToCities(String countryName, List<String> keepCities) {
        List<String> keepCitiesUpper = keepCities.stream().map(String::toUpperCase).toList();
        return hotelRepository.deleteByCountryNameExceptCities(countryName, keepCitiesUpper);
    }

    // Pages fetch-hotel-mapping with whatever filter (countryName or
    // regionIds) the caller puts on the payload, collecting every mapped
    // tjHotelId. Cheap memory-wise (just strings) even for a whole country -
    // the OOM risk is entirely in the content-fetch/save phase, handled by
    // syncHotelContentBatch above.
    List<String> collectMappedIds(Consumer<ObjectNode> payloadFilter, int maxPages) {
        List<String> allIds = new ArrayList<>();
        int page = 0;
        while (page < maxPages) {
            ObjectNode mappingPayload = objectMapper.createObjectNode();
            payloadFilter.accept(mappingPayload);
            mappingPayload.put("page", page);
            mappingPayload.put("size", 2000);

            JsonNode mappingResponse = hotelService.hotelMapping(mappingPayload);
            JsonNode hotels = mappingResponse.path("hotels");
            if (!hotels.isArray() || hotels.isEmpty()) {
                break;
            }
            for (JsonNode h : hotels) {
                String id = h.path("tjHotelId").asText(null);
                if (id != null) {
                    allIds.add(id);
                }
            }

            int totalPages = mappingResponse.path("pageable").path("totalPages").asInt(1);
            page++;
            if (page >= totalPages) {
                break;
            }
        }
        return allIds;
    }

    // Cursor-paginated collection for the NEW/UPDATE/DELETE mapping-sync
    // feeds (see HotelSyncJobRunner.refreshGlobalDelta) - unlike
    // collectMappedIds (page-number based, needs a city/country filter),
    // these need no location filter at all: they return every tjHotelId
    // that's new/changed/deleted globally since lastUpdateTime. Returns
    // both the collected ids and whether maxPages was hit before the cursor
    // ran out, so the caller can tell a full result from a truncated one.
    record SyncPage(List<String> ids, boolean truncated) {}

    SyncPage collectSyncIds(String type, String lastUpdateTimeIso, int maxPages) {
        List<String> ids = new ArrayList<>();
        String cursor = null;
        boolean truncated = false;
        for (int page = 0; page < maxPages; page++) {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("type", type);
            payload.put("lastUpdateTime", lastUpdateTimeIso);
            if (cursor != null) {
                payload.put("cursor", cursor);
            }

            JsonNode response = "DELETE".equals(type)
                    ? hotelService.deletedHotelMappingSync(payload)
                    : hotelService.hotelMappingSync(payload);

            JsonNode hotels = response.path("hotels");
            if (!hotels.isArray() || hotels.isEmpty()) {
                break;
            }
            for (JsonNode h : hotels) {
                String id = h.path("tjHotelId").asText(null);
                if (id != null) {
                    ids.add(id);
                }
            }

            cursor = response.path("nextCursor").asText(null);
            if (cursor == null || cursor.isBlank()) {
                break;
            }
            if (page == maxPages - 1) {
                truncated = true;
            }
        }
        return new SyncPage(ids, truncated);
    }

    // Bulk-remove hotels TripJack has delisted (see fetch-deleted-hotel-mapping).
    @Transactional
    public void deleteHotelsByTjHotelIds(List<String> tjHotelIds) {
        if (tjHotelIds == null || tjHotelIds.isEmpty()) {
            return;
        }
        hotelRepository.deleteAllByIdInBatch(tjHotelIds);
    }

    // fetch-city-regionIds has no name filter (per TripJack's docs) - the
    // only way to find one city's regionId is to page through the full
    // global list (2000 records/page) looking for an exact, case-insensitive
    // cityName match. Capped at maxLookupPages so an unmatched/misspelled
    // city name doesn't scan indefinitely; stops as soon as a page yields at
    // least one match (a given city name is expected to appear together on
    // one page, not scattered across the whole list).
    List<Long> findRegionIds(String cityName, int maxLookupPages) {
        List<Long> matches = new ArrayList<>();
        String cursor = null;
        for (int i = 0; i < maxLookupPages; i++) {
            JsonNode response = hotelService.cityRegionIds(2000, cursor);
            for (JsonNode entry : response.path("hotelCityRegionIds")) {
                if (cityName.equalsIgnoreCase(entry.path("cityName").asText())) {
                    matches.add(entry.path("cityRegionId").asLong());
                }
            }
            if (!matches.isEmpty()) {
                break;
            }
            if (!response.path("hasMore").asBoolean(false)) {
                break;
            }
            cursor = response.path("nextCursor").asText(null);
            if (cursor == null) {
                break;
            }
        }
        return matches;
    }

    // Used only for the bulk catalog sync - builds the same Hotel object as
    // mapToHotel but strips the heavy content fields (full image gallery,
    // full amenities list, descriptions, policies) before it's persisted.
    // Those fields still exist on the entity/table (fetchLiveContent's
    // non-persisted results use them), they're just deliberately left null
    // by the bulk sync path.
    private Hotel mapToHotelForCatalog(JsonNode node) {
        Hotel hotel = mapToHotel(node);
        hotel.setImagesJson(null);
        hotel.setAmenitiesJson(null);
        hotel.setDescriptionsJson(null);
        hotel.setPoliciesJson(null);
        return hotel;
    }

    private Hotel mapToHotel(JsonNode node) {
        String tjHotelId = node.path("tjHotelId").asText();
        Hotel hotel = hotelRepository.findById(tjHotelId).orElse(new Hotel());
        hotel.setTjHotelId(tjHotelId);
        hotel.setUnicaId(node.path("unicaId").asText(null));
        hotel.setName(node.path("name").asText(null));
        hotel.setIsActive(node.path("is_active").asBoolean(true));
        hotel.setStarRating(node.path("star_rating").asText(null));
        hotel.setPropertyType(node.path("property_type").path("name").asText(null));

        JsonNode address = node.path("locale").path("address");
        hotel.setAddressLine1(address.path("line_1").asText(null));
        hotel.setAddressLine2(address.path("line_2").asText(null));
        hotel.setFullAddress(address.path("fulladdr").asText(null));
        hotel.setCity(address.path("city").asText(null));
        hotel.setCityCode(address.path("citycode").asText(null));
        hotel.setState(address.path("statename").asText(null));
        hotel.setCountryName(address.path("countryname").asText(null));
        hotel.setCountryCode(address.path("countrycode").asText(null));
        hotel.setPostalCode(address.path("postal_code").asText(null));

        JsonNode coordinates = node.path("locale").path("coordinates");
        hotel.setLatitude(coordinates.hasNonNull("lat") ? coordinates.get("lat").asDouble() : null);
        hotel.setLongitude(coordinates.hasNonNull("long") ? coordinates.get("long").asDouble() : null);

        String heroImageUrl = null;
        for (JsonNode image : node.path("images")) {
            if (image.path("is_hero_image").asBoolean(false)) {
                heroImageUrl = firstImageLinkHref(image.path("links"));
                break;
            }
        }
        // Fall back to the first image if none is flagged as hero - some
        // hotels' content has no is_hero_image:true entry at all.
        if (heroImageUrl == null && node.path("images").size() > 0) {
            heroImageUrl = firstImageLinkHref(node.path("images").get(0).path("links"));
        }
        hotel.setHeroImageUrl(heroImageUrl);

        hotel.setImagesJson(node.path("images").toString());
        hotel.setAmenitiesJson(node.path("amenities").toString());
        hotel.setDescriptionsJson(node.path("descriptions").toString());
        hotel.setPoliciesJson(node.path("policies").toString());
        hotel.setSyncedAt(LocalDateTime.now());

        return hotel;
    }

    // images[].links is a dict keyed by size (Standard, XXL, ...) - not every
    // hotel's content has a "Standard" entry, so prefer it but fall back to
    // whichever size is actually present rather than silently returning null.
    private String firstImageLinkHref(JsonNode links) {
        if (links.hasNonNull("Standard")) {
            return links.path("Standard").path("href").asText(null);
        }
        if (links.fields().hasNext()) {
            return links.fields().next().getValue().path("href").asText(null);
        }
        return null;
    }
}
