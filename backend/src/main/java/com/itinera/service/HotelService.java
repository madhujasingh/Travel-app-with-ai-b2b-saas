package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriBuilder;

@Service
public class HotelService {

    private final TripJackClient tripJackClient;

    public HotelService(TripJackClient tripJackClient) {
        this.tripJackClient = tripJackClient;
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

    // Step 1 - Listing: search criteria in, hotel list with cheapest rate each.
    public JsonNode listing(JsonNode payload) {
        return tripJackClient.postHotel("/hms/v3/hotel/listing", payload);
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

    // --- v1 (legacy) hotel API - same hosts as v3, different paths. This is the
    // version proven to have live inventory on this account (see hotel-sample-logs
    // and hotel-v2/v2-doc.md), kept as a fallback while v3 dynamic search/pricing
    // returns no results for every hotel ID tested. ---

    public JsonNode searchV1(JsonNode payload) {
        return tripJackClient.post("/hms/v1/hotel-searchquery-list", payload);
    }

    public JsonNode detailSearchV1(JsonNode payload) {
        return tripJackClient.post("/hms/v1/hotelDetail-search", payload);
    }

    public JsonNode cancellationPolicyV1(JsonNode payload) {
        return tripJackClient.post("/hms/v1/hotel-cancellation-policy", payload);
    }

    public JsonNode reviewV1(JsonNode payload) {
        return tripJackClient.post("/hms/v1/hotel-review", payload);
    }

    public JsonNode bookV1(JsonNode payload) {
        return tripJackClient.postHotelBooker("/oms/v1/hotel/book", payload);
    }

    public JsonNode confirmBookV1(JsonNode payload) {
        return tripJackClient.postHotelBooker("/oms/v1/hotel/confirm-book", payload);
    }

    public JsonNode bookingDetailsV1(JsonNode payload) {
        return tripJackClient.postHotelBooker("/oms/v1/hotel/booking-details", payload);
    }

    public JsonNode cancelBookingV1(String bookingId) {
        return tripJackClient.postHotelBookerNoBody("/oms/v1/hotel/cancel-booking/{bookingId}", bookingId);
    }

    // v1's own static catalog - a source of real hids that v1 Search actually
    // recognizes (v1 and v3 hotel IDs appear to be different ID spaces).
    public JsonNode fetchStaticHotelsV1(JsonNode payload) {
        return tripJackClient.post("/hms/v1/fetch-static-hotels", payload);
    }
}
