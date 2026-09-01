package com.itinera.service;

import com.itinera.model.PlatformSettings;
import com.itinera.repository.PlatformSettingsRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlatformSettingsService {

    private static final Long SETTINGS_ID = 1L;

    private final PlatformSettingsRepository repository;

    public PlatformSettingsService(PlatformSettingsRepository repository) {
        this.repository = repository;
    }

    public PlatformSettings get() {
        return repository.findById(SETTINGS_ID).orElseGet(() -> repository.save(new PlatformSettings()));
    }

    public PlatformSettings updateFlightConvenienceFee(Double newFee) {
        if (newFee == null || newFee < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Convenience fee must be a non-negative number");
        }
        PlatformSettings settings = get();
        settings.setFlightConvenienceFee(newFee);
        return repository.save(settings);
    }
}
