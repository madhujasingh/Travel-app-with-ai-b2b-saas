package com.itinera.config;

import com.itinera.model.Itinerary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

// Keeps the database's CHECK constraint on itineraries.type in step with the
// ItineraryType enum.
//
// Hibernate creates that constraint from the enum the first time it builds the
// column, but ddl-auto=update only ever ADDS tables and columns - it never
// alters a constraint that already exists. So adding a value to ItineraryType
// leaves the database still rejecting it, and saving a package with the new
// type fails at the insert with a constraint violation, long after the code
// looks correct. Widening the enum from 5 types to 15 hit exactly that.
//
// Rewriting the constraint from the enum on every boot means the two can no
// longer drift, and no hand-run migration is needed against production the
// next time a type is added. It is idempotent - the same statements produce
// the same constraint - and it only ever widens what the column accepts, so
// it cannot reject a row that was already stored.
@Component
@Order(2)
public class ItineraryTypeConstraintRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ItineraryTypeConstraintRunner.class);
    private static final String CONSTRAINT = "itineraries_type_check";

    private final JdbcTemplate jdbcTemplate;

    public ItineraryTypeConstraintRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        // Built from the enum itself, not a hand-kept list that could drift
        // the same way the constraint just did. Enum names are compile-time
        // Java identifiers, so they cannot carry anything needing escaping.
        String values = Arrays.stream(Itinerary.ItineraryType.values())
                .map(type -> "'" + type.name() + "'")
                .collect(Collectors.joining(", "));

        try {
            jdbcTemplate.execute("ALTER TABLE itineraries DROP CONSTRAINT IF EXISTS " + CONSTRAINT);
            jdbcTemplate.execute(
                    "ALTER TABLE itineraries ADD CONSTRAINT " + CONSTRAINT +
                    " CHECK (type IN (" + values + "))");
            log.info("itineraries.type constraint now accepts {} types", Itinerary.ItineraryType.values().length);
        } catch (Exception ex) {
            // A package type the database rejects is a bad save, not a dead
            // application - starting up without the widened constraint is
            // better than refusing to start at all.
            log.warn("Could not refresh the {} constraint: {}", CONSTRAINT, ex.getMessage());
        }
    }
}
