package com.itinera.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Persists TripJack Hotel v3 bookings against the logged-in user's account.
//
// Until now hotel bookings existed only inside TripJack - there was no local
// record at all, which meant no My Trips entry and nothing to reconcile margin
// against. Same shape as FlightBooking and CabBooking.
@Entity
@Table(
        name = "hotel_bookings",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "tripjack_booking_id"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HotelBooking {
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

    @Column(name = "hotel_name")
    private String hotelName;

    @Column(name = "city_name")
    private String cityName;

    @Column(name = "check_in")
    private String checkIn;

    @Column(name = "check_out")
    private String checkOut;

    // What TripJack was actually paid - must stay exactly the reviewed rate.
    @Column(name = "total_fare", precision = 12, scale = 2)
    private BigDecimal totalFare;

    // --- Margin breakdown -----------------------------------------------
    // What the CUSTOMER was charged on our own rail. Recorded at booking time
    // so it survives later changes to markup settings.
    @Column(name = "markup_amount", precision = 12, scale = 2)
    private BigDecimal markupAmount;

    @Column(name = "convenience_fee", precision = 12, scale = 2)
    private BigDecimal convenienceFee;

    @Column(name = "coupon_code", length = 40)
    private String couponCode;

    @Column(name = "discount_amount", precision = 12, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "customer_total", precision = 12, scale = 2)
    private BigDecimal customerTotal;

    @Column(nullable = false)
    @NotBlank(message = "Status is required")
    private String status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
