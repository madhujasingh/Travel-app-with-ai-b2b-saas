package com.itinera.repository;

import com.itinera.model.MarkupRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MarkupRuleRepository extends JpaRepository<MarkupRule, Long> {

    Optional<MarkupRule> findByServiceAndCategoryAndEntityKey(
            String service, String category, String entityKey);

    List<MarkupRule> findAllByOrderByServiceAscCategoryAsc();
}
