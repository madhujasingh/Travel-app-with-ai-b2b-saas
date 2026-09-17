// Sign-in asked for at the moment it's needed - tapping Book - rather than at
// the front door. Deliberately an overlay rather than a navigation: pushing the
// Login screen would unmount whatever the traveller was filling in, losing the
// search and the passenger details they had already typed.
//
// On web this is a fixed-position overlay rather than a <Modal>, for the same
// reason appAlert.web.js is: booking screens open Modals of their own, and two
// visible Modals at once silently fail to open.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';
import { appAlert } from '../utils/appAlert';

const BENEFITS = [
  { icon: 'pricetags-outline', text: 'Member fares on flights, hotels and holidays' },
  { icon: 'shield-checkmark-outline', text: 'Your bookings and travellers saved securely' },
  { icon: 'notifications-outline', text: 'Live updates on every trip you book' },
];

const LoginPrompt = ({ visible, onClose, onSuccess, message }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setName('');
    setMode('signin');
  };

  const close = () => {
    reset();
    onClose?.();
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      appAlert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      appAlert('Weak password', 'Please use at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const path = mode === 'signin' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'signin'
          ? { email: email.trim(), password: password.trim() }
          : { name: name.trim() || email.trim().split('@')[0], email: email.trim(), password: password.trim(), role: 'CUSTOMER' };

      const response = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Sign in failed');
      }

      login({ token: data.token, user: data.user });
      reset();
      // Hand back to whatever the traveller was doing before we interrupted.
      onSuccess?.();
    } catch (error) {
      appAlert(
        mode === 'signin' ? 'Sign in failed' : 'Sign up failed',
        error.message || 'Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const card = (
    <View style={styles.card}>
      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>Why sign in</Text>
        {BENEFITS.map((benefit) => (
          <View key={benefit.text} style={styles.benefitRow}>
            <Ionicons name={benefit.icon} size={18} color="#FFFFFF" style={styles.benefitIcon} />
            <Text style={styles.benefitText}>{benefit.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.formSide}>
        <Pressable onPress={close} style={styles.closeButton} hitSlop={10}>
          <Ionicons name="close" size={22} color={Colors.textLight} />
        </Pressable>

        <Text style={styles.title}>{mode === 'signin' ? 'Log in' : 'Create your account'}</Text>
        <Text style={styles.subtitle}>
          {message || 'Sign in to continue with your booking.'}
        </Text>

        <ScrollView keyboardShouldPersistTaps="handled" style={styles.formScroll}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>{mode === 'signin' ? 'Log in' : 'Sign up'}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchLink}>{mode === 'signin' ? 'Sign up' : 'Log in'}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        {card}
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlayNative}>
        <Pressable style={styles.backdrop} onPress={close} />
        {card}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 9998,
  },
  overlayNative: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(12, 20, 33, 0.55)',
  },
  card: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 720,
    maxHeight: 560,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  // Hidden on narrow screens - the form is what matters, the sell is a bonus.
  benefits: {
    display: Platform.OS === 'web' ? 'flex' : 'none',
    width: 260,
    padding: 26,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
  },
  benefitsTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  benefitIcon: { marginRight: 10, marginTop: 1 },
  benefitText: { flex: 1, color: '#FFFFFF', fontSize: 13, lineHeight: 19, opacity: 0.92 },
  formSide: { flex: 1, padding: 24 },
  closeButton: { position: 'absolute', top: 14, right: 14, zIndex: 2, padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 13, color: Colors.textLight, marginBottom: 18, lineHeight: 18 },
  formScroll: { flexGrow: 0 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  switchRow: { marginTop: 16, alignItems: 'center' },
  switchText: { fontSize: 13, color: Colors.textLight },
  switchLink: { color: Colors.primary, fontWeight: '700' },
});

export default LoginPrompt;
