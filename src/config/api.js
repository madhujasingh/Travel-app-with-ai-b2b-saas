import { Platform } from 'react-native';

// API Configuration
const API_CONFIG = {
  // Use environment variable or fallback to default
  BASE_URL: process.env.EXPO_PUBLIC_API_URL ||
            process.env.REACT_APP_API_URL || 
            (Platform.OS === 'android' 
              ? 'http://10.0.2.2:8080/api'  // Android emulator
              : 'http://localhost:8080/api'), // iOS simulator
  
  // AI Service URL
  AI_SERVICE_URL: process.env.EXPO_PUBLIC_AI_SERVICE_URL ||
                  process.env.REACT_APP_AI_SERVICE_URL || 
                  (Platform.OS === 'android'
                    ? 'http://10.0.2.2:8000'
                    : 'http://localhost:8000'),
  
  // Timeout in milliseconds
  TIMEOUT: 10000,
};

export default API_CONFIG;
