import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import DatePickerModal from '../components/DatePickerModal';
import { digitsOnly } from '../utils/inputSanitizers';

// tripsafe-api/03-booking-api.txt "List of Nominee Relations"
const NOMINEE_RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'FRIEND', 'GUARDIAN', 'OTHER'];

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Persists this policy against the logged-in user's account (upserted
// server-side by tripjackBookingId - see TripSafeBookingService), same
// pattern as CabBookingScreen's syncCabBooking. Best-effort: a sync hiccup
// shouldn't block the booking flow since the TripJack booking itself
// already succeeded independently.
const syncTripSafeBooking = async (token, entry) => {
  if (!token) return;
  try {
    await fetch(`${API_CONFIG.BASE_URL}/tripsafe-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tripjackBookingId: entry.bookingId,
        planName: entry.planName,
        destinationSummary: entry.destinationSummary,
        amount: entry.amount,
        status: entry.status,
      }),
    });
  } catch (error) {
    // ignored - best-effort sync
  }
};

// Tries the documented itemInfos.INSURANCE wrapper first, then falls back
// to iinfo sitting directly at the root (the same kind of wrapper-skipping
// Review turned out to have) - a real booking confirmed this resolves
// correctly either way. Module-level so it can be used both by the
// component and to derive a resumed policy's display fields before any
// state exists yet.
const getBookedPlan = (details) =>
  details?.itemInfos?.INSURANCE?.iinfo?.pli?.[0] ?? details?.iinfo?.pli?.[0] ?? null;

const TripSafeBookingScreen = ({ route, navigation }) => {
  const { token, user } = useAuth();
  // viewBookingId is set when opened from Profile > Bookings to view an
  // already-completed policy (see CustomerProfileScreen) - in that mode
  // there's no plan/product/fare from a fresh search+review, only the
  // TripJack booking id to fetch and display.
  const { bookingId, plan, product, fare, journeyType, startDate, endDate, travellerAges, viewBookingId } = route.params || {};
  const isViewMode = Boolean(viewBookingId);
  // tripsafe-api/08-student-api-integration.txt - Student bookings need an
  // extra "sc" (student course/sponsor) object per traveller; AMT/Standalone
  // use the same Book payload shape (doc: "no changes required").
  const isStudent = journeyType === 'STUDENT';

  const [booking, setBooking] = useState(null);
  const [loadingResume, setLoadingResume] = useState(isViewMode);

  const bookedProduct = getBookedPlan(booking)?.pi?.[0];
  const planName = product?.pi || product?.pn || bookedProduct?.pi || bookedProduct?.pn || 'Travel Insurance Plan';
  const destinationSummary = product?.rname || bookedProduct?.rname || '';

  const [travellers, setTravellers] = useState(
    (travellerAges || [30]).map((age) => ({
      age,
      dob: '',
      fn: '',
      ln: '',
      eid: user?.email || '',
      pnum: '',
      gen: 'M',
      nomineeName: '',
      nomineeRelation: 'SPOUSE',
      // Student-only fields (tripsafe-api/08-student-api-integration.txt
      // "sc" object) - harmless to keep on every traveller's state, only
      // validated/sent when isStudent.
      courseName: '',
      courseDurationMonths: '',
      universityName: '',
      universityCity: '',
      sponsorName: '',
      sponsorDob: '',
      sponsorRelation: '',
      sponsorEmail: '',
    }))
  );
  const [deliveryEmail, setDeliveryEmail] = useState(user?.email || '');
  const [deliveryPhone, setDeliveryPhone] = useState(
    user?.phone && user.phone !== '0000000000' ? digitsOnly(user.phone).slice(-10) : ''
  );

  const [phase, setPhase] = useState(isViewMode ? 'confirmed' : 'form'); // form | booking | confirmed
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [dobPicker, setDobPicker] = useState({ visible: false, index: null, field: 'dob' });

  const updateTraveller = (index, field, value) => {
    setTravellers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const openDobPicker = (index, field = 'dob') => setDobPicker({ visible: true, index, field });
  const chooseDob = (dateString) => {
    updateTraveller(dobPicker.index, dobPicker.field, dateString);
    setDobPicker({ visible: false, index: null, field: 'dob' });
  };

  const validate = () => {
    if (!deliveryEmail.trim() || !deliveryEmail.includes('@')) {
      return 'Enter a valid delivery email address.';
    }
    // Doc FAQ (tripsafe-api/03-booking-api.txt): only Indian format (+91)
    // contacts are supported - sample payloads pass a bare 10-digit number.
    if (!/^\d{10}$/.test(deliveryPhone.trim())) {
      return 'Enter a valid 10-digit Indian phone number.';
    }
    for (let i = 0; i < travellers.length; i += 1) {
      const t = travellers[i];
      if (!t.dob || !t.fn.trim() || !t.ln.trim() || !t.eid.trim() || !t.pnum.trim()) {
        return `Fill in all required details for Traveller ${i + 1}.`;
      }
      // Doc FAQ: nominee info is MANDATORY - booking fails without it.
      if (!t.nomineeName.trim()) {
        return `Enter a nominee name for Traveller ${i + 1}.`;
      }
      if (
        isStudent &&
        (!t.courseName.trim() ||
          !t.courseDurationMonths.trim() ||
          !t.universityName.trim() ||
          !t.universityCity.trim() ||
          !t.sponsorName.trim() ||
          !t.sponsorDob ||
          !t.sponsorRelation.trim() ||
          !t.sponsorEmail.trim())
      ) {
        return `Fill in all course and sponsor details for Traveller ${i + 1}.`;
      }
    }
    return null;
  };

  const buildBookingPayload = () => ({
    bookingId,
    paymentInfos: [{ paymentMedium: 'WALLET', amount: Number(fare || 0) }],
    pli: [
      {
        plid: plan?.plid,
        pi: [
          {
            pid: product?.pid,
            iti: travellers.map((t, index) => ({
              id: index + 1,
              dob: t.dob,
              age: Number(t.age),
              fn: t.fn.trim(),
              ln: t.ln.trim(),
              eid: t.eid.trim(),
              pnum: t.pnum.trim().toUpperCase(),
              gen: t.gen,
              ni: [{ nn: t.nomineeName.trim(), nr: t.nomineeRelation }],
              // tripsafe-api/08-student-api-integration.txt - confirmed
              // 8-field "sc" object, Student journey only.
              ...(isStudent
                ? {
                    sc: {
                      cn: t.courseName.trim(),
                      cdm: Number(t.courseDurationMonths),
                      un: t.universityName.trim(),
                      uc: t.universityCity.trim(),
                      sn: t.sponsorName.trim(),
                      sdob: t.sponsorDob,
                      sr: t.sponsorRelation.trim(),
                      se: t.sponsorEmail.trim(),
                    },
                  }
                : {}),
            })),
          },
        ],
      },
    ],
    deliveryInfo: {
      emails: [deliveryEmail.trim()],
      contacts: [deliveryPhone.trim()],
    },
  });

  const fetchBookingDetails = async (id) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/tripsafe/booking-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookingId: id }),
    });
    const data = await response.json();
    if (!response.ok || data?.errors) {
      throw new Error(data?.errors?.[0]?.message || data?.message || 'Unable to fetch booking details right now.');
    }
    return data;
  };

  // Opened from Profile > Bookings with only a TripJack booking id - fetch
  // and render it directly instead of starting a fresh search+book flow.
  useEffect(() => {
    if (!isViewMode) return;
    let active = true;
    (async () => {
      try {
        const details = await fetchBookingDetails(viewBookingId);
        if (active) setBooking(details);
      } catch (error) {
        if (active) {
          Alert.alert('Travel Insurance', error.message || 'Unable to load this policy right now.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } finally {
        if (active) setLoadingResume(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewMode, viewBookingId]);

  const handleBookAndPay = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Missing Information', validationError);
      return;
    }
    setBusy(true);
    setPhase('booking');
    try {
      const bookPayload = buildBookingPayload();
      const bookResponse = await fetch(`${API_CONFIG.BASE_URL}/tripsafe/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(bookPayload),
      });
      const bookData = await bookResponse.json();
      if (!bookResponse.ok || bookData?.errors || bookData?.Status === false) {
        const rawMessage = bookData?.errors?.[0]?.message || bookData?.message || '';
        // errCode 2581 "Already order exist with same booking reference"
        // means THIS bookingId already has a real order on TripJack's side
        // from an earlier attempt (e.g. re-tapping Book & Pay after the
        // screen reset but kept the same reviewed bookingId) - the order
        // itself isn't lost, so recover it via Booking-Details instead of
        // just failing.
        if (rawMessage.includes('2581') || rawMessage.includes('Already order exist')) {
          const details = await fetchBookingDetails(bookingId);
          setBooking(details);
          setPhase('confirmed');
          syncTripSafeBooking(token, {
            bookingId,
            planName,
            destinationSummary,
            amount: details?.order?.amount ?? fare,
            status: details?.order?.status || 'SUCCESS',
          });
          return;
        }
        throw new Error(rawMessage || 'Unable to complete this booking right now.');
      }
      const confirmedBookingId = bookData?.bid || bookingId;
      const details = await fetchBookingDetails(confirmedBookingId);
      setBooking(details);
      setPhase('confirmed');
      syncTripSafeBooking(token, {
        bookingId: confirmedBookingId,
        planName,
        destinationSummary,
        amount: details?.order?.amount ?? fare,
        status: details?.order?.status || 'SUCCESS',
      });
    } catch (error) {
      Alert.alert('Travel Insurance Booking', error.message || 'Unable to complete this booking right now.');
      setPhase('form');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshStatus = async () => {
    const id = booking?.order?.bookingId || bookingId;
    if (!id) return;
    setBusy(true);
    try {
      const details = await fetchBookingDetails(id);
      setBooking(details);
      syncTripSafeBooking(token, {
        bookingId: id,
        planName,
        destinationSummary,
        amount: details?.order?.amount ?? fare,
        status: details?.order?.status,
      });
    } catch (error) {
      Alert.alert('Booking Status', error.message || 'Unable to refresh booking status.');
    } finally {
      setBusy(false);
    }
  };

  // The confirmed booking's real plid/pid/traveller-ids (from Booking
  // Details) are what the Amendment APIs need in travellerKeys - not the
  // Review-time values, in case anything shifted during Book.
  const getTravellerKeys = () => {
    const bookedPlan = getBookedPlan(booking);
    const bookedProduct = bookedPlan?.pi?.[0];
    const iti = bookedProduct?.iti || [];
    if (!bookedPlan?.plid || !bookedProduct?.pid || iti.length === 0) return null;
    return {
      [bookedPlan.plid]: {
        [bookedProduct.pid]: iti.map((t) => ({ id: t.id })),
      },
    };
  };

  const previewCancelCharges = () => {
    const id = booking?.order?.bookingId || bookingId;
    const travellerKeys = getTravellerKeys();
    if (!id || !travellerKeys) {
      Alert.alert('Cancellation', 'Booking details are not fully loaded yet - try Refresh Status first.');
      return;
    }
    Alert.alert('Cancel Policy', 'Check the refund amount before cancelling?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, check',
        onPress: async () => {
          setCancelling(true);
          try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/tripsafe/amendment/raise`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ amendmentId: '', bookingId: id, type: 'CANCELLATION', travellerKeys }),
            });
            const data = await response.json();
            if (!response.ok || data?.errors) {
              throw new Error(data?.errors?.[0]?.message || data?.message || 'Unable to fetch cancellation details right now.');
            }
            const amendmentId = data?.amendmentItems?.[0]?.amendmentId;
            // "tmr" (total to be refunded) is a POSITIVE preview amount here;
            // the confirm step returns it negative (see
            // tripsafe-api/06-cancellation-api.txt) - just a sign convention.
            const refundAmount = Math.abs(Number(data?.insuranceCancellationResponse?.tmr || 0));
            setCancelling(false);
            Alert.alert(
              'Confirm Cancellation',
              `Refundable amount: ₹${refundAmount.toLocaleString()}`,
              [
                { text: 'Back', style: 'cancel' },
                { text: 'Proceed', style: 'destructive', onPress: () => submitCancellation(amendmentId, travellerKeys) },
              ]
            );
          } catch (error) {
            setCancelling(false);
            Alert.alert('Cancellation', error.message || 'Unable to fetch cancellation details right now.');
          }
        },
      },
    ]);
  };

  const submitCancellation = async (amendmentId, travellerKeys) => {
    const id = booking?.order?.bookingId || bookingId;
    if (!id || !amendmentId) return;
    setCancelling(true);
    try {
      const cancelPayload = { amendmentId, bookingId: id, type: 'INSURANCE_CANCELLATION', travellerKeys };
      const response = await fetch(`${API_CONFIG.BASE_URL}/tripsafe/amendment/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cancelPayload),
      });
      const data = await response.json();
      if (!response.ok || data?.errors) {
        throw new Error(data?.errors?.[0]?.message || data?.message || 'Unable to cancel this policy right now.');
      }
      // amendmentItems[0].status is the one field the doc's FAQ explicitly
      // documents as the confirmation signal (SUCCESS or REJECTED). A real
      // REJECTED response (2026-09-05) also had a nested per-traveller
      // "status": "CANCELLED" field that looked like a success signature -
      // but Booking-Details doesn't expose any per-traveller status to
      // cross-check against, so that nested field can't actually be
      // verified as ground truth (an earlier fix here trusted it and was
      // wrong to). For anything touching a refund, trust the documented
      // field and report an honest failure rather than guess "success".
      const status = data?.amendmentItems?.[0]?.status;
      if (status !== 'SUCCESS') {
        // Surface both signals so this is diagnosable without reopening
        // debug logging - TripJack's REJECTED here may mean this new
        // product's cancellation flow isn't fully functional yet on this
        // UAT/test-key account (same class of issue as Cabs' vendor/wallet
        // gaps), not necessarily a bug in this app.
        const nestedStatus = data?.insuranceCancellationResponse?.iif?.pli?.[0]?.pi?.[0]?.iti?.[0]?.status;
        throw new Error(
          `TripJack did not confirm this cancellation (status: ${status || 'unknown'}` +
            `${nestedStatus ? `, traveller record shows "${nestedStatus}"` : ''}). ` +
            'This may mean cancellation isn\'t fully enabled yet for this account - check with TripJack if it persists.'
        );
      }
      setCancelled(true);
      const refundAmount = Math.abs(Number(data?.insuranceCancellationResponse?.tmr || 0));
      syncTripSafeBooking(token, {
        bookingId: id,
        planName,
        destinationSummary,
        amount: booking?.order?.amount ?? fare,
        status: 'CANCELLED',
      });
      Alert.alert('Cancellation Successful', `Refunded: ₹${refundAmount.toLocaleString()}`, [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error) {
      Alert.alert('Cancellation', error.message || 'Unable to cancel this policy right now.');
      // Refresh regardless of outcome - if TripJack's async processing (the
      // same asynchronous-after-the-fact pattern seen with Cabs) actually
      // does cancel it a moment later, the next status check should reflect
      // that instead of staying stuck on stale data.
      try {
        const refreshed = await fetchBookingDetails(id);
        setBooking(refreshed);
      } catch (refreshError) {
        // ignore - not worth a second alert on top of the one above
      }
    } finally {
      setCancelling(false);
    }
  };

  const order = booking?.order;
  const isCancelled = cancelled || order?.status === 'CANCELLED';
  const isFailed = order?.status === 'FAILED';
  const canCancel = !isCancelled && !isFailed;
  const confirmedTravellers = getBookedPlan(booking)?.pi?.[0]?.iti || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (phase === 'confirmed' ? navigation.popToTop() : navigation.goBack())}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{phase === 'form' ? 'Traveller Details' : 'Your Policy'}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {phase === 'form' ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryPlan}>{planName}</Text>
              <Text style={styles.summaryRoute} numberOfLines={2}>
                {destinationSummary} · {formatDisplayDate(startDate)} to {formatDisplayDate(endDate)}
              </Text>
              {fare != null ? <Text style={styles.summaryFare}>₹{Number(fare).toLocaleString()}</Text> : null}
            </View>

            {travellers.map((t, index) => (
              <View key={index} style={styles.card}>
                <Text style={styles.cardTitle}>Traveller {index + 1} (Age {t.age})</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={t.fn}
                    onChangeText={(v) => updateTraveller(index, 'fn', v)}
                    placeholder="First name"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={t.ln}
                    onChangeText={(v) => updateTraveller(index, 'ln', v)}
                    placeholder="Last name"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <TouchableOpacity style={styles.inputWithIcon} onPress={() => openDobPicker(index)}>
                  <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
                  <Text style={[styles.inputIconText, t.dob ? styles.pickerText : styles.pickerPlaceholder]}>
                    {t.dob ? formatDisplayDate(t.dob) : 'Date of birth'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  value={t.eid}
                  onChangeText={(v) => updateTraveller(index, 'eid', v)}
                  placeholder="Email"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.input}
                  value={t.pnum}
                  onChangeText={(v) => updateTraveller(index, 'pnum', v)}
                  placeholder="Passport number"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                />
                <View style={styles.chipRow}>
                  {['M', 'F'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, t.gen === g && styles.chipActive]}
                      onPress={() => updateTraveller(index, 'gen', g)}
                    >
                      <Text style={[styles.chipText, t.gen === g && styles.chipTextActive]}>
                        {g === 'M' ? 'Male' : 'Female'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.nomineeLabel}>Nominee (required)</Text>
                <TextInput
                  style={styles.input}
                  value={t.nomineeName}
                  onChangeText={(v) => updateTraveller(index, 'nomineeName', v)}
                  placeholder="Nominee name"
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.chipRow}>
                  {NOMINEE_RELATIONS.map((relation) => (
                    <TouchableOpacity
                      key={relation}
                      style={[styles.chip, t.nomineeRelation === relation && styles.chipActive]}
                      onPress={() => updateTraveller(index, 'nomineeRelation', relation)}
                    >
                      <Text style={[styles.chipText, t.nomineeRelation === relation && styles.chipTextActive]}>
                        {relation}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {isStudent ? (
                  <>
                    <Text style={styles.nomineeLabel}>Course & Sponsor Details (required)</Text>
                    <TextInput
                      style={styles.input}
                      value={t.courseName}
                      onChangeText={(v) => updateTraveller(index, 'courseName', v)}
                      placeholder="Course name (e.g. Computer Science)"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <TextInput
                      style={styles.input}
                      value={t.courseDurationMonths}
                      onChangeText={(v) => updateTraveller(index, 'courseDurationMonths', digitsOnly(v))}
                      placeholder="Course duration (months)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                    />
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        value={t.universityName}
                        onChangeText={(v) => updateTraveller(index, 'universityName', v)}
                        placeholder="University name"
                        placeholderTextColor={Colors.textMuted}
                      />
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        value={t.universityCity}
                        onChangeText={(v) => updateTraveller(index, 'universityCity', v)}
                        placeholder="University city"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      value={t.sponsorName}
                      onChangeText={(v) => updateTraveller(index, 'sponsorName', v)}
                      placeholder="Sponsor name"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <TouchableOpacity style={styles.inputWithIcon} onPress={() => openDobPicker(index, 'sponsorDob')}>
                      <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
                      <Text style={[styles.inputIconText, t.sponsorDob ? styles.pickerText : styles.pickerPlaceholder]}>
                        {t.sponsorDob ? formatDisplayDate(t.sponsorDob) : 'Sponsor date of birth'}
                      </Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.input}
                      value={t.sponsorRelation}
                      onChangeText={(v) => updateTraveller(index, 'sponsorRelation', v)}
                      placeholder="Sponsor relation (e.g. Parent, Legal Heir)"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <TextInput
                      style={styles.input}
                      value={t.sponsorEmail}
                      onChangeText={(v) => updateTraveller(index, 'sponsorEmail', v)}
                      placeholder="Sponsor email"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </>
                ) : null}
              </View>
            ))}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Delivery Details</Text>
              <TextInput
                style={styles.input}
                value={deliveryEmail}
                onChangeText={setDeliveryEmail}
                placeholder="Delivery email"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                value={deliveryPhone}
                onChangeText={(v) => setDeliveryPhone(digitsOnly(v).slice(0, 10))}
                placeholder="10-digit phone number"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleBookAndPay} disabled={busy}>
              <Text style={styles.primaryButtonText}>
                Book & Pay {fare != null ? `₹${Number(fare).toLocaleString()}` : ''}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        {phase === 'booking' ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Confirming your policy...</Text>
          </View>
        ) : null}

        {phase === 'confirmed' && loadingResume ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading your policy...</Text>
          </View>
        ) : null}

        {phase === 'confirmed' && !loadingResume ? (
          <>
            <View
              style={[
                styles.statusHeaderCard,
                isCancelled || isFailed ? styles.statusHeaderCancelled : styles.statusHeaderConfirmed,
              ]}
            >
              <Ionicons
                name={isCancelled ? 'close-circle' : isFailed ? 'alert-circle' : 'checkmark-circle'}
                size={30}
                color={isCancelled || isFailed ? Colors.error : Colors.success}
              />
              <Text style={styles.statusHeaderTitle}>
                {isCancelled ? 'Policy Cancelled' : isFailed ? 'Booking Failed' : 'Policy Issued'}
              </Text>
              <Text style={styles.statusHeaderSubtitle}>
                {isCancelled
                  ? 'This policy has been cancelled.'
                  : isFailed
                  ? 'This booking could not be completed.'
                  : 'Your policy documents will be sent to your delivery email.'}
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
                <Text style={styles.metaValueAccent}>₹{Number(order?.amount ?? fare ?? 0).toLocaleString()}</Text>
              </View>
              {confirmedTravellers.map((t, index) => (
                t.policyId ? (
                  <View key={index} style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Policy ID (Traveller {index + 1})</Text>
                    <Text style={styles.metaValue}>{t.policyId}</Text>
                  </View>
                ) : null
              ))}
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleRefreshStatus} disabled={busy}>
              <Ionicons name="refresh" size={15} color={Colors.primaryDark} />
              <Text style={styles.secondaryButtonText}>Refresh Status</Text>
            </TouchableOpacity>

            {canCancel ? (
              <TouchableOpacity style={styles.dangerButton} onPress={previewCancelCharges} disabled={cancelling}>
                {cancelling ? (
                  <ActivityIndicator color={Colors.error} />
                ) : (
                  <Text style={styles.dangerButtonText}>Cancel Policy</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <DatePickerModal
        visible={dobPicker.visible}
        title={dobPicker.field === 'sponsorDob' ? 'Sponsor Date of Birth' : 'Date of Birth'}
        maxDate={new Date()}
        onSelect={chooseDob}
        onClose={() => setDobPicker({ visible: false, index: null, field: 'dob' })}
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
  summaryPlan: {
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
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: Colors.background,
  },
  inputIconText: {
    flex: 1,
    fontSize: 14,
  },
  pickerText: {
    color: Colors.text,
  },
  pickerPlaceholder: {
    color: Colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.secondary,
  },
  nomineeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 6,
    marginBottom: 6,
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

export default TripSafeBookingScreen;
