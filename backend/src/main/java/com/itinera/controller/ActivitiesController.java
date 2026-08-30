package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.service.ActivitiesService;
import com.itinera.service.ActivityVoucherService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// Passthrough to HotelBeds/HBX Group's Activities API (see ActivitiesService)
// - a separate provider from TripJack (flights/hotels).
@RestController
@RequestMapping("/activities")
public class ActivitiesController {

    private final ActivitiesService activitiesService;
    private final ActivityVoucherService activityVoucherService;

    public ActivitiesController(ActivitiesService activitiesService, ActivityVoucherService activityVoucherService) {
        this.activitiesService = activitiesService;
        this.activityVoucherService = activityVoucherService;
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

    @GetMapping("/segments/{language}")
    public ResponseEntity<JsonNode> segments(@PathVariable String language) {
        return ResponseEntity.ok(activitiesService.segments(language));
    }

    // Requires a logged-in user - reveals booking PII via the underlying
    // booking-detail call. Tells the frontend whether HotelBeds already
    // provided a supplier voucher (must be used as-is - see
    // ActivityVoucherService) or whether it should call the /pdf endpoint
    // below to get one we generate ourselves.
    @GetMapping("/bookings/{language}/{reference}/voucher")
    public ResponseEntity<Map<String, Object>> resolveVoucher(
            @PathVariable String language,
            @PathVariable String reference
    ) {
        return ResponseEntity.ok(activityVoucherService.resolveVoucher(language, reference));
    }

    // Only meaningful when resolveVoucher above returned hasSupplierVoucher
    // = false - returns 409 otherwise (see ActivityVoucherService).
    @GetMapping(value = "/bookings/{language}/{reference}/voucher/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> generateVoucherPdf(
            @PathVariable String language,
            @PathVariable String reference
    ) {
        byte[] pdf = activityVoucherService.generatePdf(language, reference);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"activity-voucher.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
