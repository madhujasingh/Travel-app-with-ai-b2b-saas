package com.itinera.repository;

import com.itinera.model.GroupTripVote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupTripVoteRepository extends JpaRepository<GroupTripVote, Long> {
    Optional<GroupTripVote> findByOptionIdAndUserId(Long optionId, Long userId);
    List<GroupTripVote> findByOptionId(Long optionId);
    void deleteByOptionId(Long optionId);
}
