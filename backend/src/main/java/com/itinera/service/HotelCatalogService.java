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
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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

    public HotelCatalogService(
            HotelService hotelService,
            HotelRepository hotelRepository,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager,
            EntityManager entityManager
    ) {
        this.hotelService = hotelService;
        this.hotelRepository = hotelRepository;
        this.objectMapper = objectMapper;
        this.transactionManager = transactionManager;
        this.entityManager = entityManager;
    }

    // fetch-hotel-content: up to 100 hotel IDs per call (TripJack's own
    // limit - passing more returns a 400).
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
            hotelRepository.save(mapToHotel(hotelNode));
            count++;
        }
        return count;
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
