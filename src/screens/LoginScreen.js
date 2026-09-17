import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  const { isDesktop } = useResponsive();
  const { login } = useAuth();
  const [mode, setMode] = useState('signin');
  const [signInForm, setSignInForm] = useState(INITIAL_SIGN_IN);
  const [signUpForm, setSignUpForm] = useState(INITIAL_SIGN_UP);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
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
  const redirectUri = AuthSession.makeRedirectUri();
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
        appAlert('Google Sign-In Failed', 'No ID token received from Google.');
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
        appAlert('Google Sign-In Failed', error.message || 'Please try again.');
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
      appAlert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signInForm.email.trim(),
          password: signInForm.password.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        // message is the human-readable detail (e.g. the 15-minute lockout
        // explanation); error is just the short label - prefer message when
        // the backend sent both.
        throw new Error(data?.message || data?.error || 'Login failed');
      }

      login({ token: data.token, user: data.user });
    } catch (error) {
      appAlert(
        'Sign in failed',
        error.message || 'Please check your email and password and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!signUpForm.email.trim() || !signUpForm.password) {
      appAlert('Missing fields', 'Email and password are required.');
      return;
    }

    if (signUpForm.password.length < 6) {
      appAlert('Weak password', 'Please use at least 6 characters.');
      return;
    }

    if (signUpForm.password !== signUpForm.confirmPassword) {
      appAlert('Passwords do not match', 'Please re-enter the same password.');
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
      appAlert('Sign up failed', error.message || 'Please try again.');
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
      appAlert(
        'Google Sign-In Unavailable',
        'Google Sign-In isn\'t available right now. Please sign in with your email and password instead.'
      );
      return;
    }

    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result?.type !== 'success') {
        setGoogleLoading(false);
      }
    } catch (error) {
      setGoogleLoading(false);
      console.error('[Google Sign-In]', error);
      appAlert(
        'Google Sign-In Failed',
        'We couldn\'t sign you in with Google. Please try again, or sign in with your email and password instead.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderSignInForm = () => (
    <>

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
      <View style={styles.passwordInputWrapper}>
        <TextInput
          style={styles.passwordInput}
          value={signInForm.password}
          onChangeText={(value) => updateSignInField('password', value)}
          secureTextEntry={!showSignInPassword}
          autoCorrect={false}
          placeholder="Enter password"
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={() => setShowSignInPassword((prev) => !prev)}
        >
          <Ionicons
            name={showSignInPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

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

  // Decorative only - dunes, blobs and the dashed flight path. Drawn behind
  // the card and pointer-events:none so none of it can swallow a tap on the
  // form. Desktop only: on a phone it would crowd the fields.
  const renderBackdrop = () => (
    <View style={styles.backdrop} pointerEvents="none">
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobBottomLeft]} />

      {isDesktop && (
        <>
          <View style={styles.flightPathLeft} />
          <View style={styles.flightPathRight} />
          <Ionicons name="paper-plane-outline" size={34} color={Colors.primaryLight} style={styles.paperPlane} />
          <Ionicons name="airplane" size={30} color={Colors.primary} style={styles.planeIcon} />

          <View style={styles.scriptLeft}>
            <Text style={styles.scriptLine}>Plan</Text>
            <Text style={styles.scriptLine}>Explore</Text>
            <Text style={[styles.scriptLine, styles.scriptAccent]}>Go Further</Text>
          </View>

          <View style={styles.scriptRight}>
            <Text style={styles.scriptSmall}>Good Trips</Text>
            <Text style={styles.scriptSmall}>Happier You</Text>
          </View>
        </>
      )}

      {/* Layered dunes along the bottom, palest at the back. */}
      <View style={[styles.dune, styles.duneBack]} />
      <View style={[styles.dune, styles.duneMid]} />
      <View style={[styles.dune, styles.duneFront]} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />

      <LinearGradient
        colors={['#FFF9F4', '#FFF1E6', '#FFE6D5']}
        style={StyleSheet.absoluteFill}
      />
      {renderBackdrop()}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>MyItineri</Text>
          <Ionicons name="airplane" size={20} color={Colors.primary} style={styles.brandIcon} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === 'signin' ? 'Welcome ' : 'Join '}
            <Text style={styles.cardTitleAccent}>{mode === 'signin' ? 'Back' : 'Us'}</Text>
          </Text>
          <Text style={styles.cardSubtitle}>
            {mode === 'signin'
              ? 'Sign in to continue your journey'
              : 'Create an account and start planning'}
          </Text>

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
              <>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchPrompt}
            onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            <Text style={styles.switchPromptText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchPromptLink}>{mode === 'signin' ? 'Sign Up' : 'Sign In'}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerTag}>TRAVEL  •  DISCOVER  •  BELONG</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F4' },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 32,
  },

  // ---- decorative backdrop ----
  backdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  blob: { position: 'absolute', backgroundColor: Colors.primary, opacity: 0.07 },
  blobTopRight: { width: 320, height: 260, borderRadius: 140, top: -40, right: -70 },
  blobBottomLeft: { width: 300, height: 220, borderRadius: 130, bottom: 120, left: -90 },

  // Two straight dashed runs either side of the card read as one arc across
  // the page without needing a curve primitive.
  flightPathLeft: {
    position: 'absolute', left: '4%', top: '54%', width: '30%',
    borderTopWidth: 2, borderColor: Colors.primaryLight,
    borderStyle: 'dashed', opacity: 0.55, transform: [{ rotate: '-14deg' }],
  },
  flightPathRight: {
    position: 'absolute', right: '4%', top: '34%', width: '30%',
    borderTopWidth: 2, borderColor: Colors.primaryLight,
    borderStyle: 'dashed', opacity: 0.55, transform: [{ rotate: '-16deg' }],
  },
  paperPlane: { position: 'absolute', left: '9%', top: '50%', opacity: 0.75 },
  planeIcon: { position: 'absolute', right: '8%', top: '26%', transform: [{ rotate: '-30deg' }] },

  scriptLeft: { position: 'absolute', left: '7%', top: '24%' },
  scriptRight: { position: 'absolute', right: '6%', bottom: '26%', alignItems: 'flex-end' },
  // Falls back to plain italic anywhere the script faces are missing, which
  // still reads as a handwritten aside rather than broken.
  scriptLine: {
    fontFamily: Platform.OS === 'web' ? "'Snell Roundhand','Brush Script MT',cursive" : undefined,
    fontStyle: 'italic', fontSize: 30, lineHeight: 38, color: '#2B3A55', opacity: 0.8,
  },
  scriptAccent: { color: Colors.primary, fontSize: 32 },
  scriptSmall: {
    fontFamily: Platform.OS === 'web' ? "'Snell Roundhand','Brush Script MT',cursive" : undefined,
    fontStyle: 'italic', fontSize: 22, lineHeight: 30, color: Colors.primaryDark, opacity: 0.65,
  },

  dune: { position: 'absolute', left: -60, right: -60, borderTopLeftRadius: 500, borderTopRightRadius: 500 },
  duneBack: { bottom: 0, height: 190, backgroundColor: Colors.primary, opacity: 0.10 },
  duneMid: { bottom: -20, height: 150, backgroundColor: Colors.primary, opacity: 0.16 },
  duneFront: { bottom: -50, height: 120, backgroundColor: Colors.primary, opacity: 0.24 },

  // ---- brand ----
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  brandName: { fontSize: 26, fontWeight: '800', color: Colors.primary, letterSpacing: 0.3 },
  brandIcon: { marginLeft: 6 },

  // ---- card ----
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingVertical: 30,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.10,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  cardTitle: { fontSize: 30, fontWeight: '800', color: '#1B2A47', textAlign: 'center' },
  cardTitleAccent: { color: Colors.primary },
  cardSubtitle: {
    marginTop: 6, marginBottom: 22, fontSize: 14,
    color: Colors.textLight, textAlign: 'center',
  },

  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.primarySoft,
    borderRadius: 30,
    padding: 4,
    marginBottom: 22,
  },
  modeButton: { flex: 1, paddingVertical: 11, borderRadius: 26, alignItems: 'center' },
  modeButtonActive: { backgroundColor: Colors.primarySurface },
  modeButtonText: { fontSize: 14, fontWeight: '700', color: Colors.textLight },
  modeButtonTextActive: { color: Colors.primaryDark },

  label: { fontSize: 13, fontWeight: '700', color: '#1B2A47', marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 16,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    marginBottom: 6,
  },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: Colors.text },
  passwordToggle: { paddingHorizontal: 12, paddingVertical: 10 },

  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  buttonDisabled: { opacity: 0.6 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: Colors.textMuted },

  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  googleG: { fontSize: 16, fontWeight: '800', color: '#4285F4', marginRight: 10 },
  googleButtonText: { fontSize: 14, fontWeight: '700', color: Colors.text },

  switchPrompt: { marginTop: 18, alignItems: 'center' },
  switchPromptText: { fontSize: 13, color: Colors.textLight },
  switchPromptLink: { color: Colors.primary, fontWeight: '800' },

  footerTag: {
    marginTop: 26,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.primaryDark,
    opacity: 0.55,
  },
});

export default LoginScreen;
