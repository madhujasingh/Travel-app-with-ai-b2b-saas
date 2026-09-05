package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.config.TripJackConfig;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

// TripJack Cabs API - UAT/certification only for now (see TripJackClient's
// postCabs/getCabs, always authenticated with tripjack.test-api-key, never
// the production key flights/hotels/activities use). Thin passthrough, same
// convention as FlightService/HotelService - request/response shapes are
// TripJack's own JSON as documented in cabs-api/cab-api-doc.txt.
@Service
public class CabsService {

    private final TripJackClient tripJackClient;
    private final TripJackConfig tripJackConfig;

    public CabsService(TripJackClient tripJackClient, TripJackConfig tripJackConfig) {
        this.tripJackClient = tripJackClient;
        this.tripJackConfig = tripJackConfig;
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

    // "agentId" is mandatory on every real Book request (confirmed live:
    // TripJack 400s with "agentId: Agent id is mandatory" without it) but is
    // account-level config, not something the customer/frontend supplies -
    // injected here server-side, same account-config-stays-on-the-backend
    // principle as the API key itself.
    public JsonNode book(JsonNode payload) {
        return tripJackClient.postCabs("/cabs/v2/booking", withAgentId(payload));
    }

    private JsonNode withAgentId(JsonNode payload) {
        if (!StringUtils.hasText(tripJackConfig.getCabsAgentId())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TripJack Cabs agent id is not configured");
        }
        if (payload instanceof ObjectNode objectNode) {
            objectNode.put("agentId", Long.parseLong(tripJackConfig.getCabsAgentId()));
        }
        return payload;
    }

    // Books a cab tied to an existing successful flight booking
    // (sourceBookingId) in a single request - same booking endpoint
    // semantics, different path. Not yet used by any frontend flow; if it
    // is, this needs the same agentId fix as book() above, but nested inside
    // each bookingRequestList[] item instead of at the top level (see the
    // doc's Embedded API sample) - not done here since nothing exercises it.
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
