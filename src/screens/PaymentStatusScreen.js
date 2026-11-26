import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Reached via the travelapp2://payment-return deep link that Cashfree's
// hosted checkout redirects to in the system browser (see CheckoutScreen and
// src/config/linking.js). The webhook may not have landed yet, so this polls
// the status endpoint a few times rather than trusting a single read - the
// endpoint itself also asks Cashfree directly while a Payment is still
// PENDING, so one or two attempts is normally enough.
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 2000;

const PaymentStatusScreen = ({ route, navigation }) => {
  const orderId = route.params?.order_id;
  const { token } = useAuth();
  const { clearCart } = useCart();
  const [status, setStatus] = useState('checking'); // checking | SUCCESS | FAILED | PENDING | error

  useEffect(() => {
    let cancelled = false;

    const poll = async (attempt) => {
      if (!orderId || !token) {
        if (!cancelled) setStatus('error');
        return;
      }
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/payments/cashfree/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setStatus('error');
          return;
        }
        if (data.status === 'SUCCESS') {
          clearCart();
          setStatus('SUCCESS');
          return;
        }
        if (data.status === 'FAILED') {
          setStatus('FAILED');
          return;
        }
        // Still PENDING - try again, a few times, before giving up and
        // telling the customer to check their bookings later.
        if (attempt < POLL_ATTEMPTS) {
          setTimeout(() => poll(attempt + 1), POLL_DELAY_MS);
        } else {
          setStatus('PENDING');
        }
      } catch (error) {
        if (!cancelled) setStatus('error');
      }
    };

    poll(1);
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  const goHome = () => navigation.navigate('CustomerTabs', { screen: 'HomeTab' });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'checking' && (
          <>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.title}>Confirming your payment&hellip;</Text>
          </>
        )}

        {status === 'SUCCESS' && (
          <>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
            <Text style={styles.title}>Payment successful</Text>
            <Text style={styles.subtitle}>Your booking is confirmed. We'll see you soon!</Text>
            <TouchableOpacity style={styles.button} onPress={goHome}>
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'FAILED' && (
          <>
            <Ionicons name="close-circle" size={72} color={Colors.error} />
            <Text style={styles.title}>Payment failed</Text>
            <Text style={styles.subtitle}>You have not been charged. Please try again.</Text>
            <TouchableOpacity style={styles.button} onPress={goHome}>
              <Text style={styles.buttonText}>Back to home</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'PENDING' && (
          <>
            <Ionicons name="time-outline" size={72} color={Colors.primary} />
            <Text style={styles.title}>Still processing</Text>
            <Text style={styles.subtitle}>
              Your payment is taking longer than usual to confirm. Check back shortly.
            </Text>
            <TouchableOpacity style={styles.button} onPress={goHome}>
              <Text style={styles.buttonText}>Back to home</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'error' && (
          <>
            <Ionicons name="alert-circle-outline" size={72} color={Colors.error} />
            <Text style={styles.title}>Couldn't confirm payment</Text>
            <Text style={styles.subtitle}>Please check your bookings in a moment.</Text>
            <TouchableOpacity style={styles.button} onPress={goHome}>
              <Text style={styles.buttonText}>Back to home</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  title: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 20, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textLight, marginTop: 10, textAlign: 'center' },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
    marginTop: 30,
  },
  buttonText: { color: Colors.secondary, fontSize: 16, fontWeight: 'bold' },
});

export default PaymentStatusScreen;
