package com.itinera.service;

import com.itinera.model.Activity;
import com.itinera.model.DayPlan;
import com.itinera.model.Itinerary;
import com.itinera.repository.ItineraryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ItineraryService {

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

    public List<Itinerary> getByCategory(Itinerary.Category category) {
        return itineraryRepository.findByCategoryAndIsActiveTrue(category);
    }

    public List<Itinerary> getByType(Itinerary.ItineraryType type) {
        return itineraryRepository.findByTypeAndIsActiveTrue(type);
    }

    public List<ItineraryRepository.DestinationCount> getDestinations() {
        return itineraryRepository.findDestinationCounts();
    }

    public Itinerary createItinerary(Itinerary itinerary) {
        prepareRelationships(itinerary);
        return itineraryRepository.save(itinerary);
    }

    public Itinerary updateItinerary(Long id, Itinerary itinerary) {
        itinerary.setId(id);
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
