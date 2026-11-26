package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

// One Cashfree order, which may fund several Bookings at once (a cart with
// multiple packages) - see Booking.payment below for the other side.
@Entity
@Table(name = "payments")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Our own generated order reference - sent to Cashfree as order_id and
    // used as the join key everywhere (webhook lookup, the status-poll
    // endpoint, CouponService's bookingReference). Cashfree's own ids below
    // don't exist yet at the moment this row is first created, so they can
    // never be the join key.
    @Column(name = "cf_order_id", nullable = false, unique = true)
    private String cfOrderId;

    // Cashfree's own order id (cf_order_id in their response) - kept for
    // support lookups only.
    @Column(name = "cf_internal_order_id")
    private String cfInternalOrderId;

    // Cashfree's payment id, set once a payment attempt settles.
    @Column(name = "cf_payment_id")
    private String cfPaymentId;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    private PaymentStatus status;

    // Cashfree's own order_status/payment_status/event-type text at the last
    // update - kept for support/debugging, never used to drive logic.
    @Column(name = "raw_status")
    private String rawStatus;

    @Column(name = "coupon_code")
    private String couponCode;

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

    public enum PaymentStatus {
        PENDING, SUCCESS, FAILED
    }
}
