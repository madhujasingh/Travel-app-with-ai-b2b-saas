package com.itinera.service;

import com.itinera.model.MarkupRule;
import com.itinera.repository.MarkupRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

// Resolves and applies markup - the amount we add on top of a supplier's fare.
//
// The supplier is always remitted their exact fare; this is purely what the
// customer is charged on our own rail. See MarkupRule for why that is not
// optional.
@Service
public class MarkupService {

    public static final Set<String> SERVICES =
            Set.of("FLIGHT", "HOTEL", "CAB", "INSURANCE", "ACTIVITY", "PACKAGE");

    private static final Set<String> UNITS =
            Set.of("FLAT_PER_PAX", "FLAT_FULL", "PERCENT_PER_PAX", "PERCENT_FULL");

    private final MarkupRuleRepository repository;

    public MarkupService(MarkupRuleRepository repository) {
        this.repository = repository;
    }

    public List<MarkupRule> listAll() {
        return repository.findAllByOrderByServiceAscCategoryAsc();
    }

    @Transactional
    public MarkupRule upsert(MarkupRule input) {
        String service = upper(input.getService());
        String category = input.getCategory() == null || input.getCategory().isBlank()
                ? "DEFAULT"
                : upper(input.getCategory());
        String unit = upper(input.getMarkupUnit());
        // "" means the service-wide rule; anything else is an override for one
        // airline, hotel or destination.
        String entityKey = input.getEntityKey() == null ? "" : upper(input.getEntityKey());

        if (!SERVICES.contains(service)) {
            throw new IllegalArgumentException("Unknown service.");
        }
        if (!UNITS.contains(unit)) {
            throw new IllegalArgumentException("Unknown markup unit.");
        }
        if (input.getMarkupValue() == null || input.getMarkupValue().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Markup can't be negative.");
        }
        if (unit.startsWith("PERCENT") && input.getMarkupValue().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("A percentage markup can't exceed 100%.");
        }

        MarkupRule rule = repository
                .findByServiceAndCategoryAndEntityKey(service, category, entityKey)
                .orElseGet(MarkupRule::new);
        rule.setService(service);
        rule.setCategory(category);
        rule.setEntityKey(entityKey);
        rule.setEntityLabel(input.getEntityLabel());
        rule.setMarkupValue(input.getMarkupValue());
        rule.setMarkupUnit(unit);
        rule.setActive(input.getActive() == null || input.getActive());
        rule.setUpdatedAt(LocalDateTime.now());
        return repository.save(rule);
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
    }

    public BigDecimal markupFor(String service, String category, BigDecimal baseAmount, int paxCount) {
        return markupFor(service, category, "", baseAmount, paxCount);
    }

    // The markup we add for one order. `baseAmount` is the supplier's fare for
    // the whole booking; `paxCount` is used only by the per-pax units.
    //
    // Resolution runs most-specific first, so an airline or hotel override beats
    // the category rule, which beats the service-wide default. An admin only has
    // to fill in the exceptions.
    public BigDecimal markupFor(String service,
                                String category,
                                String entityKey,
                                BigDecimal baseAmount,
                                int paxCount) {
        String svc = upper(service);
        String cat = category == null || category.isBlank() ? "DEFAULT" : upper(category);
        String entity = entityKey == null ? "" : upper(entityKey);

        MarkupRule rule = null;
        if (!entity.isEmpty()) {
            rule = repository.findByServiceAndCategoryAndEntityKey(svc, cat, entity).orElse(null);
            if (rule == null) {
                rule = repository.findByServiceAndCategoryAndEntityKey(svc, "DEFAULT", entity).orElse(null);
            }
        }
        if (rule == null) {
            rule = repository.findByServiceAndCategoryAndEntityKey(svc, cat, "").orElse(null);
        }
        if (rule == null) {
            rule = repository.findByServiceAndCategoryAndEntityKey(svc, "DEFAULT", "").orElse(null);
        }

        if (rule == null || rule.getActive() == null || !rule.getActive()) {
            return BigDecimal.ZERO;
        }

        BigDecimal base = baseAmount == null ? BigDecimal.ZERO : baseAmount;
        int pax = Math.max(paxCount, 1);
        BigDecimal value = rule.getMarkupValue();

        BigDecimal markup = switch (rule.getMarkupUnit()) {
            case "FLAT_PER_PAX" -> value.multiply(BigDecimal.valueOf(pax));
            case "PERCENT_FULL" -> base.multiply(value).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            case "PERCENT_PER_PAX" ->
                    base.divide(BigDecimal.valueOf(pax), 2, RoundingMode.HALF_UP)
                            .multiply(value)
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(pax));
            default -> value; // FLAT_FULL
        };

        return markup.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
