package com.itinera.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tripjack")
public class TripJackConfig {

    private String baseUrl = "https://apitest.tripjack.com";
    private String hotelBaseUrl = "https://apitest-hms.tripjack.com";
    private String hotelBookerBaseUrl = "https://apitest-hotel-booker.tripjack.com";
    // Cabs UAT host (Cabs API Documentation v2, "Service Definition").
    private String cabsBaseUrl = "https://apitest-cabs.tripjack.com";
    // Cabs Book/Payment both require "agentId" - TripJack's own numeric User
    // Id for this account (the same one referenced when generating the API
    // key / whitelisting an IP on their portal: "Navigate to the User detail
    // for the User id you wish to create an API Key"). Not derivable from
    // any API call in the docs and not customer-specific - one fixed value
    // per account, injected server-side so the frontend never needs it.
    private String cabsAgentId;
    // TripSafe (travel insurance) UAT host - "Service Definition" (p.7 of
    // TripSafe Documentation v6).
    private String tripsafeBaseUrl = "https://apitest.tripjack.com";
    private String apiKey;
    // Separate UAT/certification key for NEW TripJack products (Cabs,
    // TripSafe) - kept distinct from apiKey (production) so certifying a
    // brand-new integration or a future feature addition can never
    // accidentally hit production with real money.
    private String testApiKey;

    // Cabs + TripSafe production - both are now certified (2026-09) and
    // both docs list, and a live test against the working production
    // Flights key CONFIRMED, the same shared production domain:
    // https://tripjack.com (unlike the UAT hosts above, which are split per
    // product - apitest-cabs.tripjack.com vs apitest.tripjack.com). Kept as
    // separate *Prod* fields/clients rather than repointing cabsBaseUrl/
    // tripsafeBaseUrl in place, so UAT re-certification (a future feature
    // addition, e.g.) still has a safe sandbox path that can never mix with
    // the one real customers hit.
    private String cabsProdBaseUrl = "https://tripjack.com";
    private String tripsafeProdBaseUrl = "https://tripjack.com";
    // Cabs' production agentId - TripJack's numeric User Id for the
    // PRODUCTION account, distinct from cabsAgentId (the UAT/test account's
    // id) above - same "Navigate to the User detail..." portal screen, just
    // the production account instead of the certification one.
    private String cabsProdAgentId;

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

    public String getCabsAgentId() {
        return cabsAgentId;
    }

    public void setCabsAgentId(String cabsAgentId) {
        this.cabsAgentId = cabsAgentId;
    }

    public String getTripsafeBaseUrl() {
        return tripsafeBaseUrl;
    }

    public void setTripsafeBaseUrl(String tripsafeBaseUrl) {
        this.tripsafeBaseUrl = tripsafeBaseUrl;
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

    public String getCabsProdBaseUrl() {
        return cabsProdBaseUrl;
    }

    public void setCabsProdBaseUrl(String cabsProdBaseUrl) {
        this.cabsProdBaseUrl = cabsProdBaseUrl;
    }

    public String getTripsafeProdBaseUrl() {
        return tripsafeProdBaseUrl;
    }

    public void setTripsafeProdBaseUrl(String tripsafeProdBaseUrl) {
        this.tripsafeProdBaseUrl = tripsafeProdBaseUrl;
    }

    public String getCabsProdAgentId() {
        return cabsProdAgentId;
    }

    public void setCabsProdAgentId(String cabsProdAgentId) {
        this.cabsProdAgentId = cabsProdAgentId;
    }
}
