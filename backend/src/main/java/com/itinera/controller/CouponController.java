package com.itinera.controller;

import com.itinera.model.Coupon;
import com.itinera.service.CouponService;
import com.itinera.service.MarkupService;
import com.itinera.service.PlatformSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

// Admin CRUD plus a single narrow endpoint customers use to price a code.
//
// Route split matters here, and SecurityConfig enforces it: everything under
// /coupons/admin/** is hasRole("ADMIN"); /coupons/validate is authenticated.
// There is deliberately no customer-facing list endpoint - codes are only
// usable if you already know them.
@RestController
@RequestMapping("/coupons")
public class CouponController {

    private final CouponService couponService;
    private final PlatformSettingsService platformSettingsService;
    private final MarkupService markupService;

    public CouponController(CouponService couponService,
                            PlatformSettingsService platformSettingsService,
                            MarkupService markupService) {
        this.couponService = couponService;
        this.platformSettingsService = platformSettingsService;
        this.markupService = markupService;
    }

    // ---------------------------------------------------------------- admin --

    @GetMapping("/admin")
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(couponService.listAll());
    }

    @PostMapping("/admin")
    public ResponseEntity<?> create(@RequestBody Coupon coupon) {
        try {
            return ResponseEntity.ok(couponService.create(coupon));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/admin/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Coupon coupon) {
        try {
            return ResponseEntity.ok(couponService.update(id, coupon));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/admin/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        couponService.delete(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @GetMapping("/admin/{id}/redemptions")
    public ResponseEntity<?> redemptions(@PathVariable Long id) {
        return ResponseEntity.ok(couponService.redemptionsFor(id));
    }

    // ------------------------------------------------------------- customer --

    // Prices a code against an order. Returns only the discount for this order;
    // the coupon's own configuration never leaves the server.
    //
    // The discountable margin is derived HERE, server-side, from platform
    // settings - it is deliberately not accepted from the request. Letting the
    // client state how much margin exists would be the same hole as letting it
    // state the discount.
    //
    // NOTE: orderAmount does come from the client, so this result is a QUOTE
    // for display. The authoritative discount is recomputed by CouponService
    // .redeem() at booking time from the server's own order total.
    @PostMapping("/validate")
    public ResponseEntity<?> validate(@RequestBody Map<String, Object> body) {
        String code = body.get("code") == null ? "" : String.valueOf(body.get("code"));
        String productType = body.get("productType") == null ? null : String.valueOf(body.get("productType"));
        BigDecimal orderAmount;
        try {
            orderAmount = body.get("orderAmount") == null
                    ? BigDecimal.ZERO
                    : new BigDecimal(String.valueOf(body.get("orderAmount")));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid order amount."));
        }
        if (orderAmount.compareTo(BigDecimal.ZERO) < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid order amount."));
        }

        return ResponseEntity.ok(couponService.quote(
                code, orderAmount, discountableMargin(productType, orderAmount), productType, currentUserId()));
    }

    // How much of an order is ours to discount. The supplier's share - TripJack's
    // reviewed fare, HotelBeds' rate - must reach them untouched, so only fees
    // and markup we charge on our own rail are discountable.
    //
    // How much of an order is ours to give away.
    //
    // PACKAGE is our own inventory - no external supplier to pay - so the whole
    // price qualifies. For everything else it is the markup we add plus, for
    // flights, the convenience fee: those are the only amounts charged on our
    // own rail. The supplier's fare is never discountable, because TripJack
    // rejects a Book that pays less than the reviewed fare.
    private BigDecimal discountableMargin(String productType, BigDecimal orderAmount) {
        String product = productType == null ? "" : productType.trim().toUpperCase();
        BigDecimal amount = orderAmount == null ? BigDecimal.ZERO : orderAmount;

        if (product.equals("PACKAGE")) {
            return amount;
        }

        BigDecimal margin = markupService.markupFor(product, "DEFAULT", amount, 1);

        if (product.equals("FLIGHT")) {
            Double fee = platformSettingsService.get().getFlightConvenienceFee();
            if (fee != null) {
                margin = margin.add(BigDecimal.valueOf(fee));
            }
        }
        return margin;
    }

    private Long currentUserId() {
        UsernamePasswordAuthenticationToken auth = (UsernamePasswordAuthenticationToken)
                SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? null : (Long) auth.getPrincipal();
    }
}
