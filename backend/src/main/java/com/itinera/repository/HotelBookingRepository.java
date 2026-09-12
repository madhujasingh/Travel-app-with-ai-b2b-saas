package com.itinera.repository;

import com.itinera.model.HotelBooking;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HotelBookingRepository extends JpaRepository<HotelBooking, Long> {

    List<HotelBooking> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<HotelBooking> findByUserIdAndTripjackBookingId(Long userId, String tripjackBookingId);
}
