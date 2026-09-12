// Cross-platform key/value storage for the auth session.
//
// expo-secure-store has no web implementation (its web build is literally
// `export default {}`), so calling it on web throws and the session is lost on
// every refresh. Native keeps using the real Keychain/Keystore; the web build
// (secureStorage.web.js) falls back to localStorage.
import * as SecureStore from 'expo-secure-store';

export const getItem = (key) => SecureStore.getItemAsync(key);
export const setItem = (key, value) => SecureStore.setItemAsync(key, value);
export const deleteItem = (key) => SecureStore.deleteItemAsync(key);
