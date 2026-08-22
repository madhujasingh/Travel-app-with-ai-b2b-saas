package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.ActivityBooking;
import com.itinera.model.User;
import com.itinera.repository.ActivityBookingRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

// Local persistence for activity bookings (see ActivityBooking) - separate
// from ActivitiesService, which only proxies the live HotelBeds API calls.
// Mirrors FlightBookingService's upsert-by-(userId, reference) pattern.
@Service
public class ActivityBookingService {

    @Autowired
    private ActivityBookingRepository activityBookingRepository;

    @Autowired
    private UserRepository userRepository;

    public List<ActivityBooking> listForUser(Long userId) {
        return activityBookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // Called by the frontend right after confirming a booking, and again
    // after checking status or cancelling - upsert by (userId,
    // bookingReference) so the same HotelBeds booking updates one row
    // instead of accumulating duplicates.
    public ActivityBooking upsert(Long userId, ActivityBooking incoming) {
        ActivityBooking existing = activityBookingRepository
                .findByUserIdAndBookingReference(userId, incoming.getBookingReference())
                .orElse(null);

        if (existing != null) {
            existing.setActivityName(incoming.getActivityName());
            existing.setVisitDateFrom(incoming.getVisitDateFrom());
            existing.setVisitDateTo(incoming.getVisitDateTo());
            existing.setTotalAmount(incoming.getTotalAmount());
            existing.setCurrency(incoming.getCurrency());
            existing.setStatus(incoming.getStatus());
            return activityBookingRepository.save(existing);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        incoming.setId(null);
        incoming.setUser(user);
        return activityBookingRepository.save(incoming);
    }
}
