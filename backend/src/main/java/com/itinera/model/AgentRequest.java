package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "agent_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(nullable = false)
    private String phone;

    @Column(nullable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferred_contact")
    private PreferredContact preferredContact;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "itinerary_id")
    private Long itineraryId;

    @Column(name = "destination")
    private String destination;

    @Column(name = "number_of_people")
    private Integer numberOfPeople;

    @Column(name = "budget")
    private String budget;

    @Enumerated(EnumType.STRING)
    private RequestStatus status;

    @Column(name = "assigned_agent_id")
    private Long assignedAgentId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        status = RequestStatus.PENDING;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum PreferredContact {
        PHONE, WHATSAPP, EMAIL
    }

    public enum RequestStatus {
        PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    }
}
