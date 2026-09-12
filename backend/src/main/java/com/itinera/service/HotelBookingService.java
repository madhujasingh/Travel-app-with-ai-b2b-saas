package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.HotelBooking;
import com.itinera.model.User;
import com.itinera.repository.HotelBookingRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HotelBookingService {

    @Autowired
    private HotelBookingRepository hotelBookingRepository;

    @Autowired
    private UserRepository userRepository;

    public List<HotelBooking> listForUser(Long userId) {
        return hotelBookingRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // Called after Book and again on each status change - upsert by
    // (userId, tripjackBookingId) so one TripJack booking is one row.
    public HotelBooking upsert(Long userId, HotelBooking incoming) {
        HotelBooking existing = hotelBookingRepository
                .findByUserIdAndTripjackBookingId(userId, incoming.getTripjackBookingId())
                .orElse(null);

        if (existing != null) {
            existing.setHotelName(incoming.getHotelName());
            existing.setCityName(incoming.getCityName());
            existing.setCheckIn(incoming.getCheckIn());
            existing.setCheckOut(incoming.getCheckOut());
            existing.setTotalFare(incoming.getTotalFare());
            existing.setMarkupAmount(incoming.getMarkupAmount());
            existing.setConvenienceFee(incoming.getConvenienceFee());
            existing.setCouponCode(incoming.getCouponCode());
            existing.setDiscountAmount(incoming.getDiscountAmount());
            existing.setCustomerTotal(incoming.getCustomerTotal());
            existing.setStatus(incoming.getStatus());
            return hotelBookingRepository.save(existing);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        incoming.setId(null);
        incoming.setUser(user);
        return hotelBookingRepository.save(incoming);
    }
}
