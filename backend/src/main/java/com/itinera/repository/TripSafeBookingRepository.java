package com.itinera.repository;

import com.itinera.model.TripSafeBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripSafeBookingRepository extends JpaRepository<TripSafeBooking, Long> {
    List<TripSafeBooking> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<TripSafeBooking> findByUserIdAndTripjackBookingId(Long userId, String tripjackBookingId);
}
