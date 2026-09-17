package com.itinera.controller;

import com.itinera.model.Cart;
import com.itinera.service.CartService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/cart")
public class CartController {

    @Autowired
    private CartService cartService;

    // Every route here takes the owner from the JWT rather than trusting the
    // request, following the same rule as BookingController: a userId in the
    // URL is supplied by the caller, so on its own it authorises nothing.
    private boolean cannotActFor(Long targetUserId, Long requesterId, String requesterRole) {
        return !targetUserId.equals(requesterId) && !"ADMIN".equals(requesterRole);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getCartByUserId(
            @PathVariable Long userId,
            @RequestAttribute(name = "userId", required = false) Long requesterId,
            @RequestAttribute(name = "role", required = false) String requesterRole
    ) {
        if (requesterId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        if (cannotActFor(userId, requesterId, requesterRole)) {
            return ResponseEntity.status(403).body(Map.of("error", "You can only view your own cart"));
        }
        return ResponseEntity.ok(cartService.getCartByUserId(userId));
    }

    // The owner is taken from the token and the body's user is overwritten -
    // otherwise a caller could post a cart line onto someone else's cart.
    @PostMapping
    public ResponseEntity<?> addToCart(
            @RequestBody Cart cart,
            @RequestAttribute(name = "userId", required = false) Long requesterId
    ) {
        if (requesterId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        return ResponseEntity.ok(cartService.addToCartFor(requesterId, cart));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> removeFromCart(
            @PathVariable Long id,
            @RequestAttribute(name = "userId", required = false) Long requesterId,
            @RequestAttribute(name = "role", required = false) String requesterRole
    ) {
        if (requesterId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        Long ownerId = cartService.ownerOf(id);
        if (ownerId == null) {
            return ResponseEntity.notFound().build();
        }
        if (cannotActFor(ownerId, requesterId, requesterRole)) {
            return ResponseEntity.status(403).body(Map.of("error", "You can only change your own cart"));
        }
        cartService.removeFromCart(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/user/{userId}")
    public ResponseEntity<?> clearCart(
            @PathVariable Long userId,
            @RequestAttribute(name = "userId", required = false) Long requesterId,
            @RequestAttribute(name = "role", required = false) String requesterRole
    ) {
        if (requesterId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        if (cannotActFor(userId, requesterId, requesterRole)) {
            return ResponseEntity.status(403).body(Map.of("error", "You can only clear your own cart"));
        }
        cartService.clearCart(userId);
        return ResponseEntity.ok().build();
    }
}
