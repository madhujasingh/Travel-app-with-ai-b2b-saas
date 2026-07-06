package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

@Service
public class FlightService {

    private final TripJackClient tripJackClient;

    public FlightService(TripJackClient tripJackClient) {
        this.tripJackClient = tripJackClient;
    }

    public JsonNode searchFlights(JsonNode payload) {
        return tripJackClient.post("/fms/v1/air-search-all", payload);
    }

    public JsonNode reviewFlight(JsonNode payload) {
        return tripJackClient.post("/fms/v1/review", payload);
    }

    public JsonNode fareRule(JsonNode payload) {
        return tripJackClient.post("/fms/v2/farerule", payload);
    }

    public JsonNode seatMap(JsonNode payload) {
        return tripJackClient.post("/fms/v1/seat", payload);
    }

    public JsonNode fareValidate(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/book/fare-validate", payload);
    }

    // Same TripJack endpoint for Instant Book and Hold - the caller controls
    // which by including (or omitting) paymentInfos in the payload.
    public JsonNode bookFlight(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/book", payload);
    }

    public JsonNode confirmFareBeforeTicketing(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/fare-validate", payload);
    }

    public JsonNode confirmBook(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/confirm-book", payload);
    }

    // Same TripJack endpoint for plain Booking Detail and Detailed Booking
    // Information - the caller controls which via the requirePaxPricing flag.
    public JsonNode bookingDetails(JsonNode payload) {
        return tripJackClient.post("/oms/v1/booking-details", payload);
    }

    public JsonNode releasePnr(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/unhold", payload);
    }

    public JsonNode amendmentCharges(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/amendment/amendment-charges", payload);
    }

    public JsonNode submitAmendment(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/amendment/submit-amendment", payload);
    }

    public JsonNode amendmentDetails(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/amendment/amendment-details", payload);
    }
}
