package com.itinera.service;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.model.HotelSyncJob;
import com.itinera.model.KnownCity;
import com.itinera.repository.HotelSyncJobRepository;
import com.itinera.repository.KnownCityRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Collectors;

// Runs HotelCatalogService syncs as background jobs (see HotelSyncJob)
// instead of one long synchronous HTTP request. A prior synchronous
// sync-country call OOM-crashed the backend - Hibernate's persistence
// context grew unbounded across thousands of hotels saved in a single
// request/transaction. This fixes both problems at once: the HTTP call
// that starts a job returns immediately, and HotelCatalogService.
// syncHotelContentBatch commits (and clears the persistence context) in its
// own short transaction per 100-hotel batch, so memory use stays bounded no
// matter how large the job is.
//
// The @Async methods here must live in a separate bean from
// HotelCatalogService/the controller that calls them - Spring's @Async proxy
// only intercepts calls that cross a real bean boundary, so calling an
// @Async method on `this` from within the same class would silently run
// synchronously instead.
@Service
public class HotelSyncJobRunner {

    private final HotelCatalogService hotelCatalogService;
    private final HotelSyncJobRepository jobRepository;
    private final KnownCityRepository knownCityRepository;

    // Self-injected proxy reference - calling an @Async method via `this.`
    // from another method in this same class bypasses Spring's @Async proxy
    // entirely (self-invocation isn't intercepted), so it would silently run
    // synchronously instead of being dispatched to a background thread.
    // Routing internal calls through `self` instead goes through the real
    // proxy. @Lazy breaks the circular dependency this otherwise creates.
    private final HotelSyncJobRunner self;

    // Pause between batches - mirrors TripJack's own site's incremental-load
    // behavior (loads ~10 hotels at a time on scroll) instead of hammering
    // their API as fast as possible, which is also what tripped Cloudflare
    // rate-limiting during an earlier, more aggressive attempt at this.
    private static final long BATCH_PAUSE_MS = 500;

    // Extra pause between cities in the periodic known-city refresh, on top
    // of BATCH_PAUSE_MS between each city's own 100-hotel batches - spreads
    // the whole run out rather than hammering TripJack city after city.
    private static final long CITY_REFRESH_PAUSE_MS = 2000;

    // Bounds each known city's periodic refresh - it's re-checking a city
    // whose regionIds are already known (not searching for it), so this only
    // needs to be big enough to page through that one city's current hotel
    // count, not a whole country.
    private static final int KNOWN_CITY_REFRESH_MAX_PAGES = 5;

    public HotelSyncJobRunner(
            HotelCatalogService hotelCatalogService,
            HotelSyncJobRepository jobRepository,
            KnownCityRepository knownCityRepository,
            @Lazy HotelSyncJobRunner self
    ) {
        this.hotelCatalogService = hotelCatalogService;
        this.jobRepository = jobRepository;
        this.knownCityRepository = knownCityRepository;
        this.self = self;
    }

    public HotelSyncJob startCountrySync(String countryName, int maxPages) {
        HotelSyncJob job = createJob("COUNTRY", countryName);
        self.runCountrySync(job.getId(), countryName, maxPages);
        return job;
    }

    public HotelSyncJob startCitySync(String cityName, int lookupMaxPages, int mappingMaxPages) {
        HotelSyncJob job = createJob("CITY", cityName);
        self.runCitySync(job.getId(), cityName, lookupMaxPages, mappingMaxPages);
        return job;
    }

    // Admin-only (see HotelCatalogController/SecurityConfig) - adds a city to
    // the curated "high-traffic" list. Resolves its regionIds once (bounded
    // lookup - fetch-city-regionIds has no name filter, so this can still
    // miss a real city, same as the admin sync-city path) and, if found,
    // stores them on the KnownCity row and kicks off an initial sync so the
    // city is searchable right away. The stored regionIds are what
    // refreshKnownCities reuses later - no re-lookup needed on every refresh.
    public Map<String, Object> addKnownCity(String cityName, int lookupMaxPages) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cityName", cityName);

        if (knownCityRepository.findByCityNameIgnoreCase(cityName).isPresent()) {
            result.put("action", "already-known");
            return result;
        }

        List<Long> regionIds = hotelCatalogService.findRegionIds(cityName, lookupMaxPages);
        if (regionIds.isEmpty()) {
            result.put("action", "not-found");
            return result;
        }

        KnownCity known = new KnownCity();
        known.setCityName(cityName);
        known.setRegionIds(joinRegionIds(regionIds));
        known.setCreatedAt(LocalDateTime.now());
        known = knownCityRepository.save(known);

        HotelSyncJob job = createJob("CITY", cityName);
        job.setRegionIds(regionIds.toString());
        jobRepository.save(job);
        self.runCityMappingSync(job.getId(), regionIds);

        result.put("action", "started");
        result.put("knownCityId", known.getId());
        result.put("jobId", job.getId());
        return result;
    }

    public List<KnownCity> listKnownCities() {
        return knownCityRepository.findAllByOrderByCityNameAsc();
    }

    public void removeKnownCity(Long id) {
        knownCityRepository.deleteById(id);
    }

    // Runs daily - re-checks every curated city for hotels TripJack has
    // added since the last sync, using each city's already-resolved
    // regionIds (see addKnownCity) rather than a country-wide scan. Cities
    // run one at a time (not concurrently) with a pause between each, same
    // gentle-polling reasoning as BATCH_PAUSE_MS - a scheduled background
    // job has no reason to burst all cities at once.
    @Scheduled(cron = "0 0 4 * * *")
    public void refreshKnownCities() {
        for (KnownCity city : knownCityRepository.findAllByOrderByCityNameAsc()) {
            List<Long> regionIds = parseRegionIds(city.getRegionIds());
            if (regionIds.isEmpty()) {
                continue;
            }

            HotelSyncJob job = createJob("CITY_REFRESH", city.getCityName());
            job.setRegionIds(city.getRegionIds());
            jobRepository.save(job);

            runMappingAndSync(job.getId(), payload -> {
                ArrayNode regionIdsNode = payload.putArray("regionIds");
                regionIds.forEach(id -> regionIdsNode.add(String.valueOf(id)));
            }, KNOWN_CITY_REFRESH_MAX_PAGES);

            city.setLastSyncedAt(LocalDateTime.now());
            knownCityRepository.save(city);

            try {
                Thread.sleep(CITY_REFRESH_PAUSE_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    private String joinRegionIds(List<Long> regionIds) {
        return regionIds.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private List<Long> parseRegionIds(String csv) {
        List<Long> ids = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            return ids;
        }
        for (String part : csv.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                ids.add(Long.parseLong(trimmed));
            }
        }
        return ids;
    }

    @Async
    public void runCountrySync(Long jobId, String countryName, int maxPages) {
        runMappingAndSync(jobId, payload -> payload.put("countryName", countryName), maxPages);
    }

    // Used once a city's regionIds are already known (either from
    // addKnownCity's lookup, or - see runCitySync below - found during the
    // admin path's own lookup) - skips re-resolving them and goes straight
    // to the mapping+content sync.
    @Async
    public void runCityMappingSync(Long jobId, List<Long> regionIds) {
        runMappingAndSync(jobId, payload -> {
            ArrayNode regionIdsNode = payload.putArray("regionIds");
            regionIds.forEach(id -> regionIdsNode.add(String.valueOf(id)));
        }, KNOWN_CITY_REFRESH_MAX_PAGES);
    }

    @Async
    public void runCitySync(Long jobId, String cityName, int lookupMaxPages, int mappingMaxPages) {
        HotelSyncJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }
        try {
            job.setStatus("RUNNING");
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);

            List<Long> regionIds = hotelCatalogService.findRegionIds(cityName, lookupMaxPages);
            if (regionIds.isEmpty()) {
                job.setStatus("FAILED");
                job.setErrorMessage("No matching city found in TripJack's region index within " + lookupMaxPages + " pages");
                job.setUpdatedAt(LocalDateTime.now());
                jobRepository.save(job);
                return;
            }
            job.setRegionIds(regionIds.toString());
            jobRepository.save(job);

            runMappingAndSync(jobId, payload -> {
                ArrayNode regionIdsNode = payload.putArray("regionIds");
                regionIds.forEach(id -> regionIdsNode.add(String.valueOf(id)));
            }, mappingMaxPages);
        } catch (Exception e) {
            markFailed(jobId, e);
        }
    }

    private void runMappingAndSync(Long jobId, Consumer<ObjectNode> payloadFilter, int maxPages) {
        HotelSyncJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }
        try {
            job.setStatus("RUNNING");
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);

            List<String> allIds = hotelCatalogService.collectMappedIds(payloadFilter, maxPages);
            job.setTotalMapped(allIds.size());
            jobRepository.save(job);

            int synced = 0;
            for (int i = 0; i < allIds.size(); i += 100) {
                List<String> batch = allIds.subList(i, Math.min(i + 100, allIds.size()));
                synced += hotelCatalogService.syncHotelContentBatch(batch);

                job.setTotalSynced(synced);
                job.setUpdatedAt(LocalDateTime.now());
                jobRepository.save(job);

                try {
                    Thread.sleep(BATCH_PAUSE_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

            job.setStatus("COMPLETED");
            job.setCompletedAt(LocalDateTime.now());
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);
        } catch (Exception e) {
            markFailed(jobId, e);
        }
    }

    private void markFailed(Long jobId, Exception e) {
        jobRepository.findById(jobId).ifPresent(job -> {
            job.setStatus("FAILED");
            job.setErrorMessage(String.valueOf(e.getMessage()));
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);
        });
    }

    private HotelSyncJob createJob(String type, String param) {
        HotelSyncJob job = new HotelSyncJob();
        job.setType(type);
        job.setParam(param);
        job.setStatus("PENDING");
        job.setStartedAt(LocalDateTime.now());
        job.setUpdatedAt(LocalDateTime.now());
        return jobRepository.save(job);
    }
}
