import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.price * item.people, 0);
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
    isLoading,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};