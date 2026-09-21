package com.itinera.config;

import com.itinera.model.Itinerary;
import com.itinera.repository.ItineraryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// RETIRED - deliberately no longer a @Component. Kept only as a record of
// what it did; it is safe to delete this file outright.
//
// It was a ONE-TIME cleanup of rows an older DataSeederConfig had written
// (16 destinations x 3 hand-made package variants + a draft Phuket-Krabi
// itinerary, seeded on every startup) once the business decided real packages
// aren't feasible to pre-author and itinerary search moved to Gemini.
//
// But it ran on EVERY boot and its rule - ai_generated false or null, no
// bookings - is exactly the signature of a package an admin uploads by hand.
// So every admin-authored package was deleted at the next restart, which on
// Render means every deploy: upload a package, deploy, and it is gone. That
// is why the catalogue held nothing but AI-generated rows. Its actual job
// finished long ago (production has no non-AI rows left to clean), so leaving
// it enabled only destroyed real inventory.
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
