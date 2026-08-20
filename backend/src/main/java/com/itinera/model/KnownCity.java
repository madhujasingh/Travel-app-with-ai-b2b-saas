package com.itinera.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// A curated list of high-traffic cities, added deliberately (by an admin)
// rather than derived from customer search activity. regionIds is resolved
// once when the city is added (see HotelSyncJobRunner.addKnownCity) and
// reused by the periodic refresh job (refreshKnownCities) to check for
// hotels TripJack has added since the last sync - a bounded per-city
// fetch-hotel-mapping call, not a full country scan.
@Entity
@Table(name = "known_cities")
@Data
@NoArgsConstructor
public class KnownCity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "city_name", nullable = false)
    private String cityName;

    // Comma-separated TripJack cityRegionIds, resolved once at add-time.
    @Column(name = "region_ids", nullable = false)
    private String regionIds;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
