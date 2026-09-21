package com.itinera.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// One picture in a package's gallery. A separate row per photo rather than a
// column on Itinerary, so a package can carry as many as it needs and any one
// of them can be removed without touching the rest.
//
// The bytes live here the same way PromoBanner keeps its image - in the row,
// @JsonIgnore so listing a gallery never ships megabytes of image data.
@Entity
@Table(name = "itinerary_photos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ItineraryPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "itinerary_id", nullable = false)
    @JsonIgnore
    private Itinerary itinerary;

    @Column(name = "image_data", columnDefinition = "bytea", nullable = false)
    @JsonIgnore
    private byte[] imageData;

    @Column(name = "image_content_type", nullable = false)
    private String imageContentType;

    // Position in the gallery. The lowest is the cover - the one a card and
    // the detail hero show when they only have room for a single picture.
    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;
}
