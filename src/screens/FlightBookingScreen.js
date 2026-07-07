import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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
import DatePickerModal from '../components/DatePickerModal';

const TITLES_BY_PAX_TYPE = {
  ADULT: ['Mr', 'Mrs', 'Ms'],
  CHILD: ['Ms', 'Master'],
  INFANT: ['Ms', 'Master'],
};

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

const emptyTraveller = (ti, pt) => ({
  ti,
  pt,
  fN: '',
  lN: '',
  dob: '',
  pNum: '',
  eD: '',
  pNat: '',
  pid: '',
});

const buildDefaultTravellers = (passengerCounts) => {
  const travellers = [];
  const counts = passengerCounts || { adults: 1, children: 0, infants: 0 };
  for (let i = 0; i < Number(counts.adults || 0); i += 1) {
    travellers.push(emptyTraveller('Mr', 'ADULT'));
  }
  for (let i = 0; i < Number(counts.children || 0); i += 1) {
    travellers.push(emptyTraveller('Master', 'CHILD'));
  }
  for (let i = 0; i < Number(counts.infants || 0); i += 1) {
    travellers.push(emptyTraveller('Master', 'INFANT'));
  }
  return travellers.length ? travellers : [emptyTraveller('Mr', 'ADULT')];
};

// SSR (Special Service Request) options for Baggage/Meal live per-segment under
// AirReviewResponse -> tripInfos[].sI[].ssrInfo - only surface segments that
// actually have BAGGAGE or MEAL options (SEAT is handled by the separate Seat
// Map feature, not here).
const getSsrSegments = (reviewResponse) => {
  const trips = Array.isArray(reviewResponse?.tripInfos) ? reviewResponse.tripInfos : [];
  const segments = [];
  trips.forEach((trip) => {
    (trip?.sI || []).forEach((segment) => {
      const baggageOptions = segment?.ssrInfo?.BAGGAGE || [];
      const mealOptions = segment?.ssrInfo?.MEAL || [];
      if (baggageOptions.length || mealOptions.length) {
        segments.push({
          id: segment?.id,
          label: `${segment?.da?.code || '--'} → ${segment?.aa?.code || '--'}`,
          baggageOptions,
          mealOptions,
        });
      }
    });
  });
  return segments;
};

const routeSummary = (flights) => {
  if (!Array.isArray(flights) || !flights.length) return 'Flight';
  return flights.map((leg) => `${leg.from}→${leg.to}`).join(' • ');
};

// Friendlier text for TripJack's documented error codes (error-codes/errorcodes.pdf)
// that can realistically occur in the Book / Confirm-Fare-Before-Ticket /
// Confirm-Book flow - keyed by errCode as a string.
const TRIPJACK_ERROR_MESSAGES = {
  1000: 'This flight is no longer available. Please search again for a fresh fare.',
  1001: 'The number of infants can\'t be greater than the number of adults.',
  1002: 'The number of children can\'t be greater than the number of adults.',
  1006: 'A booking can have at most 9 passengers.',
  1007: 'Each traveller\'s first name is required and can\'t contain spaces.',
  1008: 'Each traveller\'s last name is required and must contain only letters and spaces.',
  1009: 'No fare was selected - please go back and review a fare first.',
  1010: 'Two travellers can\'t have the exact same name.',
  1012: 'Each adult traveller must be 12-100 years old as of the travel date.',
  1013: 'Each child traveller must be 2-12 years old as of the travel date.',
  1014: 'Each infant traveller must be 0-2 years old as of the travel date.',
  1015: 'The payment amount doesn\'t match this booking\'s total - please refresh and try again.',
  1051: 'Date of birth is required for the adult traveller(s).',
  1052: 'Date of birth is required for the child traveller(s).',
  1053: 'Date of birth is required for the infant traveller(s).',
  1057: 'This booking couldn\'t be found - it may have expired or the ID is incorrect.',
  1059: 'Your hold has expired. Please search again to get a fresh fare and start a new hold.',
  1064: 'A passport number is required for this fare.',
  1065: 'A valid passport issue date is required for this fare.',
  1066: 'A valid passport expiry date is required for this fare.',
  1067: 'The passport must not expire within 6 months of the travel date.',
  1068: 'The travel date can\'t be before the passport issue date.',
  1071: 'This fare is no longer available. Please search again for a fresh fare.',
  805: 'The GST number must be exactly 15 characters and a valid format.',
  806: 'The email or mobile number provided is invalid.',
  2560: 'Emergency contact email, phone, and name are all required for this fare.',
  2561: 'Emergency contact name can\'t be blank for this fare.',
  1119: 'Child or infant travellers can\'t be included in a student fare booking.',
  1120: 'Child or infant travellers can\'t be included in a senior citizen fare booking.',
  2567: 'A document ID is required in the passenger details for this fare.',
  2568: 'The document ID can\'t contain special characters.',
  2569: 'For a senior citizen fare, the traveller must be over 60 on the date of departure.',
};

// Codes where the underlying fare/hold/booking is dead - there's nothing to
// retry on this screen, the user needs to go back and search again.
const SESSION_DEAD_ERROR_CODES = new Set([1000, 1057, 1059, 1071]);

// TripJack errors sometimes come back as a direct passthrough
// ({status, errors:[{errCode, message}]}) and sometimes wrapped by our own
// GlobalExceptionHandler ({message: "TripJack request failed with status
// 400: {...raw body...}"}) - handle both shapes rather than assuming one.
const parseTripJackError = (data, fallback) => {
  let errCode = data?.errors?.[0]?.errCode;
  let message = data?.errors?.[0]?.message || data?.message;

  if (!errCode && typeof data?.message === 'string') {
    const codeMatch = data.message.match(/"errCode"\s*:\s*"?(\d+)"?/);
    const messageMatch = data.message.match(/"message"\s*:\s*"([^"]+)"/);
    if (codeMatch) errCode = codeMatch[1];
    if (messageMatch) message = messageMatch[1];
  }

  const code = errCode ? Number(errCode) : null;
  const friendly = code && TRIPJACK_ERROR_MESSAGES[code];

  return {
    code,
    message: friendly || message || fallback,
    sessionDead: code ? SESSION_DEAD_ERROR_CODES.has(code) : false,
  };
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
  const [gstEmail, setGstEmail] = useState('');
  const [gstMobile, setGstMobile] = useState('');
  const [gstAddress, setGstAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyEmail, setEmergencyEmail] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [ssrSelections, setSsrSelections] = useState({});
  const [titlePicker, setTitlePicker] = useState({ visible: false, travellerIndex: null });
  const [datePicker, setDatePicker] = useState({ visible: false, travellerIndex: null, field: null });
  const [bookingDetails, setBookingDetails] = useState(null);
  const [busy, setBusy] = useState(false);

  const gstRequired = !!conditions?.gst?.igm;
  const gstOptional = !gstRequired && !!conditions?.gst?.gstappl;
  const emergencyRequired = !!conditions?.iecr;
  const passportRequired = !!conditions?.pcs?.pm;
  const holdAllowed = isResume || conditions?.isBA !== false;
  const ssrSegments = getSsrSegments(reviewResponse);

  const setSsrChoice = (segmentId, type, code) => {
    setSsrSelections((prev) => {
      const current = prev[segmentId] || {};
      const next = current[type] === code ? undefined : code;
      return {
        ...prev,
        [segmentId]: { ...current, [type]: next },
      };
    });
  };

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

  const openTitlePicker = (travellerIndex) => setTitlePicker({ visible: true, travellerIndex });
  const closeTitlePicker = () => setTitlePicker({ visible: false, travellerIndex: null });
  const chooseTitle = (title) => {
    if (titlePicker.travellerIndex != null) {
      updateTraveller(titlePicker.travellerIndex, 'ti', title);
    }
    closeTitlePicker();
  };

  const openDatePicker = (travellerIndex, field) => setDatePicker({ visible: true, travellerIndex, field });
  const closeDatePicker = () => setDatePicker({ visible: false, travellerIndex: null, field: null });
  const chooseDate = (dateString) => {
    if (datePicker.travellerIndex != null && datePicker.field) {
      updateTraveller(datePicker.travellerIndex, datePicker.field, dateString);
    }
    closeDatePicker();
  };

  const parseDateValue = (value) => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const showTripJackErrorAlert = (title, error) => {
    const message = error?.message || 'Something went wrong - please try again.';
    if (error?.sessionDead) {
      Alert.alert(title, message, [
        { text: 'Search Again', onPress: () => navigation.goBack() },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(title, message);
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
          if (passportRequired || t.pNum) {
            traveller.pNum = t.pNum;
            traveller.eD = t.eD;
            traveller.pNat = t.pNat;
            traveller.pid = t.pid;
          }
          return traveller;
        }),
        deliveryInfo: {
          emails: [deliveryEmail],
          contacts: [deliveryPhone],
        },
      };

      // Per the FAQ: "all fields are mandatory, whenever passing gst fields" -
      // send the full set together, never just gstNumber/registeredName alone.
      if (gstRequired || gstOptional || gstNumber) {
        body.gstInfo = {
          gstNumber,
          registeredName: gstRegisteredName,
          mobile: gstMobile,
          email: gstEmail,
          address: gstAddress,
        };
      }

      if (emergencyRequired || emergencyName) {
        body.contactInfo = {
          emails: [emergencyEmail],
          contacts: [emergencyPhone],
          ecn: emergencyName,
        };
      }

      const ssrBaggageInfos = Object.entries(ssrSelections)
        .filter(([, sel]) => sel?.baggage)
        .map(([key, sel]) => ({ key, code: sel.baggage }));
      const ssrMealInfos = Object.entries(ssrSelections)
        .filter(([, sel]) => sel?.meal)
        .map(([key, sel]) => ({ key, code: sel.meal }));
      if (ssrBaggageInfos.length) body.ssrBaggageInfos = ssrBaggageInfos;
      if (ssrMealInfos.length) body.ssrMealInfos = ssrMealInfos;

      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data?.status?.success === false) {
        throw parseTripJackError(data, 'Unable to hold this fare right now.');
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
      showTripJackErrorAlert('Hold Fare', error);
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
        throw parseTripJackError(confirmFareData, 'Fare is no longer available for this held booking.');
      }

      const amount = totalFare || bookingDetails?.order?.amount || 0;
      const confirmBookResponse = await fetch(`${API_CONFIG.BASE_URL}/flights/confirm-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, paymentInfos: [{ amount }] }),
      });
      const confirmBookData = await confirmBookResponse.json();
      if (!confirmBookResponse.ok || confirmBookData?.status?.success === false) {
        throw parseTripJackError(confirmBookData, 'Unable to confirm and pay for this booking.');
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
      showTripJackErrorAlert('Confirm & Pay', error);
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

  // Once a Hold/booking actually exists, there's nothing left to "go back" to
  // edit on this screen (the form's already been submitted) - send the user
  // to the list where this booking now lives, instead of back to search.
  const handleBack = () => {
    if (phase === 'held' || phase === 'confirming' || phase === 'confirmed') {
      navigation.replace('MyFlightBookings');
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
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
                  <Pressable
                    style={[styles.input, styles.inputSmall, styles.titleSelect]}
                    onPress={() => openTitlePicker(index)}
                  >
                    <Text style={t.ti ? styles.selectValueText : styles.selectPlaceholderText}>
                      {t.ti || 'Title'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
                  </Pressable>
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
                <Pressable style={[styles.input, styles.selectRow]} onPress={() => openDatePicker(index, 'dob')}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                  <Text style={t.dob ? styles.selectValueText : styles.selectPlaceholderText}>
                    {t.dob || 'Date of Birth'}
                  </Text>
                </Pressable>
                {passportRequired ? (
                  <>
                    <Text style={styles.cardSubtitle}>Passport (required for this fare)</Text>
                    <TextInput
                      style={styles.input}
                      value={t.pNum}
                      onChangeText={(v) => updateTraveller(index, 'pNum', v)}
                      placeholder="Passport Number"
                      autoCapitalize="characters"
                    />
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        value={t.pNat}
                        onChangeText={(v) => updateTraveller(index, 'pNat', v)}
                        placeholder="Nationality (e.g. IN)"
                        autoCapitalize="characters"
                      />
                      <Pressable
                        style={[styles.input, styles.inputFlex, styles.selectRow]}
                        onPress={() => openDatePicker(index, 'pid')}
                      >
                        <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                        <Text style={t.pid ? styles.selectValueText : styles.selectPlaceholderText}>
                          {t.pid || 'Issue Date'}
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable style={[styles.input, styles.selectRow]} onPress={() => openDatePicker(index, 'eD')}>
                      <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                      <Text style={t.eD ? styles.selectValueText : styles.selectPlaceholderText}>
                        {t.eD || 'Expiry Date'}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
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

            {gstRequired || gstOptional ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  GST Info {gstRequired ? '(required for this fare)' : '(optional for this fare)'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  placeholder="GST Number (15 characters)"
                  autoCapitalize="characters"
                />
                <TextInput
                  style={styles.input}
                  value={gstRegisteredName}
                  onChangeText={setGstRegisteredName}
                  placeholder="Registered Name"
                />
                <TextInput
                  style={styles.input}
                  value={gstMobile}
                  onChangeText={setGstMobile}
                  placeholder="GST Mobile"
                />
                <TextInput
                  style={styles.input}
                  value={gstEmail}
                  onChangeText={setGstEmail}
                  placeholder="GST Email"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  value={gstAddress}
                  onChangeText={setGstAddress}
                  placeholder="GST Address"
                />
                <Text style={styles.hintText}>
                  All GST fields are required together if you fill any of them in.
                </Text>
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

            {ssrSegments.map((segment) => (
              <View key={segment.id} style={styles.card}>
                <Text style={styles.cardTitle}>Baggage &amp; Meal (Optional) — {segment.label}</Text>
                {segment.baggageOptions.length ? (
                  <>
                    <Text style={styles.cardSubtitle}>Baggage</Text>
                    <View style={styles.chipRow}>
                      {segment.baggageOptions.map((option) => {
                        const selected = ssrSelections[segment.id]?.baggage === option.code;
                        return (
                          <TouchableOpacity
                            key={option.code}
                            style={[styles.ssrChip, selected ? styles.ssrChipSelected : null]}
                            onPress={() => setSsrChoice(segment.id, 'baggage', option.code)}
                          >
                            <Text style={[styles.ssrChipText, selected ? styles.ssrChipTextSelected : null]}>
                              {option.desc} {Number(option.amount) > 0 ? `(+₹${option.amount})` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                {segment.mealOptions.length ? (
                  <>
                    <Text style={styles.cardSubtitle}>Meal</Text>
                    <View style={styles.chipRow}>
                      {segment.mealOptions.map((option) => {
                        const selected = ssrSelections[segment.id]?.meal === option.code;
                        return (
                          <TouchableOpacity
                            key={option.code}
                            style={[styles.ssrChip, selected ? styles.ssrChipSelected : null]}
                            onPress={() => setSsrChoice(segment.id, 'meal', option.code)}
                          >
                            <Text style={[styles.ssrChipText, selected ? styles.ssrChipTextSelected : null]}>
                              {option.desc} {Number(option.amount) > 0 ? `(+₹${option.amount})` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </View>
            ))}

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

      <Modal visible={titlePicker.visible} transparent animationType="fade" onRequestClose={closeTitlePicker}>
        <Pressable style={styles.pickerOverlay} onPress={closeTitlePicker}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Select Title</Text>
            {(TITLES_BY_PAX_TYPE[travellers[titlePicker.travellerIndex]?.pt] || TITLES_BY_PAX_TYPE.ADULT).map((title) => (
              <TouchableOpacity key={title} style={styles.pickerOption} onPress={() => chooseTitle(title)}>
                <Text style={styles.pickerOptionText}>{title}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <DatePickerModal
        visible={datePicker.visible}
        title={
          datePicker.field === 'dob' ? 'Date of Birth' : datePicker.field === 'pid' ? 'Passport Issue Date' : 'Passport Expiry Date'
        }
        initialDate={parseDateValue(
          datePicker.travellerIndex != null ? travellers[datePicker.travellerIndex]?.[datePicker.field] : null
        )}
        maxDate={datePicker.field === 'eD' ? undefined : new Date()}
        minDate={datePicker.field === 'eD' ? new Date() : undefined}
        onSelect={chooseDate}
        onClose={closeDatePicker}
      />
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
  hintText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  ssrChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  ssrChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  ssrChipText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  ssrChipTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
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
  titleSelect: {
    width: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectValueText: {
    fontSize: 13,
    color: Colors.text,
  },
  selectPlaceholderText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 34, 0.45)',
    justifyContent: 'center',
    padding: 30,
  },
  pickerSheet: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  pickerOption: {
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pickerOptionText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600',
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
