import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  StatusBar,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import { phoneDigits } from '../utils/inputSanitizers';

const CabBookingScreen = ({ route, navigation }) => {
  const { token, user } = useAuth();
  const { quote, group, journeyInfo, routeDetails, journeyType } = route.params || {};

  const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.name?.split(' ').slice(1).join(' ') || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone && user.phone !== '0000000000' ? user.phone : '');
  const [flightNumber, setFlightNumber] = useState('');
  const [serviceRequest, setServiceRequest] = useState('');

  const [phase, setPhase] = useState('form'); // form | booking | confirmed
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const fare = quote?.fareBreakup || {};
  const totalFare = Number(fare.totalFare || 0);
  const totalTax = Number(fare.totalTax || 0);

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) {
      return 'Enter the lead passenger\'s first and last name.';
    }
    if (!email.trim() || !email.includes('@')) {
      return 'Enter a valid email address.';
    }
    if (!/^\+\d{7,15}$/.test(phone.trim())) {
      return 'Enter a valid phone number with country code (e.g. +919876543210).';
    }
    return null;
  };

  const buildBookingPayload = () => {
    const passengerDetail = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };
    if (journeyType === 'airport_transfer' && flightNumber.trim()) {
      passengerDetail.flightDetails = { number: flightNumber.trim() };
    }

    return {
      journeyInfo: {
        journeyType: journeyInfo?.journeyType,
        tripType: journeyInfo?.tripType,
        pickupDateTime: journeyInfo?.pickupDateTime,
        ...(journeyInfo?.returnDateTime ? { returnDateTime: journeyInfo.returnDateTime } : {}),
        distance: journeyInfo?.distance,
        duration: journeyInfo?.duration,
      },
      // Doc's Booking request uses "routeDetail" (singular) - the Quotes
      // response this data came from calls the same shape "routeDetails"
      // (plural). Renamed here, not just passed through, so the key matches
      // what the Booking API actually expects.
      routeDetail: {
        isDomestic: routeDetails?.isDomestic,
        origin: routeDetails?.origin,
        destination: routeDetails?.destination,
      },
      addons: [],
      quotationInfo: {
        vehicleType: group?.vehicleType,
        vehicleCategory: group?.vehicleCategory,
        quoteId: quote?.quotationId,
        childQuoteId: quote?.quoteChildId,
        paxCount: quote?.paxCount,
        luggageCount: quote?.luggageCount,
        vendorId: quote?.vendorId,
      },
      pricingInfo: {
        netAmount: (totalFare - totalTax).toFixed(2),
        addonsPrice: '0.00',
        agentMarkup: 0,
        agentMarkupSplitup: { onwardJourneyMarkup: 0, returnJourneyMarkup: 0 },
        grossAmount: totalFare.toFixed(2),
      },
      passengerDetail,
      serviceRequest: serviceRequest.trim(),
      consent: 'yes',
      agentEmail: email.trim(),
      agentPhone: phone.trim(),
      vendorId: quote?.vendorId,
    };
  };

  const fetchBookingDetails = async (bookingId) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/cabs/booking-details?bookingIds=${encodeURIComponent(bookingId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error?.message || data?.message || 'Unable to fetch booking details right now.');
    }
    return data?.data?.[0] || null;
  };

  const handleBookAndPay = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Missing Information', validationError);
      return;
    }
    setBusy(true);
    setPhase('booking');
    try {
      const bookResponse = await fetch(`${API_CONFIG.BASE_URL}/cabs/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buildBookingPayload()),
      });
      const bookData = await bookResponse.json();
      if (!bookResponse.ok || bookData?.success === false) {
        throw new Error(bookData?.error?.message || bookData?.message || 'Unable to create this booking right now.');
      }
      const bookingId = bookData?.data?.id;
      const totalPrice = bookData?.data?.totalPrice;
      const payUserId = bookData?.data?.agentId;
      const status = bookData?.data?.status;

      // Doc's separate Payment API debits the TripJack wallet (WALLET/DEBIT)
      // - only needed while the booking is still PAYMENT_PENDING; a status
      // that's already SUCCESS (e.g. a vendor that auto-confirms) shouldn't
      // be paid for twice.
      if (status === 'PAYMENT_PENDING' && bookingId && totalPrice != null) {
        const paymentResponse = await fetch(`${API_CONFIG.BASE_URL}/cabs/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            amount: totalPrice,
            payUserId,
            paymentMedium: 'WALLET',
            bookingId,
            opType: 'DEBIT',
            product: 'CAB',
            transactionType: 'PAID_FOR_ORDER',
          }),
        });
        const paymentData = await paymentResponse.json();
        if (!paymentResponse.ok || paymentData?.success === false) {
          throw new Error(paymentData?.error?.message || paymentData?.message || 'Payment could not be completed for this booking.');
        }
      }

      const details = await fetchBookingDetails(bookingId);
      setBooking(details || { order: { bookingId, status } });
      setPhase('confirmed');
    } catch (error) {
      Alert.alert('Cab Booking', error.message || 'Unable to complete this booking right now.');
      setPhase('form');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshStatus = async () => {
    const bookingId = booking?.order?.bookingId;
    if (!bookingId) return;
    setBusy(true);
    try {
      const details = await fetchBookingDetails(bookingId);
      setBooking(details);
    } catch (error) {
      Alert.alert('Booking Status', error.message || 'Unable to refresh booking status.');
    } finally {
      setBusy(false);
    }
  };

  const previewCancelCharges = () => {
    const bookingId = booking?.order?.bookingId;
    if (!bookingId) return;
    Alert.alert('Cancel booking', 'Check cancellation charges before cancelling?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, check',
        onPress: async () => {
          setCancelling(true);
          try {
            const response = await fetch(
              `${API_CONFIG.BASE_URL}/cabs/amendment-charges?bookingId=${encodeURIComponent(bookingId)}&type=CANCELLATION`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();
            if (!response.ok || data?.success === false) {
              throw new Error(data?.error?.message || data?.message || 'Unable to fetch cancellation charges right now.');
            }
            const amendment = data?.data?.amendment || {};
            setCancelling(false);
            Alert.alert(
              'Confirm Cancellation',
              `Refundable amount: ₹${Number(amendment.refundAmount || 0).toLocaleString()}\nCharges: ₹${Number(amendment.tjAmendmentCharge || 0).toLocaleString()}\n${amendment.appliedAmendmentConfig?.description || ''}`,
              [
                { text: 'Back', style: 'cancel' },
                { text: 'Proceed', style: 'destructive', onPress: submitCancellation },
              ]
            );
          } catch (error) {
            setCancelling(false);
            Alert.alert('Cancellation', error.message || 'Unable to fetch cancellation charges right now.');
          }
        },
      },
    ]);
  };

  const submitCancellation = async () => {
    const bookingId = booking?.order?.bookingId;
    if (!bookingId) return;
    setCancelling(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/cabs/amendment-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId, amendmentType: 'CANCELLATION' }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error?.message || data?.message || 'Unable to cancel this booking right now.');
      }
      setCancelled(true);
      Alert.alert('Cancellation Successful', `Refunded: ₹${Number(data?.data?.refundAmount || 0).toLocaleString()}`, [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error) {
      Alert.alert('Cancellation', error.message || 'Unable to cancel this booking right now.');
    } finally {
      setCancelling(false);
    }
  };

  const order = booking?.order;
  const isCancelled = cancelled || order?.status === 'CANCELLED';
  const canCancel = order?.status === 'PAYMENT_SUCCESS' && !isCancelled;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (phase === 'confirmed' ? navigation.popToTop() : navigation.goBack())}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{phase === 'form' ? 'Passenger Details' : 'Your Booking'}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {phase === 'form' ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVehicle}>{group?.label}</Text>
              <Text style={styles.summaryRoute} numberOfLines={2}>
                {routeDetails?.origin?.displayAddress} → {routeDetails?.destination?.displayAddress}
              </Text>
              <Text style={styles.summaryFare}>₹{totalFare.toLocaleString()}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Passenger Details</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(value) => setPhone(phoneDigits(value))}
                placeholder="Phone (+countrycode...)"
                placeholderTextColor={Colors.textMuted}
              />
              {journeyType === 'airport_transfer' ? (
                <TextInput
                  style={styles.input}
                  value={flightNumber}
                  onChangeText={setFlightNumber}
                  placeholder="Flight number (optional)"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                />
              ) : null}
              <TextInput
                style={[styles.input, styles.textArea]}
                value={serviceRequest}
                onChangeText={setServiceRequest}
                placeholder="Special requests (optional)"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleBookAndPay} disabled={busy}>
              <Text style={styles.primaryButtonText}>Book & Pay ₹{totalFare.toLocaleString()}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {phase === 'booking' ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Confirming your booking...</Text>
          </View>
        ) : null}

        {phase === 'confirmed' ? (
          <>
            <View
              style={[
                styles.statusHeaderCard,
                isCancelled ? styles.statusHeaderCancelled : styles.statusHeaderConfirmed,
              ]}
            >
              <Ionicons
                name={isCancelled ? 'close-circle' : 'checkmark-circle'}
                size={30}
                color={isCancelled ? Colors.error : Colors.success}
              />
              <Text style={styles.statusHeaderTitle}>
                {isCancelled ? 'Booking Cancelled' : 'Cab Booked'}
              </Text>
              <Text style={styles.statusHeaderSubtitle}>
                {isCancelled ? 'This ride has been cancelled.' : 'Your driver details will be shared before pickup.'}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Booking ID</Text>
                <Text style={styles.metaValue}>{order?.bookingId}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Status</Text>
                <Text style={styles.metaValue}>{order?.status}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Amount</Text>
                <Text style={styles.metaValueAccent}>₹{Number(order?.amount || totalFare).toLocaleString()}</Text>
              </View>
              {order?.rideStatus ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Ride Status</Text>
                  <Text style={styles.metaValue}>{order.rideStatus}</Text>
                </View>
              ) : null}
              {order?.helpline ? <Text style={styles.helplineText}>{order.helpline}</Text> : null}
            </View>

            {order?.trackingLink && !isCancelled ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(order.trackingLink)}>
                <Ionicons name="navigate-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.secondaryButtonText}>Track Your Ride</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.secondaryButton} onPress={handleRefreshStatus} disabled={busy}>
              <Ionicons name="refresh" size={15} color={Colors.primaryDark} />
              <Text style={styles.secondaryButtonText}>Refresh Status</Text>
            </TouchableOpacity>

            {canCancel ? (
              <TouchableOpacity style={styles.dangerButton} onPress={previewCancelCharges} disabled={cancelling}>
                {cancelling ? (
                  <ActivityIndicator color={Colors.error} />
                ) : (
                  <Text style={styles.dangerButtonText}>Cancel Booking</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </ScrollView>
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
  content: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  summaryVehicle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  summaryRoute: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  summaryFare: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 8,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  inputFlex: {
    flex: 1,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: Colors.secondary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  loadingState: {
    marginTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textLight,
    fontSize: 14,
  },
  statusHeaderCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  statusHeaderConfirmed: {
    backgroundColor: '#E3F5E5',
  },
  statusHeaderCancelled: {
    backgroundColor: '#FBE4E2',
  },
  statusHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
  },
  statusHeaderSubtitle: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaLabel: {
    fontSize: 13,
    color: Colors.textLight,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  metaValueAccent: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  helplineText: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 6,
  },
  secondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    backgroundColor: Colors.primarySoft,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: Colors.primaryDark,
    fontWeight: '700',
    fontSize: 14,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default CabBookingScreen;
