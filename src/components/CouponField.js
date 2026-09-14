import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

// Coupon entry for a single product's checkout.
//
// Each product books directly from its own screen rather than through the cart
// (supplier quotes expire in 15-30 minutes, so only our own packages survive a
// cart), which means the code has to be enterable at each of those checkouts.
//
// The screen never computes a discount: it sends the code and the order total,
// and the server returns what the code is worth. The parent applies the
// returned discountAmount to its own total.
const CouponField = ({ productType, orderAmount, applied, onApplied, onRemoved }) => {
  const { token } = useAuth();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const apply = async () => {
    const entered = code.trim();
    if (!entered) {
      setError('Enter a coupon code.');
      return;
    }
    try {
      setChecking(true);
      setError('');
      const response = await fetch(`${API_CONFIG.BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: entered, orderAmount, productType }),
      });

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data) {
        setError(data?.message || 'Unable to check that code right now.');
        return;
      }
      if (!data.valid) {
        setError(data.message || "This coupon code isn't valid.");
        return;
      }

      setCode('');
      onApplied?.(data);
    } catch (err) {
      setError('Unable to check that code right now.');
    } finally {
      setChecking(false);
    }
  };

  if (applied) {
    return (
      <View style={styles.appliedRow}>
        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
        <View style={styles.appliedCopy}>
          <Text style={styles.appliedCode}>{applied.code}</Text>
          {!!applied.description && <Text style={styles.appliedText}>{applied.description}</Text>}
        </View>
        <TouchableOpacity onPress={() => onRemoved?.()}>
          <Text style={styles.remove}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Have a coupon code?</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Enter code"
          placeholderTextColor={Colors.textMuted}
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
          autoCapitalize="characters"
          maxLength={40}
        />
        <TouchableOpacity style={styles.button} onPress={apply} disabled={checking}>
          {checking ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Text style={styles.buttonText}>Apply</Text>
          )}
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.text,
    outlineStyle: 'none',
  },
  button: {
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  error: { fontSize: 12.5, fontWeight: '600', color: Colors.error },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EAF7EC',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  appliedCopy: { flex: 1, gap: 2 },
  appliedCode: { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 0.8 },
  appliedText: { fontSize: 12, color: Colors.textLight },
  remove: { fontSize: 12.5, fontWeight: '700', color: Colors.error },
});

export default CouponField;
