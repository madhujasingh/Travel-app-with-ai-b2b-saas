package com.itinera.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

// HotelBeds/HBX Group Activities API - a separate provider/credential set
// from TripJack (see TripJackConfig). Auth is API key + a per-request
// X-Signature (SHA-256 of apiKey+secret+current unix timestamp), not a
// static header, so both apiKey and secret are needed at request time (see
// ActivitiesClient) rather than just one static key.
@ConfigurationProperties(prefix = "activities")
public class ActivitiesConfig {

    private String baseUrl = "https://api.test.hotelbeds.com";
    private String apiKey;
    private String secret;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }
}
