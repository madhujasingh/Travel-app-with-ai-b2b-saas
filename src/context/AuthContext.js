import { createContext, useContext } from 'react';

export const AuthContext = createContext({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);
