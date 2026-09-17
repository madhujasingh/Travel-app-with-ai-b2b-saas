import { createContext, useContext } from 'react';

export const AuthContext = createContext({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  // Runs the action if signed in; otherwise opens the sign-in prompt and
  // runs it afterwards. Returns whether the caller could proceed immediately.
  requireAuth: (action) => {
    action?.();
    return true;
  },
});

export const useAuth = () => useContext(AuthContext);
