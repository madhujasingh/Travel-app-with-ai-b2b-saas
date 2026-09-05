package com.itinera.controller;

import com.itinera.model.CabBooking;
import com.itinera.service.CabBookingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/cab-bookings")
public class CabBookingController {

    @Autowired
    private CabBookingService cabBookingService;

    @GetMapping
    public ResponseEntity<?> list(@RequestAttribute(name = "userId", required = false) Long userId) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(cabBookingService.listForUser(userId));
    }

    @PostMapping
    public ResponseEntity<?> upsert(
            @RequestAttribute(name = "userId", required = false) Long userId,
            @Valid @RequestBody CabBooking incoming
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(cabBookingService.upsert(userId, incoming));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable Long id,
            @RequestAttribute(name = "userId", required = false) Long userId
    ) {
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        cabBookingService.delete(id, userId);
        return ResponseEntity.ok().build();
    }
}
