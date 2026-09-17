package com.itinera.service;

import com.itinera.model.Cart;
import com.itinera.model.User;
import com.itinera.repository.CartRepository;
import com.itinera.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CartService {

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private UserRepository userRepository;

    public List<Cart> getCartByUserId(Long userId) {
        return cartRepository.findByUserId(userId);
    }

    // Saves the line against the given owner, ignoring whatever user the
    // request body carried - the caller doesn't get to choose whose cart it
    // lands in.
    public Cart addToCartFor(Long userId, Cart cart) {
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown user " + userId));
        cart.setUser(owner);
        return cartRepository.save(cart);
    }

    // Who owns this cart line, or null if it doesn't exist - lets the caller
    // check ownership before deleting.
    public Long ownerOf(Long cartId) {
        return cartRepository.findById(cartId)
                .map(c -> c.getUser() == null ? null : c.getUser().getId())
                .orElse(null);
    }

    public void removeFromCart(Long id) {
        cartRepository.deleteById(id);
    }

    public void clearCart(Long userId) {
        cartRepository.deleteByUserId(userId);
    }
}
