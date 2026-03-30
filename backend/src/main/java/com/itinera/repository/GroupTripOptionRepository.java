package com.itinera.repository;

import com.itinera.model.GroupTripOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GroupTripOptionRepository extends JpaRepository<GroupTripOption, Long> {
    List<GroupTripOption> findByGroupTripIdOrderByLockedWinnerDescScoreDescCreatedAtAsc(Long groupTripId);
    List<GroupTripOption> findByGroupTripIdAndCategoryOrderByLockedWinnerDescScoreDescCreatedAtAsc(
            Long groupTripId,
            GroupTripOption.OptionCategory category
    );
}
