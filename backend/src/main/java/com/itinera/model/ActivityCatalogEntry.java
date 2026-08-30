package com.itinera.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Local cache of HotelBeds/HBX Group's Activities Cache/Portfolio API
// (activity-cache-api/1.0/portfolio) - see ActivityCatalogService. This is
// catalog-level data only (which activities exist, name, type, modality
// shapes, suppliers) - NEVER price or availability, which always come from
// the live Availability/Detail APIs at search/booking time and can't be
// cached (a rateKey is single-use and expires in ~30 minutes).
@Entity
@Table(name = "activity_catalog_entries", uniqueConstraints = @UniqueConstraint(columnNames = "activity_code"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivityCatalogEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "activity_code", nullable = false)
    @NotBlank(message = "Activity code is required")
    private String activityCode;

    @Column(nullable = false)
    private String name;

    // Always "TICKET" per the docs today, but stored as-is (not an enum) in
    // case HotelBeds introduces other types later.
    private String type;

    @Column(name = "country_code")
    private String countryCode;

    @Column(name = "destination_code", nullable = false)
    private String destinationCode;

    // The full portfolio entry as returned (modalities, paxRange, suppliers,
    // etc.) - stored as raw JSON rather than a deep entity graph, since this
    // is display/reference data we don't need to query into individually.
    @Column(name = "raw_json", columnDefinition = "TEXT")
    private String rawJson;

    @Column(name = "synced_at")
    private LocalDateTime syncedAt;
}
