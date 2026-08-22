package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.ActivitiesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Passthrough to HotelBeds/HBX Group's Activities API (see ActivitiesService)
// - a separate provider from TripJack (flights/hotels).
@RestController
@RequestMapping("/activities")
public class ActivitiesController {

    private final ActivitiesService activitiesService;

    public ActivitiesController(ActivitiesService activitiesService) {
        this.activitiesService = activitiesService;
    }

    // Public (see SecurityConfig) - same reasoning as hotel/flight search:
    // pre-booking discovery, no PII or money involved.
    @PostMapping("/search")
    public ResponseEntity<JsonNode> search(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(activitiesService.search(payload));
    }
}
