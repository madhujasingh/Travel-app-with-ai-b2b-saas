package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

// HotelBeds/HBX Group Activities API - separate provider from TripJack
// (see ActivitiesClient/ActivitiesConfig).
@Service
public class ActivitiesService {

    private final ActivitiesClient activitiesClient;

    public ActivitiesService(ActivitiesClient activitiesClient) {
        this.activitiesClient = activitiesClient;
    }

    // POST /activity-api/3.0/activities/availability - filters (destination/
    // hotel/GPS/factsheet/segment/priceRange/text), from/to dates, paxes,
    // language, pagination, order. See the Availability doc for the full
    // filter-combination rules.
    public JsonNode search(JsonNode payload) {
        return activitiesClient.post("/activity-api/3.0/activities/availability", payload);
    }

    // POST /activity-api/3.0/activities/details - {code, from, to, language,
    // paxes}. IMPORTANT: `code` must be the search response's
    // `activities[].content.activityCode` (e.g. "E-E10-A1AANO0488"), NOT the
    // top-level `activities[].activityCode` (e.g. "A1AANO0488") - the two
    // are different identifiers and only the content one resolves here
    // (confirmed live; the top-level one 400s with E_ACTIVITYDETAIL_NOTFOUND).
    // Returns rateKeys (valid 30 min) needed to confirm a booking.
    public JsonNode detail(JsonNode payload) {
        return activitiesClient.post("/activity-api/3.0/activities/details", payload);
    }

    // Same as detail() but the full contents factsheet - POST
    // /activity-api/3.0/activities/details/full. Same `code` caveat applies.
    public JsonNode detailFull(JsonNode payload) {
        return activitiesClient.post("/activity-api/3.0/activities/details/full", payload);
    }

    // PUT /activity-api/3.0/bookings - single-step confirm. Unlike TripJack's
    // hotel/flight booking, there's no paymentInfos/amount in this request at
    // all - HotelBeds bills against the agency account directly, so there's
    // no payment-gateway dependency blocking this the way there was for
    // hotels. rateKey (from detail(), valid 30 min) identifies what's being
    // booked.
    public JsonNode confirmBooking(JsonNode payload) {
        return activitiesClient.put("/activity-api/3.0/bookings", payload);
    }

    // Two-step alternative to confirmBooking(), for when a payment gateway
    // needs to sit in between (preconfirm locks stock for 30 min, reconfirm
    // finalizes after payment succeeds). Not currently used by the frontend -
    // confirmBooking() covers the account-billed flow we actually need.
    public JsonNode preconfirmBooking(JsonNode payload) {
        return activitiesClient.put("/activity-api/3.0/bookings/preconfirm", payload);
    }

    public JsonNode reconfirmBooking(JsonNode payload) {
        return activitiesClient.put("/activity-api/3.0/bookings/reconfirm", payload);
    }

    // GET /activity-api/3.0/bookings/{language}/{reference} - status +
    // full booking info, same shape as the confirm response.
    public JsonNode bookingDetail(String language, String reference) {
        return activitiesClient.get("/activity-api/3.0/bookings/" + language + "/" + reference);
    }

    // DELETE /activity-api/3.0/bookings/{language}/{reference}?cancellationFlag=X
    // - cancellationFlag must be "SIMULATION" (preview charges, no-op) or
    // "CANCELLATION" (actually cancels). Always simulate first in the UI.
    public JsonNode cancelBooking(String language, String reference, String cancellationFlag) {
        return activitiesClient.delete(
                "/activity-api/3.0/bookings/" + language + "/" + reference + "?cancellationFlag=" + cancellationFlag
        );
    }

    // Content API (activity-content-api/3.0) - separate base path from the
    // booking product above, but same host/credentials. Static reference
    // data (countries/destinations) that powers the search form's picker,
    // so customers pick a real destination instead of typing a raw code.
    public JsonNode countries(String language) {
        return activitiesClient.get("/activity-content-api/3.0/countries/" + language);
    }

    public JsonNode destinations(String language, String countryCode) {
        return activitiesClient.get("/activity-content-api/3.0/destinations/" + language + "/" + countryCode);
    }
}
