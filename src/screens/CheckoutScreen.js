import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { digitsOnly } from '../utils/inputSanitizers';
import API_CONFIG from '../config/api';

// Digits only, auto-inserts the "/" after MM so typing/pasting letters
// can't corrupt the MM/YY format.
const formatExpiry = (value) => {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

// Falls back to the platform default (see backend PlatformSettings) if the
// live value can't be fetched, rather than showing ₹0 while loading or on a
// network hiccup.
const DEFAULT_CONVENIENCE_FEE = 300;

const CheckoutScreen = ({ route, navigation }) => {
  const cartItems = route.params?.cartItems || [];
  const total =
    route.params?.total ||
    cartItems.reduce((sum, item) => sum + (item.lineTotal || item.price * item.people), 0);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [convenienceFee, setConvenienceFee] = useState(DEFAULT_CONVENIENCE_FEE);

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

  const grandTotal = total + convenienceFee;

  const paymentMethods = [
    { id: 'card', name: 'Credit/Debit Card', icon: 'card-outline' },
    { id: 'upi', name: 'UPI', icon: 'phone-portrait-outline' },
    { id: 'netbanking', name: 'Net Banking', icon: 'business-outline' },
    { id: 'wallet', name: 'Digital Wallet', icon: 'wallet-outline' },
  ];

  const handlePayment = () => {
    if (paymentMethod === 'card') {
      if (!cardNumber || !expiryDate || !cvv || !cardName) {
        Alert.alert('Error', 'Please fill all card details');
        return;
      }
    }

    Alert.alert(
      'Payment Successful!',
      'Your booking has been confirmed. You will receive a confirmation email shortly.',
      [
        {
          text: 'View Booking',
          onPress: () => navigation.navigate('CustomerTabs', { screen: 'HomeTab' }),
        },
      ]
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

      <ScrollView showsVerticalScrollIndicator={false}>
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
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>
                ₹{Math.round(grandTotal).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethods}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethod,
                  paymentMethod === method.id && styles.paymentMethodActive,
                ]}
                onPress={() => setPaymentMethod(method.id)}
              >
                <Ionicons name={method.icon} size={20} color={Colors.primary} style={styles.methodIcon} />
                <Text
                  style={[
                    styles.methodName,
                    paymentMethod === method.id && styles.methodNameActive,
                  ]}
                >
                  {method.name}
                </Text>
                {paymentMethod === method.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Card Details */}
        {paymentMethod === 'card' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Card Details</Text>
            <View style={styles.cardForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Card Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={Colors.textMuted}
                  value={cardNumber}
                  onChangeText={(value) => setCardNumber(digitsOnly(value))}
                  keyboardType="numeric"
                  maxLength={19}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.inputLabel}>Expiry Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/YY"
                    placeholderTextColor={Colors.textMuted}
                    value={expiryDate}
                    onChangeText={(value) => setExpiryDate(formatExpiry(value))}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                </View>
                <View style={[styles.inputContainer, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    placeholderTextColor={Colors.textMuted}
                    value={cvv}
                    onChangeText={(value) => setCvv(digitsOnly(value))}
                    keyboardType="numeric"
                    maxLength={3}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Cardholder Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.textMuted}
                  value={cardName}
                  onChangeText={setCardName}
                />
              </View>
            </View>
          </View>
        )}

        {/* UPI */}
        {paymentMethod === 'upi' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>UPI Payment</Text>
            <View style={styles.upiContainer}>
              <Ionicons name="phone-portrait-outline" size={24} color={Colors.primary} style={styles.upiIcon} />
              <Text style={styles.upiText}>
                You will be redirected to your UPI app to complete the payment
              </Text>
            </View>
          </View>
        )}

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed-outline" size={16} color={Colors.success} style={styles.securityIcon} />
          <Text style={styles.securityText}>
            Your payment information is secure and encrypted
          </Text>
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
          onPress={handlePayment}
        >
          <Text style={styles.payButtonText}>Pay Now</Text>
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
  paymentMethods: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  paymentMethodActive: {
    backgroundColor: Colors.primaryLight,
  },
  methodIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  methodName: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  methodNameActive: {
    fontWeight: 'bold',
    color: Colors.primary,
  },
  checkmark: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  cardForm: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputRow: {
    flexDirection: 'row',
  },
  upiContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  upiIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  upiText: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  securityIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  securityText: {
    fontSize: 14,
    color: Colors.textLight,
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
