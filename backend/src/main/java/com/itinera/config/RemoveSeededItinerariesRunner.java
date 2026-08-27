package com.itinera.config;

import com.itinera.model.Itinerary;
import com.itinera.repository.ItineraryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// ONE-TIME cleanup - delete once this has run successfully against
// production (check the logs for "Removed N seeded demo itineraries").
// DataSeederConfig used to unconditionally seed 16 destinations x 3 hand-made
// package variants + a draft Phuket-Krabi itinerary on every startup; the
// business decided real packages aren't feasible to pre-author since every
// trip is customer-customized, so itinerary search now falls back to
// AiItineraryService (Gemini) instead. That seeding code is already removed,
// but rows it already wrote to the production DB on earlier deploys need to
// be deleted too, or destination searches that already have this stale demo
// data (e.g. "Jaipur") would never fall through to AI generation.
// Skips any itinerary that has real bookings against it, since Itinerary's
// bookings relationship is cascade=ALL and deleting would take those with it.
@Component
@Order(1)
public class RemoveSeededItinerariesRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(RemoveSeededItinerariesRunner.class);

    private final ItineraryRepository itineraryRepository;

    public RemoveSeededItinerariesRunner(ItineraryRepository itineraryRepository) {
        this.itineraryRepository = itineraryRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        List<Itinerary> seeded = itineraryRepository.findByAiGeneratedFalseOrAiGeneratedIsNull();
        if (seeded.isEmpty()) {
            return;
        }

        int removed = 0;
        int skipped = 0;
        for (Itinerary itinerary : seeded) {
            if (itinerary.getBookings() != null && !itinerary.getBookings().isEmpty()) {
                skipped++;
                continue;
            }
            itineraryRepository.delete(itinerary);
            removed++;
        }

        log.info("Removed {} seeded demo itineraries ({} skipped because they have real bookings)", removed, skipped);
    }
}
