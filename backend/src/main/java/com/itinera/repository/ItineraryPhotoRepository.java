package com.itinera.repository;

import com.itinera.model.ItineraryPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ItineraryPhotoRepository extends JpaRepository<ItineraryPhoto, Long> {

    List<ItineraryPhoto> findByItineraryIdOrderBySortOrderAsc(Long itineraryId);

    void deleteByItineraryId(Long itineraryId);

    // Counting in SQL keeps the gallery size off a listing without loading
    // every photo's bytes to call size() on the list.
    @Query("SELECT p.itinerary.id AS itineraryId, COUNT(p) AS photoCount " +
           "FROM ItineraryPhoto p GROUP BY p.itinerary.id")
    List<PhotoCount> countByItinerary();

    interface PhotoCount {
        Long getItineraryId();
        Long getPhotoCount();
    }
}
