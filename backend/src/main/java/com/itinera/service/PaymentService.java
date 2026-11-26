package com.itinera.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.itinera.model.Booking;
import com.itinera.model.CouponRedemption;
import com.itinera.model.Itinerary;
import com.itinera.model.Payment;
import com.itinera.model.PlatformSettings;
import com.itinera.model.User;
import com.itinera.repository.BookingRepository;
import com.itinera.repository.ItineraryRepository;
import com.itinera.repository.PaymentRepository;
import com.itinera.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Orchestrates the itinerary/package checkout flow around Cashfree: pricing
// it server-side (never trusting a client-supplied total - see
// CouponService's own comments on why), creating the Payment + Booking rows,
// then settling them from either the webhook or the status-poll endpoint.
@Service
public class PaymentService {

    // Cashfree substitutes {order_id} itself; the webview intercepts
    // navigation to this URL before it would ever actually load, so it only
    // needs to be a real domain we own, not a page that exists.
    private static final String RETURN_URL = "https://myitineri.com/payment-return?order_id={order_id}";

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final ItineraryRepository itineraryRepository;
    private final UserRepository userRepository;
    private final CouponService couponService;
    private final PlatformSettingsService platformSettingsService;
    private final CashfreeClient cashfreeClient;

    public PaymentService(PaymentRepository paymentRepository,
                          BookingRepository bookingRepository,
                          ItineraryRepository itineraryRepository,
                          UserRepository userRepository,
                          CouponService couponService,
                          PlatformSettingsService platformSettingsService,
                          CashfreeClient cashfreeClient) {
        this.paymentRepository = paymentRepository;
        this.bookingRepository = bookingRepository;
        this.itineraryRepository = itineraryRepository;
        this.userRepository = userRepository;
        this.couponService = couponService;
        this.platformSettingsService = platformSettingsService;
        this.cashfreeClient = cashfreeClient;
    }

    public record CartItemRequest(Long itineraryId, Integer numberOfPeople) {}

    public record CreateOrderResult(String orderId, String paymentSessionId, BigDecimal amount, String currency) {}

    @Transactional
    public CreateOrderResult createOrder(Long userId, List<CartItemRequest> items, String couponCode) {
        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No items to pay for.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Resolved and priced entirely from our own DB - the client only
        // supplies itinerary ids and headcounts, never an amount.
        BigDecimal subtotal = BigDecimal.ZERO;
        List<Itinerary> itineraries = new ArrayList<>();
        List<Integer> peopleCounts = new ArrayList<>();
        for (CartItemRequest item : items) {
            if (item.itineraryId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each item needs an itineraryId.");
            }
            int people = item.numberOfPeople() == null ? 1 : item.numberOfPeople();
            if (people < 1 || people > 50) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Number of people must be between 1 and 50.");
            }
            Itinerary itinerary = itineraryRepository.findById(item.itineraryId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Package not found: " + item.itineraryId()));
            if (itinerary.getIsActive() != null && !itinerary.getIsActive()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This package is no longer available.");
            }
            itineraries.add(itinerary);
            peopleCounts.add(people);
            subtotal = subtotal.add(itinerary.getPrice().multiply(BigDecimal.valueOf(people)));
        }

        PlatformSettings settings = platformSettingsService.get();
        BigDecimal convenienceFee = settings.getFlightConvenienceFee() == null
                ? BigDecimal.ZERO : BigDecimal.valueOf(settings.getFlightConvenienceFee());
        BigDecimal orderAmount = subtotal.add(convenienceFee);

        String orderId = "PKG" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase();

        BigDecimal discount = BigDecimal.ZERO;
        String appliedCouponCode = null;
        if (couponCode != null && !couponCode.isBlank()) {
            // PACKAGE is our own inventory - the whole order is discountable,
            // same rule CouponController.discountableMargin applies.
            try {
                CouponRedemption redemption = couponService.redeem(
                        couponCode, orderAmount, orderAmount, "PACKAGE", userId, orderId);
                discount = redemption.getDiscountAmount();
                appliedCouponCode = redemption.getCouponCode();
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
            }
        }

        BigDecimal payableAmount = orderAmount.subtract(discount).setScale(2, RoundingMode.HALF_UP);
        if (payableAmount.compareTo(BigDecimal.ZERO) <= 0) {
            if (appliedCouponCode != null) {
                couponService.release(orderId);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order amount must be greater than zero.");
        }

        Payment payment = new Payment();
        payment.setUser(user);
        payment.setCfOrderId(orderId);
        payment.setAmount(payableAmount);
        payment.setCurrency("INR");
        payment.setStatus(Payment.PaymentStatus.PENDING);
        payment.setCouponCode(appliedCouponCode);
        payment = paymentRepository.save(payment);

        for (int i = 0; i < itineraries.size(); i++) {
            Booking booking = new Booking();
            booking.setUser(user);
            booking.setItinerary(itineraries.get(i));
            booking.setNumberOfPeople(peopleCounts.get(i));
            booking.setAmount(itineraries.get(i).getPrice().multiply(BigDecimal.valueOf(peopleCounts.get(i))));
            booking.setStatus(Booking.BookingStatus.PENDING);
            booking.setPaymentStatus(Booking.PaymentStatus.PENDING);
            booking.setPayment(payment);
            bookingRepository.save(booking);
        }

        // Any failure from here rolls back the whole transaction - Payment,
        // Bookings and the coupon's claimed redemption slot together - since
        // ResponseStatusException is a RuntimeException.
        JsonNode orderResponse = cashfreeClient.createOrder(
                orderId,
                payableAmount,
                "user_" + user.getId(),
                user.getPhone(),
                user.getEmail(),
                user.getName(),
                RETURN_URL
        );

        String paymentSessionId = orderResponse == null || orderResponse.get("payment_session_id") == null
                ? null : orderResponse.get("payment_session_id").asText();
        if (paymentSessionId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Cashfree did not return a payment session.");
        }
        if (orderResponse.get("cf_order_id") != null) {
            payment.setCfInternalOrderId(orderResponse.get("cf_order_id").asText());
            paymentRepository.save(payment);
        }

        return new CreateOrderResult(orderId, paymentSessionId, payableAmount, "INR");
    }

    // Settles a Payment (and its Bookings) from either the webhook or the
    // status-poll endpoint - both just supply whatever status string their
    // source uses; the SUCCESS/FAILURE mapping below covers both vocabularies.
    // Idempotent: once a Payment leaves PENDING, later calls are a no-op, so
    // a retried webhook or a poll that lands after the webhook already
    // landed can never double-confirm or double-cancel a booking.
    @Transactional
    public Payment reconcileStatus(String orderId, String gatewayStatus, String cfPaymentId, String rawStatus) {
        Payment payment = paymentRepository.findByCfOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown order: " + orderId));

        if (payment.getStatus() != Payment.PaymentStatus.PENDING) {
            return payment;
        }

        String status = gatewayStatus == null ? "" : gatewayStatus.toUpperCase();
        boolean success = status.equals("SUCCESS") || status.equals("PAID");
        boolean terminalFailure = status.equals("FAILED") || status.equals("USER_DROPPED")
                || status.equals("EXPIRED") || status.equals("TERMINATED") || status.equals("CANCELLED");

        if (!success && !terminalFailure) {
            // Still in progress on Cashfree's side (e.g. order_status ACTIVE) -
            // nothing to settle yet.
            return payment;
        }

        payment.setStatus(success ? Payment.PaymentStatus.SUCCESS : Payment.PaymentStatus.FAILED);
        payment.setRawStatus(rawStatus);
        if (cfPaymentId != null) {
            payment.setCfPaymentId(cfPaymentId);
        }
        paymentRepository.save(payment);

        List<Booking> bookings = bookingRepository.findByPaymentId(payment.getId());
        for (Booking booking : bookings) {
            booking.setPaymentStatus(success ? Booking.PaymentStatus.PAID : Booking.PaymentStatus.FAILED);
            booking.setStatus(success ? Booking.BookingStatus.CONFIRMED : Booking.BookingStatus.CANCELLED);
            bookingRepository.save(booking);
        }

        if (!success && payment.getCouponCode() != null) {
            couponService.release(orderId);
        }

        return payment;
    }

    // Owner-checked status read, used by the app right after the checkout
    // webview returns - polls Cashfree directly rather than waiting on the
    // webhook, which can lag a few seconds behind the redirect.
    public Payment getStatus(String orderId, Long requesterId, String requesterRole) {
        Payment payment = paymentRepository.findByCfOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown order: " + orderId));
        if (!payment.getUser().getId().equals(requesterId) && !"ADMIN".equals(requesterRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only view your own payment.");
        }
        if (payment.getStatus() == Payment.PaymentStatus.PENDING) {
            JsonNode gatewayOrder = cashfreeClient.getOrder(orderId);
            String orderStatus = gatewayOrder != null && gatewayOrder.get("order_status") != null
                    ? gatewayOrder.get("order_status").asText() : null;
            if (orderStatus != null) {
                payment = reconcileStatus(orderId, orderStatus, null, orderStatus);
            }
        }
        return payment;
    }
}
