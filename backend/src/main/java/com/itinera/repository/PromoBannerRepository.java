package com.itinera.repository;

import com.itinera.model.PromoBanner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromoBannerRepository extends JpaRepository<PromoBanner, Long> {
    List<PromoBanner> findByPlacementAndActiveTrueOrderByDisplayOrderAsc(String placement);

    List<PromoBanner> findAllByOrderByPlacementAscDisplayOrderAsc();
}
