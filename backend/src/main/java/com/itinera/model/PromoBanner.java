package com.itinera.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// Admin-managed promo/deal banners shown as a carousel on customer-facing
// screens (Home, Hotels, ...). Image bytes are stored directly in Postgres
// (bytea) rather than a separate object-storage service - simplest option
// given Render's free-tier filesystem isn't persistent, and this is a small
// number of admin-curated images, not user-generated content at scale.
@Entity
@Table(name = "promo_banners")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PromoBanner {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    // Which customer-facing screen this banner shows on - "HOME", "HOTELS", etc.
    @Column(nullable = false)
    private String placement;

    // "SCREEN" (linkTarget is a screen name the frontend navigator knows,
    // e.g. "Hotels") or "URL" (linkTarget is opened in an in-app browser) or
    // "NONE" (banner isn't tappable).
    @Column(name = "link_type", nullable = false)
    private String linkType;

    @Column(name = "link_target")
    private String linkTarget;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "image_data", columnDefinition = "bytea", nullable = false)
    @JsonIgnore
    private byte[] imageData;

    @Column(name = "image_content_type", nullable = false)
    private String imageContentType;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
