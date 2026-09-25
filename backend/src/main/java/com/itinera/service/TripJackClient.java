package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.util.function.Function;
import java.util.zip.GZIPInputStream;

@Service
public class TripJackClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

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
    // Cabs + TripSafe production clients - both certified 2026-09, both
    // point at the shared https://tripjack.com production domain (confirmed
    // live against the working production Flights key), authenticated with
    // apiKey (production), never testApiKey. Kept as separate clients from
    // cabsRestClient/tripsafeRestClient above rather than repointing those
    // in place, so UAT re-certification (e.g. a future feature addition)
    // still has an isolated sandbox path real customer traffic never touches.
    private final RestClient cabsProdRestClient;
    private final RestClient tripsafeProdRestClient;
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

        this.cabsProdRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getCabsProdBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.tripsafeProdRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getTripsafeProdBaseUrl()))
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

    // Production Cabs/TripSafe - real customer traffic, real money. Callers
    // (CabsService/TripSafeService) use these once live; the test-key
    // methods above stay reserved for UAT/re-certification only.
    public JsonNode postCabsLive(String path, JsonNode payload) {
        return post(cabsProdRestClient, path, payload, tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    public JsonNode getCabsLive(String path) {
        return get(cabsProdRestClient, uriBuilder -> uriBuilder.path(path).build(), tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    public JsonNode getCabsLive(Function<UriBuilder, URI> uriFunction) {
        return get(cabsProdRestClient, uriFunction, tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    public JsonNode postTripSafeLive(String path, JsonNode payload) {
        return post(tripsafeProdRestClient, path, payload, tripJackConfig.getApiKey(), "TripJack API key is not configured");
    }

    // Cancel Booking takes the bookingId as a URL path segment with no request body.
    // Uses a URI template + variable (rather than string concatenation) so the
    // bookingId is properly percent-encoded and can't inject extra path segments.
    public JsonNode postHotelBookerNoBody(String pathTemplate, Object... uriVariables) {
        requireKey(tripJackConfig.getApiKey(), "TripJack API key is not configured");

        try {
            return parseJson(hotelBookerRestClient.post()
                    .uri(pathTemplate, uriVariables)
                    .header("apikey", tripJackConfig.getApiKey())
                    .retrieve()
                    .body(byte[].class));
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
            return parseJson(client.post()
                    .uri(path)
                    .header("apikey", apiKey)
                    .body(payload)
                    .retrieve()
                    .body(byte[].class));
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
            return parseJson(client.get()
                    .uri(uriFunction)
                    .header("apikey", apiKey)
                    .retrieve()
                    .body(byte[].class));
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

    // TripJack sometimes labels a response's Content-Type as
    // application/octet-stream instead of application/json - seen live on a
    // larger search result (Patna-Bhubaneswar, 27 Oct) - and Spring's
    // .body(JsonNode.class) picks its converter by that header, so it threw
    // "no converter for content type" even though the bytes were valid JSON.
    // Pulling the raw bytes ourselves and parsing them regardless of what
    // the header claims sidesteps that entirely, and doubles as gzip-safety
    // if a response is ever compressed without being labeled as such.
    private JsonNode parseJson(byte[] raw) throws IOException {
        if (raw == null || raw.length == 0) {
            return null;
        }
        if (raw.length > 1 && raw[0] == (byte) 0x1f && raw[1] == (byte) 0x8b) {
            try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(raw))) {
                return OBJECT_MAPPER.readTree(gzip);
            }
        }
        return OBJECT_MAPPER.readTree(raw);
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
