package com.itinera.repository;

import com.itinera.model.HotelSyncJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HotelSyncJobRepository extends JpaRepository<HotelSyncJob, Long> {
    List<HotelSyncJob> findTop20ByOrderByStartedAtDesc();

    // Watermark for the global delta sync (see HotelSyncJobRunner.
    // refreshGlobalDelta) - the last successful run's startedAt becomes the
    // next run's lastUpdateTime filter, so each run picks up exactly what
    // changed since the previous one started (not "since it finished",
    // which would risk missing anything that changed mid-run).
    Optional<HotelSyncJob> findTopByTypeAndStatusOrderByStartedAtDesc(String type, String status);
}
