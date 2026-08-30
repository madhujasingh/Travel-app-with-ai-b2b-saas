package com.itinera.repository;

import com.itinera.model.ActivityCatalogEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ActivityCatalogRepository extends JpaRepository<ActivityCatalogEntry, Long> {
    Optional<ActivityCatalogEntry> findByActivityCode(String activityCode);
    List<ActivityCatalogEntry> findByDestinationCode(String destinationCode);

    // Used to remove stale entries after a resync - anything for this
    // destination whose activityCode wasn't in the fresh pull no longer
    // exists upstream (or dropped out of sale) and shouldn't linger forever.
    @Modifying
    @Query("DELETE FROM ActivityCatalogEntry e WHERE e.destinationCode = :destinationCode AND e.activityCode NOT IN :keepCodes")
    void deleteByDestinationCodeAndActivityCodeNotIn(
            @Param("destinationCode") String destinationCode,
            @Param("keepCodes") List<String> keepCodes
    );

    void deleteByDestinationCode(String destinationCode);
}
