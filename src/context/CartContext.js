import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isExpired } from '../utils/cartItems';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children, userId = null }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // The cart lives in memory above the auth switch, so signing out doesn't
  // unmount it - without this, the next person to sign in on the same device
  // inherits the previous one's items until the page is reloaded. Keyed on the
  // user rather than on logout alone so switching accounts directly is covered
  // too. Skipped on first render, which would only ever clear an empty cart.
  const lastUserId = useRef(userId);
  useEffect(() => {
    if (lastUserId.current !== userId) {
      lastUserId.current = userId;
      setCartItems([]);
    }
  }, [userId]);

  const addItemToCart = (item) => {
    setCartItems(prevItems => {
      // Check if item already exists
      const existingIndex = prevItems.findIndex(cartItem => cartItem.id === item.id);
      if (existingIndex >= 0) {
        // Update existing item
        const updatedItems = [...prevItems];
        updatedItems[existingIndex] = item;
        return updatedItems;
      } else {
        // Add new item
        return [...prevItems, item];
      }
    });
  };

  const removeItemFromCart = (itemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // Supplier quotes are time-limited, so a saved line eventually stops being
  // bookable. Dropping those is better than keeping a price that can no longer
  // be honoured - the caller gets the count back so it can say what happened
  // rather than letting items vanish silently.
  const removeExpiredItems = useCallback(() => {
    let removed = 0;
    setCartItems((prevItems) => {
      const live = prevItems.filter((item) => !isExpired(item));
      removed = prevItems.length - live.length;
      return removed ? live : prevItems;
    });
    return removed;
  }, []);

  const getCartTotal = () => {
    return cartItems.reduce(
      (total, item) => total + (item.lineTotal || item.price * item.people),
      0
    );
  };

  const getCartItemCount = () => {
    return cartItems.length;
  };

  const value = {
    cartItems,
    addItemToCart,
    removeItemFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount,
    removeExpiredItems,
    isLoading,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
