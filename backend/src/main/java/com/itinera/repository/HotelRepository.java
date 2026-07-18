package com.itinera.repository;

import com.itinera.model.Hotel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HotelRepository extends JpaRepository<Hotel, String> {
    List<Hotel> findByCountryNameIgnoreCase(String countryName);
    List<Hotel> findByCityIgnoreCase(String city);

    // Powers the city picker in the search UI - only cities with hotels
    // actually synced into our catalog are offered, so a selection always
    // resolves to real, searchable hotel IDs.
    @Query("SELECT h.city AS city, h.countryName AS countryName, COUNT(h) AS hotelCount " +
           "FROM Hotel h WHERE h.city IS NOT NULL AND h.city <> '' " +
           "GROUP BY h.city, h.countryName ORDER BY h.city ASC")
    List<CityCount> findCityCounts();

    interface CityCount {
        String getCity();
        String getCountryName();
        Long getHotelCount();
    }
}
