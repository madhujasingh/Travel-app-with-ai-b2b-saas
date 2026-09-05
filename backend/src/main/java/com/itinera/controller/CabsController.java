package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.CabsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// UAT/certification only - see CabsService/TripJackClient. All endpoints
// require auth (see SecurityConfig's /cabs/** catch-all) since even
// discovery calls (quotes) run against a test key still tied to a real
// TripJack account.
@RestController
@RequestMapping("/cabs")
public class CabsController {

    private final CabsService cabsService;

    public CabsController(CabsService cabsService) {
        this.cabsService = cabsService;
    }

    @PostMapping("/location-search")
    public ResponseEntity<JsonNode> locationSearch(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(cabsService.locationSearch(payload));
    }

    @PostMapping("/lat-long")
    public ResponseEntity<JsonNode> latLong(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(cabsService.latLong(payload));
    }

    @PostMapping("/quotes")
    public ResponseEntity<JsonNode> quotes(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(cabsService.quotes(payload));
    }

    @PostMapping("/book")
    public ResponseEntity<JsonNode> book(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(cabsService.book(payload));
    }

    @PostMapping("/embedded-book")
    public ResponseEntity<JsonNode> embeddedBook(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(cabsService.embeddedBook(payload));
    }

    @GetMapping("/booking-details")
    public ResponseEntity<JsonNode> bookingDetails(@RequestParam String bookingIds) {
        return ResponseEntity.ok(cabsService.bookingDetails(bookingIds));
    }

    @PostMapping("/payment")
    public ResponseEntity<JsonNode> payment(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(cabsService.payment(payload));
    }

    @GetMapping("/amendment-charges")
    public ResponseEntity<JsonNode> amendmentCharges(@RequestParam String bookingId, @RequestParam String type) {
        return ResponseEntity.ok(cabsService.amendmentCharges(bookingId, type));
    }

    @PostMapping("/amendment-cancel")
    public ResponseEntity<JsonNode> amendmentCancel(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(cabsService.amendmentCancel(payload));
    }
}
