package com.itinera.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itinera.config.CashfreeConfig;
import com.itinera.model.Payment;
import com.itinera.service.CashfreeClient;
import com.itinera.service.PaymentService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/payments/cashfree")
public class PaymentController {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final PaymentService paymentService;
    private final CashfreeClient cashfreeClient;
    private final CashfreeConfig cashfreeConfig;

    public PaymentController(PaymentService paymentService, CashfreeClient cashfreeClient, CashfreeConfig cashfreeConfig) {
        this.paymentService = paymentService;
        this.cashfreeClient = cashfreeClient;
        this.cashfreeConfig = cashfreeConfig;
    }

    public record CartItemPayload(Long itineraryId, Integer numberOfPeople) {}
    public record CreateOrderRequest(List<CartItemPayload> items, String couponCode) {}

    @PostMapping("/orders")
    public ResponseEntity<?> createOrder(
            @RequestBody CreateOrderRequest request,
            @RequestAttribute(name = "userId", required = false) Long requesterId
    ) {
        if (requesterId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        List<PaymentService.CartItemRequest> items = request.items() == null
                ? List.of()
                : request.items().stream()
                        .map(i -> new PaymentService.CartItemRequest(i.itineraryId(), i.numberOfPeople()))
                        .toList();
        PaymentService.CreateOrderResult result = paymentService.createOrder(requesterId, items, request.couponCode());
        return ResponseEntity.ok(Map.of(
                "orderId", result.orderId(),
                "paymentSessionId", result.paymentSessionId(),
                "amount", result.amount(),
                "currency", result.currency()
        ));
    }

    // Lets the app confirm status right after the checkout webview returns,
    // without waiting on webhook delivery.
    @GetMapping("/orders/{orderId}")
    public ResponseEntity<?> getOrderStatus(
            @PathVariable String orderId,
            @RequestAttribute(name = "userId", required = false) Long requesterId,
            @RequestAttribute(name = "role", required = false) String requesterRole
    ) {
        if (requesterId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        Payment payment = paymentService.getStatus(orderId, requesterId, requesterRole);
        return ResponseEntity.ok(Map.of(
                "orderId", payment.getCfOrderId(),
                "status", payment.getStatus(),
                "amount", payment.getAmount()
        ));
    }

    // Public, opened directly in the system browser via Linking.openURL (no
    // Authorization header exists there) - loads Cashfree's own Checkout.js
    // and immediately redirects to the hosted payment page for this session.
    // This is the whole point of the "hosted checkout" choice: the app never
    // embeds a WebView (a native module that would need a dev-client
    // rebuild), it just opens a plain https URL in the system browser.
    // The session id came straight from our own /orders response a moment
    // earlier, so it is not a secret beyond what Cashfree's own page already
    // exposes; it is sanitised before being embedded in the HTML purely as
    // defense in depth, not because Cashfree is expected to send anything
    // unsafe.
    @GetMapping(value = "/checkout-page", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> checkoutPage(@RequestParam String session) {
        String safeSession = session == null ? "" : session.replaceAll("[^A-Za-z0-9_\\-]", "");
        String mode = cashfreeConfig.getBaseUrl() != null && cashfreeConfig.getBaseUrl().contains("sandbox")
                ? "sandbox" : "production";
        String html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                + "<title>Completing payment</title>"
                + "<script src=\"https://sdk.cashfree.com/js/v3/cashfree.js\"></script></head>"
                + "<body style=\"font-family:sans-serif;display:flex;align-items:center;"
                + "justify-content:center;height:100vh;margin:0;\">"
                + "<p>Redirecting to secure checkout&hellip;</p>"
                + "<script>"
                + "var cashfree = Cashfree({ mode: \"" + mode + "\" });"
                + "cashfree.checkout({ paymentSessionId: \"" + safeSession + "\", redirectTarget: \"_self\" });"
                + "</script></body></html>";
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    // Public - Cashfree calls this directly and can't carry a JWT. The
    // signature header is the only trust boundary here; SecurityConfig
    // permits just this one POST route under /payments/**, nothing else.
    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "x-webhook-signature", required = false) String signature,
            @RequestHeader(value = "x-webhook-timestamp", required = false) String timestamp
    ) {
        if (!cashfreeClient.verifyWebhookSignature(timestamp, rawBody, signature)) {
            return ResponseEntity.status(400).body(Map.of("error", "Invalid signature"));
        }

        JsonNode payload;
        try {
            payload = OBJECT_MAPPER.readTree(rawBody);
        } catch (Exception ex) {
            return ResponseEntity.status(400).body(Map.of("error", "Invalid payload"));
        }

        JsonNode data = payload.get("data");
        if (data == null) {
            return ResponseEntity.ok(Map.of("received", true));
        }
        JsonNode order = data.get("order");
        JsonNode paymentNode = data.get("payment");
        String orderId = order != null && order.get("order_id") != null ? order.get("order_id").asText() : null;
        String paymentStatus = paymentNode != null && paymentNode.get("payment_status") != null
                ? paymentNode.get("payment_status").asText() : null;
        String cfPaymentId = paymentNode != null && paymentNode.get("cf_payment_id") != null
                ? paymentNode.get("cf_payment_id").asText() : null;
        String eventType = payload.get("type") != null ? payload.get("type").asText() : null;

        if (orderId != null && paymentStatus != null) {
            paymentService.reconcileStatus(orderId, paymentStatus, cfPaymentId, eventType);
        }
        return ResponseEntity.ok(Map.of("received", true));
    }
}
