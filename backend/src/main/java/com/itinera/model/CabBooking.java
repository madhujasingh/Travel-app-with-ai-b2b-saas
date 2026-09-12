package com.itinera.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Persists TripJack Cabs bookings against the logged-in user's account -
// same shape/rationale as FlightBooking (Cabs has its own status vocabulary
// and no Itinerary to attach to, so it doesn't fit the package Booking model
// either).
@Entity
@Table(name = "cab_bookings", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "tripjack_booking_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CabBooking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @Column(name = "tripjack_booking_id", nullable = false)
    @NotBlank(message = "TripJack booking id is required")
    private String tripjackBookingId;

    @Column(name = "route_summary")
    private String routeSummary;

    @Column(name = "vehicle_label")
    private String vehicleLabel;

    @Column(name = "total_fare")
    private BigDecimal totalFare;

    // --- Margin breakdown -----------------------------------------------
    // The supplier amount above is what the supplier was actually paid, and it
    // must stay that way - TripJack rejects a booking whose payment differs
    // from the reviewed fare (errCode 1015). These three record what the
    // CUSTOMER was charged on our own rail, so a booking can be reconciled
    // later without re-deriving margin from settings that may since have
    // changed.
    //
    // Nullable: rows created before markup existed simply have no breakdown.
    @Column(name = "markup_amount", precision = 12, scale = 2)
    private BigDecimal markupAmount;

    @Column(name = "convenience_fee", precision = 12, scale = 2)
    private BigDecimal convenienceFee;

    @Column(name = "coupon_code", length = 40)
    private String couponCode;

    @Column(name = "discount_amount", precision = 12, scale = 2)
    private BigDecimal discountAmount;

    // supplier amount + markup + convenience fee - discount.
    @Column(name = "customer_total", precision = 12, scale = 2)
    private BigDecimal customerTotal;

    // Raw TripJack order status (PAYMENT_PENDING, PAYMENT_SUCCESS,
    // CANCELLED, ...), stored as-is - see FlightBooking for why.
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
