package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.TripSafeBooking;
import com.itinera.model.User;
import com.itinera.repository.TripSafeBookingRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TripSafeBookingService {

    @Autowired
    private TripSafeBookingRepository tripSafeBookingRepository;

    @Autowired
    private UserRepository userRepository;

    public List<TripSafeBooking> listForUser(Long userId) {
        return tripSafeBookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // Called after Book, and again after a status change (cancellation) -
    // upsert by (userId, tripjackBookingId) so the same TripJack booking
    // updates one row instead of accumulating duplicates.
    public TripSafeBooking upsert(Long userId, TripSafeBooking incoming) {
        TripSafeBooking existing = tripSafeBookingRepository
                .findByUserIdAndTripjackBookingId(userId, incoming.getTripjackBookingId())
                .orElse(null);

        if (existing != null) {
            existing.setPlanName(incoming.getPlanName());
            existing.setDestinationSummary(incoming.getDestinationSummary());
            existing.setAmount(incoming.getAmount());
            existing.setStatus(incoming.getStatus());
            return tripSafeBookingRepository.save(existing);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        incoming.setId(null);
        incoming.setUser(user);
        return tripSafeBookingRepository.save(incoming);
    }

    public void delete(Long id, Long userId) {
        TripSafeBooking booking = tripSafeBookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TripSafeBooking", "id", id));
        if (!booking.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("You can only delete your own TripSafe bookings");
        }
        tripSafeBookingRepository.delete(booking);
    }
}
