import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const TEST_USERS = {
  CUSTOMER: { email: 'customer@itinera.com', password: 'Customer@123' },
  SUPPLIER: { email: 'supplier@itinera.com', password: 'Supplier@123' },
  ADMIN: { email: 'admin@itinera.com', password: 'Admin@123' },
};

const LoginScreen = () => {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState('CUSTOMER');
  const [showStaffRoles, setShowStaffRoles] = useState(false);
  const [email, setEmail] = useState(TEST_USERS.CUSTOMER.email);
  const [password, setPassword] = useState(TEST_USERS.CUSTOMER.password);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const roleAnim = useRef(new Animated.Value(1)).current;
  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID ||
    '359754606546-je1gtirursnvvobltutgjesedtdnue45.apps.googleusercontent.com';
  const googleIosClientIdRaw =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.REACT_APP_GOOGLE_IOS_CLIENT_ID ||
    '359754606546-hj19jqsfoqg12222481mochdq54f3pid.apps.googleusercontent.com';
  const googleAndroidClientIdRaw =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    process.env.REACT_APP_GOOGLE_ANDROID_CLIENT_ID ||
    '';
  const googleIosClientId = googleIosClientIdRaw || googleWebClientId;
  const googleAndroidClientId = googleAndroidClientIdRaw || googleWebClientId;
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleWebClientId || undefined,
    iosClientId: googleIosClientId || undefined,
    androidClientId: googleAndroidClientId || undefined,
    redirectUri,
    scopes: ['profile', 'email'],
  });

  const applyDemoUser = (role) => {
    setSelectedRole(role);
    setEmail(TEST_USERS[role].email);
    setPassword(TEST_USERS[role].password);
  };

  useEffect(() => {
    roleAnim.setValue(0.98);
    Animated.spring(roleAnim, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [selectedRole, roleAnim]);

  useEffect(() => {
    const processGoogleLogin = async () => {
      if (response?.type !== 'success') {
        if (response?.type) {
          setGoogleLoading(false);
        }
        return;
      }

      const idToken = response.authentication?.idToken || response.params?.id_token;
      if (!idToken) {
        setGoogleLoading(false);
        Alert.alert('Google Sign-In Failed', 'No ID token received from Google.');
        return;
      }

      try {
        const backendResponse = await fetch(`${API_CONFIG.BASE_URL}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        let data = {};
        try {
          data = await backendResponse.json();
        } catch (e) {
          data = {};
        }
        if (!backendResponse.ok) {
          throw new Error(data?.message || data?.error || `Google sign-in failed (${backendResponse.status})`);
        }

        login({ token: data.token, user: data.user });
      } catch (error) {
        Alert.alert('Google Sign-In Failed', error.message || 'Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    };

    processGoogleLogin();
  }, [response, login]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Login failed');
      }

      login({ token: data.token, user: data.user });
    } catch (error) {
      Alert.alert('Login failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (
      (Platform.OS === 'ios' && !googleIosClientId) ||
      (Platform.OS === 'android' && !googleAndroidClientId) ||
      (!googleWebClientId && !googleIosClientId && !googleAndroidClientId)
    ) {
      Alert.alert(
        'Google Sign-In Not Configured',
        'Please set REACT_APP_GOOGLE_WEB_CLIENT_ID. iOS/Android IDs are optional for local dev but recommended for production.'
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const result = await promptAsync({ useProxy: true });
      if (result?.type !== 'success') {
        setGoogleLoading(false);
      }
    } catch (error) {
      setGoogleLoading(false);
      Alert.alert('Google Sign-In Failed', 'Unable to start Google sign-in.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Choose a role and log in to test full flows</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Choose Profile</Text>

        <Animated.View style={{ transform: [{ scale: roleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.primaryRoleCard,
              selectedRole === 'CUSTOMER' && styles.primaryRoleCardActive,
            ]}
            onPress={() => applyDemoUser('CUSTOMER')}
            activeOpacity={0.9}
          >
            <View>
              <Text style={styles.primaryRoleTitle}>Customer</Text>
              <Text style={styles.primaryRoleSubtitle}>Discover trips, chat with travel agent, and book easily</Text>
            </View>
           
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={Colors.textMuted}
        />

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={Colors.secondary} /> : <Text style={styles.loginText}>Login</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.googleButton, (!request || googleLoading) && styles.loginButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={!request || googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        {showStaffRoles && (
          <View style={styles.secondaryRoleRow}>
            <TouchableOpacity
              style={[
                styles.secondaryRoleCard,
                selectedRole === 'SUPPLIER' && styles.secondaryRoleCardActive,
              ]}
              onPress={() => applyDemoUser('SUPPLIER')}
              activeOpacity={0.9}
            >
              
              <Text style={styles.secondaryRoleTitle}>Supplier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryRoleCard,
                selectedRole === 'ADMIN' && styles.secondaryRoleCardActive,
              ]}
              onPress={() => applyDemoUser('ADMIN')}
              activeOpacity={0.9}
            >
              
              <Text style={styles.secondaryRoleTitle}>Admin</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.staffToggle}
          onPress={() => setShowStaffRoles((prev) => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.staffToggleText}>
            {showStaffRoles ? 'Hide staff login' : 'Staff login'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    fontSize: 31,
    fontWeight: '800',
    color: Colors.secondary,
  },
  subtitle: {
    marginTop: 6,
    color: Colors.secondary,
    opacity: 0.88,
    fontSize: 13,
  },
  card: {
    marginHorizontal: 18,
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  label: {
    marginBottom: 8,
    marginTop: 8,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.text,
  },
  primaryRoleCard: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 1.5,
    borderColor: Colors.primarySurface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryRoleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFE9DD',
  },
  primaryRoleTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  primaryRoleSubtitle: {
    marginTop: 4,
    color: Colors.textLight,
    maxWidth: 228,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryRoleIcon: {
    fontSize: 30,
  },
  secondaryRoleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  staffToggle: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  staffToggleText: {
    color: Colors.textLight,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  secondaryRoleCard: {
    width: '48%',
    backgroundColor: '#FFFDFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryRoleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF0E8',
  },
  secondaryRoleTitle: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryRoleIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: Colors.text,
    backgroundColor: '#FFFCFA',
  },
  loginButton: {
    marginTop: 18,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: '800',
  },
  googleButton: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  googleButtonText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LoginScreen;
