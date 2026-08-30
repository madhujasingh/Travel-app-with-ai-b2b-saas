package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.config.GeminiConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.Base64;

// Thin wrapper around Gemini's generateContent REST endpoint (Google AI
// Studio's free tier - see project memory on itinerary generation). Always
// asks for responseMimeType "application/json" so the model's own JSON mode
// does the escaping/formatting correctly instead of us regex-stripping
// markdown code fences out of a plain-text reply.
@Service
public class GeminiClient {

    private final RestClient restClient;
    private final GeminiConfig geminiConfig;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GeminiClient(GeminiConfig geminiConfig) {
        this.geminiConfig = geminiConfig;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10000);
        requestFactory.setReadTimeout(30000);

        this.restClient = RestClient.builder()
                .baseUrl(geminiConfig.getBaseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // Returns the raw text of the model's first candidate response - the
    // caller parses it as JSON per its own expected schema.
    public String generateJson(String prompt) {
        ObjectNode part = objectMapper.createObjectNode();
        part.put("text", prompt);
        ObjectNode content = objectMapper.createObjectNode();
        content.set("parts", objectMapper.createArrayNode().add(part));
        ObjectNode generationConfig = objectMapper.createObjectNode();
        generationConfig.put("responseMimeType", "application/json");
        ObjectNode body = objectMapper.createObjectNode();
        body.set("contents", objectMapper.createArrayNode().add(content));
        body.set("generationConfig", generationConfig);
        return callGemini(body);
    }

    // Multimodal variant - Gemini can "see" the image alongside the text
    // prompt in the same request (inlineData part, base64-encoded). Used for
    // admin promo-banner title suggestions (see PromoBannerService); returns
    // plain text rather than forcing JSON mode since callers just want a
    // short string back.
    public String generateTextWithImage(String prompt, byte[] imageBytes, String imageMimeType) {
        ObjectNode textPart = objectMapper.createObjectNode();
        textPart.put("text", prompt);

        ObjectNode inlineData = objectMapper.createObjectNode();
        inlineData.put("mimeType", imageMimeType);
        inlineData.put("data", Base64.getEncoder().encodeToString(imageBytes));
        ObjectNode imagePart = objectMapper.createObjectNode();
        imagePart.set("inlineData", inlineData);

        ObjectNode content = objectMapper.createObjectNode();
        content.set("parts", objectMapper.createArrayNode().add(textPart).add(imagePart));
        ObjectNode body = objectMapper.createObjectNode();
        body.set("contents", objectMapper.createArrayNode().add(content));
        return callGemini(body).trim();
    }

    private String callGemini(ObjectNode body) {
        if (!StringUtils.hasText(geminiConfig.getApiKey())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Gemini API key is not configured");
        }

        try {
            JsonNode response = restClient.post()
                    .uri("/v1beta/models/{model}:generateContent?key={apiKey}",
                            geminiConfig.getModel(), geminiConfig.getApiKey())
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            String text = response
                    .path("candidates").path(0)
                    .path("content").path("parts").path(0)
                    .path("text").asText(null);

            if (text == null || text.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned an empty response");
            }
            return text;
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Gemini request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Gemini service is unavailable");
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Gemini request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }
}
