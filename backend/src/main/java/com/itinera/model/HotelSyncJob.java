package com.itinera.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Tracks one hotel-catalog sync run (see HotelCatalogService) so it can run
// as a background job instead of one long synchronous HTTP request - a
// syncCountry/syncCity call processing thousands of hotels can take many
// minutes and hold a lot of Hibernate-managed entities in memory if done in
// one request/transaction, which previously OOM-crashed the backend.
@Entity
@Table(name = "hotel_sync_jobs")
@Data
@NoArgsConstructor
public class HotelSyncJob {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // "COUNTRY" or "CITY"
    @Column(nullable = false)
    private String type;

    // The countryName or cityName the job was started with.
    @Column(nullable = false)
    private String param;

    // PENDING -> RUNNING -> COMPLETED | FAILED
    @Column(nullable = false)
    private String status = "PENDING";

    @Column(name = "region_ids")
    private String regionIds;

    @Column(name = "total_mapped")
    private Integer totalMapped = 0;

    @Column(name = "total_synced")
    private Integer totalSynced = 0;

    @Column(name = "total_deleted")
    private Integer totalDeleted = 0;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
