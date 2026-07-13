package com.itinera.repository;

import com.itinera.model.Hotel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HotelRepository extends JpaRepository<Hotel, String> {
    List<Hotel> findByCountryNameIgnoreCase(String countryName);
    List<Hotel> findByCityIgnoreCase(String city);
}
