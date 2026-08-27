package com.itinera.repository;

import com.itinera.model.Itinerary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ItineraryRepository extends JpaRepository<Itinerary, Long> {
    boolean existsByTitleIgnoreCase(String title);
    List<Itinerary> findByDestinationContainingIgnoreCaseAndIsActiveTrue(String destination);
    List<Itinerary> findByCategoryAndIsActiveTrue(Itinerary.Category category);
    List<Itinerary> findByTypeAndIsActiveTrue(Itinerary.ItineraryType type);
    List<Itinerary> findByIsActiveTrue();
    List<Itinerary> findByDestinationContainingIgnoreCaseAndCategoryAndIsActiveTrue(String destination, Itinerary.Category category);

    // ai_generated is NULL on rows created before that column existed (old
    // hand-seeded demo packages) - match both so the one-time cleanup in
    // RemoveSeededItinerariesRunner catches all of them, not just aiGenerated=false.
    List<Itinerary> findByAiGeneratedFalseOrAiGeneratedIsNull();

    // Powers the destination picker for group trip creation (and any other
    // "pick from known destinations" UI) - only destinations with a real,
    // publicly-visible package are offered, mirroring how
    // HotelRepository.findCityCounts() only offers cities with synced hotels.
    // isActive=true excludes group-trip-generated synthetic itineraries (see
    // GroupTripService.finalizeTrip), which should never appear as a
    // selectable "known destination" themselves.
    @Query("SELECT i.destination AS destination, COUNT(i) AS packageCount " +
           "FROM Itinerary i WHERE i.isActive = true " +
           "GROUP BY i.destination ORDER BY i.destination ASC")
    List<DestinationCount> findDestinationCounts();

    interface DestinationCount {
        String getDestination();
        Long getPackageCount();
    }
}
