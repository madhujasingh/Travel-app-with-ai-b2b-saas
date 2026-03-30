package com.itinera.repository;

import com.itinera.model.GroupTripMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupTripMemberRepository extends JpaRepository<GroupTripMember, Long> {
    List<GroupTripMember> findByUserIdOrderByJoinedAtDesc(Long userId);
    List<GroupTripMember> findByGroupTripIdOrderByJoinedAtAsc(Long groupTripId);
    boolean existsByGroupTripIdAndUserId(Long groupTripId, Long userId);
    Optional<GroupTripMember> findByGroupTripIdAndUserId(Long groupTripId, Long userId);
}
