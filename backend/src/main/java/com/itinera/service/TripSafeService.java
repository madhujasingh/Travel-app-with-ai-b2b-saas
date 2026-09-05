package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

// TripJack TripSafe (travel insurance) API - UAT/certification only for now
// (see TripJackClient.postTripSafe, always authenticated with
// tripjack.test-api-key, never the production key flights/hotels/activities
// use). Thin passthrough, same convention as CabsService - request/response
// shapes are TripJack's own JSON as documented in
// tripsafe-api/01-search-api.txt through 09-amt-api-integration.txt.
//
// Only the Standalone journey type's 6 core endpoints are wired here.
// Student/AMT/Embedded are additive request-field variants of the SAME
// endpoints (see tripsafe-api/08-student-api-integration.txt and
// 09-amt-api-integration.txt) and don't need separate service methods -
// the frontend can pass the extra fields (ict/cd/sc/etc.) straight through
// in the same request bodies.
@Service
public class TripSafeService {

    private final TripJackClient tripJackClient;

    public TripSafeService(TripJackClient tripJackClient) {
        this.tripJackClient = tripJackClient;
    }

    public JsonNode search(JsonNode payload) {
        return tripJackClient.postTripSafe("/insurance/v1/searchquery-list", payload);
    }

    public JsonNode review(JsonNode payload) {
        return tripJackClient.postTripSafe("/insurance/v1/review", payload);
    }

    public JsonNode book(JsonNode payload) {
        return tripJackClient.postTripSafe("/oms/v1/insurance/book", payload);
    }

    public JsonNode bookingDetails(JsonNode payload) {
        return tripJackClient.postTripSafe("/oms/v1/insurance/booking-details", payload);
    }

    // Step 1 of the two-step cancel flow - preview only, does not cancel.
    public JsonNode raiseAmendment(JsonNode payload) {
        return tripJackClient.postTripSafe("/oms/v1/ins/amendment/raise", payload);
    }

    // Step 2 - confirms/finalizes the cancellation using the amendmentId
    // returned by raiseAmendment above.
    public JsonNode confirmCancellation(JsonNode payload) {
        return tripJackClient.postTripSafe("/oms/v1/ins/amendment/confirm-insurance-cancellation", payload);
    }
}
