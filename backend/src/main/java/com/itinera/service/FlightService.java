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

    // Post-booking ancillaries - only callable once a booking is SUCCESS.
    public JsonNode fetchAncillarySsr(JsonNode payload) {
        return tripJackClient.post("/fms/v1/ancillaries/fetch/ssr", payload);
    }

    public JsonNode fetchAncillarySeat(JsonNode payload) {
        return tripJackClient.post("/fms/v1/ancillaries/fetch/seat", payload);
    }

    public JsonNode addAncillarySsr(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/amendment/add/ssr", payload);
    }

    // Auto Reissue - reschedules one trip of an already-ticketed booking to a
    // new date. Only one trip can be reissued at a time (partial reissue is
    // supported for multi-trip bookings), and a booking can only be reissued
    // once ever, per TripJack's docs.
    public JsonNode reissueSearchQueryList(JsonNode payload) {
        return tripJackClient.post("/fms/v1/reissue/poll/searchquery-list", payload);
    }

    public JsonNode reissueSearch(JsonNode payload) {
        return tripJackClient.post("/fms/v1/reissue/poll/search", payload);
    }

    public JsonNode reissueReview(JsonNode payload) {
        return tripJackClient.post("/fms/v1/reissue/review", payload);
    }

    public JsonNode reissueBook(JsonNode payload) {
        return tripJackClient.post("/oms/v1/air/amendment/auto-reissue", payload);
    }

    public JsonNode userBalance() {
        return tripJackClient.get("/ums/v1/user-detail");
    }
}
