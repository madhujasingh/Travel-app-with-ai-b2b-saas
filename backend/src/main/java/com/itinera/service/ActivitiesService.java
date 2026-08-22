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
}
