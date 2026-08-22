package com.itinera.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Persists HotelBeds/HBX Group activity bookings against the logged-in
// user's account - mirrors FlightBooking's shape/reasoning exactly (separate
// from Booking's package-Itinerary model; HotelBeds' own status vocabulary
// - PRECONFIRMED, CONFIRMED, CANCELLED - doesn't map onto that either).
// HotelBeds itself is the source of truth for the booking; this table only
// exists so a customer can see their own booking history in this app,
// since HotelBeds' Booking List API is scoped to the whole agency account,
// not filterable by our own per-customer identity.
@Entity
@Table(name = "activity_bookings", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "booking_reference"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivityBooking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Not @NotNull: always resolved server-side from the requester's JWT
    // (see ActivityBookingService.upsert), never supplied by the client.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @Column(name = "booking_reference", nullable = false)
    @NotBlank(message = "Booking reference is required")
    private String bookingReference;

    @Column(name = "activity_name")
    private String activityName;

    @Column(name = "visit_date_from")
    private String visitDateFrom;

    @Column(name = "visit_date_to")
    private String visitDateTo;

    @Column(name = "total_amount")
    private BigDecimal totalAmount;

    private String currency;

    // Raw HotelBeds status (PRECONFIRMED, CONFIRMED, CANCELLED) stored as-is,
    // same reasoning as FlightBooking.status - no Java enum to keep in sync
    // with whatever HotelBeds actually returns.
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
