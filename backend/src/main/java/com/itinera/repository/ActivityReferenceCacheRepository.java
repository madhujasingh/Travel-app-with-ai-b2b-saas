package com.itinera.repository;

import com.itinera.model.ActivityReferenceCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ActivityReferenceCacheRepository extends JpaRepository<ActivityReferenceCache, Long> {
    Optional<ActivityReferenceCache> findByCacheKey(String cacheKey);
}
