package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.HotelService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/hotels")
public class HotelController {

    private final HotelService hotelService;

    public HotelController(HotelService hotelService) {
        this.hotelService = hotelService;
    }

    @PostMapping("/listing")
    public ResponseEntity<JsonNode> listing(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.listing(payload));
    }

    @PostMapping("/detail")
    public ResponseEntity<JsonNode> detail(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.detail(payload));
    }

    @PostMapping("/review")
    public ResponseEntity<JsonNode> review(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.review(payload));
    }

    @PostMapping("/static-detail")
    public ResponseEntity<JsonNode> staticDetail(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.staticDetail(payload));
    }

    @PostMapping("/book")
    public ResponseEntity<JsonNode> book(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.book(payload));
    }

    @PostMapping("/confirm-book")
    public ResponseEntity<JsonNode> confirmBook(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.confirmBook(payload));
    }

    @PostMapping("/booking-details")
    public ResponseEntity<JsonNode> bookingDetails(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.bookingDetails(payload));
    }

    @PostMapping("/cancel-booking/{bookingId}")
    public ResponseEntity<JsonNode> cancelBooking(@PathVariable String bookingId) {
        return ResponseEntity.ok(hotelService.cancelBooking(bookingId));
    }

    @GetMapping("/nationalities")
    public ResponseEntity<JsonNode> nationalities() {
        return ResponseEntity.ok(hotelService.nationalities());
    }

    @GetMapping("/countries")
    public ResponseEntity<JsonNode> countries() {
        return ResponseEntity.ok(hotelService.countries());
    }

    @GetMapping("/city-region-ids")
    public ResponseEntity<JsonNode> cityRegionIds(
            @RequestParam int limit,
            @RequestParam(required = false) String cursor
    ) {
        return ResponseEntity.ok(hotelService.cityRegionIds(limit, cursor));
    }

    @PostMapping("/hotel-mapping")
    public ResponseEntity<JsonNode> hotelMapping(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.hotelMapping(payload));
    }

    @PostMapping("/hotel-content")
    public ResponseEntity<JsonNode> hotelContent(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.hotelContent(payload));
    }

    // --- v1 (legacy) fallback - see HotelService for why this exists. ---

    @PostMapping("/v1/search")
    public ResponseEntity<JsonNode> searchV1(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.searchV1(payload));
    }

    @PostMapping("/v1/detail-search")
    public ResponseEntity<JsonNode> detailSearchV1(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.detailSearchV1(payload));
    }

    @PostMapping("/v1/cancellation-policy")
    public ResponseEntity<JsonNode> cancellationPolicyV1(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.cancellationPolicyV1(payload));
    }

    @PostMapping("/v1/review")
    public ResponseEntity<JsonNode> reviewV1(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.reviewV1(payload));
    }

    @PostMapping("/v1/book")
    public ResponseEntity<JsonNode> bookV1(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.bookV1(payload));
    }

    @PostMapping("/v1/confirm-book")
    public ResponseEntity<JsonNode> confirmBookV1(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.confirmBookV1(payload));
    }

    @PostMapping("/v1/booking-details")
    public ResponseEntity<JsonNode> bookingDetailsV1(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.bookingDetailsV1(payload));
    }

    @PostMapping("/v1/cancel-booking/{bookingId}")
    public ResponseEntity<JsonNode> cancelBookingV1(@PathVariable String bookingId) {
        return ResponseEntity.ok(hotelService.cancelBookingV1(bookingId));
    }
}
