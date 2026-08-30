package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.FlightBooking;
import com.itinera.model.User;
import com.itinera.repository.FlightBookingRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FlightBookingService {

    @Autowired
    private FlightBookingRepository flightBookingRepository;

    @Autowired
    private UserRepository userRepository;

    public List<FlightBooking> listForUser(Long userId) {
        return flightBookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // The frontend calls this every time a booking's status changes (hold
    // created, instant-booked, confirmed, cancelled) - upsert by
    // (userId, tripjackBookingId) so the same TripJack booking updates one
    // row instead of accumulating duplicates.
    public FlightBooking upsert(Long userId, FlightBooking incoming) {
        FlightBooking existing = flightBookingRepository
                .findByUserIdAndTripjackBookingId(userId, incoming.getTripjackBookingId())
                .orElse(null);

        if (existing != null) {
            existing.setRouteSummary(incoming.getRouteSummary());
            existing.setAirlineCode(incoming.getAirlineCode());
            existing.setTotalFare(incoming.getTotalFare());
            existing.setStatus(incoming.getStatus());
            return flightBookingRepository.save(existing);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        incoming.setId(null);
        incoming.setUser(user);
        return flightBookingRepository.save(incoming);
    }

    public void delete(Long id, Long userId) {
        FlightBooking booking = flightBookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("FlightBooking", "id", id));
        if (!booking.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("You can only delete your own flight bookings");
        }
        flightBookingRepository.delete(booking);
    }
}
