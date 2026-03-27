package com.itinera.controller;

import com.itinera.model.Itinerary;
import com.itinera.service.ItineraryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/itineraries")
public class ItineraryController {

    @Autowired
    private ItineraryService itineraryService;

    @GetMapping
    public ResponseEntity<List<Itinerary>> getAllItineraries() {
        return ResponseEntity.ok(itineraryService.getAllItineraries());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Itinerary> getItineraryById(@PathVariable Long id) {
        return itineraryService.getItineraryById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    public ResponseEntity<List<Itinerary>> searchItineraries(
            @RequestParam String destination,
            @RequestParam(required = false) String category) {
        if (category != null) {
            return ResponseEntity.ok(
                itineraryService.searchByDestinationAndCategory(destination, category)
            );
        }
        return ResponseEntity.ok(itineraryService.searchByDestination(destination));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<List<Itinerary>> getByCategory(@PathVariable String category) {
        return ResponseEntity.ok(
            itineraryService.getByCategory(Itinerary.Category.valueOf(category.toUpperCase()))
        );
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<Itinerary>> getByType(@PathVariable String type) {
        return ResponseEntity.ok(
            itineraryService.getByType(Itinerary.ItineraryType.valueOf(type.toUpperCase()))
        );
    }

    @PostMapping
    public ResponseEntity<Itinerary> createItinerary(@RequestBody Itinerary itinerary) {
        return ResponseEntity.ok(itineraryService.createItinerary(itinerary));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Itinerary> updateItinerary(
            @PathVariable Long id,
            @RequestBody Itinerary itinerary) {
        return ResponseEntity.ok(itineraryService.updateItinerary(id, itinerary));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItinerary(@PathVariable Long id) {
        itineraryService.deleteItinerary(id);
        return ResponseEntity.ok().build();
    }
}
