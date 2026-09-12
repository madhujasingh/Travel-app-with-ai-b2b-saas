package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Admin-managed discount codes.
//
// SECURITY: this row is the single source of truth for what a code is worth.
// The discount is always recomputed server-side from these fields at validate
// and again at redeem time - the client only ever sends the code string, never
// an amount or a percentage. Nothing a customer can send changes what a coupon
// is worth.
@Entity
@Table(
        name = "coupons",
        // Codes are compared case-insensitively by normalising to upper case on
        // write, so a unique index on the stored value is enough to stop
        // "SAVE20" and "save20" existing as two different coupons.
        indexes = @Index(name = "idx_coupons_code", columnList = "code", unique = true)
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Coupon {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(columnDefinition = "TEXT")
    private String description;

    // PERCENT -> discountValue is a percentage (capped by maxDiscountAmount).
    // FLAT    -> discountValue is a rupee amount.
    @Column(name = "discount_type", nullable = false, length = 16)
    private String discountType;

    @Column(name = "discount_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountValue;

    // Ceiling for PERCENT coupons, e.g. "20% off up to ₹2,000". Null = uncapped.
    @Column(name = "max_discount_amount", precision = 12, scale = 2)
    private BigDecimal maxDiscountAmount;

    // Order must reach this before the code applies. Null = no minimum.
    @Column(name = "min_order_amount", precision = 12, scale = 2)
    private BigDecimal minOrderAmount;

    @Column(name = "valid_from")
    private LocalDateTime validFrom;

    @Column(name = "valid_until")
    private LocalDateTime validUntil;

    @Column(nullable = false)
    private Boolean active = true;

    // Total redemptions allowed across all customers. Null = unlimited.
    @Column(name = "usage_limit")
    private Integer usageLimit;

    // Redemptions allowed per customer. Null = unlimited.
    @Column(name = "per_user_limit")
    private Integer perUserLimit;

    // Incremented only on redeem, never on validate - otherwise simply typing a
    // code into the box would burn the quota.
    @Column(name = "times_used", nullable = false)
    private Integer timesUsed = 0;

    // Comma-separated product keys this code applies to (FLIGHT, HOTEL, CAB,
    // ACTIVITY, PACKAGE, INSURANCE), or "ALL".
    @Column(name = "applicable_products", nullable = false, length = 200)
    private String applicableProducts = "ALL";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Guards against two concurrent redemptions both reading timesUsed = 9 on a
    // limit of 10 and both saving 10.
    @Version
    @Column(name = "version")
    private Long version;
}
