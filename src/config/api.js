import { NativeModules, Platform } from 'react-native';

const LOCALHOSTS = new Set(['localhost', '127.0.0.1']);

const extractHostFromScriptUrl = () => {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) {
    return null;
  }

  const match = scriptURL.match(/^[a-zA-Z]+:\/\/([^/:]+)/);
  return match?.[1] || null;
};

const resolveHost = () => {
  const scriptHost = extractHostFromScriptUrl();

  if (Platform.OS === 'android' && (!scriptHost || LOCALHOSTS.has(scriptHost))) {
    return '10.0.2.2';
  }

  if (scriptHost && !LOCALHOSTS.has(scriptHost)) {
    return scriptHost;
  }

  return 'localhost';
};

const host = resolveHost();

const API_CONFIG = {
  BASE_URL:
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.REACT_APP_API_URL ||
    `http://${host}:8080/api`,
  AI_SERVICE_URL:
    process.env.EXPO_PUBLIC_AI_SERVICE_URL ||
    process.env.REACT_APP_AI_SERVICE_URL ||
    `http://${host}:8000`,
  TIMEOUT: 10000,
};

export default API_CONFIG;
