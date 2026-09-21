package com.itinera.controller;

import com.itinera.model.Itinerary;
import com.itinera.repository.ItineraryRepository;
import com.itinera.service.AiItineraryService;
import com.itinera.service.ItineraryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/itineraries")
public class ItineraryController {

    @Autowired
    private ItineraryService itineraryService;

    @Autowired
    private AiItineraryService aiItineraryService;

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

    // Public - powers a "pick from known destinations" UI (e.g. the group
    // trip planner's destination field), same pattern as
    // HotelCatalogController's /cities endpoint.
    @GetMapping("/destinations")
    public ResponseEntity<List<ItineraryRepository.DestinationCount>> getDestinations() {
        return ResponseEntity.ok(itineraryService.getDestinations());
    }

    // destination and budget are both optional, but at least one is required -
    // Home's trip search lets the traveller fill either or both. With a
    // destination we can fall back to generating packages for it; with only a
    // budget we can only offer what already exists, since AiItineraryService
    // generates per destination and has nothing to generate for here.
    @GetMapping("/search")
    public ResponseEntity<List<Itinerary>> searchItineraries(
            @RequestParam(required = false) String destination,
            @RequestParam(required = false) BigDecimal budget,
            @RequestParam(required = false) String category) {

        if (destination == null || destination.isBlank()) {
            if (budget == null || budget.signum() <= 0) {
                return ResponseEntity.badRequest().build();
            }
            return ResponseEntity.ok(itineraryService.searchByBudget(budget));
        }

        List<Itinerary> results = category != null
                ? itineraryService.searchByDestinationAndCategory(destination, category)
                : itineraryService.searchByDestination(destination);

        // No curated packages exist for this destination yet - hand-authoring
        // one for every possible destination isn't realistic, so generate AI
        // options on the fly instead. Persisted (see AiItineraryService) so
        // the next search for the same destination is a normal DB read, not
        // another Gemini call.
        if (results.isEmpty()) {
            results = aiItineraryService.generateForDestination(destination);
        }

        return ResponseEntity.ok(results);
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Itinerary> createItinerary(@RequestBody Itinerary itinerary) {
        return ResponseEntity.ok(itineraryService.createItinerary(itinerary));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Itinerary> updateItinerary(
            @PathVariable Long id,
            @RequestBody Itinerary itinerary) {
        return ResponseEntity.ok(itineraryService.updateItinerary(id, itinerary));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteItinerary(@PathVariable Long id) {
        itineraryService.deleteItinerary(id);
        return ResponseEntity.ok().build();
    }
}
