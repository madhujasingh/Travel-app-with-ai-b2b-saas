package com.itinera.service;

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
        return itineraryRepository.findByDestinationContainingIgnoreCase(destination);
    }

    public List<Itinerary> searchByDestinationAndCategory(String destination, String category) {
        return itineraryRepository.findByDestinationContainingIgnoreCaseAndCategory(
            destination,
            Itinerary.Category.valueOf(category.toUpperCase())
        );
    }

    public List<Itinerary> getByCategory(Itinerary.Category category) {
        return itineraryRepository.findByCategory(category);
    }

    public List<Itinerary> getByType(Itinerary.ItineraryType type) {
        return itineraryRepository.findByType(type);
    }

    public Itinerary createItinerary(Itinerary itinerary) {
        return itineraryRepository.save(itinerary);
    }

    public Itinerary updateItinerary(Long id, Itinerary itinerary) {
        itinerary.setId(id);
        return itineraryRepository.save(itinerary);
    }

    public void deleteItinerary(Long id) {
        itineraryRepository.deleteById(id);
    }
}
