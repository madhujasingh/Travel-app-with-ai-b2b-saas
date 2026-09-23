package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// TripJack has no low-fare/fare-calendar API of its own (checked the whole
// search-api doc - no "calendar" or "low fare" mention anywhere), so this
// fakes one: fan out to the normal Search endpoint once per candidate date,
// holding everything else (route, passengers, cabin) fixed, and report back
// just the cheapest adult fare found per date.
@Service
public class FareCalendarService {

    // Capped at 3 concurrent TripJack calls - a 15-day window fired all at
    // once would repeat the ~20-rapid-calls burst that briefly took the
    // Render free-tier backend down during TripSafe UAT testing (see
    // project_tripjack_tripsafe_integration memory). 15 dates / 3 at a time
    // = 5 sequential batches instead of one burst.
    private final ExecutorService executor = Executors.newFixedThreadPool(3);

    private final TripJackClient tripJackClient;
    private final ObjectMapper objectMapper;

    public FareCalendarService(TripJackClient tripJackClient, ObjectMapper objectMapper) {
        this.tripJackClient = tripJackClient;
        this.objectMapper = objectMapper;
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdown();
    }

    public JsonNode fareCalendar(JsonNode request) {
        String fromCode = request.path("fromCode").asText(null);
        String toCode = request.path("toCode").asText(null);
        String centerDateStr = request.path("centerDate").asText(null);
        if (fromCode == null || toCode == null || centerDateStr == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fromCode, toCode and centerDate are required");
        }

        LocalDate centerDate;
        try {
            centerDate = LocalDate.parse(centerDateStr);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "centerDate must be YYYY-MM-DD");
        }

        // Clamped server-side too, not just left to whatever the frontend
        // sends - the concurrency cap above only protects against a burst
        // WITHIN one request; a caller asking for a 90-day window would still
        // turn into 90 sequential-ish TripJack calls one request at a time.
        int daysBefore = Math.min(Math.max(request.path("daysBefore").asInt(7), 0), 7);
        int daysAfter = Math.min(Math.max(request.path("daysAfter").asInt(7), 0), 7);

        String cabinClass = request.path("cabinClass").asText("ECONOMY");
        String adults = request.path("adults").asText("1");
        String children = request.path("children").asText("0");
        String infants = request.path("infants").asText("0");
        boolean isDirect = request.path("isDirectFlight").asBoolean(true);
        boolean isConnecting = request.path("isConnectingFlight").asBoolean(true);
        String pft = request.hasNonNull("pft") ? request.path("pft").asText() : null;

        LocalDate today = LocalDate.now();
        List<LocalDate> dates = new ArrayList<>();
        for (int offset = -daysBefore; offset <= daysAfter; offset++) {
            LocalDate date = centerDate.plusDays(offset);
            if (!date.isBefore(today)) {
                dates.add(date);
            }
        }

        // Map.entry() (used originally) rejects a null value outright - and
        // searchCheapestFare legitimately returns null for a date with no
        // fare found, which turned into an NPE on every single request.
        // AbstractMap.SimpleEntry tolerates a null value just fine.
        List<CompletableFuture<Map.Entry<String, Double>>> futures = new ArrayList<>();
        for (LocalDate date : dates) {
            futures.add(CompletableFuture.supplyAsync(
                    () -> new AbstractMap.SimpleEntry<>(date.toString(), searchCheapestFare(
                            fromCode, toCode, date, cabinClass, adults, children, infants, isDirect, isConnecting, pft)),
                    executor
            ));
        }

        ObjectNode result = objectMapper.createObjectNode();
        ObjectNode fares = result.putObject("fares");
        for (CompletableFuture<Map.Entry<String, Double>> future : futures) {
            Map.Entry<String, Double> entry = future.join();
            if (entry.getValue() != null) {
                fares.put(entry.getKey(), entry.getValue());
            }
        }
        return result;
    }

    // A single date's search failing (no availability, a transient TripJack
    // error) should just leave that day blank on the calendar, not fail the
    // whole request - the caller already sees 14 other days' prices either way.
    private Double searchCheapestFare(
            String fromCode,
            String toCode,
            LocalDate date,
            String cabinClass,
            String adults,
            String children,
            String infants,
            boolean isDirect,
            boolean isConnecting,
            String pft
    ) {
        try {
            ObjectNode routeInfo = objectMapper.createObjectNode();
            routeInfo.putObject("fromCityOrAirport").put("code", fromCode);
            routeInfo.putObject("toCityOrAirport").put("code", toCode);
            routeInfo.put("travelDate", date.toString());

            ObjectNode paxInfo = objectMapper.createObjectNode();
            paxInfo.put("ADULT", adults);
            paxInfo.put("CHILD", children);
            paxInfo.put("INFANT", infants);

            ObjectNode searchModifiers = objectMapper.createObjectNode();
            searchModifiers.put("isDirectFlight", isDirect);
            searchModifiers.put("isConnectingFlight", isConnecting);
            if (pft != null) {
                searchModifiers.put("pft", pft);
            }

            ObjectNode searchQuery = objectMapper.createObjectNode();
            searchQuery.put("cabinClass", cabinClass);
            searchQuery.set("paxInfo", paxInfo);
            searchQuery.set("routeInfos", objectMapper.createArrayNode().add(routeInfo));
            searchQuery.set("searchModifiers", searchModifiers);

            ObjectNode payload = objectMapper.createObjectNode();
            payload.set("searchQuery", searchQuery);

            JsonNode response = tripJackClient.post("/fms/v1/air-search-all", payload);
            return extractCheapestAdultFare(response);
        } catch (Exception ex) {
            return null;
        }
    }

    // Same field path the frontend already reads per fare option
    // (priceOption.fd.ADULT.fC.TF) - see FlightsScreen.js's fareOptions
    // mapping. Comparing this per-adult figure across dates is a fair
    // apples-to-apples read since every date in the window is searched with
    // the identical passenger composition.
    private Double extractCheapestAdultFare(JsonNode response) {
        if (response == null) return null;
        JsonNode tripInfos = response.path("searchResult").path("tripInfos");
        if (!tripInfos.isObject()) return null;

        double min = Double.MAX_VALUE;
        boolean found = false;
        Iterator<String> bucketNames = tripInfos.fieldNames();
        while (bucketNames.hasNext()) {
            JsonNode trips = tripInfos.get(bucketNames.next());
            if (!trips.isArray()) continue;
            for (JsonNode trip : trips) {
                for (JsonNode priceOption : trip.path("totalPriceList")) {
                    JsonNode tfNode = priceOption.path("fd").path("ADULT").path("fC").path("TF");
                    if (tfNode.isNumber()) {
                        double tf = tfNode.asDouble();
                        if (tf < min) {
                            min = tf;
                            found = true;
                        }
                    }
                }
            }
        }
        return found ? min : null;
    }
}
