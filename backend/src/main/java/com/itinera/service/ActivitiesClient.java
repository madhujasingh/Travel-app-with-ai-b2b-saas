package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.config.ActivitiesConfig;
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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;

// HotelBeds/HBX Group Activities API client. Unlike TripJackClient's static
// apikey header, this API's X-Signature is SHA256(apiKey + secret + current
// unix-epoch-seconds) in hex, computed fresh per request - it can't be
// precomputed/cached since it embeds the current timestamp, and (per their
// docs) is presumably only valid for a short window around that timestamp.
@Service
public class ActivitiesClient {

    private final RestClient restClient;
    private final ActivitiesConfig activitiesConfig;

    public ActivitiesClient(ActivitiesConfig activitiesConfig) {
        this.activitiesConfig = activitiesConfig;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10000);
        requestFactory.setReadTimeout(20000);

        this.restClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(activitiesConfig.getBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public JsonNode post(String path, JsonNode payload) {
        requireCredentials();

        try {
            return restClient.post()
                    .uri(path)
                    .header("Api-key", activitiesConfig.getApiKey())
                    .header("X-Signature", computeSignature())
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Activities API request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Activities API service is unavailable"
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Activities API request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }

    // apiKey + secret + current unix-epoch-seconds, SHA-256, lowercase hex -
    // matches the docs' `echo -n ${apiKey}${secret}$(date +%s) | sha256sum`.
    private String computeSignature() {
        try {
            String raw = activitiesConfig.getApiKey() + activitiesConfig.getSecret() + Instant.now().getEpochSecond();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private void requireCredentials() {
        if (!StringUtils.hasText(activitiesConfig.getApiKey()) || !StringUtils.hasText(activitiesConfig.getSecret())) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Activities API credentials are not configured"
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
