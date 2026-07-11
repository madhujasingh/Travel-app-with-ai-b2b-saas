package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

@Service
public class HotelService {

    private final TripJackClient tripJackClient;

    public HotelService(TripJackClient tripJackClient) {
        this.tripJackClient = tripJackClient;
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
}
