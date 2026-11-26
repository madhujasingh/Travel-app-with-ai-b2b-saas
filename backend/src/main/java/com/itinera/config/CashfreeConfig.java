package com.itinera.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

// Cashfree Payment Gateway (Orders API) - collects customer payment for the
// itinerary/package checkout flow. See CashfreeClient for how these are used.
@ConfigurationProperties(prefix = "cashfree")
public class CashfreeConfig {

    private String baseUrl = "https://sandbox.cashfree.com";
    private String appId;
    private String secretKey;
    // Verifies the signature on inbound webhook callbacks - generated on the
    // Cashfree Dashboard's webhook setup screen, a different secret from
    // appId/secretKey above (those come from the API Keys page).
    private String webhookSecret;

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

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }
}
