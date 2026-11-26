package com.itinera.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

// Cashfree Payment Gateway (Orders API) - collects customer payment for the
// itinerary/package checkout flow. See CashfreeClient for how these are used.
@ConfigurationProperties(prefix = "cashfree")
public class CashfreeConfig {

    private String baseUrl = "https://sandbox.cashfree.com";
    private String appId;
    // Also used to verify inbound webhook signatures (HMAC-SHA256 keyed on
    // this same secret) - Cashfree doesn't issue a separate per-webhook
    // signing secret the way some gateways do.
    private String secretKey;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getAppId() {
        return appId;
    }

    public void setAppId(String appId) {
        this.appId = appId;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }
}
