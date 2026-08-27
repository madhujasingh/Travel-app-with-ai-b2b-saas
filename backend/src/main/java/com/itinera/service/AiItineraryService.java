package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinera.model.Activity;
import com.itinera.model.DayPlan;
import com.itinera.model.Itinerary;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

// Generates AI itinerary packages for a destination that has no curated
// packages yet - real customer-specific packages aren't feasible to
// hand-author for every destination up front, so this fills the catalog gap
// with realistic options a customer can browse and book, which a travel
// agent then turns into an actual tailored trip afterward. Results are
// persisted as regular Itinerary rows (aiGenerated=true) so a repeat search
// for the same destination reuses them instead of calling Gemini again.
@Service
public class AiItineraryService {

    private final GeminiClient geminiClient;
    private final ItineraryService itineraryService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiItineraryService(GeminiClient geminiClient, ItineraryService itineraryService) {
        this.geminiClient = geminiClient;
        this.itineraryService = itineraryService;
    }

    public List<Itinerary> generateForDestination(String destination) {
        String rawJson = geminiClient.generateJson(buildPrompt(destination));

        JsonNode root;
        try {
            root = objectMapper.readTree(rawJson);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned invalid JSON: " + ex.getMessage());
        }

        Itinerary.Category category = parseEnum(
                root.path("category").asText("INDIA"), Itinerary.Category.class, Itinerary.Category.INDIA);

        List<Itinerary> saved = new ArrayList<>();
        for (JsonNode pkg : root.path("packages")) {
            saved.add(itineraryService.createItinerary(toItinerary(pkg, destination, category)));
        }

        if (saved.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini did not return any itinerary packages");
        }
        return saved;
    }

    private Itinerary toItinerary(JsonNode pkg, String destination, Itinerary.Category category) {
        Itinerary itinerary = new Itinerary();
        itinerary.setTitle(pkg.path("title").asText(destination + " Trip"));
        itinerary.setDestination(destination);

        int days = Math.max(1, pkg.path("durationDays").asInt(3));
        itinerary.setDuration(days + " Days / " + (days - 1) + " Nights");

        itinerary.setPrice(BigDecimal.valueOf(pkg.path("priceInr").asLong(10000)));
        itinerary.setRating(Math.max(1, Math.min(5, pkg.path("rating").asInt(4))));
        itinerary.setReviewCount(0);
        itinerary.setDescription(pkg.path("description").asText(""));
        itinerary.setCategory(category);
        itinerary.setIsActive(true);
        itinerary.setAiGenerated(true);
        itinerary.setType(parseEnum(pkg.path("tier").asText("BUDGET"), Itinerary.ItineraryType.class, Itinerary.ItineraryType.BUDGET));

        itinerary.setHighlights(toStringList(pkg.path("highlights")));
        itinerary.setInclusions(toStringList(pkg.path("inclusions")));
        itinerary.setExclusions(toStringList(pkg.path("exclusions")));
        itinerary.setDayPlans(toDayPlans(pkg.path("dayPlans")));

        return itinerary;
    }

    private List<DayPlan> toDayPlans(JsonNode dayPlansNode) {
        List<DayPlan> dayPlans = new ArrayList<>();
        int index = 1;
        for (JsonNode dayNode : dayPlansNode) {
            DayPlan dayPlan = new DayPlan();
            dayPlan.setDayNumber(dayNode.path("dayNumber").asInt(index));
            dayPlan.setTitle(dayNode.path("title").asText("Day " + index));

            List<Activity> activities = new ArrayList<>();
            for (JsonNode actNode : dayNode.path("activities")) {
                Activity activity = new Activity();
                activity.setTime(actNode.path("time").asText(""));
                activity.setActivity(actNode.path("activity").asText(""));
                activity.setIcon(actNode.path("icon").asText(null));
                activities.add(activity);
            }
            dayPlan.setActivities(activities);
            dayPlans.add(dayPlan);
            index++;
        }
        return dayPlans;
    }

    private List<String> toStringList(JsonNode arrayNode) {
        List<String> list = new ArrayList<>();
        for (JsonNode item : arrayNode) {
            list.add(item.asText(""));
        }
        return list;
    }

    private <E extends Enum<E>> E parseEnum(String raw, Class<E> enumType, E fallback) {
        try {
            return Enum.valueOf(enumType, raw.trim().toUpperCase());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private String buildPrompt(String destination) {
        return """
                You are a travel planner for an Indian travel agency. Generate exactly 2 travel package \
                options for a trip to "%s", covering different budgets: one BUDGET tier and one PREMIUM tier.

                Return ONLY a JSON object matching this exact schema - no markdown fences, no commentary:
                {
                  "category": "INDIA or INTERNATIONAL depending on the destination",
                  "packages": [
                    {
                      "tier": "BUDGET or PREMIUM",
                      "title": "short catchy package name",
                      "durationDays": integer (3 to 5),
                      "priceInr": integer (realistic total price per person in Indian Rupees for this destination and tier),
                      "rating": integer 1-5,
                      "description": "2-3 sentence overview",
                      "highlights": ["short highlight", "..."],
                      "inclusions": ["what's included", "..."],
                      "exclusions": ["what's excluded", "..."],
                      "dayPlans": [
                        {
                          "dayNumber": integer starting at 1,
                          "title": "short day title",
                          "activities": [
                            {"time": "e.g. 09:00 AM", "activity": "short activity description", "icon": "a matching Ionicons name such as airplane-outline, restaurant-outline, bed-outline, camera-outline, walk-outline"}
                          ]
                        }
                      ]
                    }
                  ]
                }

                Make the BUDGET package genuinely cheaper (2-3 star stays, shared/public transport, fewer paid \
                activities) and the PREMIUM package clearly nicer (4-5 star stays, private transport, more \
                curated experiences), with realistic Indian Rupee pricing for %s.
                """.formatted(destination, destination);
    }
}
