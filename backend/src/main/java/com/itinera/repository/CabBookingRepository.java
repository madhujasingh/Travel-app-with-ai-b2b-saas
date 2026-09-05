package com.itinera.repository;

import com.itinera.model.CabBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CabBookingRepository extends JpaRepository<CabBooking, Long> {
    List<CabBooking> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<CabBooking> findByUserIdAndTripjackBookingId(Long userId, String tripjackBookingId);
}
