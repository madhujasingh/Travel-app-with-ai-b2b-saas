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
}
