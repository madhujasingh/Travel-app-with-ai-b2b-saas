package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinera.model.ActivityReferenceCache;
import com.itinera.repository.ActivityReferenceCacheRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.function.Supplier;

// HotelBeds/HBX Group Activities API - separate provider from TripJack
// (see ActivitiesClient/ActivitiesConfig).
@Service
public class ActivitiesService {

    // Per HotelBeds' own "Cache build" doc: countries/destinations mapping
    // "must" be cached and refreshed monthly - unlike Detail/Availability,
    // which must never be cached and always hit them live.
    private static final long REFERENCE_CACHE_TTL_DAYS = 30;

    private final ActivitiesClient activitiesClient;
    private final ActivityReferenceCacheRepository referenceCacheRepository;
    private final ObjectMapper objectMapper;

    public ActivitiesService(
            ActivitiesClient activitiesClient,
            ActivityReferenceCacheRepository referenceCacheRepository,
            ObjectMapper objectMapper
    ) {
        this.activitiesClient = activitiesClient;
        this.referenceCacheRepository = referenceCacheRepository;
        this.objectMapper = objectMapper;
    }

    // POST /activity-api/3.0/activities/availability - filters (destination/
    // hotel/GPS/factsheet/segment/priceRange/text), from/to dates, paxes,
    // language, pagination, order. See the Availability doc for the full
    // filter-combination rules.
    public JsonNode search(JsonNode payload) {
        return activitiesClient.post("/activity-api/3.0/activities/availability", payload);
    }

    // POST /activity-api/3.0/activities/details - {code, from, to, language,
    // paxes}. IMPORTANT: `code` must be the search response's
    // `activities[].content.activityCode` (e.g. "E-E10-A1AANO0488"), NOT the
    // top-level `activities[].activityCode` (e.g. "A1AANO0488") - the two
    // are different identifiers and only the content one resolves here
    // (confirmed live; the top-level one 400s with E_ACTIVITYDETAIL_NOTFOUND).
    // Returns rateKeys (valid 30 min) needed to confirm a booking.
    public JsonNode detail(JsonNode payload) {
        return activitiesClient.post("/activity-api/3.0/activities/details", payload);
    }

    // Same as detail() but the full contents factsheet - POST
    // /activity-api/3.0/activities/details/full. Same `code` caveat applies.
    public JsonNode detailFull(JsonNode payload) {
        return activitiesClient.post("/activity-api/3.0/activities/details/full", payload);
    }

    // PUT /activity-api/3.0/bookings - single-step confirm. Unlike TripJack's
    // hotel/flight booking, there's no paymentInfos/amount in this request at
    // all - HotelBeds bills against the agency account directly, so there's
    // no payment-gateway dependency blocking this the way there was for
    // hotels. rateKey (from detail(), valid 30 min) identifies what's being
    // booked.
    public JsonNode confirmBooking(JsonNode payload) {
        return activitiesClient.put("/activity-api/3.0/bookings", payload);
    }

    // Two-step alternative to confirmBooking(), for when a payment gateway
    // needs to sit in between (preconfirm locks stock for 30 min, reconfirm
    // finalizes after payment succeeds). Not currently used by the frontend -
    // confirmBooking() covers the account-billed flow we actually need.
    public JsonNode preconfirmBooking(JsonNode payload) {
        return activitiesClient.put("/activity-api/3.0/bookings/preconfirm", payload);
    }

    public JsonNode reconfirmBooking(JsonNode payload) {
        return activitiesClient.put("/activity-api/3.0/bookings/reconfirm", payload);
    }

    // GET /activity-api/3.0/bookings/{language}/{reference} - status +
    // full booking info, same shape as the confirm response.
    public JsonNode bookingDetail(String language, String reference) {
        return activitiesClient.get("/activity-api/3.0/bookings/" + language + "/" + reference);
    }

    // DELETE /activity-api/3.0/bookings/{language}/{reference}?cancellationFlag=X
    // - cancellationFlag must be "SIMULATION" (preview charges, no-op) or
    // "CANCELLATION" (actually cancels). Always simulate first in the UI.
    public JsonNode cancelBooking(String language, String reference, String cancellationFlag) {
        return activitiesClient.delete(
                "/activity-api/3.0/bookings/" + language + "/" + reference + "?cancellationFlag=" + cancellationFlag
        );
    }

    // Content API (activity-content-api/3.0) - separate base path from the
    // booking product above, but same host/credentials. Static reference
    // data (countries/destinations) that powers the search form's picker,
    // so customers pick a real destination instead of typing a raw code.
    // Cached (see cachedOrLive) since this barely ever changes - avoids
    // hitting HotelBeds live every time a customer opens the picker.
    public JsonNode countries(String language) {
        return cachedOrLive(
                "countries:" + language,
                () -> activitiesClient.get("/activity-content-api/3.0/countries/" + language)
        );
    }

    public JsonNode destinations(String language, String countryCode) {
        return cachedOrLive(
                "destinations:" + language + ":" + countryCode,
                () -> activitiesClient.get("/activity-content-api/3.0/destinations/" + language + "/" + countryCode)
        );
    }

    // Lazy cache-aside, refreshed on the next request past the TTL rather
    // than on a cron schedule - Render's free tier can't run @Scheduled
    // reliably (see project_render_backend_free_tier), and this data doesn't
    // need to be fresher than "at most a month old" per HotelBeds' own
    // recommendation, so there's nothing a cron would buy us here. Cache
    // read/write failures are swallowed and fall back to a single live call -
    // this is a best-effort optimization, never allowed to block the picker.
    private JsonNode cachedOrLive(String cacheKey, Supplier<JsonNode> liveFetch) {
        ActivityReferenceCache cached = null;
        try {
            var existing = referenceCacheRepository.findByCacheKey(cacheKey);
            if (existing.isPresent()
                    && existing.get().getRefreshedAt().isAfter(LocalDateTime.now().minusDays(REFERENCE_CACHE_TTL_DAYS))) {
                return objectMapper.readTree(existing.get().getRawJson());
            }
            cached = existing.orElse(null);
        } catch (Exception ignored) {
            // Fall through to a live fetch below.
        }

        JsonNode live = liveFetch.get();

        try {
            ActivityReferenceCache entry = cached != null ? cached : new ActivityReferenceCache();
            entry.setCacheKey(cacheKey);
            entry.setRawJson(live.toString());
            entry.setRefreshedAt(LocalDateTime.now());
            referenceCacheRepository.save(entry);
        } catch (Exception ignored) {
            // Best-effort - the live response is already what we're returning.
        }

        return live;
    }

    // Category taxonomy (City Tours, Water Sports, ...) - powers the search
    // form's optional category filter. Per the Availability docs, only ONE
    // segment code is allowed per search, and it must be combined with a
    // destination/hotel/GPS filter, never used alone. Cached like
    // countries/destinations - this taxonomy barely changes but gets hit on
    // every search screen open.
    public JsonNode segments(String language) {
        return cachedOrLive(
                "segments:" + language,
                () -> activitiesClient.get("/activity-content-api/3.0/segments/" + language)
        );
    }

    // Cache API (activity-cache-api/1.0) - yet another separate base path,
    // same host/credentials. Bulk/paginated catalog pull per destination
    // (code/name/type/modalities/paxRange/suppliers, no dates or pricing) -
    // HotelBeds' own docs describe this as the intended way to sync/cache
    // activity data, as opposed to Availability which is always live and
    // date-scoped. See ActivityCatalogService for how this gets paginated
    // and persisted.
    public JsonNode portfolio(String destinationCode, int offset, int limit) {
        return activitiesClient.get(
                "/activity-cache-api/1.0/portfolio?destination=" + destinationCode + "&offset=" + offset + "&limit=" + limit
        );
    }
}
