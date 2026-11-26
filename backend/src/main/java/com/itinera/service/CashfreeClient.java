package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.itinera.config.CashfreeConfig;
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

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

@Service
public class CashfreeClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String API_VERSION = "2023-08-01";

    private final RestClient restClient;
    private final CashfreeConfig cashfreeConfig;

    public CashfreeClient(CashfreeConfig cashfreeConfig) {
        this.cashfreeConfig = cashfreeConfig;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10000);
        requestFactory.setReadTimeout(20000);

        this.restClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(cashfreeConfig.getBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("x-api-version", API_VERSION)
                .build();
    }

    // Creates a Cashfree order. Callers read payment_session_id (handed to
    // the checkout webview) and cf_order_id (Cashfree's own id, kept for
    // support lookups) off the response.
    public JsonNode createOrder(String orderId, BigDecimal amount, String customerId,
                                 String customerPhone, String customerEmail,
                                 String customerName, String returnUrl) {
        requireCredentials();

        ObjectNode customerDetails = OBJECT_MAPPER.createObjectNode();
        customerDetails.put("customer_id", customerId);
        customerDetails.put("customer_phone", customerPhone);
        if (StringUtils.hasText(customerEmail)) {
            customerDetails.put("customer_email", customerEmail);
        }
        if (StringUtils.hasText(customerName)) {
            customerDetails.put("customer_name", customerName);
        }

        ObjectNode orderMeta = OBJECT_MAPPER.createObjectNode();
        orderMeta.put("return_url", returnUrl);

        ObjectNode payload = OBJECT_MAPPER.createObjectNode();
        payload.put("order_id", orderId);
        payload.put("order_amount", amount);
        payload.put("order_currency", "INR");
        payload.set("customer_details", customerDetails);
        payload.set("order_meta", orderMeta);

        return post("/pg/orders", payload);
    }

    // Live order status from Cashfree (order_status: ACTIVE/PAID/EXPIRED/
    // TERMINATED) - used by PaymentService to reconcile a status the webhook
    // hasn't delivered yet, e.g. right after the checkout webview returns.
    public JsonNode getOrder(String orderId) {
        requireCredentials();
        try {
            return parseJson(restClient.get()
                    .uri("/pg/orders/{orderId}", orderId)
                    .header("x-client-id", cashfreeConfig.getAppId())
                    .header("x-client-secret", cashfreeConfig.getSecretKey())
                    .retrieve()
                    .body(byte[].class));
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Cashfree request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cashfree service is unavailable");
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Cashfree request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }

    // HMAC-SHA256(webhookSecret, timestamp + rawBody), base64-encoded, per
    // Cashfree's webhook verification spec - compared as raw bytes via
    // MessageDigest.isEqual so a mismatch can't be timed out character by
    // character.
    public boolean verifyWebhookSignature(String timestamp, String rawBody, String signature) {
        if (!StringUtils.hasText(cashfreeConfig.getWebhookSecret()) || !StringUtils.hasText(signature)
                || !StringUtils.hasText(timestamp)) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(cashfreeConfig.getWebhookSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal((timestamp + rawBody).getBytes(StandardCharsets.UTF_8));
            String expected = Base64.getEncoder().encodeToString(computed);
            return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            return false;
        }
    }

    private JsonNode post(String path, JsonNode payload) {
        try {
            return parseJson(restClient.post()
                    .uri(path)
                    .header("x-client-id", cashfreeConfig.getAppId())
                    .header("x-client-secret", cashfreeConfig.getSecretKey())
                    .body(payload)
                    .retrieve()
                    .body(byte[].class));
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Cashfree request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cashfree service is unavailable");
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Cashfree request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }

    private JsonNode parseJson(byte[] raw) throws IOException {
        if (raw == null || raw.length == 0) {
            return null;
        }
        return OBJECT_MAPPER.readTree(raw);
    }

    private void requireCredentials() {
        if (!StringUtils.hasText(cashfreeConfig.getAppId()) || !StringUtils.hasText(cashfreeConfig.getSecretKey())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cashfree credentials are not configured");
        }
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
