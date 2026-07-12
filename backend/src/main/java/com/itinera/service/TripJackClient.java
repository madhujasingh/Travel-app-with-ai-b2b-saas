package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.config.TripJackConfig;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.List;
import java.util.function.Function;

@Service
public class TripJackClient {

    private final RestClient restClient;
    private final RestClient hotelRestClient;
    private final RestClient hotelBookerRestClient;
    private final TripJackConfig tripJackConfig;

    public TripJackClient(TripJackConfig tripJackConfig) {
        this.tripJackConfig = tripJackConfig;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10000);
        requestFactory.setReadTimeout(20000);

        // TripJack's v1 hotel search sometimes responds with Content-Type:
        // application/octet-stream for a genuinely JSON body (confirmed via a real
        // city search - see docu/tripjack-support-message.md history). The default
        // Jackson converter refuses to parse a body whose declared content type
        // isn't JSON, throwing an uncaught RestClientException. Widening the
        // converter's supported media types fixes this without weakening anything
        // else - we still fail loudly if the body genuinely isn't JSON.
        MappingJackson2HttpMessageConverter jsonConverter = new MappingJackson2HttpMessageConverter();
        jsonConverter.setSupportedMediaTypes(List.of(
                MediaType.APPLICATION_JSON,
                MediaType.APPLICATION_OCTET_STREAM,
                new MediaType("text", "plain")
        ));

        this.restClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getBaseUrl()))
                .requestFactory(requestFactory)
                .messageConverters(converters -> converters.add(0, jsonConverter))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.hotelRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getHotelBaseUrl()))
                .requestFactory(requestFactory)
                .messageConverters(converters -> converters.add(0, jsonConverter))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();

        this.hotelBookerRestClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(tripJackConfig.getHotelBookerBaseUrl()))
                .requestFactory(requestFactory)
                .messageConverters(converters -> converters.add(0, jsonConverter))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public JsonNode post(String path, JsonNode payload) {
        return post(restClient, path, payload);
    }

    public JsonNode postHotel(String path, JsonNode payload) {
        return post(hotelRestClient, path, payload);
    }

    public JsonNode postHotelBooker(String path, JsonNode payload) {
        return post(hotelBookerRestClient, path, payload);
    }

    // Cancel Booking takes the bookingId as a URL path segment with no request body.
    // Uses a URI template + variable (rather than string concatenation) so the
    // bookingId is properly percent-encoded and can't inject extra path segments.
    public JsonNode postHotelBookerNoBody(String pathTemplate, Object... uriVariables) {
        requireApiKey();

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
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, describeUnexpected(ex));
        }
    }

    private JsonNode post(RestClient client, String path, JsonNode payload) {
        requireApiKey();

        try {
            return client.post()
                    .uri(path)
                    .header("apikey", tripJackConfig.getApiKey())
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
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, describeUnexpected(ex));
        }
    }

    public JsonNode get(String path) {
        return get(restClient, uriBuilder -> uriBuilder.path(path).build());
    }

    public JsonNode getHotel(String path) {
        return get(hotelRestClient, uriBuilder -> uriBuilder.path(path).build());
    }

    // Query-param variant (e.g. City Region IDs' limit/cursor) - building the URI
    // through Spring's UriBuilder rather than string concatenation ensures values
    // like a base64 cursor are properly percent-encoded.
    public JsonNode getHotel(Function<UriBuilder, URI> uriFunction) {
        return get(hotelRestClient, uriFunction);
    }

    private JsonNode get(RestClient client, Function<UriBuilder, URI> uriFunction) {
        requireApiKey();

        try {
            return client.get()
                    .uri(uriFunction)
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
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, describeUnexpected(ex));
        }
    }

    // Walks the cause chain so errors like "no suitable converter" don't hide
    // the actual underlying parse failure (e.g. a body that isn't valid UTF-8).
    private String describeUnexpected(Exception ex) {
        StringBuilder sb = new StringBuilder("TripJack request failed unexpectedly: ")
                .append(ex.getClass().getSimpleName()).append(": ").append(ex.getMessage());
        Throwable cause = ex.getCause();
        int depth = 0;
        while (cause != null && depth < 3) {
            sb.append(" | caused by ").append(cause.getClass().getSimpleName()).append(": ").append(cause.getMessage());
            cause = cause.getCause();
            depth++;
        }
        return sb.toString();
    }

    private void requireApiKey() {
        if (!StringUtils.hasText(tripJackConfig.getApiKey())) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "TripJack API key is not configured"
            );
        }
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }

        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
