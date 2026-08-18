package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;
import java.util.List;
import java.util.Map;

// OCRs an admin-uploaded flyer/poster image into raw text via Google Cloud
// Vision. Deliberately dumb - it only extracts text, it doesn't try to
// structure it. The frontend runs that raw text through the same
// flyerTextParser.js used for pasted text, so this is just an alternate way
// to get text into that box when the admin only has a photo.
@Service
public class FlyerOcrService {

    private final RestClient restClient;
    private final String apiKey;

    public FlyerOcrService(@Value("${google.cloud-vision-api-key:}") String apiKey) {
        this.apiKey = apiKey;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(15000);

        this.restClient = RestClient.builder()
                .baseUrl("https://vision.googleapis.com/v1")
                .requestFactory(requestFactory)
                .build();
    }

    public String extractText(byte[] imageBytes) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Flyer scanning isn't configured - set GOOGLE_CLOUD_VISION_API_KEY"
            );
        }

        String base64Image = Base64.getEncoder().encodeToString(imageBytes);
        Map<String, Object> requestBody = Map.of(
                "requests", List.of(Map.of(
                        "image", Map.of("content", base64Image),
                        "features", List.of(Map.of("type", "TEXT_DETECTION"))
                ))
        );

        JsonNode response;
        try {
            response = restClient.post()
                    .uri("/images:annotate?key={apiKey}", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException ex) {
            String detail = extractGoogleErrorMessage(ex.getResponseBodyAsString());
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Vision API returned " + ex.getStatusCode().value()
                            + (detail != null ? ": " + detail : "")
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Vision API is unavailable");
        }

        JsonNode responses = response != null ? response.path("responses") : null;
        if (responses == null || !responses.isArray() || responses.isEmpty()) {
            return "";
        }

        JsonNode first = responses.get(0);
        if (first.has("error")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Vision API error: " + first.path("error").path("message").asText("unknown error")
            );
        }

        JsonNode fullText = first.path("fullTextAnnotation").path("text");
        return fullText.isMissingNode() ? "" : fullText.asText("");
    }

    // Google's error body shape is {"error": {"code": ..., "message": "...", "status": "..."}} -
    // pull the message out so the admin sees the real reason (bad key, billing
    // not enabled, wrong key restriction, etc.) instead of just a status code.
    private String extractGoogleErrorMessage(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return null;
        }
        try {
            JsonNode body = new ObjectMapper().readTree(responseBody);
            JsonNode message = body.path("error").path("message");
            return message.isMissingNode() ? null : message.asText(null);
        } catch (Exception e) {
            return null;
        }
    }
}
