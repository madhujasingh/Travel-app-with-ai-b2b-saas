package com.itinera.repository;

import com.itinera.model.Itinerary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ItineraryRepository extends JpaRepository<Itinerary, Long> {
    List<Itinerary> findByDestinationContainingIgnoreCase(String destination);
    List<Itinerary> findByCategory(Itinerary.Category category);
    List<Itinerary> findByType(Itinerary.ItineraryType type);
    List<Itinerary> findByIsActiveTrue();
    List<Itinerary> findByDestinationContainingIgnoreCaseAndCategory(String destination, Itinerary.Category category);
}
