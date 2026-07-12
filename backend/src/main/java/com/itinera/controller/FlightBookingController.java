package com.itinera.controller;

import com.itinera.model.FlightBooking;
import com.itinera.service.FlightBookingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/flight-bookings")
public class FlightBookingController {

    @Autowired
    private FlightBookingService flightBookingService;

    @GetMapping
    public ResponseEntity<?> list(@RequestAttribute(name = "userId", required = false) Long userId) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(flightBookingService.listForUser(userId));
    }

    @PostMapping
    public ResponseEntity<?> upsert(
            @RequestAttribute(name = "userId", required = false) Long userId,
            @Valid @RequestBody FlightBooking incoming
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(flightBookingService.upsert(userId, incoming));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @RequestAttribute(name = "userId", required = false) Long userId
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        flightBookingService.delete(id, userId);
        return ResponseEntity.ok().build();
    }
}
