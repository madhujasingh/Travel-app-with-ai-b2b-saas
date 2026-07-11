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
}
