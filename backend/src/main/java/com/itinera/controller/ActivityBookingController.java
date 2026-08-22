package com.itinera.controller;

import com.itinera.model.ActivityBooking;
import com.itinera.service.ActivityBookingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// Local record of the logged-in user's activity bookings (see
// ActivityBooking/ActivityBookingService) - separate from ActivitiesController,
// which only proxies the live HotelBeds API.
@RestController
@RequestMapping("/activity-bookings")
public class ActivityBookingController {

    @Autowired
    private ActivityBookingService activityBookingService;

    @GetMapping
    public ResponseEntity<?> list(@RequestAttribute(name = "userId", required = false) Long userId) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(activityBookingService.listForUser(userId));
    }

    @PostMapping
    public ResponseEntity<?> upsert(
            @RequestAttribute(name = "userId", required = false) Long userId,
            @Valid @RequestBody ActivityBooking incoming
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(activityBookingService.upsert(userId, incoming));
    }
}
