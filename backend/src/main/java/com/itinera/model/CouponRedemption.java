package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// One row per actual redemption. Serves two purposes: enforcing per-customer
// limits, and giving admins an audit trail of what each code actually cost.
//
// Written only when a booking succeeds - validating a code in the cart does not
// create a row.
@Entity
@Table(
        name = "coupon_redemptions",
        indexes = {
                @Index(name = "idx_coupon_redemptions_coupon_user", columnList = "coupon_id,user_id"),
                @Index(name = "idx_coupon_redemptions_booking", columnList = "booking_reference")
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CouponRedemption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coupon_id", nullable = false)
    private Long couponId;

    @Column(name = "coupon_code", nullable = false, length = 40)
    private String couponCode;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    // The booking this discount was applied to, so a redemption can be traced
    // and reversed if the booking later fails.
    @Column(name = "booking_reference", length = 120)
    private String bookingReference;

    @Column(name = "product_type", length = 32)
    private String productType;

    @Column(name = "order_amount", precision = 12, scale = 2)
    private BigDecimal orderAmount;

    @Column(name = "discount_amount", precision = 12, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "redeemed_at", nullable = false)
    private LocalDateTime redeemedAt = LocalDateTime.now();
}
