package com.itinera.service;

import com.itinera.model.Activity;
import com.itinera.model.DayPlan;
import com.itinera.model.Itinerary;
import com.itinera.repository.ItineraryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class ItineraryService {

    private static final BigDecimal BUDGET_HEADROOM = new BigDecimal("1.2");

    @Autowired
    private ItineraryRepository itineraryRepository;

    public List<Itinerary> getAllItineraries() {
        return itineraryRepository.findByIsActiveTrue();
    }

    public Optional<Itinerary> getItineraryById(Long id) {
        return itineraryRepository.findById(id);
    }

    public List<Itinerary> searchByDestination(String destination) {
        return itineraryRepository.findByDestinationContainingIgnoreCaseAndIsActiveTrue(destination);
    }

    public List<Itinerary> searchByDestinationAndCategory(String destination, String category) {
        return itineraryRepository.findByDestinationContainingIgnoreCaseAndCategoryAndIsActiveTrue(
            destination,
            Itinerary.Category.valueOf(category.toUpperCase())
        );
    }

    // Home's trip search takes a budget, a destination, or both, so a budget
    // with no destination has to answer "what can I afford anywhere?". The 20%
    // headroom mirrors the client-side budget filter in ItineraryListScreen so
    // the two agree on what "within budget" means, rather than each trimming
    // what the other returned.
    public List<Itinerary> searchByBudget(BigDecimal budget) {
        return itineraryRepository.findByPriceLessThanEqualAndIsActiveTrueOrderByPriceAsc(
            budget.multiply(BUDGET_HEADROOM)
        );
    }

    public List<Itinerary> getByCategory(Itinerary.Category category) {
        return itineraryRepository.findByCategoryAndIsActiveTrue(category);
    }

    public List<Itinerary> getByType(Itinerary.ItineraryType type) {
        return itineraryRepository.findByTypeAndIsActiveTrue(type);
    }

    public List<ItineraryRepository.DestinationCount> getDestinations() {
        return itineraryRepository.findDestinationCounts();
    }

    // The manage-packages screen needs inactive rows too - an admin has to be
    // able to see what they deactivated in order to turn it back on.
    public List<Itinerary> getAllForAdmin() {
        return itineraryRepository.findAllByOrderByCreatedAtDesc();
    }

    public Itinerary setImage(Long id, byte[] data, String contentType) {
        Itinerary itinerary = itineraryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Itinerary not found: " + id));
        itinerary.setImageData(data);
        itinerary.setImageContentType(contentType);
        return itineraryRepository.save(itinerary);
    }

    public Itinerary createItinerary(Itinerary itinerary) {
        prepareRelationships(itinerary);
        return itineraryRepository.save(itinerary);
    }

    public Itinerary updateItinerary(Long id, Itinerary itinerary) {
        itinerary.setId(id);

        // The cover photo is @JsonIgnore, so it never reaches the client and
        // the client can never send it back - a plain full-replace save would
        // therefore wipe the image on every edit. Carry the stored bytes over
        // unless this request is deliberately replacing them.
        if (itinerary.getImageData() == null) {
            itineraryRepository.findById(id).ifPresent(existing -> {
                itinerary.setImageData(existing.getImageData());
                itinerary.setImageContentType(existing.getImageContentType());
            });
        }

        prepareRelationships(itinerary);
        return itineraryRepository.save(itinerary);
    }

    public void deleteItinerary(Long id) {
        itineraryRepository.deleteById(id);
    }

    private void prepareRelationships(Itinerary itinerary) {
        if (itinerary.getDayPlans() == null) {
            return;
        }

        for (DayPlan dayPlan : itinerary.getDayPlans()) {
            dayPlan.setItinerary(itinerary);
            if (dayPlan.getActivities() == null) {
                continue;
            }

            for (Activity activity : dayPlan.getActivities()) {
                activity.setDayPlan(dayPlan);
            }
        }
    }
}
