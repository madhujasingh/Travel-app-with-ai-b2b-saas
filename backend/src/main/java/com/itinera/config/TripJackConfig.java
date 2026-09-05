package com.itinera.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tripjack")
public class TripJackConfig {

    private String baseUrl = "https://apitest.tripjack.com";
    private String hotelBaseUrl = "https://apitest-hms.tripjack.com";
    private String hotelBookerBaseUrl = "https://apitest-hotel-booker.tripjack.com";
    // Cabs UAT host (Cabs API Documentation v2, "Service Definition") - the
    // doc's own listed production host ("https://tripjack.com") is almost
    // certainly a copy-paste error (their marketing homepage, not an API
    // shape), so no production default is set here yet - confirm the real
    // one with TripJack before going live.
    private String cabsBaseUrl = "https://apitest-cabs.tripjack.com";
    private String apiKey;
    // Separate UAT/certification key for NEW, not-yet-certified TripJack
    // products (Cabs, TripSafe) - kept distinct from apiKey (production,
    // already live for flights/hotels/activities) so testing a brand-new
    // integration can never accidentally hit production with real money.
    private String testApiKey;

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

    public String getHotelBookerBaseUrl() {
        return hotelBookerBaseUrl;
    }

    public void setHotelBookerBaseUrl(String hotelBookerBaseUrl) {
        this.hotelBookerBaseUrl = hotelBookerBaseUrl;
    }

    public String getCabsBaseUrl() {
        return cabsBaseUrl;
    }

    public void setCabsBaseUrl(String cabsBaseUrl) {
        this.cabsBaseUrl = cabsBaseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getTestApiKey() {
        return testApiKey;
    }

    public void setTestApiKey(String testApiKey) {
        this.testApiKey = testApiKey;
    }
}
