package com.itinera.controller;

import com.itinera.model.Booking;
import com.itinera.service.BookingService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/bookings")
public class BookingController {

    @Autowired
    private BookingService bookingService;

    @GetMapping
    public ResponseEntity<List<Booking>> getAllBookings() {
        return ResponseEntity.ok(bookingService.getAllBookings());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Booking> getBookingById(@PathVariable Long id) {
        return bookingService.getBookingById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // A user can only list their own bookings unless they're an admin - otherwise
    // any logged-in customer could read anyone else's booking history just by
    // changing the userId in the URL.
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getBookingsByUserId(
            @PathVariable Long userId,
            @RequestAttribute(name = "userId", required = false) Long requesterId,
            @RequestAttribute(name = "role", required = false) String requesterRole
    ) {
        if (requesterId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        if (!requesterId.equals(userId) && !"ADMIN".equals(requesterRole)) {
            return ResponseEntity.status(403).body(Map.of("error", "You can only view your own bookings"));
        }
        return ResponseEntity.ok(bookingService.getBookingsByUserId(userId));
    }

    @PostMapping
    public ResponseEntity<Booking> createBooking(@Valid @RequestBody Booking booking) {
        return ResponseEntity.ok(bookingService.createBooking(booking));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Booking> updateBookingStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        return ResponseEntity.ok(
            bookingService.updateBookingStatus(id, Booking.BookingStatus.valueOf(status.toUpperCase()))
        );
    }

    @PutMapping("/{id}/payment")
    public ResponseEntity<Booking> updatePaymentStatus(
            @PathVariable Long id,
            @RequestParam String paymentStatus) {
        return ResponseEntity.ok(
            bookingService.updatePaymentStatus(id, Booking.PaymentStatus.valueOf(paymentStatus.toUpperCase()))
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelBooking(@PathVariable Long id) {
        bookingService.cancelBooking(id);
        return ResponseEntity.ok().build();
    }
}
