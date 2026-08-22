package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

// HotelBeds/HBX Group Activities API - separate provider from TripJack
// (see ActivitiesClient/ActivitiesConfig). Only the v3 search/availability
// call is wired up so far; detail, pickups, and booking/cancel come once
// their exact request/response shapes are confirmed against the current
// (v3) product rather than the older activity-booking-api/1.0 spec.
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
}
