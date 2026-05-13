package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.FlightService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/flights")
public class FlightController {

    private final FlightService flightService;

    public FlightController(FlightService flightService) {
        this.flightService = flightService;
    }

    @PostMapping("/search")
    public ResponseEntity<JsonNode> searchFlights(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.searchFlights(payload));
    }
}
