package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.config.TripJackConfig;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.function.Function;

@Service
public class TripJackClient {

    private final RestClient restClient;
    private final RestClient hotelRestClient;
    private final RestClient hotelBookerRestClient;
    // Cabs is a NEW, not-yet-certified product - always authenticated with
    // testApiKey (never the production apiKey the three clients above use),
    // so certification testing can never accidentally touch production with
    // real money. Cabs' own UAT host is already known (unlike TripSafe,
    // whose docs haven't been reviewed yet), so this gets a proper
    // constructor-built client like the others rather than a one-off.
    private final RestClient cabsRestClient;
    // TripSafe (travel insurance) - same UAT-only, testApiKey-only treatment
    // as Cabs above; every TripSafe endpoint is POST (including Booking
    // Details, unlike Cabs), so no GET helper is needed for it.
    private final RestClient tripsafeRestClient;
    private final TripJackConfig tripJackConfig;

    public TripJackClient(TripJackConfig tripJackConfig) {
        this.tripJackConfig = tripJackConfig;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10000);
        requestFactory.setReadTimeout(20000);

        this.restClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.hotelRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getHotelBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.hotelBookerRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getHotelBookerBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.cabsRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getCabsBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.tripsafeRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getTripsafeBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public JsonNode post(String path, JsonNode payload) {
        return post(restClient, path, payload, tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    public JsonNode postHotel(String path, JsonNode payload) {
        return post(hotelRestClient, path, payload, tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    public JsonNode postHotelBooker(String path, JsonNode payload) {
        return post(hotelBookerRestClient, path, payload, tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    // Cabs doc's own header naming is inconsistent ("x-api-key" in one line,
    // "apiKey" in the next) - going with "apikey" first since that's what
    // every other TripJack product here actually uses; if Cabs 401s on a
    // real call, that's the first thing to check.
    public JsonNode postCabs(String path, JsonNode payload) {
        return post(cabsRestClient, path, payload, tripJackConfig.getTestApiKey(), "TripJack test API key is not configured");
    }

    public JsonNode getCabs(String path) {
        return get(cabsRestClient, uriBuilder -> uriBuilder.path(path).build(), tripJackConfig.getTestApiKey(), "TripJack test API key is not configured");
    }

    // Query-param variant (e.g. Booking Details' bookingIds, Amendment's
    // bookingId/type) - building the URI through Spring's UriBuilder rather
    // than string concatenation ensures values are properly percent-encoded.
    public JsonNode getCabs(Function<UriBuilder, URI> uriFunction) {
        return get(cabsRestClient, uriFunction, tripJackConfig.getTestApiKey(), "TripJack test API key is not configured");
    }

    // TripSafe - every documented endpoint (Search, Review, Book, Booking
    // Details, Raise-Amendments, Cancellation) is POST with a JSON body.
    public JsonNode postTripSafe(String path, JsonNode payload) {
        return post(tripsafeRestClient, path, payload, tripJackConfig.getTestApiKey(), "TripJack test API key is not configured");
    }

    // Cancel Booking takes the bookingId as a URL path segment with no request body.
    // Uses a URI template + variable (rather than string concatenation) so the
    // bookingId is properly percent-encoded and can't inject extra path segments.
    public JsonNode postHotelBookerNoBody(String pathTemplate, Object... uriVariables) {
        requireKey(tripJackConfig.getApiKey(), "TripJack API key is not configured");

        try {
            return hotelBookerRestClient.post()
                    .uri(pathTemplate, uriVariables)
                    .header("apikey", tripJackConfig.getApiKey())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "TripJack request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "TripJack service is unavailable"
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "TripJack request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }

    private JsonNode post(RestClient client, String path, JsonNode payload, String apiKey, String missingKeyMessage) {
        requireKey(apiKey, missingKeyMessage);

        try {
            return client.post()
                    .uri(path)
                    .header("apikey", apiKey)
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "TripJack request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "TripJack service is unavailable"
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "TripJack request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }

    public JsonNode get(String path) {
        return get(restClient, uriBuilder -> uriBuilder.path(path).build(), tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    public JsonNode getHotel(String path) {
        return get(hotelRestClient, uriBuilder -> uriBuilder.path(path).build(), tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    // Query-param variant (e.g. City Region IDs' limit/cursor) - building the URI
    // through Spring's UriBuilder rather than string concatenation ensures values
    // like a base64 cursor are properly percent-encoded.
    public JsonNode getHotel(Function<UriBuilder, URI> uriFunction) {
        return get(hotelRestClient, uriFunction, tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    private JsonNode get(RestClient client, Function<UriBuilder, URI> uriFunction, String apiKey, String missingKeyMessage) {
        requireKey(apiKey, missingKeyMessage);

        try {
            return client.get()
                    .uri(uriFunction)
                    .header("apikey", apiKey)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "TripJack request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "TripJack service is unavailable"
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "TripJack request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }

    private void requireKey(String apiKey, String missingKeyMessage) {
        if (!StringUtils.hasText(apiKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, missingKeyMessage);
        }
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }

        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
