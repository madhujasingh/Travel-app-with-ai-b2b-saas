// Web implementation of secureStorage - see secureStorage.js for the contract.
//
// localStorage is the only durable option in a browser. It is readable by any
// script on the origin, unlike the Keychain/Keystore used on native, so treat
// the web session as less protected: keep JWT lifetimes short and don't store
// anything here beyond the session payload.
//
// Every call is guarded because localStorage throws outright in Safari private
// mode and when a browser is set to block site data.
const isAvailable = () => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (error) {
    return false;
  }
};

export const getItem = async (key) => {
  if (!isAvailable()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
};

export const setItem = async (key, value) => {
  if (!isAvailable()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Unable to persist to localStorage', error);
  }
};

export const deleteItem = async (key) => {
  if (!isAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('Unable to clear localStorage', error);
  }
};
