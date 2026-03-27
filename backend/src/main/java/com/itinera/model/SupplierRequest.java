package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "supplier_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SupplierRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agent_request_id")
    private AgentRequest agentRequest;

    @Column(name = "request_details", columnDefinition = "TEXT")
    private String requestDetails;

    @Column(name = "quoted_price")
    private BigDecimal quotedPrice;

    @Column(name = "quote_details", columnDefinition = "TEXT")
    private String quoteDetails;

    @Enumerated(EnumType.STRING)
    private RequestStatus status;

    @Column(name = "deadline")
    private LocalDateTime deadline;

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

    public enum RequestStatus {
        PENDING, QUOTE_RECEIVED, ACCEPTED, REJECTED, COMPLETED
    }
}
