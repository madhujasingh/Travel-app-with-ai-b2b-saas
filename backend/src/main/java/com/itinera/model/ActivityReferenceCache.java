package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Local cache of HotelBeds Activities static reference data (countries,
// destinations) - per their own "Cache build" doc, this is data that
// "must" be cached and refreshed monthly, unlike Detail/Availability
// responses which must never be cached. Refreshed lazily on read (see
// ActivitiesService) rather than on a cron schedule, since this data
// barely changes and Render's free tier can't run @Scheduled reliably
// anyway (see project_render_backend_free_tier memory).
@Entity
@Table(name = "activity_reference_cache", uniqueConstraints = @UniqueConstraint(columnNames = "cache_key"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivityReferenceCache {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // e.g. "countries:en" or "destinations:en:ES"
    @Column(name = "cache_key", nullable = false)
    private String cacheKey;

    @Column(name = "raw_json", columnDefinition = "TEXT", nullable = false)
    private String rawJson;

    @Column(name = "refreshed_at", nullable = false)
    private LocalDateTime refreshedAt;
}
