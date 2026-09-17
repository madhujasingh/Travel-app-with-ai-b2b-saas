import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

// Digits only, auto-inserts the "/" after MM so typing/pasting letters
// can't corrupt the MM/YY format.
// Falls back to the platform default (see backend PlatformSettings) if the
// live value can't be fetched, rather than showing ₹0 while loading or on a
// network hiccup.
const DEFAULT_CONVENIENCE_FEE = 300;

const CheckoutScreen = ({ route, navigation }) => {
  const { centeredForm } = useResponsive();
  const cartItems = route.params?.cartItems || [];
  const total =
    route.params?.total ||
    cartItems.reduce((sum, item) => sum + (item.lineTotal || item.price * item.people), 0);
  const [convenienceFee, setConvenienceFee] = useState(DEFAULT_CONVENIENCE_FEE);
  const { token } = useAuth();

  // Coupon. The server prices the code - this screen only sends it and the
  // order total, and shows whatever discount comes back.
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Which rules apply. A mixed cart has no single answer, so the biggest line
  // decides - the one a coupon is most likely meant for.
  const checkoutProductType = (() => {
    if (!cartItems.length) return 'PACKAGE';
    const byType = {};
    cartItems.forEach((item) => {
      const type = item.productType || 'PACKAGE';
      byType[type] = (byType[type] || 0) + (item.lineTotal || item.price * item.people || 0);
    });
    return Object.entries(byType).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError('Enter a coupon code.');
      return;
    }
    try {
      setCouponChecking(true);
      setCouponError('');
      const response = await fetch(`${API_CONFIG.BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          code,
          orderAmount: total + convenienceFee,
          productType: checkoutProductType,
        }),
      });
      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!response.ok || !data) {
        setCouponError(data?.message || 'Unable to check that code right now.');
        return;
      }
      if (!data.valid) {
        setCouponError(data.message || "This coupon code isn't valid.");
        return;
      }
      setAppliedCoupon(data);
      setCouponCode('');
    } catch (error) {
      setCouponError('Unable to check that code right now.');
    } finally {
      setCouponChecking(false);
    }
  };

  // Reached either from CartScreen or directly via FlightsScreen's
  // "Continue" shortcut (which skips CartScreen entirely) - fetch
  // independently rather than relying on a nav param from the other screen.
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/platform-settings`);
        const data = await response.json();
        if (response.ok && typeof data?.flightConvenienceFee === 'number') {
          setConvenienceFee(data.flightConvenienceFee);
        }
      } catch (error) {
        // ignored - keep the default fee
      }
    })();
  }, []);

  const discount = Number(appliedCoupon?.discountAmount || 0);
  const grandTotal = Math.max(total + convenienceFee - discount, 0);

  // Online payment is not built yet - there is no gateway, so nothing here can
  // take money. Say so plainly rather than showing a confirmation: a traveller
  // who believes they have paid and holds no ticket is far worse than one who
  // knows to call us.
  const handleEnquiry = () => {
    appAlert(
      'Request received',
      'Online payment is not available yet. Our team will contact you to confirm '
        + 'this booking and arrange payment. Nothing has been charged.',
      [{ text: 'OK', onPress: () => navigation.navigate('CustomerTabs', { screen: 'HomeTab' }) }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={centeredForm}>
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.orderCard}>
            {cartItems.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <Ionicons name={item.iconName || item.image || 'briefcase-outline'} size={24} color={Colors.primary} style={styles.orderIcon} />
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>{item.title}</Text>
                  <Text style={styles.orderDetails}>
                    {item.people} people • {item.duration}
                  </Text>
                </View>
                <Text style={styles.orderPrice}>
                  ₹{Math.round(item.lineTotal || item.price * item.people).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Breakdown</Text>
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>₹{total.toLocaleString()}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Convenience Fee</Text>
              <Text style={styles.priceValue}>
                ₹{Math.round(convenienceFee).toLocaleString()}
              </Text>
            </View>
            {appliedCoupon ? (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, styles.discountLabel]}>
                  Discount ({appliedCoupon.code})
                </Text>
                <Text style={[styles.priceValue, styles.discountValue]}>
                  -₹{Math.round(discount).toLocaleString()}
                </Text>
              </View>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>
                ₹{Math.round(grandTotal).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coupon</Text>
          {appliedCoupon ? (
            <View style={styles.couponApplied}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <View style={styles.couponAppliedCopy}>
                <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
                {!!appliedCoupon.description && (
                  <Text style={styles.couponAppliedText}>{appliedCoupon.description}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setAppliedCoupon(null)}>
                <Text style={styles.couponRemove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Enter code"
                  placeholderTextColor={Colors.textMuted}
                  value={couponCode}
                  onChangeText={(value) =>
                    setCouponCode(value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                  }
                  autoCapitalize="characters"
                  maxLength={40}
                />
                <TouchableOpacity
                  style={styles.couponApplyButton}
                  onPress={applyCoupon}
                  disabled={couponChecking}
                >
                  {couponChecking ? (
                    <ActivityIndicator color={Colors.primary} size="small" />
                  ) : (
                    <Text style={styles.couponApplyText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
              {!!couponError && <Text style={styles.couponError}>{couponError}</Text>}
            </>
          )}
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.pendingNotice}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} style={styles.pendingIcon} />
            <Text style={styles.pendingText}>
              Online payment is coming soon. Submit your request and our team will
              contact you to confirm the booking and arrange payment. You will not
              be charged now.
            </Text>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabelSmall}>Total</Text>
          <Text style={styles.totalAmount}>
            ₹{Math.round(grandTotal).toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.payButton}
          onPress={handleEnquiry}
        >
          <Text style={styles.payButtonText}>Request Booking</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.primarySoft,
    borderRadius: 12,
    padding: 14,
  },
  pendingIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  orderCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  orderDetails: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 2,
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  couponInput: {
    flex: 1,
    height: 46,
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
  couponApplyButton: {
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  couponError: { marginTop: 8, fontSize: 12.5, fontWeight: '600', color: Colors.error },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EAF7EC',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  couponAppliedCopy: { flex: 1, gap: 2 },
  couponAppliedCode: { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 0.8 },
  couponAppliedText: { fontSize: 12, color: Colors.textLight },
  couponRemove: { fontSize: 12.5, fontWeight: '700', color: Colors.error },
  discountLabel: { color: Colors.success, fontWeight: '700' },
  discountValue: { color: Colors.success, fontWeight: '800' },

  priceCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 16,
    color: Colors.textLight,
  },
  priceValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabelSmall: {
    fontSize: 14,
    color: Colors.textLight,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  payButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CheckoutScreen;
