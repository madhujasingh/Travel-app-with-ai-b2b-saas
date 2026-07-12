package com.itinera.repository;

import com.itinera.model.FlightBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FlightBookingRepository extends JpaRepository<FlightBooking, Long> {
    List<FlightBooking> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<FlightBooking> findByUserIdAndTripjackBookingId(Long userId, String tripjackBookingId);
}
