package com.itinera.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tripjack")
public class TripJackConfig {

    private String baseUrl = "https://apitest.tripjack.com";
    private String hotelBaseUrl = "https://apitest-hms.tripjack.com";
    private String apiKey;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getHotelBaseUrl() {
        return hotelBaseUrl;
    }

    public void setHotelBaseUrl(String hotelBaseUrl) {
        this.hotelBaseUrl = hotelBaseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
}
