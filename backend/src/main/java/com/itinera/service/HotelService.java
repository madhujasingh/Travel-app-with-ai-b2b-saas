package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.repository.HotelRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriBuilder;

@Service
public class HotelService {

    private final TripJackClient tripJackClient;
    private final HotelRepository hotelRepository;

    public HotelService(TripJackClient tripJackClient, HotelRepository hotelRepository) {
        this.tripJackClient = tripJackClient;
        this.hotelRepository = hotelRepository;
    }

    // Same host as flights (apitest.tripjack.com), despite the /hms/v3 path.
    public JsonNode nationalities() {
        return tripJackClient.get("/hms/v3/nationality-info");
    }

    public JsonNode countries() {
        return tripJackClient.getHotel("/hms/v3/content/fetch-countries");
    }

    // regionIds from here feed into hotelMapping() to look up hotels by city.
    public JsonNode cityRegionIds(int limit, String cursor) {
        return tripJackClient.getHotel(uriBuilder -> {
            UriBuilder builder = uriBuilder.path("/hms/v3/content/fetch-city-regionIds").queryParam("limit", limit);
            if (StringUtils.hasText(cursor)) {
                builder = builder.queryParam("cursor", cursor);
            }
            return builder.build();
        });
    }

    // Maps tjHotelId/unicaId by countryName or regionIds (city region IDs).
    public JsonNode hotelMapping(JsonNode payload) {
        return tripJackClient.postHotel("/hms/v3/content/fetch-hotel-mapping", payload);
    }

    // Batched static content (name, images, rating, address) for up to 100 hotelIds.
    public JsonNode hotelContent(JsonNode payload) {
        return tripJackClient.postHotel("/hms/v3/content/fetch-hotel-content", payload);
    }

    // Same host as flights/nationalities (apitest.tripjack.com, not the v3
    // hotel-content host) despite the /hms/v3 path - a "what's new or
    // changed" delta feed (lastUpdateTime) that returns tjHotelId directly,
    // unlike its older v1 counterpart which only gave unicaId. TripJack's
    // own docs recommend syncing this every 7 days.
    public JsonNode fetchStaticHotels(JsonNode payload) {
        return tripJackClient.post("/hms/v3/fetch-static-hotels", payload);
    }

    // Step 1 - Listing: search criteria in, hotel list with cheapest rate each.
    // TripJack's dynamic Listing response never includes photos, star rating,
    // address, coordinates, or property type - by their own documented
    // schema, that's static content only, fetched separately and cached in
    // our own `hotels` table (see HotelCatalogService). Enrich each result
    // here by hotelId so every consumer of this endpoint gets it without
    // needing its own extra round-trip per hotel (the customer-facing
    // star-rating/property-type filters, map view, and locality-on-card
    // display all depend on this).
    public JsonNode listing(JsonNode payload) {
        JsonNode response = tripJackClient.postHotel("/hms/v3/hotel/listing", payload);
        JsonNode hotels = response.get("hotels");
        if (hotels != null && hotels.isArray()) {
            for (JsonNode hotelNode : hotels) {
                if (!(hotelNode instanceof ObjectNode) || !hotelNode.hasNonNull("hotelId")) {
                    continue;
                }
                String hotelId = hotelNode.get("hotelId").asText();
                hotelRepository.findById(hotelId).ifPresent(hotel -> {
                    ObjectNode node = (ObjectNode) hotelNode;
                    if (StringUtils.hasText(hotel.getHeroImageUrl())) {
                        node.put("heroImageUrl", hotel.getHeroImageUrl());
                    }
                    if (StringUtils.hasText(hotel.getStarRating())) {
                        node.put("starRating", hotel.getStarRating());
                    }
                    if (StringUtils.hasText(hotel.getCity())) {
                        node.put("city", hotel.getCity());
                    }
                    if (hotel.getLatitude() != null && hotel.getLongitude() != null) {
                        node.put("latitude", hotel.getLatitude());
                        node.put("longitude", hotel.getLongitude());
                    }
                    if (StringUtils.hasText(hotel.getPropertyType())) {
                        node.put("propertyType", hotel.getPropertyType());
                    }
                });
            }
        }
        return response;
    }

    // Step 2 - Detail (Dynamic Pricing): all bookable options for one hotel.
    public JsonNode detail(JsonNode payload) {
        return tripJackClient.postHotel("/hms/v3/hotel/pricing", payload);
    }

    // Step 3 - Review: re-validates price + availability immediately before Book.
    // Must be called with the same correlationId as Listing/Detail, and immediately
    // before Book - the resulting bookingId's window is shorter than the search session.
    public JsonNode review(JsonNode payload) {
        return tripJackClient.postHotel("/hms/v3/hotel/review", payload);
    }

    // Static (non-real-time) property metadata: location, images, amenities, policies.
    // Cacheable for up to 24h - not part of the booking flow itself.
    public JsonNode staticDetail(JsonNode payload) {
        return tripJackClient.postHotel("/hms/v3/hotel/static-detail", payload);
    }

    // Step 4 - Book: instant (paymentInfos present) or hold (paymentInfos omitted) -
    // same endpoint either way. Uses the bookingId from Review.
    public JsonNode book(JsonNode payload) {
        return tripJackClient.postHotelBooker("/oms/v3/hotel/book", payload);
    }

    // Confirms a held booking before its ddt (deadline) deadline.
    public JsonNode confirmBook(JsonNode payload) {
        return tripJackClient.postHotelBooker("/oms/v3/hotel/confirm-book", payload);
    }

    // Poll after Book (every 5s, up to 180s) until a terminal status is reached.
    public JsonNode bookingDetails(JsonNode payload) {
        return tripJackClient.postHotelBooker("/oms/v3/hotel/booking-details", payload);
    }

    public JsonNode cancelBooking(String bookingId) {
        return tripJackClient.postHotelBookerNoBody("/oms/v3/hotel/cancel-booking/{bookingId}", bookingId);
    }
}
