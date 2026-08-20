package com.itinera.controller;

import com.itinera.model.Hotel;
import com.itinera.model.HotelSyncJob;
import com.itinera.repository.HotelRepository;
import com.itinera.repository.HotelSyncJobRepository;
import com.itinera.service.HotelCatalogService;
import com.itinera.service.HotelSyncJobRunner;
import org.springframework.http.HttpStatus;
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
    private final HotelSyncJobRunner hotelSyncJobRunner;
    private final HotelRepository hotelRepository;
    private final HotelSyncJobRepository hotelSyncJobRepository;

    public HotelCatalogController(
            HotelCatalogService hotelCatalogService,
            HotelSyncJobRunner hotelSyncJobRunner,
            HotelRepository hotelRepository,
            HotelSyncJobRepository hotelSyncJobRepository
    ) {
        this.hotelCatalogService = hotelCatalogService;
        this.hotelSyncJobRunner = hotelSyncJobRunner;
        this.hotelRepository = hotelRepository;
        this.hotelSyncJobRepository = hotelSyncJobRepository;
    }

    public static class SyncByIdsRequest {
        public List<String> hotelIds;
    }

    // Admin-only (see SecurityConfig) - syncs up to 100 explicit TripJack
    // hotel IDs' static content into our `hotels` table. Small/bounded
    // enough to stay synchronous - the OOM risk that made sync-country/
    // sync-city async only shows up at much larger volumes.
    @PostMapping("/sync")
    public ResponseEntity<?> syncByIds(@RequestBody SyncByIdsRequest request) {
        int count = hotelCatalogService.syncHotelContent(request.hotelIds);
        return ResponseEntity.ok(Map.of("synced", count));
    }

    // Admin-only (see SecurityConfig) - starts a background job (see
    // HotelSyncJob) that runs full hotel-mapping + hotel-content sync for a
    // whole country, per TripJack support's instruction to download and
    // store all TJ Hotel IDs before Listing/Search will work. Returns
    // immediately with a job id - poll GET /hotel-catalog/sync-jobs/{id} for
    // progress. This used to be a single synchronous request, which both
    // risked the HTTP call timing out on large syncs and OOM-crashed the
    // backend once by holding thousands of Hotel entities in memory across
    // one giant transaction - see HotelSyncJobRunner.
    @PostMapping("/sync-country")
    public ResponseEntity<?> syncCountry(
            @RequestParam String countryName,
            @RequestParam(defaultValue = "1") int maxPages
    ) {
        HotelSyncJob job = hotelSyncJobRunner.startCountrySync(countryName, maxPages);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(job);
    }

    // Admin-only (see SecurityConfig) - starts a background job that syncs
    // every hotel TripJack has mapped for ONE city (resolved to a regionId
    // via fetch-city-regionIds, then fetch-hotel-mapping filtered by that
    // regionId), instead of syncCountry's whole-country pull. Use this to
    // fill in a specific city's coverage - e.g. a low-maxPages country sync
    // can leave a city with only a fraction of its real hotel count synced.
    // Returns immediately with a job id - poll GET /hotel-catalog/sync-jobs/{id}.
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
        HotelSyncJob job = hotelSyncJobRunner.startCitySync(cityName, lookupMaxPages, mappingMaxPages);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(job);
    }

    // Admin-only (see SecurityConfig) - poll one sync job's progress/status.
    @GetMapping("/sync-jobs/{id}")
    public ResponseEntity<HotelSyncJob> syncJob(@PathVariable Long id) {
        return hotelSyncJobRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Admin-only (see SecurityConfig) - the 20 most recently started sync jobs.
    @GetMapping("/sync-jobs")
    public ResponseEntity<List<HotelSyncJob>> syncJobs() {
        return ResponseEntity.ok(hotelSyncJobRepository.findTop20ByOrderByStartedAtDesc());
    }

    // Admin-only (see SecurityConfig) - one-time cleanup for hotels synced
    // before the catalog switched to storing only lightweight fields in
    // bulk (see HotelCatalogService.clearHeavyContent). A single bulk SQL
    // UPDATE, not a loop - fast and safe to run directly regardless of how
    // many rows exist.
    @PostMapping("/cleanup-heavy-content")
    public ResponseEntity<?> cleanupHeavyContent() {
        int updated = hotelCatalogService.clearHeavyContent();
        return ResponseEntity.ok(Map.of("clearedRows", updated));
    }

    // Admin-only (see SecurityConfig) - reclaims the disk space
    // cleanup-heavy-content's NULLs freed up. Postgres doesn't return that
    // space on its own until VACUUM runs (autovacuum gets to it eventually,
    // but not on demand), so this runs VACUUM directly.
    @PostMapping("/vacuum")
    public ResponseEntity<?> vacuum() {
        hotelCatalogService.vacuumHotelsTable();
        return ResponseEntity.ok(hotelCatalogService.hotelsTableStorageStats());
    }

    // Admin-only (see SecurityConfig) - real on-disk size of the hotels
    // table, to verify storage changes actually took effect rather than
    // trusting a dashboard percentage that may lag or round.
    @GetMapping("/storage-stats")
    public ResponseEntity<?> storageStats() {
        return ResponseEntity.ok(hotelCatalogService.hotelsTableStorageStats());
    }

    // Admin-only (see SecurityConfig) - manually triggers the global
    // NEW/UPDATE/DELETE delta sync (see HotelSyncJobRunner.refreshGlobalDelta)
    // instead of waiting for its 4am schedule. Returns immediately with a
    // job id - poll GET /hotel-catalog/sync-jobs/{id}.
    @PostMapping("/sync-global-delta")
    public ResponseEntity<?> syncGlobalDelta() {
        HotelSyncJob job = hotelSyncJobRunner.startGlobalDeltaSync();
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(job);
    }

    // Admin-only (see SecurityConfig) - trims a country's catalog down to
    // just the given cities (see HotelCatalogService.pruneCountryToCities).
    // Meant to clean up after a full country sync brought in far more
    // cities than are actually worth keeping searchable.
    @DeleteMapping("/cities")
    public ResponseEntity<?> pruneCountryToCities(
            @RequestParam String countryName,
            @RequestParam List<String> keepCities
    ) {
        int removed = hotelCatalogService.pruneCountryToCities(countryName, keepCities);
        return ResponseEntity.ok(Map.of("removedHotels", removed));
    }

    // Public - fetches one hotel's full content (images, amenities,
    // descriptions, policies) live from TripJack rather than our cache,
    // since the bulk catalog sync deliberately doesn't store that heavy
    // content for every hotel - only the lightweight fields needed for
    // search results (see HotelCatalogService.mapToHotelForCatalog). Used by
    // the hotel detail screen.
    @GetMapping("/{tjHotelId}/live")
    public ResponseEntity<Hotel> getLive(@PathVariable String tjHotelId) {
        Hotel hotel = hotelCatalogService.fetchLiveContent(tjHotelId);
        return hotel != null ? ResponseEntity.ok(hotel) : ResponseEntity.notFound().build();
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
