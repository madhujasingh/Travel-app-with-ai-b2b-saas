package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AIRecommendationService {

    private final RestClient restClient;

    public AIRecommendationService(@Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl) {
        String normalizedUrl = aiServiceUrl.startsWith("http://") || aiServiceUrl.startsWith("https://")
                ? aiServiceUrl
                : "http://" + aiServiceUrl;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(10000);

        this.restClient = RestClient.builder()
                .baseUrl(normalizedUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public JsonNode getRecommendations(JsonNode payload) {
        try {
            return restClient.post()
                    .uri("/recommend")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI service returned an error: " + ex.getStatusCode().value()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service is unavailable"
            );
        }
    }
}
