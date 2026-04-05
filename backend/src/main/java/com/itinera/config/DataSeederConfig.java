package com.itinera.config;

import com.itinera.model.Activity;
import com.itinera.model.DayPlan;
import com.itinera.model.Itinerary;
import com.itinera.model.User;
import com.itinera.repository.ItineraryRepository;
import com.itinera.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Configuration
public class DataSeederConfig {

    @Bean
    CommandLineRunner seedDefaultData(UserRepository userRepository, ItineraryRepository itineraryRepository) {
        return args -> {
            createUserIfMissing(
                    userRepository,
                    "customer@itinera.com",
                    "Demo Customer",
                    "9000000001",
                    "Customer@123",
                    User.UserRole.CUSTOMER
            );

            createUserIfMissing(
                    userRepository,
                    "supplier@itinera.com",
                    "Demo Supplier",
                    "9000000002",
                    "Supplier@123",
                    User.UserRole.SUPPLIER
            );

            createUserIfMissing(
                    userRepository,
                    "admin@itinera.com",
                    "Demo Admin",
                    "9000000003",
                    "Admin@123",
                    User.UserRole.ADMIN
            );

            createDemoItineraries(itineraryRepository);
            createOriginalPhuketKrabiDraft(itineraryRepository);
        };
    }

    private void createUserIfMissing(
            UserRepository userRepository,
            String email,
            String name,
            String phone,
            String rawPassword,
            User.UserRole role
    ) {
        if (userRepository.existsByEmail(email)) {
            return;
        }

        User user = new User();
        user.setEmail(email);
        user.setName(name);
        user.setPhone(phone);
        user.setRole(role);
        user.setPassword(rawPassword);
        userRepository.save(user);
    }

    private void createDemoItineraries(ItineraryRepository itineraryRepository) {
        List<DestinationSeed> destinations = List.of(
                new DestinationSeed("Paris", "France", Itinerary.Category.INTERNATIONAL, "city icons, museums and cafe culture", "business-outline", 89000),
                new DestinationSeed("Tokyo", "Japan", Itinerary.Category.INTERNATIONAL, "fast city energy, food trails and modern landmarks", "navigate-outline", 96000),
                new DestinationSeed("Dubai", "UAE", Itinerary.Category.INTERNATIONAL, "luxury skyline, desert moments and shopping districts", "business", 76000),
                new DestinationSeed("Bali", "Indonesia", Itinerary.Category.INTERNATIONAL, "tropical beaches, wellness and island exploration", "sunny", 64000),
                new DestinationSeed("Maldives", "Maldives", Itinerary.Category.INTERNATIONAL, "overwater luxury, turquoise water and slow romance", "water-outline", 118000),
                new DestinationSeed("Singapore", "Singapore", Itinerary.Category.INTERNATIONAL, "clean city escapes, food culture and family attractions", "leaf-outline", 72000),
                new DestinationSeed("Thailand", "Thailand", Itinerary.Category.INTERNATIONAL, "island life, nightlife and culture-rich day trips", "flower-outline", 59000),
                new DestinationSeed("Switzerland", "Switzerland", Itinerary.Category.INTERNATIONAL, "alpine views, rail journeys and scenic villages", "trail-sign", 125000),
                new DestinationSeed("Jaipur", "Rajasthan", Itinerary.Category.INDIA, "forts, heritage stays and vibrant bazaars", "business", 24000),
                new DestinationSeed("Goa", "Goa", Itinerary.Category.INDIA, "beaches, cafes and laid-back coastal energy", "sunny", 27000),
                new DestinationSeed("Kerala", "Kerala", Itinerary.Category.INDIA, "backwaters, wellness and tropical greenery", "leaf", 32000),
                new DestinationSeed("Manali", "Himachal Pradesh", Itinerary.Category.INDIA, "mountains, adventure and crisp weather", "trail-sign", 28000),
                new DestinationSeed("Varanasi", "Uttar Pradesh", Itinerary.Category.INDIA, "spiritual ghats, rituals and cultural depth", "flower", 21000),
                new DestinationSeed("Udaipur", "Rajasthan", Itinerary.Category.INDIA, "lakeside palaces and romantic city scenes", "business-outline", 26000),
                new DestinationSeed("Shimla", "Himachal Pradesh", Itinerary.Category.INDIA, "hill station charm, pine trails and relaxed escapes", "trail-sign-outline", 23000),
                new DestinationSeed("Agra", "Uttar Pradesh", Itinerary.Category.INDIA, "monuments, heritage walks and Mughal history", "location", 22000)
        );

        List<PackageVariant> variants = List.of(
                new PackageVariant("Essentials Escape", "Value-first package for quick discovery and smooth travel.", 4, 0, Itinerary.ItineraryType.BUDGET),
                new PackageVariant("Signature Journey", "Balanced package with stronger experiences and polished pacing.", 5, 9000, Itinerary.ItineraryType.PREMIUM),
                new PackageVariant("Premium Discovery", "Elevated package with richer stays and standout moments.", 6, 18000, Itinerary.ItineraryType.ADVENTURE)
        );

        for (DestinationSeed destination : destinations) {
            for (int index = 0; index < variants.size(); index++) {
                PackageVariant variant = variants.get(index);
                String title = destination.name() + " " + variant.name();
                if (itineraryRepository.existsByTitleIgnoreCase(title)) {
                    continue;
                }

                Itinerary itinerary = new Itinerary();
                itinerary.setTitle(title);
                itinerary.setDestination(destination.name());
                itinerary.setDuration(variant.days() + " Days / " + Math.max(variant.days() - 1, 2) + " Nights");
                itinerary.setPrice(BigDecimal.valueOf(destination.basePriceInr() + variant.priceBump()));
                itinerary.setRating(4 + (index % 2));
                itinerary.setReviewCount(8 + (index * 5));
                itinerary.setDescription(
                        variant.description() + " Crafted for " + destination.name() + " with " + destination.vibe() + "."
                );
                itinerary.setImageUrl(destination.icon());
                itinerary.setType(variant.type());
                itinerary.setCategory(destination.category());
                itinerary.setIsActive(true);
                itinerary.setHighlights(List.of(
                        destination.name() + " arrival and local orientation",
                        "Curated moments around " + destination.vibe(),
                        "Flexible day-wise pacing for upgrades and add-ons",
                        "Ideal for demoing package depth inside the app"
                ));
                itinerary.setInclusions(List.of(
                        (variant.days() - 1) + " nights accommodation",
                        "Airport / station transfers",
                        "Daily breakfast",
                        "Selected sightseeing and local support"
                ));
                itinerary.setExclusions(List.of(
                        "Flights or train tickets",
                        "Personal expenses",
                        "Meals not mentioned",
                        "Optional activities and upgrades"
                ));
                itinerary.setDayPlans(buildDemoDayPlans(itinerary, destination, variant));

                itineraryRepository.save(itinerary);
            }
        }
    }

    private List<DayPlan> buildDemoDayPlans(Itinerary itinerary, DestinationSeed destination, PackageVariant variant) {
        List<DayPlan> dayPlans = new ArrayList<>();

        dayPlans.add(createDayPlan(
                itinerary,
                1,
                "Arrival in " + destination.name(),
                List.of(
                        createActivity("Morning", "Arrival and assisted transfer to hotel", "airplane-outline"),
                        createActivity("Afternoon", "Check-in and settle into the stay", "bed-outline"),
                        createActivity("Evening", "Easy local walk and welcome briefing", "walk-outline")
                )
        ));

        dayPlans.add(createDayPlan(
                itinerary,
                2,
                destination.name() + " Discovery",
                List.of(
                        createActivity("Morning", "Breakfast and guided city highlights", destination.icon()),
                        createActivity("Afternoon", "Explore signature spots built around " + destination.vibe(), "compass-outline"),
                        createActivity("Evening", "Leisure time for shopping or food trail", "restaurant-outline")
                )
        ));

        dayPlans.add(createDayPlan(
                itinerary,
                3,
                "Experiences and Local Flavor",
                List.of(
                        createActivity("Morning", "Immersive activity or excursion", "sparkles-outline"),
                        createActivity("Afternoon", "Flexible free time for custom add-ons", "sunny-outline"),
                        createActivity("Evening", "Curated dinner and nightlife / cultural time", "moon-outline")
                )
        ));

        if (variant.days() >= 5) {
            dayPlans.add(createDayPlan(
                    itinerary,
                    4,
                    "Scenic Day Out",
                    List.of(
                            createActivity("Morning", "Breakfast and day trip departure", "car-outline"),
                            createActivity("Afternoon", "Explore surrounding highlights", "trail-sign-outline"),
                            createActivity("Evening", "Return and wind down", "cafe-outline")
                    )
            ));
        }

        if (variant.days() >= 6) {
            dayPlans.add(createDayPlan(
                    itinerary,
                    5,
                    "Premium Leisure Buffer",
                    List.of(
                            createActivity("Morning", "Slow breakfast and optional spa / wellness", "leaf-outline"),
                            createActivity("Afternoon", "Open slot for admin customization", "create-outline"),
                            createActivity("Evening", "Farewell dinner or final city stroll", "star-outline")
                    )
            ));
        }

        dayPlans.add(createDayPlan(
                itinerary,
                variant.days(),
                "Departure",
                List.of(
                        createActivity("Morning", "Checkout and transfer for onward journey", "briefcase-outline"),
                        createActivity("Departure", "Travel assistance and wrap-up", "airplane-outline")
                )
        ));

        return dayPlans;
    }

    private void createOriginalPhuketKrabiDraft(ItineraryRepository itineraryRepository) {
        String title = "Mr Mrinal Phuket-Krabi 5N/6D";
        if (itineraryRepository.existsByTitleIgnoreCase(title)) {
            return;
        }

        Itinerary itinerary = new Itinerary();
        itinerary.setTitle(title);
        itinerary.setDestination("Phuket / Krabi");
        itinerary.setDuration("6 Days / 5 Nights");
        itinerary.setPrice(new BigDecimal("45999"));
        itinerary.setRating(5);
        itinerary.setReviewCount(1);
        itinerary.setDescription(
                "Initial rough itinerary seeded from the original Phuket-Krabi PDF draft. " +
                        "This version is intentionally editable and can be refined when the text itinerary is available."
        );
        itinerary.setImageUrl("airplane-outline");
        itinerary.setType(Itinerary.ItineraryType.PREMIUM);
        itinerary.setCategory(Itinerary.Category.INTERNATIONAL);
        itinerary.setIsActive(true);
        itinerary.setHighlights(List.of(
                "Phuket arrival and leisure time",
                "Island-hopping style sightseeing",
                "Krabi transfer and stay",
                "Flexible customization from original client itinerary"
        ));
        itinerary.setInclusions(List.of(
                "Accommodation for 5 nights",
                "Airport and intercity transfers",
                "Daily breakfast",
                "Selected sightseeing",
                "Basic itinerary assistance"
        ));
        itinerary.setExclusions(List.of(
                "Airfare",
                "Visa and travel insurance",
                "Personal expenses",
                "Meals not mentioned",
                "Optional tours and upgrades"
        ));
        itinerary.setDayPlans(List.of(
                createDayPlan(
                        itinerary,
                        1,
                        "Arrival in Phuket",
                        List.of(
                                createActivity("Arrival", "Airport pickup and hotel check-in", "car-outline"),
                                createActivity("Evening", "Leisure time to relax or explore nearby markets", "walk-outline")
                        )
                ),
                createDayPlan(
                        itinerary,
                        2,
                        "Phuket Sightseeing",
                        List.of(
                                createActivity("Morning", "Breakfast and local sightseeing", "cafe-outline"),
                                createActivity("Afternoon", "Explore major Phuket attractions", "business-outline"),
                                createActivity("Evening", "Free time for beach or sunset point", "sunny-outline")
                        )
                ),
                createDayPlan(
                        itinerary,
                        3,
                        "Island Excursion",
                        List.of(
                                createActivity("Morning", "Island tour departure", "boat-outline"),
                                createActivity("Afternoon", "Sightseeing and water activity time", "fish-outline"),
                                createActivity("Evening", "Return to hotel", "bed-outline")
                        )
                ),
                createDayPlan(
                        itinerary,
                        4,
                        "Transfer to Krabi",
                        List.of(
                                createActivity("Morning", "Checkout and transfer toward Krabi", "car-outline"),
                                createActivity("Afternoon", "Krabi hotel check-in", "business-outline"),
                                createActivity("Evening", "Relaxed evening at leisure", "moon-outline")
                        )
                ),
                createDayPlan(
                        itinerary,
                        5,
                        "Krabi Exploration",
                        List.of(
                                createActivity("Morning", "Breakfast and local sightseeing in Krabi", "restaurant-outline"),
                                createActivity("Afternoon", "Optional beach or four-island style excursion", "boat-outline"),
                                createActivity("Evening", "Shopping or leisure time", "cart-outline")
                        )
                ),
                createDayPlan(
                        itinerary,
                        6,
                        "Departure",
                        List.of(
                                createActivity("Morning", "Checkout from hotel", "briefcase-outline"),
                                createActivity("Departure", "Transfer for onward journey", "airplane-outline")
                        )
                )
        ));
        itineraryRepository.save(itinerary);
    }

    private DayPlan createDayPlan(Itinerary itinerary, Integer dayNumber, String title, List<Activity> activities) {
        DayPlan dayPlan = new DayPlan();
        dayPlan.setItinerary(itinerary);
        dayPlan.setDayNumber(dayNumber);
        dayPlan.setTitle(title);
        activities.forEach(activity -> activity.setDayPlan(dayPlan));
        dayPlan.setActivities(activities);
        return dayPlan;
    }

    private Activity createActivity(String time, String activityText, String icon) {
        Activity activity = new Activity();
        activity.setTime(time);
        activity.setActivity(activityText);
        activity.setIcon(icon);
        return activity;
    }

    private record DestinationSeed(
            String name,
            String regionLabel,
            Itinerary.Category category,
            String vibe,
            String icon,
            long basePriceInr
    ) {}

    private record PackageVariant(
            String name,
            String description,
            int days,
            long priceBump,
            Itinerary.ItineraryType type
    ) {}
}
