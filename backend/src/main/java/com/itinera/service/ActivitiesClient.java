package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.config.ActivitiesConfig;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.function.Supplier;
import java.util.zip.GZIPInputStream;

// HotelBeds/HBX Group Activities API client. Unlike TripJackClient's static
// apikey header, this API's X-Signature is SHA256(apiKey + secret + current
// unix-epoch-seconds) in hex, computed fresh per request - it can't be
// precomputed/cached since it embeds the current timestamp, and (per their
// docs) is presumably only valid for a short window around that timestamp.
@Service
public class ActivitiesClient {

    private final RestClient restClient;
    private final ActivitiesConfig activitiesConfig;

    public ActivitiesClient(ActivitiesConfig activitiesConfig) {
        this.activitiesConfig = activitiesConfig;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10000);
        requestFactory.setReadTimeout(20000);

        // HotelBeds' own certification review checks that this is sent - see
        // activities-api/activities-knowledge-base/certification process .txt
        // ("we will review... how well you are using GZIP compression").
        // SimpleClientHttpRequestFactory wraps java.net.HttpURLConnection,
        // which - unlike a browser or most other languages' HTTP clients -
        // does NOT auto-decompress a gzip response just because Accept-
        // Encoding was sent, so the interceptor below does that manually.
        this.restClient = RestClient.builder()
                .baseUrl(trimTrailingSlash(activitiesConfig.getBaseUrl()))
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT_ENCODING, "gzip")
                .requestInterceptor(GZIP_DECOMPRESSING_INTERCEPTOR)
                .build();
    }

    public JsonNode post(String path, JsonNode payload) {
        return execute(() -> restClient.post()
                .uri(path)
                .header("Api-key", activitiesConfig.getApiKey())
                .header("X-Signature", computeSignature())
                .body(payload)
                .retrieve()
                .body(JsonNode.class));
    }

    // Confirm/Preconfirm/Reconfirm all use PUT per the docs.
    public JsonNode put(String path, JsonNode payload) {
        return execute(() -> restClient.put()
                .uri(path)
                .header("Api-key", activitiesConfig.getApiKey())
                .header("X-Signature", computeSignature())
                .body(payload)
                .retrieve()
                .body(JsonNode.class));
    }

    public JsonNode get(String path) {
        return execute(() -> restClient.get()
                .uri(path)
                .header("Api-key", activitiesConfig.getApiKey())
                .header("X-Signature", computeSignature())
                .retrieve()
                .body(JsonNode.class));
    }

    // Cancel takes cancellationFlag as a query param - callers build the full
    // path+query string (see ActivitiesService.cancelBooking).
    public JsonNode delete(String path) {
        return execute(() -> restClient.delete()
                .uri(path)
                .header("Api-key", activitiesConfig.getApiKey())
                .header("X-Signature", computeSignature())
                .retrieve()
                .body(JsonNode.class));
    }

    private JsonNode execute(Supplier<JsonNode> call) {
        requireCredentials();

        try {
            return call.get();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Activities API request failed with status " + ex.getStatusCode().value() + ": " + ex.getResponseBodyAsString()
            );
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Activities API service is unavailable"
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Activities API request failed unexpectedly: " + ex.getClass().getSimpleName() + ": " + ex.getMessage()
            );
        }
    }

    // apiKey + secret + current unix-epoch-seconds, SHA-256, lowercase hex -
    // matches the docs' `echo -n ${apiKey}${secret}$(date +%s) | sha256sum`.
    private String computeSignature() {
        try {
            String raw = activitiesConfig.getApiKey() + activitiesConfig.getSecret() + Instant.now().getEpochSecond();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private void requireCredentials() {
        if (!StringUtils.hasText(activitiesConfig.getApiKey()) || !StringUtils.hasText(activitiesConfig.getSecret())) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Activities API credentials are not configured"
            );
        }
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    // Transparently unwraps a gzip-encoded response body so Jackson still
    // just sees plain JSON bytes - HotelBeds only compresses when it decides
    // to (typically larger portfolio/availability payloads), so this only
    // kicks in when the response actually says Content-Encoding: gzip.
    private static final org.springframework.http.client.ClientHttpRequestInterceptor GZIP_DECOMPRESSING_INTERCEPTOR =
            (request, body, execution) -> {
                ClientHttpResponse response = execution.execute(request, body);
                String contentEncoding = response.getHeaders().getFirst(HttpHeaders.CONTENT_ENCODING);
                if (contentEncoding != null && contentEncoding.equalsIgnoreCase("gzip")) {
                    return new GzipDecompressedResponse(response);
                }
                return response;
            };

    private static final class GzipDecompressedResponse implements ClientHttpResponse {
        private final ClientHttpResponse delegate;

        GzipDecompressedResponse(ClientHttpResponse delegate) {
            this.delegate = delegate;
        }

        @Override
        public InputStream getBody() throws IOException {
            return new GZIPInputStream(delegate.getBody());
        }

        @Override
        public HttpStatusCode getStatusCode() throws IOException {
            return delegate.getStatusCode();
        }

        @Override
        public String getStatusText() throws IOException {
            return delegate.getStatusText();
        }

        @Override
        public HttpHeaders getHeaders() {
            return delegate.getHeaders();
        }

        @Override
        public void close() {
            delegate.close();
        }
    }
}
