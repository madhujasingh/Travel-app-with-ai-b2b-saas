package com.itinera.service;

import com.itinera.model.Coupon;
import com.itinera.model.CouponRedemption;
import com.itinera.repository.CouponRedemptionRepository;
import com.itinera.repository.CouponRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

// All coupon rules live here. Controllers never compute a discount themselves.
//
// The security model, in short:
//   - The client sends a CODE. It never sends, and can never influence, the
//     discount amount - that is derived from the stored Coupon row every time.
//   - Only ROLE_ADMIN can create or change a coupon (enforced in SecurityConfig).
//   - Customers have no endpoint that lists coupons, so codes cannot be
//     enumerated through the API.
//   - Guessing is throttled per user.
//   - The usage limit is claimed with a conditional UPDATE, so it holds under
//     concurrent bookings.
//
// PRICING RULE: a discount can only ever come out of OUR margin - the
// convenience fee and any markup we charge on our own payment rail. The
// supplier's share (TripJack's reviewed fare, HotelBeds' rate) must reach them
// in full: TripJack rejects a Book whose paymentInfos.amount differs from the
// reviewed fare at all (errCode 1015). So every discount is capped at the
// caller-supplied `discountableAmount`, never at the order total.
@Service
public class CouponService {

    private static final int MAX_CODE_LENGTH = 40;
    // A customer gets this many failed attempts per window before validation
    // starts refusing outright - enough that a typo is never a problem, far too
    // few to brute-force a code space.
    private static final int MAX_FAILED_ATTEMPTS = 10;
    private static final long ATTEMPT_WINDOW_MS = 10 * 60 * 1000L;

    private final CouponRepository couponRepository;
    private final CouponRedemptionRepository redemptionRepository;

    // Per-user failed-attempt counters. In-memory deliberately: this is a
    // speed bump against guessing, not an audit record, and it costs nothing.
    // On a multi-instance deployment each instance throttles independently,
    // which is still far below what brute force needs.
    private final Map<Long, AtomicInteger> failedAttempts = new ConcurrentHashMap<>();
    private final Map<Long, Long> windowStart = new ConcurrentHashMap<>();

    public CouponService(CouponRepository couponRepository,
                         CouponRedemptionRepository redemptionRepository) {
        this.couponRepository = couponRepository;
        this.redemptionRepository = redemptionRepository;
    }

    // ---------------------------------------------------------------- admin --

    public List<Coupon> listAll() {
        return couponRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public Coupon create(Coupon input) {
        String code = normalise(input.getCode());
        validateDefinition(code, input);
        if (couponRepository.existsByCode(code)) {
            throw new IllegalArgumentException("A coupon with that code already exists.");
        }

        input.setCode(code);
        // Never trust these off the wire - a create payload could otherwise
        // arrive with timesUsed pre-set to bypass a limit.
        input.setId(null);
        input.setTimesUsed(0);
        input.setVersion(null);
        input.setCreatedAt(LocalDateTime.now());
        input.setUpdatedAt(LocalDateTime.now());
        if (input.getActive() == null) input.setActive(true);
        if (input.getApplicableProducts() == null || input.getApplicableProducts().isBlank()) {
            input.setApplicableProducts("ALL");
        }
        return couponRepository.save(input);
    }

    @Transactional
    public Coupon update(Long id, Coupon input) {
        Coupon existing = couponRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found."));

        String code = normalise(input.getCode());
        validateDefinition(code, input);
        if (!existing.getCode().equals(code) && couponRepository.existsByCode(code)) {
            throw new IllegalArgumentException("A coupon with that code already exists.");
        }

        existing.setCode(code);
        existing.setDescription(input.getDescription());
        existing.setDiscountType(input.getDiscountType());
        existing.setDiscountValue(input.getDiscountValue());
        existing.setMaxDiscountAmount(input.getMaxDiscountAmount());
        existing.setMinOrderAmount(input.getMinOrderAmount());
        existing.setValidFrom(input.getValidFrom());
        existing.setValidUntil(input.getValidUntil());
        existing.setActive(input.getActive() == null || input.getActive());
        existing.setUsageLimit(input.getUsageLimit());
        existing.setPerUserLimit(input.getPerUserLimit());
        existing.setApplicableProducts(
                input.getApplicableProducts() == null || input.getApplicableProducts().isBlank()
                        ? "ALL"
                        : input.getApplicableProducts());
        existing.setUpdatedAt(LocalDateTime.now());
        // timesUsed is intentionally NOT taken from the request.
        return couponRepository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        couponRepository.deleteById(id);
    }

    public List<CouponRedemption> redemptionsFor(Long couponId) {
        return redemptionRepository.findByCouponIdOrderByRedeemedAtDesc(couponId);
    }

    // ------------------------------------------------------------- customer --

    // Checks a code and returns what it is worth for this order. Read-only: it
    // never consumes the coupon.
    // `discountableAmount` is the slice of the order that is ours to give away -
    // the convenience fee and markup, excluding the supplier's net. Pass 0 and
    // the coupon correctly refuses rather than promising a discount that the
    // supplier would then reject at Book time.
    public CouponQuote quote(String rawCode,
                             BigDecimal orderAmount,
                             BigDecimal discountableAmount,
                             String productType,
                             Long userId) {
        if (isThrottled(userId)) {
            return CouponQuote.invalid("Too many attempts. Please try again in a few minutes.");
        }

        String code = normalise(rawCode);
        if (code.isEmpty() || code.length() > MAX_CODE_LENGTH) {
            recordFailure(userId);
            return CouponQuote.invalid("Enter a valid coupon code.");
        }

        Optional<Coupon> found = couponRepository.findByCode(code);
        if (found.isEmpty()) {
            recordFailure(userId);
            return CouponQuote.invalid("This coupon code isn't valid.");
        }

        Coupon coupon = found.get();
        BigDecimal amount = orderAmount == null ? BigDecimal.ZERO : orderAmount;

        String problem = findProblem(coupon, amount, productType, userId);
        if (problem != null) {
            recordFailure(userId);
            return CouponQuote.invalid(problem);
        }

        BigDecimal margin = discountableAmount == null ? BigDecimal.ZERO : discountableAmount;
        if (margin.compareTo(BigDecimal.ZERO) <= 0) {
            // Not a customer's fault and not worth explaining our margin to them.
            return CouponQuote.invalid("This coupon can't be applied to this booking.");
        }

        clearFailures(userId);
        BigDecimal discount = computeDiscount(coupon, amount, margin);
        if (discount.compareTo(BigDecimal.ZERO) <= 0) {
            return CouponQuote.invalid("This coupon can't be applied to this booking.");
        }
        return CouponQuote.valid(coupon, discount, amount.subtract(discount));
    }

    // Consumes the coupon for a completed booking.
    //
    // `orderAmount` must be the amount the server itself calculated for the
    // booking, never a number forwarded from the client - otherwise a customer
    // could inflate it to earn a larger percentage discount.
    @Transactional
    public CouponRedemption redeem(String rawCode,
                                   BigDecimal orderAmount,
                                   BigDecimal discountableAmount,
                                   String productType,
                                   Long userId,
                                   String bookingReference) {
        String code = normalise(rawCode);
        Coupon coupon = couponRepository.findByCode(code)
                .orElseThrow(() -> new IllegalArgumentException("This coupon code isn't valid."));

        String problem = findProblem(coupon, orderAmount, productType, userId);
        if (problem != null) {
            throw new IllegalArgumentException(problem);
        }

        // Claim the slot before writing the redemption. If the conditional
        // UPDATE matches nothing, another booking took the last one first.
        if (couponRepository.claimRedemptionSlot(coupon.getId()) == 0) {
            throw new IllegalArgumentException("This coupon has reached its usage limit.");
        }

        BigDecimal margin = discountableAmount == null ? BigDecimal.ZERO : discountableAmount;
        BigDecimal discount = computeDiscount(coupon, orderAmount, margin);
        if (discount.compareTo(BigDecimal.ZERO) <= 0) {
            couponRepository.releaseRedemptionSlot(coupon.getId());
            throw new IllegalArgumentException("This coupon can't be applied to this booking.");
        }

        CouponRedemption redemption = new CouponRedemption();
        redemption.setCouponId(coupon.getId());
        redemption.setCouponCode(coupon.getCode());
        redemption.setUserId(userId);
        redemption.setBookingReference(bookingReference);
        redemption.setProductType(productType);
        redemption.setOrderAmount(orderAmount);
        redemption.setDiscountAmount(discount);
        redemption.setRedeemedAt(LocalDateTime.now());
        return redemptionRepository.save(redemption);
    }

    // Gives a claimed slot back when a booking fails after redemption.
    @Transactional
    public void release(String bookingReference) {
        redemptionRepository.findByBookingReference(bookingReference).forEach(redemption -> {
            couponRepository.releaseRedemptionSlot(redemption.getCouponId());
            redemptionRepository.delete(redemption);
        });
    }

    // ---------------------------------------------------------------- rules --

    // Returns a customer-safe reason the coupon can't be used, or null if it can.
    private String findProblem(Coupon coupon, BigDecimal orderAmount, String productType, Long userId) {
        LocalDateTime now = LocalDateTime.now();

        if (coupon.getActive() == null || !coupon.getActive()) {
            return "This coupon is no longer available.";
        }
        if (coupon.getValidFrom() != null && now.isBefore(coupon.getValidFrom())) {
            return "This coupon isn't active yet.";
        }
        if (coupon.getValidUntil() != null && now.isAfter(coupon.getValidUntil())) {
            return "This coupon has expired.";
        }
        if (coupon.getUsageLimit() != null && coupon.getTimesUsed() >= coupon.getUsageLimit()) {
            return "This coupon has reached its usage limit.";
        }
        if (coupon.getMinOrderAmount() != null
                && orderAmount.compareTo(coupon.getMinOrderAmount()) < 0) {
            return "Add ₹" + coupon.getMinOrderAmount().subtract(orderAmount).setScale(0, RoundingMode.CEILING)
                    + " more to use this coupon.";
        }
        if (!appliesTo(coupon, productType)) {
            return "This coupon doesn't apply to this booking.";
        }
        if (coupon.getPerUserLimit() != null && userId != null) {
            long used = redemptionRepository.countByCouponIdAndUserId(coupon.getId(), userId);
            if (used >= coupon.getPerUserLimit()) {
                return "You've already used this coupon.";
            }
        }
        return null;
    }

    private boolean appliesTo(Coupon coupon, String productType) {
        String applicable = coupon.getApplicableProducts();
        if (applicable == null || applicable.isBlank() || applicable.equalsIgnoreCase("ALL")) {
            return true;
        }
        if (productType == null || productType.isBlank()) {
            return false;
        }
        Set<String> allowed = new HashSet<>(Arrays.asList(applicable.toUpperCase(Locale.ROOT).split("\\s*,\\s*")));
        return allowed.contains(productType.toUpperCase(Locale.ROOT));
    }

    private BigDecimal computeDiscount(Coupon coupon, BigDecimal orderAmount, BigDecimal discountable) {
        BigDecimal amount = orderAmount == null ? BigDecimal.ZERO : orderAmount;
        BigDecimal margin = discountable == null ? BigDecimal.ZERO : discountable;
        BigDecimal discount;

        if ("PERCENT".equalsIgnoreCase(coupon.getDiscountType())) {
            // The percentage is of the order total, because that is what the
            // customer is promised ("20% off"); it is then clamped to margin
            // below, so a generous headline can never cost more than we earn.
            discount = amount.multiply(coupon.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (coupon.getMaxDiscountAmount() != null
                    && discount.compareTo(coupon.getMaxDiscountAmount()) > 0) {
                discount = coupon.getMaxDiscountAmount();
            }
        } else {
            discount = coupon.getDiscountValue();
        }

        // THE important clamp: never give away more than our own margin, or the
        // supplier's amount would come up short and the Book call would fail.
        if (discount.compareTo(margin) > 0) discount = margin;
        if (discount.compareTo(amount) > 0) discount = amount;
        if (discount.compareTo(BigDecimal.ZERO) < 0) discount = BigDecimal.ZERO;
        return discount.setScale(2, RoundingMode.HALF_UP);
    }

    private void validateDefinition(String code, Coupon input) {
        if (code.isEmpty()) {
            throw new IllegalArgumentException("Coupon code is required.");
        }
        if (code.length() > MAX_CODE_LENGTH) {
            throw new IllegalArgumentException("Coupon code is too long.");
        }
        if (!code.matches("[A-Z0-9_-]+")) {
            throw new IllegalArgumentException("Use letters, numbers, hyphens and underscores only.");
        }
        String type = input.getDiscountType() == null ? "" : input.getDiscountType().toUpperCase(Locale.ROOT);
        if (!type.equals("PERCENT") && !type.equals("FLAT")) {
            throw new IllegalArgumentException("Discount type must be PERCENT or FLAT.");
        }
        input.setDiscountType(type);

        if (input.getDiscountValue() == null || input.getDiscountValue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Discount value must be greater than zero.");
        }
        if (type.equals("PERCENT") && input.getDiscountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("A percentage discount can't exceed 100%.");
        }
        if (input.getValidFrom() != null && input.getValidUntil() != null
                && input.getValidUntil().isBefore(input.getValidFrom())) {
            throw new IllegalArgumentException("The end date must be after the start date.");
        }
        if (input.getUsageLimit() != null && input.getUsageLimit() < 1) {
            throw new IllegalArgumentException("Usage limit must be at least 1.");
        }
        if (input.getPerUserLimit() != null && input.getPerUserLimit() < 1) {
            throw new IllegalArgumentException("Per-customer limit must be at least 1.");
        }
    }

    private String normalise(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    // ------------------------------------------------------------ throttling --

    private boolean isThrottled(Long userId) {
        if (userId == null) return false;
        Long started = windowStart.get(userId);
        if (started == null) return false;
        if (System.currentTimeMillis() - started > ATTEMPT_WINDOW_MS) {
            clearFailures(userId);
            return false;
        }
        AtomicInteger count = failedAttempts.get(userId);
        return count != null && count.get() >= MAX_FAILED_ATTEMPTS;
    }

    private void recordFailure(Long userId) {
        if (userId == null) return;
        windowStart.putIfAbsent(userId, System.currentTimeMillis());
        failedAttempts.computeIfAbsent(userId, key -> new AtomicInteger()).incrementAndGet();
    }

    private void clearFailures(Long userId) {
        if (userId == null) return;
        failedAttempts.remove(userId);
        windowStart.remove(userId);
    }

    // What the customer endpoint returns. Deliberately narrow: it exposes the
    // discount for THIS order and nothing about the coupon's configuration -
    // no limits, no remaining uses, no product list.
    public record CouponQuote(
            boolean valid,
            String code,
            String description,
            BigDecimal discountAmount,
            BigDecimal payableAmount,
            String message
    ) {
        static CouponQuote valid(Coupon coupon, BigDecimal discount, BigDecimal payable) {
            return new CouponQuote(true, coupon.getCode(), coupon.getDescription(), discount, payable, null);
        }

        static CouponQuote invalid(String message) {
            return new CouponQuote(false, null, null, BigDecimal.ZERO, null, message);
        }
    }
}
