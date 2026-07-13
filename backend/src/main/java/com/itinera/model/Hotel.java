package com.itinera.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Our own local cache of TripJack's V3 Hotel Static Content
// (fetch-hotel-mapping + fetch-hotel-content). tjHotelId is used directly as
// the primary key rather than a generated one, since it's already a stable,
// globally unique identifier from TripJack and every row is upserted by it.
// The dynamic pricing/availability layer (Listing/Detail) is a completely
// separate TripJack API and is NEVER cached here - only static content.
@Entity
@Table(name = "hotels")
@Data
@NoArgsConstructor
public class Hotel {
    @Id
    @Column(name = "tj_hotel_id")
    private String tjHotelId;

    @Column(name = "unica_id")
    private String unicaId;

    private String name;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "star_rating")
    private String starRating;

    @Column(name = "property_type")
    private String propertyType;

    @Column(name = "address_line_1")
    private String addressLine1;

    @Column(name = "address_line_2")
    private String addressLine2;

    @Column(name = "full_address", columnDefinition = "TEXT")
    private String fullAddress;

    private String city;

    @Column(name = "city_code")
    private String cityCode;

    private String state;

    @Column(name = "country_name")
    private String countryName;

    @Column(name = "country_code")
    private String countryCode;

    @Column(name = "postal_code")
    private String postalCode;

    private Double latitude;
    private Double longitude;

    @Column(name = "hero_image_url", columnDefinition = "TEXT")
    private String heroImageUrl;

    // Raw sub-objects from fetch-hotel-content, kept as JSON text rather than
    // normalized tables - this app has no relational use for querying inside
    // them (e.g. "hotels with a pool"), just displaying them on a detail
    // screen, so JSON-in-a-column avoids over-modeling for no real benefit.
    @Column(name = "images_json", columnDefinition = "TEXT")
    private String imagesJson;

    @Column(name = "amenities_json", columnDefinition = "TEXT")
    private String amenitiesJson;

    @Column(name = "descriptions_json", columnDefinition = "TEXT")
    private String descriptionsJson;

    @Column(name = "policies_json", columnDefinition = "TEXT")
    private String policiesJson;

    @Column(name = "synced_at")
    private LocalDateTime syncedAt;
}
