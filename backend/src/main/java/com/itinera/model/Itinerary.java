package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "itineraries")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Itinerary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String destination;

    @Column(nullable = false)
    private String duration;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer rating;

    @Column(name = "review_count")
    private Integer reviewCount;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url")
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    private ItineraryType type;

    @Enumerated(EnumType.STRING)
    private Category category;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ElementCollection
    @CollectionTable(name = "itinerary_highlights", joinColumns = @JoinColumn(name = "itinerary_id"))
    @Column(name = "highlight")
    private List<String> highlights;

    @ElementCollection
    @CollectionTable(name = "itinerary_inclusions", joinColumns = @JoinColumn(name = "itinerary_id"))
    @Column(name = "inclusion")
    private List<String> inclusions;

    @ElementCollection
    @CollectionTable(name = "itinerary_exclusions", joinColumns = @JoinColumn(name = "itinerary_id"))
    @Column(name = "exclusion")
    private List<String> exclusions;

    @OneToMany(mappedBy = "itinerary", cascade = CascadeType.ALL)
    private List<DayPlan> dayPlans;

    @OneToMany(mappedBy = "itinerary", cascade = CascadeType.ALL)
    private List<Booking> bookings;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ItineraryType {
        BUDGET, PREMIUM, ADVENTURE, FAMILY, ROMANTIC
    }

    public enum Category {
        INTERNATIONAL, INDIA
    }
}
