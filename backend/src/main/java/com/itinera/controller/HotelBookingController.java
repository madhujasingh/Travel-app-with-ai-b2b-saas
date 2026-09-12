package com.itinera.controller;

import com.itinera.model.HotelBooking;
import com.itinera.service.HotelBookingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/hotel-bookings")
public class HotelBookingController {

    @Autowired
    private HotelBookingService hotelBookingService;

    @GetMapping
    public ResponseEntity<?> list(@RequestAttribute(name = "userId", required = false) Long userId) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(hotelBookingService.listForUser(userId));
    }

    @PostMapping
    public ResponseEntity<?> upsert(
            @RequestAttribute(name = "userId", required = false) Long userId,
            @Valid @RequestBody HotelBooking incoming
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(hotelBookingService.upsert(userId, incoming));
    }
}
