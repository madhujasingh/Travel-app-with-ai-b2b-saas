package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.TripSafeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// UAT/certification only - see TripSafeService/TripJackClient. All endpoints
// require auth (see SecurityConfig's /tripsafe/** catch-all) since even
// discovery calls (search) run against a test key still tied to a real
// TripJack account.
@RestController
@RequestMapping("/tripsafe")
public class TripSafeController {

    private final TripSafeService tripSafeService;

    public TripSafeController(TripSafeService tripSafeService) {
        this.tripSafeService = tripSafeService;
    }

    @PostMapping("/search")
    public ResponseEntity<JsonNode> search(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(tripSafeService.search(payload));
    }

    @PostMapping("/review")
    public ResponseEntity<JsonNode> review(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(tripSafeService.review(payload));
    }

    @PostMapping("/book")
    public ResponseEntity<JsonNode> book(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(tripSafeService.book(payload));
    }

    @PostMapping("/booking-details")
    public ResponseEntity<JsonNode> bookingDetails(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(tripSafeService.bookingDetails(payload));
    }

    @PostMapping("/amendment/raise")
    public ResponseEntity<JsonNode> raiseAmendment(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(tripSafeService.raiseAmendment(payload));
    }

    @PostMapping("/amendment/cancel")
    public ResponseEntity<JsonNode> confirmCancellation(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(tripSafeService.confirmCancellation(payload));
    }
}
