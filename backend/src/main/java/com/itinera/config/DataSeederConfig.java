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
import java.util.Arrays;
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

            createItineraryIfMissing(itineraryRepository);
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

    private void createItineraryIfMissing(ItineraryRepository itineraryRepository) {
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
        itinerary.setHighlights(Arrays.asList(
                "Phuket arrival and leisure time",
                "Island-hopping style sightseeing",
                "Krabi transfer and stay",
                "Flexible customization from original client itinerary"
        ));
        itinerary.setInclusions(Arrays.asList(
                "Accommodation for 5 nights",
                "Airport and intercity transfers",
                "Daily breakfast",
                "Selected sightseeing",
                "Basic itinerary assistance"
        ));
        itinerary.setExclusions(Arrays.asList(
                "Airfare",
                "Visa and travel insurance",
                "Personal expenses",
                "Meals not mentioned",
                "Optional tours and upgrades"
        ));

        DayPlan day1 = createDayPlan(
                itinerary,
                1,
                "Arrival in Phuket",
                Arrays.asList(
                        createActivity("Arrival", "Airport pickup and hotel check-in", "car-outline"),
                        createActivity("Evening", "Leisure time to relax or explore nearby markets", "walk-outline")
                )
        );
        DayPlan day2 = createDayPlan(
                itinerary,
                2,
                "Phuket Sightseeing",
                Arrays.asList(
                        createActivity("Morning", "Breakfast and local sightseeing", "cafe-outline"),
                        createActivity("Afternoon", "Explore major Phuket attractions", "business-outline"),
                        createActivity("Evening", "Free time for beach or sunset point", "sunny-outline")
                )
        );
        DayPlan day3 = createDayPlan(
                itinerary,
                3,
                "Island Excursion",
                Arrays.asList(
                        createActivity("Morning", "Island tour departure", "boat-outline"),
                        createActivity("Afternoon", "Sightseeing and water activity time", "fish-outline"),
                        createActivity("Evening", "Return to hotel", "bed-outline")
                )
        );
        DayPlan day4 = createDayPlan(
                itinerary,
                4,
                "Transfer to Krabi",
                Arrays.asList(
                        createActivity("Morning", "Checkout and transfer toward Krabi", "car-outline"),
                        createActivity("Afternoon", "Krabi hotel check-in", "business-outline"),
                        createActivity("Evening", "Relaxed evening at leisure", "moon-outline")
                )
        );
        DayPlan day5 = createDayPlan(
                itinerary,
                5,
                "Krabi Exploration",
                Arrays.asList(
                        createActivity("Morning", "Breakfast and local sightseeing in Krabi", "restaurant-outline"),
                        createActivity("Afternoon", "Optional beach or four-island style excursion", "boat-outline"),
                        createActivity("Evening", "Shopping or leisure time", "cart-outline")
                )
        );
        DayPlan day6 = createDayPlan(
                itinerary,
                6,
                "Departure",
                Arrays.asList(
                        createActivity("Morning", "Checkout from hotel", "briefcase-outline"),
                        createActivity("Departure", "Transfer for onward journey", "airplane-outline")
                )
        );

        itinerary.setDayPlans(Arrays.asList(day1, day2, day3, day4, day5, day6));
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
}
