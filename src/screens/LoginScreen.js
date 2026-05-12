import React, { useEffect, useState } from 'react';
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
  ScrollView,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const INITIAL_SIGN_IN = {
  email: '',
  password: '',
};

const INITIAL_SIGN_UP = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const LoginScreen = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState('signin');
  const [signInForm, setSignInForm] = useState(INITIAL_SIGN_IN);
  const [signUpForm, setSignUpForm] = useState(INITIAL_SIGN_UP);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showStaffRoles, setShowStaffRoles] = useState(false);
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
    scopes: ['profile', 'email'],
    shouldAutoExchangeCode: true,
    // Add additional security measures
    prompt: 'select_account',
  });

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
        } catch (error) {
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

  const updateSignInField = (field, value) => {
    setSignInForm((current) => ({ ...current, [field]: value }));
  };

  const updateSignUpField = (field, value) => {
    setSignUpForm((current) => ({ ...current, [field]: value }));
  };

  const handleLogin = async () => {
    if (!signInForm.email.trim() || !signInForm.password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signInForm.email.trim(),
          password: signInForm.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Login failed');
      }

      login({ token: data.token, user: data.user });
    } catch (error) {
      Alert.alert(
        'Sign in failed',
        error.message || 'Please check your email and password and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!signUpForm.email.trim() || !signUpForm.password) {
      Alert.alert('Missing fields', 'Email and password are required.');
      return;
    }

    if (signUpForm.password.length < 6) {
      Alert.alert('Weak password', 'Please use at least 6 characters.');
      return;
    }

    if (signUpForm.password !== signUpForm.confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpForm.name.trim(),
          email: signUpForm.email.trim(),
          password: signUpForm.password,
          role: 'CUSTOMER',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Account creation failed');
      }

      login({ token: data.token, user: data.user });
    } catch (error) {
      Alert.alert('Sign up failed', error.message || 'Please try again.');
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
        'Please set REACT_APP_GOOGLE_WEB_CLIENT_ID. iOS and Android IDs are recommended for production.'
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
        Alert.alert(
          'Google Sign-In Failed',
          'Please check your Google Cloud Console OAuth settings. Since your app is published, ensure:\n\n1. Authorized redirect URIs include Expo proxy URLs\n2. Authorized JavaScript origins are set\n3. Your app may need additional Google verification\n\nContact the developer if issues persist.',
          [{ text: 'OK' }]
        );
    }
  };

  const applyStaffDemoUser = (role) => {
    const presets = {
      SUPPLIER: { email: 'supplier@itinera.com', password: 'Supplier@123' },
      ADMIN: { email: 'admin@itinera.com', password: 'Admin@123' },
    };

    const preset = presets[role];
    if (!preset) {
      return;
    }

    setMode('signin');
    setSignInForm(preset);
  };

  const renderSignInForm = () => (
    <>
      <Text style={styles.sectionTitle}>Welcome back</Text>
      <Text style={styles.sectionSubtitle}>Sign in with the email and password saved in PostgreSQL.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={signInForm.email}
        onChangeText={(value) => updateSignInField('email', value)}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={signInForm.password}
        onChangeText={(value) => updateSignInField('password', value)}
        secureTextEntry
        placeholder="Enter password"
        placeholderTextColor={Colors.textMuted}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.secondary} />
        ) : (
          <Text style={styles.primaryButtonText}>Sign In</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderSignUpForm = () => (
    <>
      <Text style={styles.sectionTitle}>Create account</Text>
      <Text style={styles.sectionSubtitle}>No account yet? We’ll create one and store it in the connected database.</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        value={signUpForm.name}
        onChangeText={(value) => updateSignUpField('name', value)}
        autoCapitalize="words"
        placeholder="Optional"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={signUpForm.email}
        onChangeText={(value) => updateSignUpField('email', value)}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={signUpForm.password}
        onChangeText={(value) => updateSignUpField('password', value)}
        secureTextEntry
        placeholder="Minimum 6 characters"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>Confirm Password</Text>
      <TextInput
        style={styles.input}
        value={signUpForm.confirmPassword}
        onChangeText={(value) => updateSignUpField('confirmPassword', value)}
        secureTextEntry
        placeholder="Re-enter password"
        placeholderTextColor={Colors.textMuted}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.secondary} />
        ) : (
          <Text style={styles.primaryButtonText}>Create Account</Text>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Itinera Auth</Text>
          <Text style={styles.subtitle}>Use email and password to sign in, or create a new customer account.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
              onPress={() => setMode('signin')}
              activeOpacity={0.9}
            >
              <Text style={[styles.modeButtonText, mode === 'signin' && styles.modeButtonTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
              onPress={() => setMode('signup')}
              activeOpacity={0.9}
            >
              <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signin' ? renderSignInForm() : renderSignUpForm()}

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, (!request || googleLoading) && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={!request || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.staffToggle}
            onPress={() => setShowStaffRoles((current) => !current)}
            activeOpacity={0.8}
          >
            <Text style={styles.staffToggleText}>
              {showStaffRoles ? 'Hide staff login' : 'Staff login'}
            </Text>
          </TouchableOpacity>

          {showStaffRoles ? (
            <View style={styles.staffRow}>
              <TouchableOpacity
                style={[styles.staffCard, styles.staffCardLeft]}
                onPress={() => applyStaffDemoUser('SUPPLIER')}
                activeOpacity={0.9}
              >
                <Text style={styles.staffCardTitle}>Supplier</Text>
                <Text style={styles.staffCardText}>Fill demo supplier credentials</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.staffCard, styles.staffCardRight]}
                onPress={() => applyStaffDemoUser('ADMIN')}
                activeOpacity={0.9}
              >
                <Text style={styles.staffCardTitle}>Admin</Text>
                <Text style={styles.staffCardText}>Fill demo admin credentials</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    fontSize: 31,
    fontWeight: '800',
    color: Colors.secondary,
  },
  subtitle: {
    marginTop: 8,
    color: Colors.secondary,
    opacity: 0.9,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    marginHorizontal: 18,
    marginTop: 18,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.primarySoft,
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: Colors.secondary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  modeButtonText: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionSubtitle: {
    marginTop: 6,
    marginBottom: 10,
    color: Colors.textLight,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    marginBottom: 8,
    marginTop: 10,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.text,
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
  primaryButton: {
    marginTop: 20,
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
  primaryButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 2,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 10,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
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
  staffToggle: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  staffToggleText: {
    color: Colors.textLight,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  staffCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFDFC',
  },
  staffCardLeft: {
    marginRight: 5,
  },
  staffCardRight: {
    marginLeft: 5,
  },
  staffCardTitle: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  staffCardText: {
    marginTop: 4,
    color: Colors.textLight,
    fontSize: 12,
    lineHeight: 17,
  },
});

export default LoginScreen;
