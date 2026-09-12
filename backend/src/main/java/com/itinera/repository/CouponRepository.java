package com.itinera.repository;

import com.itinera.model.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {

    Optional<Coupon> findByCode(String code);

    boolean existsByCode(String code);

    List<Coupon> findAllByOrderByCreatedAtDesc();

    // Atomic claim of one redemption slot. The WHERE clause re-checks the limit
    // inside the UPDATE, so two concurrent bookings cannot both take the last
    // one - the second affects 0 rows and is rejected. Doing this as a
    // read-modify-write in Java would be a race no matter how it was locked.
    @Modifying
    @Query("""
            UPDATE Coupon c
               SET c.timesUsed = c.timesUsed + 1
             WHERE c.id = :id
               AND (c.usageLimit IS NULL OR c.timesUsed < c.usageLimit)
            """)
    int claimRedemptionSlot(@Param("id") Long id);

    // Compensating update when a booking fails after the slot was claimed.
    @Modifying
    @Query("""
            UPDATE Coupon c
               SET c.timesUsed = CASE WHEN c.timesUsed > 0 THEN c.timesUsed - 1 ELSE 0 END
             WHERE c.id = :id
            """)
    int releaseRedemptionSlot(@Param("id") Long id);
}
