package com.itinera.repository;

import com.itinera.model.GroupTrip;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupTripRepository extends JpaRepository<GroupTrip, Long> {
    Optional<GroupTrip> findByInviteCodeIgnoreCase(String inviteCode);
    boolean existsByInviteCodeIgnoreCase(String inviteCode);
}
