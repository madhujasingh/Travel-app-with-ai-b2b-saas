package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.ActivitiesService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/details")
    public ResponseEntity<JsonNode> details(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(activitiesService.detail(payload));
    }

    @PostMapping("/details/full")
    public ResponseEntity<JsonNode> detailsFull(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(activitiesService.detailFull(payload));
    }

    // Requires a logged-in user (see SecurityConfig) - commits the agency
    // account to pay for this booking and stores real traveller PII.
    @PutMapping("/bookings")
    public ResponseEntity<JsonNode> confirmBooking(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(activitiesService.confirmBooking(payload));
    }

    // Requires a logged-in user - reveals a specific booking's holder/pax PII.
    @GetMapping("/bookings/{language}/{reference}")
    public ResponseEntity<JsonNode> bookingDetail(@PathVariable String language, @PathVariable String reference) {
        return ResponseEntity.ok(activitiesService.bookingDetail(language, reference));
    }

    // Requires a logged-in user - cancellationFlag must be SIMULATION (preview
    // only) or CANCELLATION (actually cancels); the frontend always simulates
    // first.
    @DeleteMapping("/bookings/{language}/{reference}")
    public ResponseEntity<JsonNode> cancelBooking(
            @PathVariable String language,
            @PathVariable String reference,
            @RequestParam String cancellationFlag
    ) {
        return ResponseEntity.ok(activitiesService.cancelBooking(language, reference, cancellationFlag));
    }

    // Public (see SecurityConfig) - static reference data, powers the search
    // form's country/destination picker.
    @GetMapping("/countries/{language}")
    public ResponseEntity<JsonNode> countries(@PathVariable String language) {
        return ResponseEntity.ok(activitiesService.countries(language));
    }

    @GetMapping("/destinations/{language}/{country}")
    public ResponseEntity<JsonNode> destinations(@PathVariable String language, @PathVariable String country) {
        return ResponseEntity.ok(activitiesService.destinations(language, country));
    }
}
