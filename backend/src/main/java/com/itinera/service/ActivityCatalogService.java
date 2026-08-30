package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.model.ActivityCatalogEntry;
import com.itinera.repository.ActivityCatalogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Syncs one destination's activity catalog from HotelBeds' Cache/Portfolio
// API into ActivityCatalogEntry. This is the only supported way to keep a
// local copy in sync per HotelBeds' own docs - there's no delta/webhook
// API, just a bulk paginated pull you're expected to re-run periodically
// (see ActivityCatalogController for the admin-triggered endpoint).
@Service
public class ActivityCatalogService {

    private static final Logger log = LoggerFactory.getLogger(ActivityCatalogService.class);

    // HotelBeds doesn't return a total count in the portfolio response - we
    // just keep paging until a page comes back with fewer than PAGE_SIZE
    // items (or 204/empty), which means we've reached the end.
    private static final int PAGE_SIZE = 100;
    // Hard ceiling so a client-side bug (e.g. HotelBeds always returning a
    // full page) can't turn into an infinite loop against a live API.
    private static final int MAX_PAGES = 200;

    private final ActivitiesService activitiesService;
    private final ActivityCatalogRepository activityCatalogRepository;

    public ActivityCatalogService(ActivitiesService activitiesService, ActivityCatalogRepository activityCatalogRepository) {
        this.activitiesService = activitiesService;
        this.activityCatalogRepository = activityCatalogRepository;
    }

    @Transactional
    public int syncDestination(String destinationCode) {
        List<JsonNode> allEntries = fetchAllPages(destinationCode);
        Map<String, ObjectNode> mergedByCode = mergeByActivityCode(allEntries);

        LocalDateTime now = LocalDateTime.now();
        for (Map.Entry<String, ObjectNode> entry : mergedByCode.entrySet()) {
            String activityCode = entry.getKey();
            ObjectNode merged = entry.getValue();

            ActivityCatalogEntry catalogEntry = activityCatalogRepository.findByActivityCode(activityCode)
                    .orElseGet(ActivityCatalogEntry::new);
            catalogEntry.setActivityCode(activityCode);
            catalogEntry.setName(merged.path("name").asText(""));
            catalogEntry.setType(merged.path("type").asText(null));
            catalogEntry.setCountryCode(merged.path("country").asText(null));
            catalogEntry.setDestinationCode(destinationCode);
            catalogEntry.setRawJson(merged.toString());
            catalogEntry.setSyncedAt(now);
            activityCatalogRepository.save(catalogEntry);
        }

        List<String> freshCodes = new ArrayList<>(mergedByCode.keySet());

        // Remove anything for this destination that wasn't in the fresh pull
        // (discontinued, or dropped out of sale) - keeps the cache accurate
        // instead of only ever growing.
        if (freshCodes.isEmpty()) {
            activityCatalogRepository.deleteByDestinationCode(destinationCode);
        } else {
            activityCatalogRepository.deleteByDestinationCodeAndActivityCodeNotIn(destinationCode, freshCodes);
        }

        log.info("Synced {} activities for destination {}", freshCodes.size(), destinationCode);
        return freshCodes.size();
    }

    // The portfolio response has one entry PER MODALITY, not per activity -
    // the same activityCode can (and does, confirmed live against BCN) appear
    // multiple times with a different single-element "modalities" array each
    // time. Naively upserting per raw entry would silently overwrite one
    // modality with the next instead of accumulating them, so group by code
    // first and merge every entry's modalities into one list per activity.
    private Map<String, ObjectNode> mergeByActivityCode(List<JsonNode> entries) {
        Map<String, ObjectNode> mergedByCode = new LinkedHashMap<>();

        for (JsonNode entry : entries) {
            String activityCode = entry.path("code").asText(null);
            if (activityCode == null || activityCode.isBlank() || !entry.isObject()) {
                continue;
            }

            ObjectNode existing = mergedByCode.get(activityCode);
            if (existing == null) {
                ObjectNode copy = ((ObjectNode) entry).deepCopy();
                copy.withArray("modalities");
                mergedByCode.put(activityCode, copy);
            } else {
                ArrayNode existingModalities = existing.withArray("modalities");
                entry.path("modalities").forEach(existingModalities::add);
            }
        }

        return mergedByCode;
    }

    private List<JsonNode> fetchAllPages(String destinationCode) {
        List<JsonNode> allEntries = new ArrayList<>();

        for (int page = 0; page < MAX_PAGES; page++) {
            int offset = page * PAGE_SIZE;
            JsonNode response = activitiesService.portfolio(destinationCode, offset, PAGE_SIZE);

            if (response == null || !response.isArray() || response.isEmpty()) {
                break;
            }

            response.forEach(allEntries::add);

            if (response.size() < PAGE_SIZE) {
                break;
            }
        }

        return allEntries;
    }
}
