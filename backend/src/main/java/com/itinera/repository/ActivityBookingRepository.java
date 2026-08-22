package com.itinera.repository;

import com.itinera.model.ActivityBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActivityBookingRepository extends JpaRepository<ActivityBooking, Long> {
    List<ActivityBooking> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<ActivityBooking> findByUserIdAndBookingReference(Long userId, String bookingReference);
}
