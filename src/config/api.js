import { NativeModules } from 'react-native';

const LOCALHOSTS = new Set(['localhost', '127.0.0.1']);

const PRODUCTION_API_URL = 'https://itinera-backend-ds3v.onrender.com/api';

const extractHostFromScriptUrl = () => {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) return null;

  const match = scriptURL.match(/^[a-zA-Z]+:\/\/([^/:]+)/);
  return match?.[1] || null;
};

const resolveHost = () => {
  const scriptHost = extractHostFromScriptUrl();

  // Expo LAN - a physical device or emulator connecting to Metro over the
  // local network uses that same host to reach the backend too.
  if (scriptHost && !LOCALHOSTS.has(scriptHost)) {
    return `http://${scriptHost}:8080/api`;
  }

  // Metro running on localhost (the default for `npx expo run:android` /
  // `run:ios` with no LAN config) gives no useful host to redirect to - fall
  // through to production, same as iOS simulator already does by default.
  // To point at a local backend from the Android emulator instead, set
  // EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api explicitly (10.0.2.2 is the
  // emulator's alias for the host machine's localhost) rather than relying
  // on this auto-detection.
  return PRODUCTION_API_URL;
};

const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || resolveHost(),

  TIMEOUT: 10000,
};

export default API_CONFIG;
