package com.itinera.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "gemini")
public class GeminiConfig {

    private String baseUrl = "https://generativelanguage.googleapis.com";
    // gemini-2.0-flash was retired - Google's own 404 response on that model
    // pointed us to this one. Verify against https://aistudio.google.com if
    // this ever 404s again; model names/availability shift over time.
    private String model = "gemini-3.6-flash";
    private String apiKey;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
}
