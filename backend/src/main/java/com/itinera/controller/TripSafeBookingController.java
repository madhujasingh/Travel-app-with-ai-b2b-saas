package com.itinera.controller;

import com.itinera.model.TripSafeBooking;
import com.itinera.service.TripSafeBookingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/tripsafe-bookings")
public class TripSafeBookingController {

    @Autowired
    private TripSafeBookingService tripSafeBookingService;

    @GetMapping
    public ResponseEntity<?> list(@RequestAttribute(name = "userId", required = false) Long userId) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(tripSafeBookingService.listForUser(userId));
    }

    @PostMapping
    public ResponseEntity<?> upsert(
            @RequestAttribute(name = "userId", required = false) Long userId,
            @Valid @RequestBody TripSafeBooking incoming
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(tripSafeBookingService.upsert(userId, incoming));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @RequestAttribute(name = "userId", required = false) Long userId
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        tripSafeBookingService.delete(id, userId);
        return ResponseEntity.ok().build();
    }
}
