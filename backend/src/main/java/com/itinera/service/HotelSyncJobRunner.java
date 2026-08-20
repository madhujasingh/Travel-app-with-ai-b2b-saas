package com.itinera.service;

import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.model.HotelSyncJob;
import com.itinera.repository.HotelSyncJobRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
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

    // Caps each of the NEW/UPDATE/DELETE delta pulls at 50 pages * 2000/page
    // = 100,000 records per run - a normal daily run should be a tiny
    // fraction of that (see refreshGlobalDelta). This only matters as a
    // safety net if the watermark somehow goes stale for a while.
    private static final int DELTA_SYNC_MAX_PAGES = 50;

    public HotelSyncJobRunner(
            HotelCatalogService hotelCatalogService,
            HotelSyncJobRepository jobRepository,
            @Lazy HotelSyncJobRunner self
    ) {
        this.hotelCatalogService = hotelCatalogService;
        this.jobRepository = jobRepository;
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

    // Runs daily - the global "keep it fresh" sync. Unlike the old per-city
    // regionId refresh this replaces, it needs no city/country curation and
    // can't hit the same-name-wrong-country bug (it uses TripJack's
    // dedicated NEW/UPDATE/DELETE mapping-sync feeds, not a name lookup).
    //
    // Watermark: the lastUpdateTime sent to TripJack is this job type's most
    // recent COMPLETED run's startedAt (not "now", and not that run's
    // completedAt - using startedAt means nothing that changed while a run
    // was executing gets missed by the next one). The very first run has no
    // prior COMPLETED job to anchor to, so it falls back to its own
    // startedAt - i.e. it watches from the moment it first runs, not from
    // TripJack's entire history (which would mean ~1.6M hotels worldwide).
    //
    // If any of the three pulls hits DELTA_SYNC_MAX_PAGES without the
    // cursor running out, the job is marked PARTIAL instead of COMPLETED so
    // its startedAt is never used as a watermark - the next run naturally
    // retries the same range instead of silently skipping whatever was past
    // the cap (safe either way, since every sync here is an upsert).
    @Scheduled(cron = "0 0 4 * * *")
    public void refreshGlobalDelta() {
        startGlobalDeltaSync();
    }

    // Manual trigger (see HotelCatalogController) - same logic the schedule
    // runs, exposed so an admin can force a run instead of waiting for 4am.
    public HotelSyncJob startGlobalDeltaSync() {
        String watermark = jobRepository.findTopByTypeAndStatusOrderByStartedAtDesc("GLOBAL_DELTA", "COMPLETED")
                .map(j -> j.getStartedAt().toString() + "Z")
                .orElse(LocalDateTime.now().toString() + "Z");

        HotelSyncJob job = createJob("GLOBAL_DELTA", watermark);
        self.runGlobalDeltaSync(job.getId(), watermark);
        return job;
    }

    @Async
    public void runGlobalDeltaSync(Long jobId, String watermark) {
        HotelSyncJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            return;
        }
        try {
            job.setStatus("RUNNING");
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);

            HotelCatalogService.SyncPage newIds = hotelCatalogService.collectSyncIds("NEW", watermark, DELTA_SYNC_MAX_PAGES);
            HotelCatalogService.SyncPage updatedIds = hotelCatalogService.collectSyncIds("UPDATE", watermark, DELTA_SYNC_MAX_PAGES);
            HotelCatalogService.SyncPage deletedIds = hotelCatalogService.collectSyncIds("DELETE", watermark, DELTA_SYNC_MAX_PAGES);

            Set<String> toSync = new LinkedHashSet<>(newIds.ids());
            toSync.addAll(updatedIds.ids());

            job.setTotalMapped(toSync.size());
            jobRepository.save(job);

            int synced = 0;
            List<String> toSyncList = List.copyOf(toSync);
            for (int i = 0; i < toSyncList.size(); i += 100) {
                List<String> batch = toSyncList.subList(i, Math.min(i + 100, toSyncList.size()));
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

            hotelCatalogService.deleteHotelsByTjHotelIds(deletedIds.ids());
            job.setTotalDeleted(deletedIds.ids().size());

            boolean truncated = newIds.truncated() || updatedIds.truncated() || deletedIds.truncated();
            job.setStatus(truncated ? "PARTIAL" : "COMPLETED");
            job.setCompletedAt(LocalDateTime.now());
            job.setUpdatedAt(LocalDateTime.now());
            jobRepository.save(job);
        } catch (Exception e) {
            markFailed(jobId, e);
        }
    }

    @Async
    public void runCountrySync(Long jobId, String countryName, int maxPages) {
        runMappingAndSync(jobId, payload -> payload.put("countryName", countryName), maxPages);
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
