package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.CabBooking;
import com.itinera.model.User;
import com.itinera.repository.CabBookingRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CabBookingService {

    @Autowired
    private CabBookingRepository cabBookingRepository;

    @Autowired
    private UserRepository userRepository;

    public List<CabBooking> listForUser(Long userId) {
        return cabBookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // Called after Book, and again after a status change (payment settling,
    // cancellation) - upsert by (userId, tripjackBookingId) so the same
    // TripJack booking updates one row instead of accumulating duplicates.
    public CabBooking upsert(Long userId, CabBooking incoming) {
        CabBooking existing = cabBookingRepository
                .findByUserIdAndTripjackBookingId(userId, incoming.getTripjackBookingId())
                .orElse(null);

        if (existing != null) {
            existing.setRouteSummary(incoming.getRouteSummary());
            existing.setVehicleLabel(incoming.getVehicleLabel());
            existing.setTotalFare(incoming.getTotalFare());
            existing.setStatus(incoming.getStatus());
            return cabBookingRepository.save(existing);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        incoming.setId(null);
        incoming.setUser(user);
        return cabBookingRepository.save(incoming);
    }

    public void delete(Long id, Long userId) {
        CabBooking booking = cabBookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CabBooking", "id", id));
        if (!booking.getUser().getId().equals(userId)) {
            throw new AccessDeniedException("You can only delete your own cab bookings");
        }
        cabBookingRepository.delete(booking);
    }
}
