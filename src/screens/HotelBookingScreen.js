import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { fetchHotelJson } from '../utils/hotelApiErrors';

const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Master'];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Doc: "Poll Booking Details every 5 seconds until a terminal status is
// returned or 180 seconds elapses."
const BOOKING_POLL_INTERVAL_MS = 5000;
const MAX_BOOKING_POLL_ATTEMPTS = 36;
const TERMINAL_STATUSES = new Set(['SUCCESS', 'ON_HOLD', 'ABORTED', 'FAILED', 'CANCELLED']);

// Doc: CANCELLATION_PENDING is a distinct "Post-Booking" state, not
// Terminal - "TripJack Ops handles offline. Poll once daily." The 5s/180s
// loop above is the wrong strategy for it, so it's tracked separately: stop
// the aggressive polling immediately rather than burning all 36 attempts in
// 3 minutes for a status that can take a day to resolve.
const SLOW_POLL_STATUS = 'CANCELLATION_PENDING';

const buildInitialTravelers = (rooms) => {
  return (rooms || []).map((room) => {
    const travelers = [];
    for (let i = 0; i < room.adults; i++) {
      travelers.push({ ti: i === 0 ? 'Mr' : 'Mrs', pt: 'ADULT', fN: '', lN: '', pan: '', pNum: '' });
    }
    (room.childAge || []).forEach(() => {
      travelers.push({ ti: 'Master', pt: 'CHILD', fN: '', lN: '', pan: '', pNum: '' });
    });
    return travelers;
  });
};

const HotelBookingScreen = ({ route, navigation }) => {
  const { hotelName, searchContext, reviewResult } = route.params;
  const option = reviewResult.option;
  const panRequired = Boolean(option?.compliance?.panRequired);
  const passportRequired = Boolean(option?.compliance?.passportRequired);
  const gstType = option?.compliance?.gstType;
  const needsGst = gstType === 'PASSTHROUGH' || gstType === 'RESELLER';

  const [travelers, setTravelers] = useState(() => buildInitialTravelers(searchContext.rooms));
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [gstNumber, setGstNumber] = useState('');
  const [gstRegisteredName, setGstRegisteredName] = useState('');
  const [bookingMode, setBookingMode] = useState('HOLD');

  const [submitting, setSubmitting] = useState(false);
  const [bookResponse, setBookResponse] = useState(null);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [polling, setPolling] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const updateTraveler = (roomIndex, travelerIndex, field, value) => {
    setTravelers((current) =>
      current.map((room, rIndex) =>
        rIndex !== roomIndex
          ? room
          : room.map((traveler, tIndex) => (tIndex !== travelerIndex ? traveler : { ...traveler, [field]: value }))
      )
    );
  };

  const validate = () => {
    for (const room of travelers) {
      for (const traveler of room) {
        if (!traveler.fN.trim() || !traveler.lN.trim()) {
          return 'Enter a first and last name for every traveller.';
        }
        if (panRequired && !traveler.pan.trim()) {
          return 'PAN is required for every traveller on this rate.';
        }
        if (passportRequired && !traveler.pNum.trim()) {
          return 'Passport number is required for every traveller on this rate.';
        }
      }
    }

    const leadNames = travelers.map((room) => `${room[0]?.fN.trim().toLowerCase()} ${room[0]?.lN.trim().toLowerCase()}`);
    if (new Set(leadNames).size !== leadNames.length) {
      return 'The lead traveller name must be unique across rooms.';
    }

    if (!email.trim() || !email.includes('@')) {
      return 'Enter a valid email address for booking confirmation.';
    }
    if (!contact.trim()) {
      return 'Enter a contact phone number.';
    }
    if (!countryCode.trim()) {
      return 'Enter a country dialing code (e.g. +91).';
    }
    if (needsGst && !gstNumber.trim()) {
      return 'This rate requires GST details - enter a GST number.';
    }
    return null;
  };

  const buildBookPayload = () => {
    const roomTravellerInfo = travelers.map((roomTravelers) => ({
      travellerInfo: roomTravelers.map((traveler) => {
        const entry = {
          ti: traveler.ti,
          pt: traveler.pt,
          fN: traveler.fN.trim(),
          lN: traveler.lN.trim(),
        };
        if (panRequired) entry.pan = traveler.pan.trim();
        if (passportRequired) entry.pNum = traveler.pNum.trim();
        return entry;
      }),
    }));

    const payload = {
      bookingId: reviewResult.bookingId,
      roomTravellerInfo,
      deliveryInfo: {
        emails: [email.trim()],
        contacts: [contact.trim()],
        code: [countryCode.trim()],
      },
      type: 'HOTEL',
    };

    if (needsGst) {
      payload.gstInfo = { gstNumber: gstNumber.trim(), registeredName: gstRegisteredName.trim() };
    }

    if (bookingMode === 'INSTANT') {
      payload.paymentInfos = [{ amount: Number(option?.pricing?.totalPrice || 0) }];
    }

    return payload;
  };

  const submitBooking = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Check the form', validationError);
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildBookPayload();
      console.log('[hotel book] REQUEST', JSON.stringify(payload));
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/book`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Unable to submit this booking right now.'
      );
      console.log('[hotel book] RESPONSE', JSON.stringify(data));

      setBookResponse(data);
      pollBookingStatus(data.bookingId || reviewResult.bookingId, 1);
    } catch (err) {
      Alert.alert('Booking', err.message || 'Unable to submit this booking right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const pollBookingStatus = async (bookingId, attempt) => {
    setPolling(true);
    try {
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/booking-details`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        },
        'Unable to check booking status.'
      );

      setBookingDetails(data);
      const status = data?.order?.status;

      const shouldKeepPolling =
        !TERMINAL_STATUSES.has(status) && status !== SLOW_POLL_STATUS && attempt < MAX_BOOKING_POLL_ATTEMPTS;
      if (shouldKeepPolling) {
        await wait(BOOKING_POLL_INTERVAL_MS);
        return pollBookingStatus(bookingId, attempt + 1);
      }
      setPolling(false);
    } catch (err) {
      setPolling(false);
      Alert.alert('Booking Status', err.message || 'Unable to check booking status.');
    }
  };

  const cancelBooking = () => {
    const bookingId = bookingDetails?.order?.bookingId || bookResponse?.bookingId || reviewResult.bookingId;

    Alert.alert('Cancel booking', 'Cancellation charges from the policy will apply. Continue?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setCancelling(true);
            await fetchHotelJson(
              `${API_CONFIG.BASE_URL}/hotels/cancel-booking/${bookingId}`,
              { method: 'POST' },
              'Unable to cancel this booking.'
            );
            Alert.alert('Cancellation requested', 'Checking the latest status now.');
            pollBookingStatus(bookingId, 1);
          } catch (err) {
            Alert.alert('Cancel Booking', err.message || 'Unable to cancel this booking.');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const status = bookingDetails?.order?.status;
  const isSlowPending = status === SLOW_POLL_STATUS;
  const isTerminal = status ? TERMINAL_STATUSES.has(status) : false;
  const canCancel = status === 'SUCCESS' || status === 'ON_HOLD';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {hotelName}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryStay}>
            {searchContext.checkIn} → {searchContext.checkOut}
          </Text>
          <Text style={styles.summaryMeal}>{option?.mealBasis}</Text>
          <Text style={styles.summaryTotal}>
            {option?.pricing?.currency} {Number(option?.pricing?.totalPrice || 0).toLocaleString()}
          </Text>
        </View>

        {!bookResponse && (
          <>
            {travelers.map((room, roomIndex) => (
              <View key={roomIndex} style={styles.formCard}>
                <Text style={styles.sectionLabel}>Room {roomIndex + 1} travellers</Text>
                {room.map((traveler, travelerIndex) => (
                  <View key={travelerIndex} style={styles.travelerBlock}>
                    <Text style={styles.travelerLabel}>
                      {traveler.pt === 'ADULT' ? 'Adult' : 'Child'} {travelerIndex + 1}
                    </Text>
                    <View style={styles.titleRow}>
                      {TITLES.map((title) => (
                        <TouchableOpacity
                          key={title}
                          style={[styles.titleChip, traveler.ti === title && styles.titleChipActive]}
                          onPress={() => updateTraveler(roomIndex, travelerIndex, 'ti', title)}
                        >
                          <Text style={[styles.titleChipText, traveler.ti === title && styles.titleChipTextActive]}>
                            {title}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.nameRow}>
                      <TextInput
                        style={[styles.input, styles.nameInput]}
                        placeholder="First name"
                        placeholderTextColor={Colors.textMuted}
                        value={traveler.fN}
                        onChangeText={(value) => updateTraveler(roomIndex, travelerIndex, 'fN', value)}
                      />
                      <TextInput
                        style={[styles.input, styles.nameInput]}
                        placeholder="Last name"
                        placeholderTextColor={Colors.textMuted}
                        value={traveler.lN}
                        onChangeText={(value) => updateTraveler(roomIndex, travelerIndex, 'lN', value)}
                      />
                    </View>
                    {panRequired && (
                      <TextInput
                        style={styles.input}
                        placeholder="PAN number"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="characters"
                        value={traveler.pan}
                        onChangeText={(value) => updateTraveler(roomIndex, travelerIndex, 'pan', value)}
                      />
                    )}
                    {passportRequired && (
                      <TextInput
                        style={styles.input}
                        placeholder="Passport number"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="characters"
                        value={traveler.pNum}
                        onChangeText={(value) => updateTraveler(roomIndex, travelerIndex, 'pNum', value)}
                      />
                    )}
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.formCard}>
              <Text style={styles.sectionLabel}>Booking confirmation details</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <View style={styles.nameRow}>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="+91"
                  placeholderTextColor={Colors.textMuted}
                  value={countryCode}
                  onChangeText={setCountryCode}
                />
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  placeholder="Contact number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  value={contact}
                  onChangeText={setContact}
                />
              </View>

              {needsGst && (
                <>
                  <Text style={styles.fieldLabel}>GST details ({gstType})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="GST number"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                    value={gstNumber}
                    onChangeText={setGstNumber}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Registered business name"
                    placeholderTextColor={Colors.textMuted}
                    value={gstRegisteredName}
                    onChangeText={setGstRegisteredName}
                  />
                </>
              )}
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionLabel}>Booking type</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeChip, bookingMode === 'HOLD' && styles.modeChipActive]}
                  onPress={() => setBookingMode('HOLD')}
                >
                  <Text style={[styles.modeChipText, bookingMode === 'HOLD' && styles.modeChipTextActive]}>
                    Hold (no payment)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, bookingMode === 'INSTANT' && styles.modeChipActive]}
                  onPress={() => setBookingMode('INSTANT')}
                >
                  <Text style={[styles.modeChipText, bookingMode === 'INSTANT' && styles.modeChipTextActive]}>
                    Instant booking
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modeHelper}>
                {bookingMode === 'HOLD'
                  ? 'Reserves the room until the cancellation deadline, without charging payment. Confirm separately before it expires.'
                  : `Charges ${option?.pricing?.currency} ${Number(option?.pricing?.totalPrice || 0).toLocaleString()} and confirms immediately.`}
              </Text>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={submitBooking} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={Colors.secondary} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {bookingMode === 'HOLD' ? 'Place Hold' : 'Book & Pay'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {bookResponse && (
          <View style={styles.statusCard}>
            <Text style={styles.sectionLabel}>Booking status</Text>
            <Text style={styles.statusValue}>{status || 'IN_PROGRESS'}</Text>

            {polling && !isTerminal && (
              <View style={styles.pollingRow}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.pollingText}>Waiting for supplier confirmation...</Text>
              </View>
            )}

            {bookingDetails?.hotelConfirmationNumber && (
              <Text style={styles.statusRow}>Confirmation #: {bookingDetails.hotelConfirmationNumber}</Text>
            )}
            {bookingDetails?.order?.amount !== undefined && (
              <Text style={styles.statusRow}>Amount: {Number(bookingDetails.order.amount).toLocaleString()}</Text>
            )}

            {isSlowPending && (
              <Text style={styles.pendingNote}>
                Your cancellation was received. TripJack processes this offline and it can take up to a day to
                confirm - check back later rather than expecting an instant update.
              </Text>
            )}

            {(isTerminal || isSlowPending) && !polling && (
              <TouchableOpacity style={styles.refreshButton} onPress={() => pollBookingStatus(bookingDetails?.order?.bookingId || reviewResult.bookingId, 1)}>
                <Text style={styles.refreshButtonText}>Refresh status</Text>
              </TouchableOpacity>
            )}

            {canCancel && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelBooking} disabled={cancelling}>
                {cancelling ? (
                  <ActivityIndicator color={Colors.error} />
                ) : (
                  <Text style={styles.cancelButtonText}>Cancel booking</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneButton} onPress={() => navigation.popToTop()}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
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
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginHorizontal: 8,
  },
  content: {
    padding: 15,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryStay: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  summaryMeal: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 4,
  },
  summaryTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 6,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  travelerBlock: {
    marginBottom: 14,
  },
  travelerLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  titleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  titleChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  titleChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  titleChipTextActive: {
    color: Colors.secondary,
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  nameInput: {
    flex: 1,
  },
  codeInput: {
    width: 70,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 6,
    marginTop: 4,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  modeChipText: {
    fontSize: 13,
    color: Colors.textLight,
  },
  modeChipTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  modeHelper: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 30,
  },
  submitButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 10,
  },
  statusRow: {
    fontSize: 13,
    color: Colors.text,
    marginBottom: 4,
  },
  pendingNote: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 17,
  },
  pollingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  pollingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  refreshButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  refreshButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.error,
    fontWeight: 'bold',
    fontSize: 14,
  },
  doneButton: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default HotelBookingScreen;
