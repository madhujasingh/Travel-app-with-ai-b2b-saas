package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "group_trips")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupTrip {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String destination;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "invite_code", nullable = false, unique = true)
    private String inviteCode;

    @Column(nullable = false)
    private String status = "PLANNING";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "groupTrip", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GroupTripMember> members;

    @OneToMany(mappedBy = "groupTrip", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GroupTripOption> options;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
