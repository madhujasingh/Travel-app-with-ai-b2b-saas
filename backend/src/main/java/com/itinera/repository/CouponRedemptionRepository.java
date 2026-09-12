package com.itinera.repository;

import com.itinera.model.CouponRedemption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CouponRedemptionRepository extends JpaRepository<CouponRedemption, Long> {

    long countByCouponIdAndUserId(Long couponId, Long userId);

    List<CouponRedemption> findByCouponIdOrderByRedeemedAtDesc(Long couponId);

    List<CouponRedemption> findByBookingReference(String bookingReference);
}
