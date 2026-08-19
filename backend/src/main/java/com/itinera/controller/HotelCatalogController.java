package com.itinera.controller;

import com.itinera.model.Hotel;
import com.itinera.repository.HotelRepository;
import com.itinera.service.HotelCatalogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// Serves our own locally-cached hotel static content (see HotelCatalogService)
// - distinct from HotelController, which is a live passthrough to TripJack's
// dynamic pricing/availability APIs.
@RestController
@RequestMapping("/hotel-catalog")
public class HotelCatalogController {

    private final HotelCatalogService hotelCatalogService;
    private final HotelRepository hotelRepository;

    public HotelCatalogController(HotelCatalogService hotelCatalogService, HotelRepository hotelRepository) {
        this.hotelCatalogService = hotelCatalogService;
        this.hotelRepository = hotelRepository;
    }

    public static class SyncByIdsRequest {
        public List<String> hotelIds;
    }

    // Admin-only (see SecurityConfig) - syncs up to 100 explicit TripJack
    // hotel IDs' static content into our `hotels` table.
    @PostMapping("/sync")
    public ResponseEntity<?> syncByIds(@RequestBody SyncByIdsRequest request) {
        int count = hotelCatalogService.syncHotelContent(request.hotelIds);
        return ResponseEntity.ok(Map.of("synced", count));
    }

    // Admin-only (see SecurityConfig) - full hotel-mapping + hotel-content
    // sync for a whole country, per TripJack support's instruction to
    // download and store all TJ Hotel IDs before Listing/Search will work.
    @PostMapping("/sync-country")
    public ResponseEntity<?> syncCountry(
            @RequestParam String countryName,
            @RequestParam(defaultValue = "1") int maxPages
    ) {
        int count = hotelCatalogService.syncCountry(countryName, maxPages);
        return ResponseEntity.ok(Map.of("synced", count));
    }

    // Admin-only (see SecurityConfig) - syncs every hotel TripJack has
    // mapped for ONE city (resolved to a regionId via fetch-city-regionIds,
    // then fetch-hotel-mapping filtered by that regionId), instead of
    // syncCountry's whole-country pull. Use this to fill in a specific
    // city's coverage - e.g. a low-maxPages country sync can leave a city
    // with only a fraction of its real hotel count synced.
    // lookupMaxPages bounds the regionId search (fetch-city-regionIds has no
    // name filter, so finding one city means paging through the global list
    // at 2000/page); mappingMaxPages bounds the hotel-mapping pull once the
    // regionId is found.
    @PostMapping("/sync-city")
    public ResponseEntity<?> syncCity(
            @RequestParam String cityName,
            @RequestParam(defaultValue = "100") int lookupMaxPages,
            @RequestParam(defaultValue = "5") int mappingMaxPages
    ) {
        Map<String, Object> result = hotelCatalogService.syncCity(cityName, lookupMaxPages, mappingMaxPages);
        return ResponseEntity.ok(result);
    }

    // Public - powers the "search by city" picker on the frontend. Only
    // returns cities that actually have synced hotels, so every result is
    // guaranteed to resolve to real, searchable hotel IDs.
    @GetMapping("/cities")
    public ResponseEntity<List<HotelRepository.CityCount>> cities() {
        return ResponseEntity.ok(hotelRepository.findCityCounts());
    }

    @GetMapping
    public ResponseEntity<List<Hotel>> list(
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String city
    ) {
        if (city != null) {
            return ResponseEntity.ok(hotelRepository.findByCityIgnoreCase(city));
        }
        if (country != null) {
            return ResponseEntity.ok(hotelRepository.findByCountryNameIgnoreCase(country));
        }
        return ResponseEntity.ok(hotelRepository.findAll());
    }

    @GetMapping("/{tjHotelId}")
    public ResponseEntity<Hotel> get(@PathVariable String tjHotelId) {
        return hotelRepository.findById(tjHotelId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
