package com.itinera.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// One markup rule: what we add on top of a supplier's fare for a given service
// and category.
//
// IMPORTANT: a markup is never sent to the supplier. TripJack rejects a Book
// whose payment amount differs from the reviewed fare (errCode 1015, and the
// Cabs equivalent "Net Payable Amount is ..."), and HotelBeds takes no amount
// at all. The markup is what we charge the customer on our own payment rail;
// the supplier is always remitted their exact fare.
@Entity
@Table(
        name = "markup_rules",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_markup_service_category_entity",
                columnNames = {"service", "category", "entity_key"}
        )
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MarkupRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // FLIGHT, HOTEL, CAB, INSURANCE, ACTIVITY, PACKAGE
    @Column(nullable = false, length = 32)
    private String service;

    // Sub-split within a service. Flights use DOMESTIC_ONEWAY /
    // DOMESTIC_ROUND / INTERNATIONAL_ONEWAY / INTERNATIONAL_ROUND; packages use
    // DOMESTIC / INTERNATIONAL; everything else uses DEFAULT.
    @Column(nullable = false, length = 40)
    private String category = "DEFAULT";

    // The specific airline / hotel / destination this rule overrides, or "" for
    // the service-wide rule. Stored as an empty string rather than NULL because
    // Postgres treats NULLs as distinct in a unique index, which would let two
    // service-wide rules exist for the same category.
    @Column(name = "entity_key", nullable = false, length = 80)
    private String entityKey = "";

    // Human-readable name for the override, so the admin list can show
    // "6E - IndiGo" rather than a bare code.
    @Column(name = "entity_label", length = 160)
    private String entityLabel;

    @Column(name = "markup_value", nullable = false, precision = 12, scale = 2)
    private BigDecimal markupValue = BigDecimal.ZERO;

    // FLAT_PER_PAX, FLAT_FULL, PERCENT_PER_PAX, PERCENT_FULL - the same four
    // units TripJack's own agent dashboard offers.
    @Column(name = "markup_unit", nullable = false, length = 24)
    private String markupUnit = "FLAT_FULL";

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
