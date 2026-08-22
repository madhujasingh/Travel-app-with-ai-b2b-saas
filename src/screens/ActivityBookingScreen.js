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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import { parseActivitiesError } from '../utils/activitiesApiErrors';

// Free-text agency reference HotelBeds stores alongside the booking (up to
// 20 chars per the docs) - generated rather than asked from the customer,
// same "no technical fields in customer UI" reasoning as elsewhere in the app.
const generateClientReference = () => `ITINERA${Date.now().toString().slice(-10)}`;

const buildInitialTravelers = (adults) =>
  Array.from({ length: adults || 1 }, () => ({ name: '', surname: '' }));

const ActivityBookingScreen = ({ route, navigation }) => {
  const { token } = useAuth();
  const { activityCode, name, rateKey, from, to, adults, price, currency, questions } = route.params;

  const [holderName, setHolderName] = useState('');
  const [holderSurname, setHolderSurname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('IN');
  const [travelers, setTravelers] = useState(() => buildInitialTravelers(adults));
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const updateTraveler = (index, field, value) => {
    setTravelers((current) =>
      current.map((traveler, i) => (i === index ? { ...traveler, [field]: value } : traveler))
    );
  };

  const updateAnswer = (code, value) => {
    setAnswers((current) => ({ ...current, [code]: value }));
  };

  const submitBooking = async () => {
    if (!holderName.trim() || !holderSurname.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Missing details', 'Please fill in your name, email, and phone number.');
      return;
    }
    if (travelers.some((t) => !t.name.trim() || !t.surname.trim())) {
      Alert.alert('Missing traveler details', 'Please provide a name and surname for every traveler.');
      return;
    }
    const missingRequired = (questions || []).find((q) => q.required && !answers[q.code]?.trim());
    if (missingRequired) {
      Alert.alert('Missing information', missingRequired.text || 'Please answer all required questions.');
      return;
    }

    // Ages must match what the rateKey was generated for (see
    // ActivityDetailScreen - always age 30, ADULT) or HotelBeds rejects the
    // confirmation as inconsistent with the detail call.
    const payload = {
      language: 'en',
      clientReference: generateClientReference(),
      holder: {
        name: holderName.trim(),
        surname: holderSurname.trim(),
        title: 'Mr',
        email: email.trim(),
        address: address.trim() || 'N/A',
        zipCode: zipCode.trim() || '000000',
        mailing: false,
        country: country.trim().toUpperCase() || 'IN',
        telephones: [phone.trim()],
      },
      activities: [
        {
          rateKey,
          from,
          to,
          paxes: travelers.map((t) => ({
            age: 30,
            name: t.name.trim(),
            surname: t.surname.trim(),
            type: 'ADULT',
          })),
          // Some activities (per Detail's modality.questions) require extra
          // info before they can be confirmed - e.g. "what hotel are you
          // staying at", passport numbers. Confirmed live: omitting these
          // when required gets rejected with one E_REQUEST_INVALID error per
          // unanswered question.
          ...((questions || []).length > 0
            ? {
                answers: questions.map((q) => ({
                  question: { code: q.code, text: q.text, required: q.required },
                  answer: answers[q.code]?.trim() || '',
                })),
              }
            : {}),
        },
      ],
    };

    try {
      setSubmitting(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/activities/bookings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data?.errors) {
        throw new Error(parseActivitiesError(data, 'Unable to confirm this booking.'));
      }
      setBooking(data?.booking || null);
    } catch (error) {
      Alert.alert('Booking Failed', error.message || 'Unable to confirm this booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const checkStatus = async () => {
    try {
      setCheckingStatus(true);
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/activities/bookings/en/${booking.reference}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!response.ok || data?.errors) {
        throw new Error(parseActivitiesError(data, 'Unable to check booking status.'));
      }
      setBooking(data?.booking || booking);
    } catch (error) {
      Alert.alert('Booking Status', error.message || 'Unable to check booking status.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // Always simulate first (no charge, no state change) to show the real
  // cancellation fee before actually cancelling - same two-step pattern
  // HotelBookingScreen uses for hotel cancellations.
  const cancelBooking = () => {
    Alert.alert('Cancel booking', 'Check cancellation charges before cancelling?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, check',
        onPress: async () => {
          try {
            setCancelling(true);
            const simResponse = await fetch(
              `${API_CONFIG.BASE_URL}/activities/bookings/en/${booking.reference}?cancellationFlag=SIMULATION`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
            );
            const simData = await simResponse.json();
            if (!simResponse.ok || simData?.errors) {
              throw new Error(parseActivitiesError(simData, 'Unable to check cancellation charges.'));
            }
            const fee = simData?.booking?.cancelValuationAmount ?? 0;

            Alert.alert(
              'Confirm cancellation',
              fee > 0
                ? `Cancelling now will incur a fee of ${booking.currency} ${fee}. Continue?`
                : 'This booking can be cancelled free of charge. Continue?',
              [
                { text: 'No', style: 'cancel', onPress: () => setCancelling(false) },
                {
                  text: 'Yes, cancel',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const response = await fetch(
                        `${API_CONFIG.BASE_URL}/activities/bookings/en/${booking.reference}?cancellationFlag=CANCELLATION`,
                        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
                      );
                      const data = await response.json();
                      if (!response.ok || data?.errors) {
                        throw new Error(parseActivitiesError(data, 'Unable to cancel this booking.'));
                      }
                      setBooking(data?.booking || booking);
                    } catch (error) {
                      Alert.alert('Cancel Booking', error.message || 'Unable to cancel this booking.');
                    } finally {
                      setCancelling(false);
                    }
                  },
                },
              ]
            );
          } catch (error) {
            setCancelling(false);
            Alert.alert('Cancel Booking', error.message || 'Unable to check cancellation charges.');
          }
        },
      },
    ]);
  };

  if (booking) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.confirmedState}>
          <Ionicons
            name={booking.status === 'CANCELLED' ? 'close-circle' : 'checkmark-circle'}
            size={64}
            color={booking.status === 'CANCELLED' ? Colors.error : Colors.success}
          />
          <Text style={styles.confirmedTitle}>
            {booking.status === 'CANCELLED' ? 'Booking Cancelled' : 'Booking Confirmed'}
          </Text>
          <Text style={styles.confirmedReference}>Reference: {booking.reference}</Text>
          <Text style={styles.confirmedStatus}>Status: {booking.status}</Text>

          <TouchableOpacity style={styles.secondaryButton} onPress={checkStatus} disabled={checkingStatus}>
            {checkingStatus ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>Check latest status</Text>
            )}
          </TouchableOpacity>

          {booking.status !== 'CANCELLED' && (
            <TouchableOpacity style={styles.cancelButton} onPress={cancelBooking} disabled={cancelling}>
              {cancelling ? (
                <ActivityIndicator color={Colors.error} />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel booking</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.popToTop()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryName} numberOfLines={2}>{name}</Text>
          {price != null && (
            <Text style={styles.summaryPrice}>{currency} {Number(price).toLocaleString()}</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Your details</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            placeholder="First name"
            placeholderTextColor={Colors.textMuted}
            value={holderName}
            onChangeText={setHolderName}
          />
          <TextInput
            style={[styles.input, styles.rowInput]}
            placeholder="Last name"
            placeholderTextColor={Colors.textMuted}
            value={holderSurname}
            onChangeText={setHolderSurname}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Phone number"
          placeholderTextColor={Colors.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            placeholder="Address"
            placeholderTextColor={Colors.textMuted}
            value={address}
            onChangeText={setAddress}
          />
          <TextInput
            style={[styles.input, styles.rowInputSmall]}
            placeholder="ZIP"
            placeholderTextColor={Colors.textMuted}
            value={zipCode}
            onChangeText={setZipCode}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Country code (e.g. IN)"
          placeholderTextColor={Colors.textMuted}
          value={country}
          onChangeText={setCountry}
          autoCapitalize="characters"
          maxLength={2}
        />

        {(questions || []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Additional information</Text>
            {questions.map((q) => (
              <TextInput
                key={q.code}
                style={styles.input}
                placeholder={q.text || q.code}
                placeholderTextColor={Colors.textMuted}
                value={answers[q.code] || ''}
                onChangeText={(value) => updateAnswer(q.code, value)}
              />
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Traveler names</Text>
        {travelers.map((traveler, index) => (
          <View key={index} style={styles.row}>
            <TextInput
              style={[styles.input, styles.rowInput]}
              placeholder={`Traveler ${index + 1} first name`}
              placeholderTextColor={Colors.textMuted}
              value={traveler.name}
              onChangeText={(value) => updateTraveler(index, 'name', value)}
            />
            <TextInput
              style={[styles.input, styles.rowInput]}
              placeholder="Last name"
              placeholderTextColor={Colors.textMuted}
              value={traveler.surname}
              onChangeText={(value) => updateTraveler(index, 'surname', value)}
            />
          </View>
        ))}

        <TouchableOpacity style={styles.confirmButton} onPress={submitBooking} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={Colors.secondary} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Booking</Text>
          )}
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  summaryName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowInput: {
    flex: 1,
  },
  rowInputSmall: {
    width: 100,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
  confirmedState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 16,
  },
  confirmedReference: {
    fontSize: 15,
    color: Colors.textLight,
    marginTop: 10,
  },
  confirmedStatus: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginTop: 24,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginTop: 14,
  },
  cancelButtonText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 30,
  },
  doneButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ActivityBookingScreen;
