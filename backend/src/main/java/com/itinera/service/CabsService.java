package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

// TripJack Cabs API - UAT/certification only for now (see TripJackClient's
// postCabs/getCabs, always authenticated with tripjack.test-api-key, never
// the production key flights/hotels/activities use). Thin passthrough, same
// convention as FlightService/HotelService - request/response shapes are
// TripJack's own JSON as documented in cabs-api/cab-api-doc.txt.
@Service
public class CabsService {

    private final TripJackClient tripJackClient;

    public CabsService(TripJackClient tripJackClient) {
        this.tripJackClient = tripJackClient;
    }

    public JsonNode locationSearch(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v1/google-places", payload);
    }

    public JsonNode latLong(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v1/get-lat-long", payload);
    }

    // Same endpoint for airport transfer / outstation / local, and for
    // oneway / roundtrip - the caller controls which via journeyType/tripType
    // in the payload (see doc sections 3.1-3.4).
    public JsonNode quotes(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v2/quotes", payload);
    }

    public JsonNode book(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v2/booking", payload);
    }

    // Books a cab tied to an existing successful flight booking
    // (sourceBookingId) in a single request - same booking endpoint
    // semantics, different path.
    public JsonNode embeddedBook(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v2/embedded/booking", payload);
    }

    // bookingIds is a query param per the doc
    // ("cabs/v1/booking/details?bookingIds=..."), not a path segment or body.
    public JsonNode bookingDetails(String bookingIds) {
        return tripJackClient.getCabs(uriBuilder -> uriBuilder
                .path("/cabs/v1/booking/details")
                .queryParam("bookingIds", bookingIds)
                .build());
    }

    public JsonNode payment(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v1/payment/create", payload);
    }

    // GET despite "charges" in the name - previews the refund/charge amounts
    // before actually cancelling (see amendmentCancel below).
    public JsonNode amendmentCharges(String bookingId, String type) {
        return tripJackClient.getCabs(uriBuilder -> uriBuilder
                .path("/cabs/v1/amendment")
                .queryParam("bookingId", bookingId)
                .queryParam("type", type)
                .build());
    }

    // Doc: "In Amendments, only Cancellation Allowed" - same path as
    // amendmentCharges above but POST, and takes the cancellation as a body
    // instead of query params.
    public JsonNode amendmentCancel(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v1/amendment", payload);
    }
}
