package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.model.Hotel;
import com.itinera.repository.HotelRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

// Downloads TripJack's V3 Hotel Static Content (fetch-hotel-mapping +
// fetch-hotel-content) into our own `hotels` table, per TripJack support's
// instructions. This is entirely separate from the dynamic pricing layer
// (Listing/Detail, which returns zero results for this sandbox key
// regardless - see project memory) - static content sync doesn't affect
// that, it's only what lets us know which hotel IDs exist so a search UI has
// something to query Listing/Detail with in the first place.
@Service
public class HotelCatalogService {

    private final HotelService hotelService;
    private final HotelRepository hotelRepository;
    private final ObjectMapper objectMapper;

    public HotelCatalogService(HotelService hotelService, HotelRepository hotelRepository, ObjectMapper objectMapper) {
        this.hotelService = hotelService;
        this.hotelRepository = hotelRepository;
        this.objectMapper = objectMapper;
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

    // fetch-hotel-mapping (paginated, up to 2000/page) followed by batched
    // fetch-hotel-content calls (100 IDs at a time) for every mapped hotel.
    // A full-country sync can be thousands of hotels, and should be
    // triggered deliberately (and probably scheduled/rate-limited) rather
    // than fired off as a side effect of browsing.
    public int syncCountry(String countryName, int maxPages) {
        return mapAndSyncHotels(payload -> payload.put("countryName", countryName), maxPages);
    }

    // City-scoped counterpart to syncCountry - captures every hotel TripJack
    // has mapped for ONE city (via fetch-hotel-mapping's regionIds filter)
    // instead of pulling a whole country's worth just to cover one city.
    // Needed because syncCountry with a low maxPages only captures whatever
    // fraction of a country's hotels happen to sort into that page range -
    // e.g. Ahmedabad had only 38/321 hotels synced this way, while TripJack's
    // own site (querying live) shows all 321.
    public Map<String, Object> syncCity(String cityName, int lookupMaxPages, int mappingMaxPages) {
        List<Long> regionIds = findRegionIds(cityName, lookupMaxPages);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cityName", cityName);
        result.put("regionIds", regionIds);
        if (regionIds.isEmpty()) {
            result.put("found", false);
            result.put("synced", 0);
            return result;
        }

        int synced = mapAndSyncHotels(payload -> {
            ArrayNode regionIdsNode = payload.putArray("regionIds");
            regionIds.forEach(id -> regionIdsNode.add(String.valueOf(id)));
        }, mappingMaxPages);
        result.put("found", true);
        result.put("synced", synced);
        return result;
    }

    // fetch-city-regionIds has no name filter (per TripJack's docs) - the
    // only way to find one city's regionId is to page through the full
    // global list (2000 records/page) looking for an exact, case-insensitive
    // cityName match. Capped at maxLookupPages so an unmatched/misspelled
    // city name doesn't scan indefinitely; stops as soon as a page yields at
    // least one match (a given city name is expected to appear together on
    // one page, not scattered across the whole list).
    private List<Long> findRegionIds(String cityName, int maxLookupPages) {
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

    // Shared by syncCountry/syncCity - pages fetch-hotel-mapping with
    // whatever filter (countryName or regionIds) the caller puts on the
    // payload, then batch-syncs full content (100 IDs/call) for every
    // mapped hotel ID found.
    private int mapAndSyncHotels(Consumer<ObjectNode> payloadFilter, int maxPages) {
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

        int synced = 0;
        for (int i = 0; i < allIds.size(); i += 100) {
            List<String> batch = allIds.subList(i, Math.min(i + 100, allIds.size()));
            synced += syncHotelContent(batch);
        }
        return synced;
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
