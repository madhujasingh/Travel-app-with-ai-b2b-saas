package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.HotelService;
import com.itinera.service.HotelVoucherService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
    private final HotelVoucherService hotelVoucherService;

    public HotelController(HotelService hotelService, HotelVoucherService hotelVoucherService) {
        this.hotelService = hotelService;
        this.hotelVoucherService = hotelVoucherService;
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

    // Generates our own voucher PDF from TripJack's booking-details response
    // - see HotelVoucherService for why hotels always get a generated
    // voucher rather than resolving a supplier one first (contrast
    // ActivitiesController's /voucher + /voucher/pdf pair).
    @PostMapping(value = "/booking-voucher-pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> bookingVoucherPdf(@RequestBody JsonNode payload) {
        byte[] pdf = hotelVoucherService.generatePdf(payload.path("bookingId").asText(""));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"hotel-voucher.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
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

    // Admin-only (see SecurityConfig) - passthroughs to TripJack's dedicated
    // NEW/UPDATE/DELETE hotel-mapping delta feeds, replacing the per-city
    // regionId refresh (see HotelSyncJobRunner) - no city/country filter
    // needed, so no risk of the same-name-wrong-country mismatch hit twice
    // already (Bali, Paris).
    @PostMapping("/hotel-mapping-sync")
    public ResponseEntity<JsonNode> hotelMappingSync(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.hotelMappingSync(payload));
    }

    @PostMapping("/deleted-hotel-mapping")
    public ResponseEntity<JsonNode> deletedHotelMappingSync(@RequestBody JsonNode payload) {
        return ResponseEntity.ok(hotelService.deletedHotelMappingSync(payload));
    }
}
