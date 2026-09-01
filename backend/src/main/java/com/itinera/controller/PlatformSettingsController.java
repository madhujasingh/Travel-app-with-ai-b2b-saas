package com.itinera.controller;

import com.itinera.model.PlatformSettings;
import com.itinera.service.PlatformSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// GET is public (read by every customer screen that shows a price
// breakdown); PUT is ADMIN-only (see SecurityConfig) so only an admin can
// change what the platform charges on top of the supplier fare.
@RestController
@RequestMapping("/platform-settings")
public class PlatformSettingsController {

    private final PlatformSettingsService platformSettingsService;

    public PlatformSettingsController(PlatformSettingsService platformSettingsService) {
        this.platformSettingsService = platformSettingsService;
    }

    @GetMapping
    public ResponseEntity<PlatformSettings> get() {
        return ResponseEntity.ok(platformSettingsService.get());
    }

    @PutMapping("/flight-convenience-fee")
    public ResponseEntity<PlatformSettings> updateFlightConvenienceFee(@RequestBody Map<String, Double> payload) {
        return ResponseEntity.ok(platformSettingsService.updateFlightConvenienceFee(payload.get("flightConvenienceFee")));
    }
}
