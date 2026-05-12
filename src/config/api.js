import { NativeModules, Platform } from 'react-native';

const LOCALHOSTS = new Set(['localhost', '127.0.0.1']);

const LOCAL_IP = 'localhost';

const extractHostFromScriptUrl = () => {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) return null;

  const match = scriptURL.match(/^[a-zA-Z]+:\/\/([^/:]+)/);
  return match?.[1] || null;
};

const resolveHost = () => {
  const scriptHost = extractHostFromScriptUrl();

  // Android emulator
  if (Platform.OS === 'android' && (!scriptHost || LOCALHOSTS.has(scriptHost))) {
    return '10.0.2.2';
  }

  // Expo LAN
  if (scriptHost && !LOCALHOSTS.has(scriptHost)) {
    return scriptHost;
  }

  // ✅ Fallback for APK
  return LOCAL_IP;
};

const host = resolveHost();

const API_CONFIG = {
  BASE_URL:
    process.env.EXPO_PUBLIC_API_URL ||
    `http://${host}:8080/api`,

  TIMEOUT: 10000,
};

export default API_CONFIG;
