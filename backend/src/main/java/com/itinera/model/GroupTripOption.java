package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "group_trip_options")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupTripOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_trip_id", nullable = false)
    private GroupTrip groupTrip;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OptionCategory category;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column
    private String location;

    @Column(name = "added_by_user_id", nullable = false)
    private Long addedByUserId;

    @Column(name = "added_by_name", nullable = false)
    private String addedByName;

    @Column(nullable = false)
    private Integer score = 0;

    @Column(name = "locked_winner", nullable = false)
    private Boolean lockedWinner = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "option", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GroupTripVote> votes;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum OptionCategory {
        RESTAURANT, ACTIVITY, LODGING
    }
}
