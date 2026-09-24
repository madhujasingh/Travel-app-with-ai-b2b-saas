package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.config.TripJackConfig;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

// TripJack Cabs API - certified and LIVE (2026-09) on the production key via
// TripJackClient's postCabsLive/getCabsLive (real money, real customer
// bookings). Thin passthrough, same convention as FlightService/HotelService
// - request/response shapes are TripJack's own JSON as documented in
// cabs-api/cab-api-doc.txt.
@Service
public class CabsService {

    private final TripJackClient tripJackClient;
    private final TripJackConfig tripJackConfig;

    public CabsService(TripJackClient tripJackClient, TripJackConfig tripJackConfig) {
        this.tripJackClient = tripJackClient;
        this.tripJackConfig = tripJackConfig;
    }

    public JsonNode locationSearch(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v1/google-places", payload);
    }

    public JsonNode latLong(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v1/get-lat-long", payload);
    }

    // Same endpoint for airport transfer / outstation / local, and for
    // oneway / roundtrip - the caller controls which via journeyType/tripType
    // in the payload (see doc sections 3.1-3.4).
    public JsonNode quotes(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v2/quotes", payload);
    }

    // "agentId" is mandatory on every real Book request (confirmed live:
    // TripJack 400s with "agentId: Agent id is mandatory" without it) but is
    // account-level config, not something the customer/frontend supplies -
    // injected here server-side, same account-config-stays-on-the-backend
    // principle as the API key itself.
    public JsonNode book(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v2/booking", withAgentId(payload));
    }

    private JsonNode withAgentId(JsonNode payload) {
        if (!StringUtils.hasText(tripJackConfig.getCabsProdAgentId())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TripJack Cabs agent id is not configured");
        }
        if (payload instanceof ObjectNode objectNode) {
            objectNode.put("agentId", Long.parseLong(tripJackConfig.getCabsProdAgentId()));
        }
        return payload;
    }

    // Books a cab tied to an existing successful flight booking
    // (sourceBookingId) in a single request - same booking endpoint
    // semantics, different path.
    public JsonNode embeddedBook(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v2/embedded/booking", withAgentIdInEmbeddedList(payload));
    }

    // Embedded Book nests each individual booking request inside
    // bookingRequestList[] (unlike plain Book, which is a single flat
    // object) - agentId goes on each entry there, per the doc's own sample
    // payload, not at the top level like plain book()'s withAgentId() above.
    private JsonNode withAgentIdInEmbeddedList(JsonNode payload) {
        if (!StringUtils.hasText(tripJackConfig.getCabsProdAgentId())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TripJack Cabs agent id is not configured");
        }
        if (payload instanceof ObjectNode objectNode && objectNode.get("bookingRequestList") instanceof ArrayNode list) {
            long agentId = Long.parseLong(tripJackConfig.getCabsProdAgentId());
            list.forEach(node -> {
                if (node instanceof ObjectNode entry) {
                    entry.put("agentId", agentId);
                }
            });
        }
        return payload;
    }

    // bookingIds is a query param per the doc
    // ("cabs/v1/booking/details?bookingIds=..."), not a path segment or body.
    public JsonNode bookingDetails(String bookingIds) {
        return tripJackClient.getCabsLive(uriBuilder -> uriBuilder
                .path("/cabs/v1/booking/details")
                .queryParam("bookingIds", bookingIds)
                .build());
    }

    public JsonNode payment(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v1/payment/create", payload);
    }

    // Authoritative "how much do I actually pay" for a booking. Confirmed
    // live: a ROUNDTRIP creates TWO bookings (the response carries both
    // onwardBookingId and returnBookingId) and the Book response's own
    // "totalPrice" only reports ONE leg - paying that is rejected with
    // "Net Payable Amount is <full>". This endpoint returns the correct
    // combined amountPayable for both one-way (returnBookingId null) and
    // roundtrip. Present in TripJack's own Postman collection but absent
    // from the PDF, which is why it was missed initially.
    // Returns the payment modes available for a booking, each carrying the
    // wallet's own userId and current balance. Two uses: (1) the wallet
    // userId is the authoritative value for Create Payment's "payUserId"
    // (the doc's own comment says "userId from Payment Modes API"), and
    // (2) it surfaces the Cabs wallet balance, which no other endpoint in
    // the Cabs API exposes. Also absent from the PDF, found in TripJack's
    // Postman collection.
    public JsonNode paymentModes(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v1/payment/payment-modes", payload);
    }

    public JsonNode paymentSummary(String bookingId) {
        return tripJackClient.getCabsLive(uriBuilder -> uriBuilder
                .path("/cabs/v1/payment/summary/{bookingId}")
                .build(bookingId));
    }

    // GET despite "charges" in the name - previews the refund/charge amounts
    // before actually cancelling (see amendmentCancel below).
    public JsonNode amendmentCharges(String bookingId, String type) {
        return tripJackClient.getCabsLive(uriBuilder -> uriBuilder
                .path("/cabs/v1/amendment")
                .queryParam("bookingId", bookingId)
                .queryParam("type", type)
                .build());
    }

    // Doc: "In Amendments, only Cancellation Allowed" - same path as
    // amendmentCharges above but POST, and takes the cancellation as a body
    // instead of query params.
    public JsonNode amendmentCancel(JsonNode payload) {
        return tripJackClient.postCabsLive("/cabs/v1/amendment", payload);
    }
}
