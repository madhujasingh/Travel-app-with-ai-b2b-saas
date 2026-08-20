package com.itinera.repository;

import com.itinera.model.KnownCity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KnownCityRepository extends JpaRepository<KnownCity, Long> {
    List<KnownCity> findAllByOrderByCityNameAsc();
    Optional<KnownCity> findByCityNameIgnoreCase(String cityName);
}
