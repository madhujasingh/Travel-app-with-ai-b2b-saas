import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';

const HOLDS_STORAGE_KEY = 'itinera.flightHolds';

// Per TripJack's documented web flow diagram: "Booking Detail should be
// called elapsed 5 seconds" after Book/Confirm-Book - the PNR/ticket may
// not be ready yet if queried immediately.
const BOOKING_DETAILS_DELAY_MS = 5000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadHolds = async () => {
  const raw = await AsyncStorage.getItem(HOLDS_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const saveHold = async (entry) => {
  const holds = await loadHolds();
  const next = holds.filter((h) => h.bookingId !== entry.bookingId);
  next.unshift(entry);
  await AsyncStorage.setItem(HOLDS_STORAGE_KEY, JSON.stringify(next));
};

const buildDefaultTravellers = (passengerCounts) => {
  const travellers = [];
  const counts = passengerCounts || { adults: 1, children: 0, infants: 0 };
  for (let i = 0; i < Number(counts.adults || 0); i += 1) {
    travellers.push({ ti: 'Mr', pt: 'ADULT', fN: '', lN: '', dob: '' });
  }
  for (let i = 0; i < Number(counts.children || 0); i += 1) {
    travellers.push({ ti: 'Master', pt: 'CHILD', fN: '', lN: '', dob: '' });
  }
  for (let i = 0; i < Number(counts.infants || 0); i += 1) {
    travellers.push({ ti: 'Master', pt: 'INFANT', fN: '', lN: '', dob: '' });
  }
  return travellers.length ? travellers : [{ ti: 'Mr', pt: 'ADULT', fN: '', lN: '', dob: '' }];
};

const routeSummary = (flights) => {
  if (!Array.isArray(flights) || !flights.length) return 'Flight';
  return flights.map((leg) => `${leg.from}→${leg.to}`).join(' • ');
};

const FlightBookingScreen = ({ route, navigation }) => {
  const { flights, reviewResponse, passengerCounts, bookingId: resumeBookingId } = route.params || {};
  const isResume = !reviewResponse;

  const conditions = reviewResponse?.conditions || {};
  const totalFare = Number(reviewResponse?.totalPriceInfo?.totalFareDetail?.fC?.TF || 0);

  const [phase, setPhase] = useState(isResume ? 'loading' : 'form');
  const [bookingId, setBookingId] = useState(resumeBookingId || reviewResponse?.bookingId || null);
  const [travellers, setTravellers] = useState(buildDefaultTravellers(passengerCounts));
  const [deliveryEmail, setDeliveryEmail] = useState('test@itinera.com');
  const [deliveryPhone, setDeliveryPhone] = useState('+919500112233');
  const [gstNumber, setGstNumber] = useState('');
  const [gstRegisteredName, setGstRegisteredName] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyEmail, setEmergencyEmail] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [bookingDetails, setBookingDetails] = useState(null);
  const [busy, setBusy] = useState(false);

  const gstRequired = !!conditions?.gst?.igm;
  const emergencyRequired = !!conditions?.iecr;
  const holdAllowed = isResume || conditions?.isBA !== false;

  const fetchBookingDetails = async (id) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/flights/booking-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Unable to fetch booking status right now.');
    }
    return data;
  };

  useEffect(() => {
    if (!isResume) return;
    (async () => {
      try {
        const data = await fetchBookingDetails(resumeBookingId);
        setBookingDetails(data);
        setPhase(data?.order?.status === 'SUCCESS' ? 'confirmed' : 'held');
      } catch (error) {
        Alert.alert('Booking Status', error.message || 'Unable to load this booking.');
        setPhase('held');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTraveller = (index, field, value) => {
    setTravellers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const handleHold = async () => {
    if (!bookingId) return;
    setBusy(true);
    try {
      const body = {
        bookingId,
        travellerInfo: travellers.map((t) => {
          const traveller = { ti: t.ti, pt: t.pt, fN: t.fN, lN: t.lN };
          if (t.dob) traveller.dob = t.dob;
          return traveller;
        }),
        deliveryInfo: {
          emails: [deliveryEmail],
          contacts: [deliveryPhone],
        },
      };

      if (gstRequired || gstNumber) {
        body.gstInfo = {
          gstNumber,
          registeredName: gstRegisteredName,
        };
      }

      if (emergencyRequired || emergencyName) {
        body.contactInfo = {
          emails: [emergencyEmail],
          contacts: [emergencyPhone],
          ecn: emergencyName,
        };
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data?.status?.success === false) {
        throw new Error(data?.message || data?.errors?.[0]?.message || 'Unable to hold this fare right now.');
      }

      await saveHold({
        bookingId,
        summary: routeSummary(flights),
        totalFare,
        createdAt: new Date().toISOString(),
        status: 'ON_HOLD',
      });

      await wait(BOOKING_DETAILS_DELAY_MS);
      const details = await fetchBookingDetails(bookingId);
      setBookingDetails(details);
      setPhase('held');
    } catch (error) {
      Alert.alert('Hold Fare', error.message || 'Unable to hold this fare right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAndPay = async () => {
    if (!bookingId) return;
    setBusy(true);
    setPhase('confirming');
    try {
      const confirmFareResponse = await fetch(`${API_CONFIG.BASE_URL}/flights/confirm-fare-before-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const confirmFareData = await confirmFareResponse.json();
      if (!confirmFareResponse.ok || confirmFareData?.status?.success === false) {
        throw new Error(
          confirmFareData?.message || confirmFareData?.errors?.[0]?.message || 'Fare is no longer available for this held booking.'
        );
      }

      const amount = totalFare || bookingDetails?.order?.amount || 0;
      const confirmBookResponse = await fetch(`${API_CONFIG.BASE_URL}/flights/confirm-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, paymentInfos: [{ amount }] }),
      });
      const confirmBookData = await confirmBookResponse.json();
      if (!confirmBookResponse.ok || confirmBookData?.status?.success === false) {
        throw new Error(
          confirmBookData?.message || confirmBookData?.errors?.[0]?.message || 'Unable to confirm and pay for this booking.'
        );
      }

      await wait(BOOKING_DETAILS_DELAY_MS);
      const details = await fetchBookingDetails(bookingId);
      setBookingDetails(details);
      await saveHold({
        bookingId,
        summary: routeSummary(flights),
        totalFare,
        createdAt: new Date().toISOString(),
        status: details?.order?.status || 'SUCCESS',
      });
      setPhase('confirmed');
    } catch (error) {
      Alert.alert('Confirm & Pay', error.message || 'Unable to confirm and pay for this booking.');
      setPhase('held');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!bookingId) return;
    setBusy(true);
    try {
      const details = await fetchBookingDetails(bookingId);
      setBookingDetails(details);
      if (details?.order?.status === 'SUCCESS') setPhase('confirmed');
    } catch (error) {
      Alert.alert('Booking Status', error.message || 'Unable to refresh booking status.');
    } finally {
      setBusy(false);
    }
  };

  const pnrEntries = Object.entries(bookingDetails?.itemInfos?.AIR?.travellerInfos?.[0]?.pnrDetails || {});
  const ticketEntries = Object.entries(bookingDetails?.itemInfos?.AIR?.travellerInfos?.[0]?.ticketNumberDetails || {});

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sandbox Booking</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sandboxBanner}>
          TripJack UAT sandbox — this creates a real test PNR, not a live customer booking.
        </Text>

        {phase === 'loading' ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : null}

        {phase === 'form' ? (
          <>
            <Text style={styles.sectionTitle}>{routeSummary(flights)}</Text>
            {!holdAllowed ? (
              <Text style={styles.warningText}>
                This fare's conditions say Hold isn't allowed (isBA: false) — Book may fail.
              </Text>
            ) : null}

            {travellers.map((t, index) => (
              <View key={index} style={styles.card}>
                <Text style={styles.cardTitle}>
                  Traveller {index + 1} ({t.pt})
                </Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.inputSmall]}
                    value={t.ti}
                    onChangeText={(v) => updateTraveller(index, 'ti', v)}
                    placeholder="Title"
                  />
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={t.fN}
                    onChangeText={(v) => updateTraveller(index, 'fN', v)}
                    placeholder="First name"
                  />
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={t.lN}
                    onChangeText={(v) => updateTraveller(index, 'lN', v)}
                    placeholder="Last name"
                  />
                </View>
                <TextInput
                  style={styles.input}
                  value={t.dob}
                  onChangeText={(v) => updateTraveller(index, 'dob', v)}
                  placeholder="DOB (YYYY-MM-DD)"
                />
              </View>
            ))}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contact & Delivery</Text>
              <TextInput
                style={styles.input}
                value={deliveryEmail}
                onChangeText={setDeliveryEmail}
                placeholder="Email"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                value={deliveryPhone}
                onChangeText={setDeliveryPhone}
                placeholder="Phone (+countrycode...)"
              />
            </View>

            {gstRequired ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>GST Info (required for this fare)</Text>
                <TextInput
                  style={styles.input}
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  placeholder="GST Number"
                  autoCapitalize="characters"
                />
                <TextInput
                  style={styles.input}
                  value={gstRegisteredName}
                  onChangeText={setGstRegisteredName}
                  placeholder="Registered Name"
                />
              </View>
            ) : null}

            {emergencyRequired ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Emergency Contact (required for this fare)</Text>
                <TextInput
                  style={styles.input}
                  value={emergencyName}
                  onChangeText={setEmergencyName}
                  placeholder="Contact Name"
                />
                <TextInput
                  style={styles.input}
                  value={emergencyEmail}
                  onChangeText={setEmergencyEmail}
                  placeholder="Contact Email"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="Contact Phone"
                />
              </View>
            ) : null}

            <TouchableOpacity style={styles.primaryButton} onPress={handleHold} disabled={busy}>
              <Text style={styles.primaryButtonText}>{busy ? 'Holding…' : 'Hold This Fare (No Payment)'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {phase === 'held' || phase === 'confirming' || phase === 'confirmed' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Booking Status</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Booking ID</Text>
              <Text style={styles.metaValue}>{bookingId}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Order Status</Text>
              <Text style={styles.metaValue}>{bookingDetails?.order?.status || 'ON_HOLD'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Amount</Text>
              <Text style={styles.metaValue}>₹{Math.round(totalFare || bookingDetails?.order?.amount || 0).toLocaleString()}</Text>
            </View>

            {pnrEntries.length ? (
              <>
                <Text style={styles.cardSubtitle}>PNR</Text>
                {pnrEntries.map(([segment, pnr]) => (
                  <Text key={segment} style={styles.metaValue}>
                    {segment}: {pnr}
                  </Text>
                ))}
              </>
            ) : null}

            {ticketEntries.length ? (
              <>
                <Text style={styles.cardSubtitle}>Ticket Number</Text>
                {ticketEntries.map(([segment, ticket]) => (
                  <Text key={segment} style={styles.metaValue}>
                    {segment}: {ticket}
                  </Text>
                ))}
              </>
            ) : null}

            {phase !== 'confirmed' ? (
              <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmAndPay} disabled={busy}>
                <Text style={styles.primaryButtonText}>
                  {phase === 'confirming' ? 'Confirming & Paying…' : 'Confirm & Pay (Sandbox)'}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.successText}>Ticketed — this booking is confirmed in the TripJack sandbox.</Text>
            )}

            <TouchableOpacity style={styles.secondaryButton} onPress={handleRefreshStatus} disabled={busy}>
              <Text style={styles.secondaryButtonText}>Refresh Status</Text>
            </TouchableOpacity>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: Colors.secondary,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sandboxBanner: {
    backgroundColor: Colors.primarySoft,
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  warningText: {
    fontSize: 12,
    color: Colors.error,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 8,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    marginBottom: 8,
  },
  inputSmall: {
    width: 70,
    marginRight: 8,
  },
  inputFlex: {
    flex: 1,
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  successText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
});

export default FlightBookingScreen;
