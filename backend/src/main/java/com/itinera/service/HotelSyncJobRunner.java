package com.itinera.service;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.model.HotelSyncJob;
import com.itinera.repository.HotelRepository;
import com.itinera.repository.HotelSyncJobRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

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
    private final HotelRepository hotelRepository;

    // Pause between batches - mirrors TripJack's own site's incremental-load
    // behavior (loads ~10 hotels at a time on scroll) instead of hammering
    // their API as fast as possible, which is also what tripped Cloudflare
    // rate-limiting during an earlier, more aggressive attempt at this.
    private static final long BATCH_PAUSE_MS = 500;

    // A city with hotels synced more recently than this doesn't get
    // re-triggered by on-demand sync - old enough that TripJack's inventory
    // for it may have meaningfully changed, recent enough not to re-sync a
    // city every time it's searched.
    private static final int STALENESS_DAYS = 30;

    // Customer searches can trigger this concurrently for different cities -
    // unlike the admin endpoints (one deliberate action at a time), this cap
    // keeps a burst of searches for different never-synced cities from
    // piling up multiple simultaneous background jobs on a small instance.
    private static final int MAX_CONCURRENT_ON_DEMAND_JOBS = 2;
    private final AtomicInteger runningOnDemandJobs = new AtomicInteger(0);

    public HotelSyncJobRunner(HotelCatalogService hotelCatalogService, HotelSyncJobRepository jobRepository, HotelRepository hotelRepository) {
        this.hotelCatalogService = hotelCatalogService;
        this.jobRepository = jobRepository;
        this.hotelRepository = hotelRepository;
    }

    public HotelSyncJob startCountrySync(String countryName, int maxPages) {
        HotelSyncJob job = createJob("COUNTRY", countryName);
        runCountrySync(job.getId(), countryName, maxPages);
        return job;
    }

    public HotelSyncJob startCitySync(String cityName, int lookupMaxPages, int mappingMaxPages) {
        HotelSyncJob job = createJob("CITY", cityName);
        runCitySync(job.getId(), cityName, lookupMaxPages, mappingMaxPages, false);
        return job;
    }

    // Public, customer-facing counterpart to startCitySync (see
    // HotelCatalogController) - powers the city picker's "can't find your
    // city" fallback. Only actually starts a job when the city looks like it
    // needs one: never synced, or not synced within STALENESS_DAYS, and not
    // already being synced right now, and under the concurrency cap. Every
    // other case is a fast, cheap no-op - this is safe to call from live
    // customer traffic, not just deliberate admin action.
    public Map<String, Object> triggerOnDemandCitySync(String cityName) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cityName", cityName);

        LocalDateTime lastSynced = hotelRepository.findMaxSyncedAtByCity(cityName);
        if (lastSynced != null && lastSynced.isAfter(LocalDateTime.now().minusDays(STALENESS_DAYS))) {
            result.put("action", "already-fresh");
            result.put("lastSyncedAt", lastSynced.toString());
            return result;
        }

        boolean alreadyRunningForCity = jobRepository.findTop20ByOrderByStartedAtDesc().stream()
                .anyMatch(job -> "RUNNING".equals(job.getStatus())
                        && "CITY".equals(job.getType())
                        && cityName.equalsIgnoreCase(job.getParam()));
        if (alreadyRunningForCity) {
            result.put("action", "already-running");
            return result;
        }

        if (runningOnDemandJobs.get() >= MAX_CONCURRENT_ON_DEMAND_JOBS) {
            result.put("action", "busy");
            return result;
        }

        runningOnDemandJobs.incrementAndGet();
        HotelSyncJob job = createJob("CITY", cityName);
        // Bounded a bit tighter than the admin default (100 lookup pages) -
        // on-demand triggers can fire from anonymous traffic, so this keeps
        // a single miss (city not in TripJack's index at all) cheaper.
        runCitySync(job.getId(), cityName, 60, 5, true);
        result.put("action", "started");
        result.put("jobId", job.getId());
        return result;
    }

    @Async
    public void runCountrySync(Long jobId, String countryName, int maxPages) {
        runMappingAndSync(jobId, payload -> payload.put("countryName", countryName), maxPages);
    }

    @Async
    public void runCitySync(Long jobId, String cityName, int lookupMaxPages, int mappingMaxPages, boolean onDemand) {
        try {
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
        } finally {
            if (onDemand) {
                runningOnDemandJobs.decrementAndGet();
            }
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
