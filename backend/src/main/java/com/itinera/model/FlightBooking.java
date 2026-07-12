package com.itinera.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Persists TripJack flight bookings against the logged-in user's account.
// Kept separate from Booking (tied to a package Itinerary, with its own
// BookingStatus/PaymentStatus enums) since TripJack's own status vocabulary
// (ON_HOLD, SUCCESS, CANCELLED, PENDING, ...) doesn't map cleanly onto that
// model and flights have no Itinerary to attach to.
@Entity
@Table(name = "flight_bookings", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "tripjack_booking_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FlightBooking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Not @NotNull: this is always resolved server-side from the requester's
    // JWT (see FlightBookingService.upsert), never supplied by the client -
    // a @Valid check here would reject every legitimate request body.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "tripjack_booking_id", nullable = false)
    @NotBlank(message = "TripJack booking id is required")
    private String tripjackBookingId;

    @Column(name = "route_summary")
    private String routeSummary;

    @Column(name = "total_fare")
    private BigDecimal totalFare;

    // Raw TripJack order status (ON_HOLD, SUCCESS, CANCELLED, PENDING, ...),
    // stored as-is rather than a Java enum so a new status TripJack returns
    // never requires a backend redeploy to store - mirrors how the frontend
    // already falls back gracefully for unmapped statuses.
    @Column(nullable = false)
    @NotBlank(message = "Status is required")
    private String status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
