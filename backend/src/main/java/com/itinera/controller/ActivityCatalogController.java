package com.itinera.controller;

import com.itinera.service.ActivityCatalogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// Admin-triggered sync of the local Activities catalog cache from HotelBeds'
// Cache/Portfolio API (see ActivityCatalogService). There's no automated
// schedule wired up yet - Render's free tier can't run @Scheduled reliably,
// so this needs either a manual admin trigger or an external cron service
// hitting this endpoint (would need its own auth story, since a JWT would
// expire - not built yet).
@RestController
@RequestMapping("/activity-catalog")
public class ActivityCatalogController {

    private final ActivityCatalogService activityCatalogService;

    public ActivityCatalogController(ActivityCatalogService activityCatalogService) {
        this.activityCatalogService = activityCatalogService;
    }

    @PostMapping("/sync/{destinationCode}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> syncDestination(@PathVariable String destinationCode) {
        int count = activityCatalogService.syncDestination(destinationCode);
        return ResponseEntity.ok(Map.of("destination", destinationCode, "synced", count));
    }
}
