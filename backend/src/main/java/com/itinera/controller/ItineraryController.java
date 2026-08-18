package com.itinera.controller;

import com.itinera.model.Itinerary;
import com.itinera.repository.ItineraryRepository;
import com.itinera.service.FlyerOcrService;
import com.itinera.service.ItineraryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/itineraries")
public class ItineraryController {

    @Autowired
    private ItineraryService itineraryService;

    @Autowired
    private FlyerOcrService flyerOcrService;

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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Itinerary> createItinerary(@RequestBody Itinerary itinerary) {
        return ResponseEntity.ok(itineraryService.createItinerary(itinerary));
    }

    // OCRs a flyer/poster photo into raw text - the admin's paste-and-parse
    // box (flyerTextParser.js on the frontend) does the actual structuring,
    // this just gets text out of an image for it.
    @PostMapping(value = "/extract-from-flyer", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> extractFromFlyer(@RequestParam("flyer") MultipartFile flyer) {
        if (flyer.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No image uploaded"));
        }
        String contentType = flyer.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Uploaded file must be an image"));
        }
        try {
            String text = flyerOcrService.extractText(flyer.getBytes());
            return ResponseEntity.ok(Map.of("text", text));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Could not read uploaded image"));
        }
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
