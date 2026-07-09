package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.FlightService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
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

    @PostMapping("/review")
    public ResponseEntity<JsonNode> reviewFlight(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.reviewFlight(payload));
    }

    @PostMapping("/fare-rule")
    public ResponseEntity<JsonNode> fareRule(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.fareRule(payload));
    }

    @PostMapping("/seat-map")
    public ResponseEntity<JsonNode> seatMap(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.seatMap(payload));
    }

    @PostMapping("/fare-validate")
    public ResponseEntity<JsonNode> fareValidate(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.fareValidate(payload));
    }

    @PostMapping("/book")
    public ResponseEntity<JsonNode> bookFlight(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.bookFlight(payload));
    }

    @PostMapping("/confirm-fare-before-ticket")
    public ResponseEntity<JsonNode> confirmFareBeforeTicketing(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.confirmFareBeforeTicketing(payload));
    }

    @PostMapping("/confirm-book")
    public ResponseEntity<JsonNode> confirmBook(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.confirmBook(payload));
    }

    @PostMapping("/booking-details")
    public ResponseEntity<JsonNode> bookingDetails(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.bookingDetails(payload));
    }

    @PostMapping("/release-pnr")
    public ResponseEntity<JsonNode> releasePnr(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.releasePnr(payload));
    }

    @PostMapping("/amendment-charges")
    public ResponseEntity<JsonNode> amendmentCharges(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.amendmentCharges(payload));
    }

    @PostMapping("/submit-amendment")
    public ResponseEntity<JsonNode> submitAmendment(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.submitAmendment(payload));
    }

    @PostMapping("/amendment-details")
    public ResponseEntity<JsonNode> amendmentDetails(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.amendmentDetails(payload));
    }

    @PostMapping("/ancillaries/fetch-ssr")
    public ResponseEntity<JsonNode> fetchAncillarySsr(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.fetchAncillarySsr(payload));
    }

    @PostMapping("/ancillaries/fetch-seat")
    public ResponseEntity<JsonNode> fetchAncillarySeat(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.fetchAncillarySeat(payload));
    }

    @PostMapping("/ancillaries/add-ssr")
    public ResponseEntity<JsonNode> addAncillarySsr(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.addAncillarySsr(payload));
    }

    @PostMapping("/reissue/searchquery-list")
    public ResponseEntity<JsonNode> reissueSearchQueryList(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.reissueSearchQueryList(payload));
    }

    @PostMapping("/reissue/search")
    public ResponseEntity<JsonNode> reissueSearch(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.reissueSearch(payload));
    }

    @PostMapping("/reissue/review")
    public ResponseEntity<JsonNode> reissueReview(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.reissueReview(payload));
    }

    @PostMapping("/reissue/book")
    public ResponseEntity<JsonNode> reissueBook(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(flightService.reissueBook(payload));
    }

    @GetMapping("/user-balance")
    public ResponseEntity<JsonNode> userBalance() {
        return ResponseEntity.ok(flightService.userBalance());
    }
}
