package com.itinera.repository;

import com.itinera.model.HotelSyncJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HotelSyncJobRepository extends JpaRepository<HotelSyncJob, Long> {
    List<HotelSyncJob> findTop20ByOrderByStartedAtDesc();
}
