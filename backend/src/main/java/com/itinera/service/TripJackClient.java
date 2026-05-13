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

@Service
public class TripJackClient {

    private final RestClient restClient;
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
    }

    public JsonNode post(String path, JsonNode payload) {
        if (!StringUtils.hasText(tripJackConfig.getApiKey())) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "TripJack API key is not configured"
            );
        }

        try {
            return restClient.post()
                    .uri(path)
                    .header("apikey", tripJackConfig.getApiKey())
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "TripJack request failed with status " + ex.getStatusCode().value()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "TripJack service is unavailable"
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
