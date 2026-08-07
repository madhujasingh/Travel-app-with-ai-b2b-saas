import React, { useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import DatePickerModal from '../components/DatePickerModal';
import { useAuth } from '../context/AuthContext';

const TITLES_BY_PAX_TYPE = {
  ADULT: ['Mr', 'Mrs', 'Ms'],
  CHILD: ['Ms', 'Master'],
  INFANT: ['Ms', 'Master'],
};

// Per TripJack's documented web flow diagram: "Booking Detail should be
// called elapsed 5 seconds" after Book/Confirm-Book - the PNR/ticket may
// not be ready yet if queried immediately.
const BOOKING_DETAILS_DELAY_MS = 5000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Persists this flight booking against the logged-in user's account
// (upserted server-side by tripjackBookingId - see FlightBookingService) so
// it shows up in both "My Trips" and Profile > Bookings. Best-effort: a sync
// hiccup shouldn't block the booking flow since the TripJack booking itself
// already succeeded independently of this call.
const syncFlightBooking = async (token, entry) => {
  if (!token) return;
  try {
    await fetch(`${API_CONFIG.BASE_URL}/flight-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tripjackBookingId: entry.bookingId,
        routeSummary: entry.summary,
        totalFare: entry.totalFare,
        status: entry.status,
      }),
    });
  } catch (error) {
    // ignored - best-effort sync
  }
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
  di: '',
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

// Merges the post-booking FETCH SSR + FETCH SEAT responses into one
// per-segment structure the Ancillaries modal can render. Unlike the
// pre-booking Review flow, FETCH SSR nests ssrInfo per-traveller
// (sI[].bI.tI[].ssrInfo), not at the segment level - each traveller entry
// does carry its own "id" here, matching booking-details' traveller ids.
// When TripJack has no ancillary data for a segment it returns a single
// placeholder {"message": "..."} entry instead of real options, so options
// without a "code" field are filtered out rather than rendered as choices.
const buildAncillarySegments = (ssrData, seatData, bookingTravellers) => {
  const trips = Array.isArray(ssrData?.tripInfos) ? ssrData.tripInfos : [];
  const seatBySegmentId = seatData?.tripSeatMap?.tripSeat || {};
  const nonInfantTravellers = (bookingTravellers || []).filter((t) => t.pt !== 'INFANT');

  const segments = [];
  trips.forEach((trip, tripIndex) => {
    (trip?.sI || []).forEach((segment) => {
      const seatEntry = seatBySegmentId[segment?.id] || {};
      const optionsByTraveller = {};
      (segment?.bI?.tI || []).forEach((entry) => {
        if (entry?.id == null) return;
        optionsByTraveller[entry.id] = {
          baggageOptions: (entry?.ssrInfo?.BAGGAGE || []).filter((o) => o?.code),
          mealOptions: (entry?.ssrInfo?.MEAL || []).filter((o) => o?.code),
        };
      });

      segments.push({
        id: segment?.id,
        tripIndex,
        label: `${segment?.da?.code || '--'} → ${segment?.aa?.code || '--'}`,
        travellers: nonInfantTravellers,
        optionsByTraveller,
        seatOptions: (seatEntry?.sInfo || []).filter((seat) => !seat?.isBooked),
      });
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

// Per Auto Full Refund docs: submitting one of these exact remarks strings
// lets TripJack auto-approve the refund instead of routing to manual review.
const CANCEL_REASONS = [
  'Flight Cancelled by Airline',
  'Airline rescheduled flight, revised timings are not suitable',
  'Already cancelled by directly contacting airline customer support team',
  'Airline confirmed, refund is already processed',
  'Refund under DGCA policy',
  'Personal loss or bereavement',
  'Passenger is medically unfit for travel',
  'Refund under empowerment policy',
];

// TripJack's own sample payload showed this same phrase with no spaces
// ("RefundunderDGCApolicy"), while the doc's checklist has them - untested
// which form actually triggers auto-approval, so we send the readable form
// and treat auto-approval as a nice-to-have, not something to rely on.
const MAX_AMENDMENT_POLL_ATTEMPTS = 5;
const AMENDMENT_POLL_INTERVAL_MS = 10000;

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
  const { token, user } = useAuth();
  const { flights, reviewResponse, passengerCounts, bookingId: resumeBookingId, openCancel } = route.params || {};
  const isResume = !reviewResponse;
  const autoCancelHandled = useRef(false);

  const conditions = reviewResponse?.conditions || {};
  const totalFare = Number(reviewResponse?.totalPriceInfo?.totalFareDetail?.fC?.TF || 0);

  const [phase, setPhase] = useState(isResume ? 'loading' : 'form');
  const [bookingId, setBookingId] = useState(resumeBookingId || reviewResponse?.bookingId || null);
  const [travellers, setTravellers] = useState(buildDefaultTravellers(passengerCounts));
  // Default to the logged-in user's own contact details, not a placeholder -
  // this is where TripJack actually sends the PNR/ticket confirmation, so a
  // leftover fake address here means the real customer never receives it.
  const [deliveryEmail, setDeliveryEmail] = useState(user?.email || '');
  const [deliveryPhone, setDeliveryPhone] = useState(user?.phone && user.phone !== '0000000000' ? user.phone : '');
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
  const [cancelReasonPicker, setCancelReasonPicker] = useState({ visible: false });
  const [cancelled, setCancelled] = useState(false);
  const [ancillary, setAncillary] = useState({ visible: false, loading: false, segments: [] });
  const [ancillarySelections, setAncillarySelections] = useState({});
  const [ancillaryBusy, setAncillaryBusy] = useState(false);

  const gstRequired = !!conditions?.gst?.igm;
  const gstOptional = !gstRequired && !!conditions?.gst?.gstappl;
  const emergencyRequired = !!conditions?.iecr;
  const passportRequired = !!conditions?.pcs?.pm;
  const documentIdApplicable = !!conditions?.dc?.ida;
  const documentIdRequired = !!conditions?.dc?.idm;
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

  // Pre-booking baggage/meal SSR add to the order total (same as post-booking
  // ancillaries, see computeAncillaryAmount below) - TripJack rejects Book/
  // Confirm-Book with errCode 1015 ("Total amount passed in payment doesn't
  // match with total order Amount") if paymentInfos.amount is just the base
  // fare while ssrBaggageInfos/ssrMealInfos are attached to the same request.
  const computeSsrAmount = () => {
    let total = 0;
    ssrSegments.forEach((segment) => {
      const selection = ssrSelections[segment.id];
      if (!selection) return;
      if (selection.baggage) {
        const option = segment.baggageOptions.find((o) => o.code === selection.baggage);
        total += Number(option?.amount || 0);
      }
      if (selection.meal) {
        const option = segment.mealOptions.find((o) => o.code === selection.meal);
        total += Number(option?.amount || 0);
      }
    });
    return total;
  };

  const totalWithSsr = totalFare + computeSsrAmount();

  const fetchBookingDetails = async (id) => {
    const requestBody = { bookingId: id };
    console.log('[booking-details] REQUEST', JSON.stringify(requestBody));
    const response = await fetch(`${API_CONFIG.BASE_URL}/flights/booking-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();
    console.log('[booking-details] RESPONSE', JSON.stringify(data));
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

  // Lets MyFlightBookingsScreen's card-level "Cancel" quick action jump
  // straight into the cancel flow instead of landing on the detail screen
  // and requiring an extra tap.
  useEffect(() => {
    if (!openCancel || autoCancelHandled.current) return;
    const bookingIsCancelled = cancelled || bookingDetails?.order?.status === 'CANCELLED';
    if (phase === 'confirmed' && !bookingIsCancelled) {
      autoCancelHandled.current = true;
      openCancelReasonPicker();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCancel, phase, cancelled, bookingDetails]);

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

  // Shared by Hold and Instant Book - the only difference between the two
  // TripJack booking modes is whether paymentInfos is present on this same
  // /oms/v1/air/book request (doc: "Which is the same as INSTANT BOOK
  // (request should not have paymentInfo)" for Hold).
  const buildBookingBody = () => {
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
        if (documentIdApplicable && t.di) {
          traveller.di = t.di;
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

    return body;
  };

  const handleHold = async () => {
    if (!bookingId) return;
    setBusy(true);
    try {
      const body = buildBookingBody();

      console.log('[book] REQUEST', JSON.stringify(body));
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      console.log('[book] RESPONSE', JSON.stringify(data));
      if (!response.ok || data?.status?.success === false) {
        throw parseTripJackError(data, 'Unable to hold this fare right now.');
      }

      await syncFlightBooking(token, {
        bookingId,
        summary: routeSummary(flights),
        totalFare: totalWithSsr,
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

  // Instant Book: same /book call as Hold, but with paymentInfos attached so
  // TripJack tickets it immediately - no separate Confirm-Fare/Confirm-Book
  // step needed afterwards. This is the only booking path our TripJack UAT
  // certification run (23/23 cases in certification-logs/) ever exercised;
  // the Hold -> Confirm-Fare -> Confirm-Book chain was never verified against
  // this sandbox account and can reject with "invalid action for current
  // order status" on the confirm step even though Hold itself succeeds.
  const handleInstantBook = async () => {
    if (!bookingId) return;
    setBusy(true);
    setPhase('confirming');
    try {
      const body = { ...buildBookingBody(), paymentInfos: [{ amount: totalWithSsr }] };

      console.log('[book-instant] REQUEST', JSON.stringify(body));
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      console.log('[book-instant] RESPONSE', JSON.stringify(data));
      if (!response.ok || data?.status?.success === false) {
        throw parseTripJackError(data, 'Unable to book and pay for this fare right now.');
      }

      await wait(BOOKING_DETAILS_DELAY_MS);
      const details = await fetchBookingDetails(bookingId);
      setBookingDetails(details);
      await syncFlightBooking(token, {
        bookingId,
        summary: routeSummary(flights),
        totalFare: details?.order?.amount ?? totalWithSsr,
        status: details?.order?.status || 'SUCCESS',
      });
      setPhase('confirmed');
    } catch (error) {
      showTripJackErrorAlert('Book & Pay', error);
      setPhase('form');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAndPay = async () => {
    if (!bookingId) return;
    setBusy(true);
    setPhase('confirming');
    try {
      console.log('[confirm-fare] REQUEST', JSON.stringify({ bookingId }));
      const confirmFareResponse = await fetch(`${API_CONFIG.BASE_URL}/flights/confirm-fare-before-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId }),
      });
      const confirmFareData = await confirmFareResponse.json();
      console.log('[confirm-fare] RESPONSE', JSON.stringify(confirmFareData));
      if (!confirmFareResponse.ok || confirmFareData?.status?.success === false) {
        throw parseTripJackError(confirmFareData, 'Fare is no longer available for this held booking.');
      }

      const amount = totalWithSsr || bookingDetails?.order?.amount || 0;
      const confirmBookBody = { bookingId, paymentInfos: [{ amount }] };
      console.log('[confirm-book] REQUEST', JSON.stringify(confirmBookBody));
      const confirmBookResponse = await fetch(`${API_CONFIG.BASE_URL}/flights/confirm-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(confirmBookBody),
      });
      const confirmBookData = await confirmBookResponse.json();
      console.log('[confirm-book] RESPONSE', JSON.stringify(confirmBookData));
      if (!confirmBookResponse.ok || confirmBookData?.status?.success === false) {
        throw parseTripJackError(confirmBookData, 'Unable to confirm and pay for this booking.');
      }

      await wait(BOOKING_DETAILS_DELAY_MS);
      const details = await fetchBookingDetails(bookingId);
      setBookingDetails(details);
      await syncFlightBooking(token, {
        bookingId,
        summary: routeSummary(flights),
        totalFare: details?.order?.amount ?? totalWithSsr,
        status: details?.order?.status || 'SUCCESS',
      });
      setPhase('confirmed');
    } catch (error) {
      // "Invalid action for current order status" (and similar) usually means
      // this booking was already ticketed by an earlier attempt whose
      // response this screen never got to apply - re-check the real status
      // before assuming the booking is still just held, so a stale retry
      // doesn't strand the user on the Confirm & Pay screen forever.
      try {
        const details = await fetchBookingDetails(bookingId);
        setBookingDetails(details);
        if (details?.order?.status === 'SUCCESS') {
          await syncFlightBooking(token, {
            bookingId,
            summary: routeSummary(flights),
            totalFare: details?.order?.amount ?? totalWithSsr,
            status: 'SUCCESS',
          });
          setPhase('confirmed');
          return;
        }
      } catch (statusCheckError) {
        // ignore - fall through to showing the original error below
      }

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

  const openCancelReasonPicker = () => setCancelReasonPicker({ visible: true });
  const closeCancelReasonPicker = () => setCancelReasonPicker({ visible: false });

  const pollCancelStatus = async (amendmentId, attempt) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/amendment-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amendmentId }),
      });
      const data = await response.json();
      const amendmentStatus = data?.amendmentStatus;

      if ((amendmentStatus === 'REQUESTED' || amendmentStatus === 'PENDING') && attempt < MAX_AMENDMENT_POLL_ATTEMPTS) {
        await wait(AMENDMENT_POLL_INTERVAL_MS);
        return pollCancelStatus(amendmentId, attempt + 1);
      }

      if (amendmentStatus === 'SUCCESS') {
        setCancelled(true);
        await syncFlightBooking(token, {
          bookingId,
          summary: routeSummary(flights),
          totalFare: bookingDetails?.order?.amount ?? totalWithSsr,
          status: 'CANCELLED',
        });
        Alert.alert(
          'Cancellation Successful',
          `Refundable amount: ₹${Math.round(data?.refundableAmount || 0).toLocaleString()}`,
          [{ text: 'OK', onPress: () => navigation.replace('MyFlightBookings') }]
        );
      } else if (amendmentStatus === 'REJECTED') {
        Alert.alert('Cancellation Rejected', 'TripJack rejected this cancellation request. Please contact TripJack support for details.');
      } else {
        Alert.alert(
          'Still Processing',
          'This cancellation is still being processed after several checks. You can check back later from My Trips, or contact TripJack support if it doesn\'t resolve.'
        );
      }
    } catch (error) {
      showTripJackErrorAlert('Cancellation', error);
    } finally {
      setBusy(false);
    }
  };

  const submitCancelAmendment = async (reason) => {
    if (!bookingId) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/submit-amendment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId, type: 'FULL_REFUND', remarks: reason }),
      });
      const data = await response.json();
      if (!response.ok || data?.status?.success === false) {
        throw parseTripJackError(data, 'Unable to submit this cancellation right now.');
      }
      await pollCancelStatus(data?.amendmentId, 1);
    } catch (error) {
      showTripJackErrorAlert('Cancellation', error);
      setBusy(false);
    }
  };

  const previewCancelCharges = async (reason) => {
    if (!bookingId) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/amendment-charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId, type: 'FULL_REFUND', remarks: reason }),
      });
      const data = await response.json();
      if (!response.ok || data?.status?.success === false) {
        throw parseTripJackError(data, 'Unable to fetch cancellation charges right now.');
      }
      setBusy(false);

      const amendmentInfo = data?.trips?.[0]?.amendmentInfo || {};
      const lines = Object.entries(amendmentInfo).map(
        ([paxType, info]) =>
          `${paxType}: refund ₹${Math.round(info?.refundAmount || 0).toLocaleString()} (charge ₹${Math.round(info?.amendmentCharges || 0).toLocaleString()})`
      );

      Alert.alert(
        'Confirm Cancellation',
        lines.length ? lines.join('\n') : 'Charges are not available for this fare yet - TripJack may need to be contacted directly.',
        [
          { text: 'Back', style: 'cancel' },
          { text: 'Proceed', style: 'destructive', onPress: () => submitCancelAmendment(reason) },
        ]
      );
    } catch (error) {
      setBusy(false);
      showTripJackErrorAlert('Cancellation', error);
    }
  };

  const chooseCancelReason = (reason) => {
    closeCancelReasonPicker();
    previewCancelCharges(reason);
  };

  const openAncillaryModal = async () => {
    if (!bookingId) return;
    setAncillary({ visible: true, loading: true, segments: [] });
    try {
      const ssrResponse = await fetch(`${API_CONFIG.BASE_URL}/flights/ancillaries/fetch-ssr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId }),
      });
      const ssrData = await ssrResponse.json();
      if (!ssrResponse.ok || ssrData?.status?.success === false) {
        throw parseTripJackError(ssrData, 'Unable to load baggage/meal options for this booking.');
      }

      // Seat map isn't available for every fare (conditions.isa can be false)
      // - treat its failure as non-fatal so baggage/meal can still be added.
      let seatData = null;
      try {
        const seatResponse = await fetch(`${API_CONFIG.BASE_URL}/flights/ancillaries/fetch-seat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bookingId }),
        });
        const parsedSeat = await seatResponse.json();
        if (seatResponse.ok && parsedSeat?.status?.success !== false) seatData = parsedSeat;
      } catch (seatError) {
        // ignored - segments will just render without seat options
      }

      const bookingTravellers = bookingDetails?.itemInfos?.AIR?.travellerInfos || [];
      const segments = buildAncillarySegments(ssrData, seatData, bookingTravellers);
      setAncillary({ visible: true, loading: false, segments });
    } catch (error) {
      setAncillary({ visible: false, loading: false, segments: [] });
      showTripJackErrorAlert('Add Extras', error);
    }
  };

  const closeAncillaryModal = () => {
    setAncillary({ visible: false, loading: false, segments: [] });
    setAncillarySelections({});
  };

  const toggleAncillary = (type, groupKey, travellerId, code) => {
    setAncillarySelections((prev) => {
      const group = { ...(prev[type]?.[groupKey] || {}) };
      if (group[travellerId] === code) {
        delete group[travellerId];
      } else {
        group[travellerId] = code;
      }
      return { ...prev, [type]: { ...prev[type], [groupKey]: group } };
    });
  };

  const computeAncillaryAmount = () => {
    let total = 0;
    const countedBaggage = new Set();
    ancillary.segments.forEach((segment) => {
      Object.entries(ancillarySelections.meal?.[segment.id] || {}).forEach(([travellerId, code]) => {
        const options = segment.optionsByTraveller?.[travellerId]?.mealOptions || [];
        const option = options.find((o) => o.code === code);
        total += Number(option?.amount || 0);
      });
      Object.entries(ancillarySelections.seat?.[segment.id] || {}).forEach(([, code]) => {
        const option = segment.seatOptions.find((o) => o.code === code);
        total += Number(option?.amount || 0);
      });
      Object.entries(ancillarySelections.baggage?.[segment.tripIndex] || {}).forEach(([travellerId, code]) => {
        const uniqueKey = `${segment.tripIndex}-${travellerId}`;
        if (countedBaggage.has(uniqueKey)) return;
        countedBaggage.add(uniqueKey);
        const options = segment.optionsByTraveller?.[travellerId]?.baggageOptions || [];
        const option = options.find((o) => o.code === code);
        total += Number(option?.amount || 0);
      });
    });
    return total;
  };

  // Baggage (unlike meal/seat) is selected per-trip, not per-segment - looking
  // it up via segment.tripIndex means a connecting segment automatically gets
  // the same baggage code as its sibling segment, matching the Ancillaries
  // doc's note that baggage must be repeated across every segment in a trip.
  const buildAncillaryPayload = () => {
    const sI = [];
    ancillary.segments.forEach((segment) => {
      const tI = [];
      (segment.travellers || []).forEach((traveller) => {
        const baggageCode = ancillarySelections.baggage?.[segment.tripIndex]?.[traveller.id];
        const mealCode = ancillarySelections.meal?.[segment.id]?.[traveller.id];
        const seatCode = ancillarySelections.seat?.[segment.id]?.[traveller.id];
        if (!baggageCode && !mealCode && !seatCode) return;
        const entry = { id: traveller.id };
        if (baggageCode) entry.sbi = { code: baggageCode };
        if (mealCode) entry.smi = { code: mealCode };
        if (seatCode) entry.ssi = { code: seatCode };
        tI.push(entry);
      });
      if (tI.length) sI.push({ id: segment.id, bI: { tI } });
    });
    return sI;
  };

  const pollAncillaryAmendment = async (amendmentId, attempt) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/flights/amendment-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amendmentId }),
    });
    const data = await response.json();
    const amendmentStatus = data?.amendmentStatus;
    if ((amendmentStatus === 'REQUESTED' || amendmentStatus === 'PENDING') && attempt < MAX_AMENDMENT_POLL_ATTEMPTS) {
      await wait(AMENDMENT_POLL_INTERVAL_MS);
      return pollAncillaryAmendment(amendmentId, attempt + 1);
    }
    return amendmentStatus || 'UNKNOWN';
  };

  const submitAncillaries = async () => {
    if (!bookingId) return;
    const amount = computeAncillaryAmount();
    if (amount <= 0) {
      Alert.alert('Add Extras', 'Please select at least one baggage, meal, or seat option.');
      return;
    }
    setAncillaryBusy(true);
    try {
      const sI = buildAncillaryPayload();
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/ancillaries/add-ssr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId, paymentInfos: [{ amount }], sI }),
      });
      const data = await response.json();
      if (!response.ok || data?.status?.success === false) {
        throw parseTripJackError(data, 'Unable to add these extras right now.');
      }
      const amendmentIds = data?.amendmentIds || [];
      const statuses = await Promise.all(amendmentIds.map((id) => pollAncillaryAmendment(id, 1)));
      setAncillaryBusy(false);
      closeAncillaryModal();
      if (statuses.length && statuses.every((s) => s === 'SUCCESS')) {
        Alert.alert('Extras Added', 'Your baggage, meal, and/or seat selections have been added to this booking.');
      } else if (statuses.some((s) => s === 'REJECTED')) {
        Alert.alert('Extras Not Added', 'TripJack rejected this request. Please contact TripJack support for details.');
      } else {
        Alert.alert('Still Processing', 'This is still being processed. You can check back later from My Trips.');
      }
    } catch (error) {
      setAncillaryBusy(false);
      showTripJackErrorAlert('Add Extras', error);
    }
  };

  const pnrEntries = Object.entries(bookingDetails?.itemInfos?.AIR?.travellerInfos?.[0]?.pnrDetails || {});
  const ticketEntries = Object.entries(bookingDetails?.itemInfos?.AIR?.travellerInfos?.[0]?.ticketNumberDetails || {});
  const isCancelled = cancelled || bookingDetails?.order?.status === 'CANCELLED';
  // ABORTED/FAILED are terminal-dead per TripJack's status contract (same
  // vocabulary as the hotel flow) - distinct from a legitimate ON_HOLD/PENDING
  // fare, which is recoverable via Confirm & Pay. Without this, a dead order
  // rendered identically to "held" and offered a Confirm & Pay button that
  // would just fail again.
  const isFailed = ['ABORTED', 'FAILED'].includes(bookingDetails?.order?.status);

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
        <Text style={styles.headerTitle}>
          {phase === 'form' ? 'Traveller Details' : 'Your Booking'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {phase === 'loading' ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : null}

        {phase === 'form' ? (
          <>
            <View style={styles.routeSummaryCard}>
              <View style={styles.routeSummaryIconWrap}>
                <Ionicons name="airplane" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.routeSummaryText}>{routeSummary(flights)}</Text>
            </View>
            {!holdAllowed ? (
              <View style={styles.warningBanner}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.warningText}>
                  This fare can't be held — it needs to be booked and paid for right away.
                </Text>
              </View>
            ) : null}

            {travellers.map((t, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.travellerCardHeader}>
                  <View style={styles.travellerBadge}>
                    <Text style={styles.travellerBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.cardTitle}>Traveller {index + 1}</Text>
                  <View style={styles.paxTypeTag}>
                    <Text style={styles.paxTypeTagText}>{t.pt}</Text>
                  </View>
                </View>

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
                    placeholderTextColor={Colors.textMuted}
                  />
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={t.lN}
                    onChangeText={(v) => updateTraveller(index, 'lN', v)}
                    placeholder="Last name"
                    placeholderTextColor={Colors.textMuted}
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
                    <View style={styles.subsectionDivider} />
                    <View style={styles.subsectionLabelRow}>
                      <Ionicons name="document-text-outline" size={13} color={Colors.primaryDark} />
                      <Text style={styles.cardSubtitle}>Passport details required for this fare</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={t.pNum}
                      onChangeText={(v) => updateTraveller(index, 'pNum', v)}
                      placeholder="Passport Number"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="characters"
                    />
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.inputFlex]}
                        value={t.pNat}
                        onChangeText={(v) => updateTraveller(index, 'pNat', v)}
                        placeholder="Nationality (e.g. IN)"
                        placeholderTextColor={Colors.textMuted}
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
                {documentIdApplicable ? (
                  <>
                    <View style={styles.subsectionDivider} />
                    <View style={styles.subsectionLabelRow}>
                      <Ionicons name="card-outline" size={13} color={Colors.primaryDark} />
                      <Text style={styles.cardSubtitle}>
                        Document ID{documentIdRequired ? ' required' : ' (optional)'} for this fare
                      </Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      value={t.di}
                      onChangeText={(v) => updateTraveller(index, 'di', v)}
                      placeholder="Document ID"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="characters"
                    />
                  </>
                ) : null}
              </View>
            ))}

            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="mail-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.cardTitle}>Contact & Delivery</Text>
              </View>
              <TextInput
                style={styles.input}
                value={deliveryEmail}
                onChangeText={setDeliveryEmail}
                placeholder="Email"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                value={deliveryPhone}
                onChangeText={setDeliveryPhone}
                placeholder="Phone (+countrycode...)"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {gstRequired || gstOptional ? (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="receipt-outline" size={15} color={Colors.primaryDark} />
                  <Text style={styles.cardTitle}>GST Details</Text>
                  <View style={styles.optionalTag}>
                    <Text style={styles.optionalTagText}>{gstRequired ? 'Required' : 'Optional'}</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  placeholder="GST Number (15 characters)"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                />
                <TextInput
                  style={styles.input}
                  value={gstRegisteredName}
                  onChangeText={setGstRegisteredName}
                  placeholder="Registered Name"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={gstMobile}
                  onChangeText={setGstMobile}
                  placeholder="GST Mobile"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={gstEmail}
                  onChangeText={setGstEmail}
                  placeholder="GST Email"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  value={gstAddress}
                  onChangeText={setGstAddress}
                  placeholder="GST Address"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.hintText}>
                  All GST fields are required together if you fill any of them in.
                </Text>
              </View>
            ) : null}

            {emergencyRequired ? (
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="alert-circle-outline" size={15} color={Colors.primaryDark} />
                  <Text style={styles.cardTitle}>Emergency Contact</Text>
                  <View style={styles.optionalTag}>
                    <Text style={styles.optionalTagText}>Required</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  value={emergencyName}
                  onChangeText={setEmergencyName}
                  placeholder="Contact Name"
                  placeholderTextColor={Colors.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={emergencyEmail}
                  onChangeText={setEmergencyEmail}
                  placeholder="Contact Email"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  value={emergencyPhone}
                  onChangeText={setEmergencyPhone}
                  placeholder="Contact Phone"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ) : null}

            {ssrSegments.map((segment) => (
              <View key={segment.id} style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Ionicons name="fast-food-outline" size={15} color={Colors.primaryDark} />
                  <Text style={styles.cardTitle}>Baggage & Meal</Text>
                  <View style={styles.optionalTag}>
                    <Text style={styles.optionalTagText}>Optional</Text>
                  </View>
                </View>
                <Text style={styles.hintText}>{segment.label}</Text>
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

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Total{computeSsrAmount() > 0 ? ' (fare + extras)' : ''}</Text>
              <Text style={styles.metaValueAccent}>₹{Math.round(totalWithSsr).toLocaleString()}</Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleInstantBook} disabled={busy}>
              <Text style={styles.primaryButtonText}>{busy ? 'Booking & paying…' : 'Book & Pay Now'}</Text>
            </TouchableOpacity>
            <Text style={styles.ctaHelperText}>Confirms and tickets this fare immediately.</Text>

            {holdAllowed ? (
              <>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleHold} disabled={busy}>
                  <Ionicons name="time-outline" size={15} color={Colors.primaryDark} />
                  <Text style={styles.secondaryButtonText}>{busy ? 'Holding your fare…' : 'Hold Fare Instead (Pay Later)'}</Text>
                </TouchableOpacity>
                <Text style={styles.ctaHelperText}>You won't be charged yet — this reserves the fare while you complete payment.</Text>
              </>
            ) : null}
          </>
        ) : null}

        {phase === 'held' || phase === 'confirming' || phase === 'confirmed' ? (
          <>
            <View
              style={[
                styles.statusHeaderCard,
                isCancelled || isFailed
                  ? styles.statusHeaderCancelled
                  : phase === 'confirmed'
                  ? styles.statusHeaderConfirmed
                  : styles.statusHeaderHold,
              ]}
            >
              <View
                style={[
                  styles.statusHeaderIconWrap,
                  { backgroundColor: isCancelled || isFailed ? '#FBE4E2' : phase === 'confirmed' ? '#E3F5E5' : '#FFF3D6' },
                ]}
              >
                <Ionicons
                  name={isCancelled || isFailed ? 'close-circle' : phase === 'confirmed' ? 'checkmark-circle' : 'time'}
                  size={26}
                  color={isCancelled || isFailed ? Colors.error : phase === 'confirmed' ? Colors.success : '#8A6100'}
                />
              </View>
              <Text style={styles.statusHeaderTitle}>
                {isCancelled
                  ? 'Booking Cancelled'
                  : isFailed
                  ? 'Booking Failed'
                  : phase === 'confirmed'
                  ? 'Booking Confirmed'
                  : 'Fare On Hold'}
              </Text>
              <Text style={styles.statusHeaderSubtitle}>
                {isCancelled
                  ? 'This trip has been cancelled.'
                  : isFailed
                  ? 'This booking could not be completed with the supplier. Please search again.'
                  : phase === 'confirmed'
                  ? 'Your tickets are booked and ready.'
                  : phase === 'confirming'
                  ? 'Confirming and processing your payment…'
                  : 'Complete payment to confirm your seats.'}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Booking ID</Text>
                <Text style={styles.metaValue}>{bookingId}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Route</Text>
                <Text style={styles.metaValue}>{routeSummary(flights)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Amount</Text>
                <Text style={styles.metaValueAccent}>
                  ₹{Math.round(bookingDetails?.order?.amount ?? totalWithSsr ?? 0).toLocaleString()}
                </Text>
              </View>

              {pnrEntries.length || ticketEntries.length ? (
                <>
                  <View style={styles.ticketDivider} />

                  {pnrEntries.length ? (
                    <View style={styles.subsectionLabelRow}>
                      <Ionicons name="bookmark-outline" size={13} color={Colors.primaryDark} />
                      <Text style={styles.cardSubtitle}>PNR</Text>
                    </View>
                  ) : null}
                  {pnrEntries.map(([segment, pnr]) => (
                    <View key={segment} style={styles.metaRow}>
                      <Text style={styles.metaLabel}>{segment}</Text>
                      <Text style={styles.metaValue}>{pnr}</Text>
                    </View>
                  ))}

                  {ticketEntries.length ? (
                    <View style={styles.subsectionLabelRow}>
                      <Ionicons name="ticket-outline" size={13} color={Colors.primaryDark} />
                      <Text style={styles.cardSubtitle}>Ticket Number</Text>
                    </View>
                  ) : null}
                  {ticketEntries.map(([segment, ticket]) => (
                    <View key={segment} style={styles.metaRow}>
                      <Text style={styles.metaLabel}>{segment}</Text>
                      <Text style={styles.metaValue}>{ticket}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>

            {phase !== 'confirmed' && !isFailed && !isCancelled ? (
              <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmAndPay} disabled={busy}>
                <Text style={styles.primaryButtonText}>
                  {phase === 'confirming' ? 'Confirming & Paying…' : 'Confirm & Pay'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.secondaryButton} onPress={handleRefreshStatus} disabled={busy}>
              <Ionicons name="refresh" size={15} color={Colors.primaryDark} />
              <Text style={styles.secondaryButtonText}>Refresh Status</Text>
            </TouchableOpacity>

            {phase === 'confirmed' && !isCancelled ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={openAncillaryModal} disabled={busy}>
                <Ionicons name="bag-add-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.secondaryButtonText}>Add Baggage / Meal / Seat</Text>
              </TouchableOpacity>
            ) : null}

            {phase === 'confirmed' && !isCancelled ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('FlightReissue', { bookingId })}
                disabled={busy}
              >
                <Ionicons name="calendar-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.secondaryButtonText}>Reschedule Flight</Text>
              </TouchableOpacity>
            ) : null}

            {phase === 'confirmed' && !isCancelled ? (
              <TouchableOpacity style={styles.dangerButton} onPress={openCancelReasonPicker} disabled={busy}>
                <Ionicons name="close-circle-outline" size={15} color={Colors.error} />
                <Text style={styles.dangerButtonText}>Cancel Booking</Text>
              </TouchableOpacity>
            ) : null}
          </>
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

      <Modal visible={cancelReasonPicker.visible} transparent animationType="fade" onRequestClose={closeCancelReasonPicker}>
        <Pressable style={styles.pickerOverlay} onPress={closeCancelReasonPicker}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Reason for Cancellation</Text>
            {CANCEL_REASONS.map((reason) => (
              <TouchableOpacity key={reason} style={styles.pickerOption} onPress={() => chooseCancelReason(reason)}>
                <Text style={styles.pickerOptionText}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={ancillary.visible} animationType="slide" onRequestClose={closeAncillaryModal}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={closeAncillaryModal}>
              <Ionicons name="close" size={26} color={Colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Baggage / Meal / Seat</Text>
            <View style={{ width: 26 }} />
          </View>

          {ancillary.loading ? (
            <View style={styles.ancillaryLoading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.hintText}>Loading available extras…</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {ancillary.segments.length === 0 ? (
                <Text style={styles.hintText}>No baggage, meal, or seat options are available for this booking.</Text>
              ) : (
                ancillary.segments.map((segment) => (
                  <View key={segment.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{segment.label}</Text>
                    {segment.travellers.map((traveller) => {
                      const travellerOptions = segment.optionsByTraveller?.[traveller.id] || {};
                      const baggageOptions = travellerOptions.baggageOptions || [];
                      const mealOptions = travellerOptions.mealOptions || [];
                      return (
                        <View key={traveller.id} style={styles.ancillaryTravellerBlock}>
                          <Text style={styles.cardSubtitle}>
                            {traveller.ti} {traveller.fN} {traveller.lN}
                          </Text>

                          {!baggageOptions.length && !mealOptions.length && !segment.seatOptions.length ? (
                            <Text style={styles.hintText}>No extras available for this traveller on this segment.</Text>
                          ) : null}

                          {baggageOptions.length ? (
                            <>
                              <Text style={styles.ancillarySectionLabel}>Baggage</Text>
                              <View style={styles.chipRow}>
                                {baggageOptions.map((option) => {
                                  const selected = ancillarySelections.baggage?.[segment.tripIndex]?.[traveller.id] === option.code;
                                  return (
                                    <TouchableOpacity
                                      key={option.code}
                                      style={[styles.ssrChip, selected ? styles.ssrChipSelected : null]}
                                      onPress={() => toggleAncillary('baggage', segment.tripIndex, traveller.id, option.code)}
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

                          {mealOptions.length ? (
                            <>
                              <Text style={styles.ancillarySectionLabel}>Meal</Text>
                              <View style={styles.chipRow}>
                                {mealOptions.map((option) => {
                                  const selected = ancillarySelections.meal?.[segment.id]?.[traveller.id] === option.code;
                                  return (
                                    <TouchableOpacity
                                      key={option.code}
                                      style={[styles.ssrChip, selected ? styles.ssrChipSelected : null]}
                                      onPress={() => toggleAncillary('meal', segment.id, traveller.id, option.code)}
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

                          {segment.seatOptions.length ? (
                            <>
                              <Text style={styles.ancillarySectionLabel}>Seat</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seatScroll}>
                                {segment.seatOptions.map((seat) => {
                                  const selected = ancillarySelections.seat?.[segment.id]?.[traveller.id] === seat.code;
                                  return (
                                    <TouchableOpacity
                                      key={seat.code}
                                      style={[styles.ssrChip, selected ? styles.ssrChipSelected : null]}
                                      onPress={() => toggleAncillary('seat', segment.id, traveller.id, seat.code)}
                                    >
                                      <Text style={[styles.ssrChipText, selected ? styles.ssrChipTextSelected : null]}>
                                        {seat.seatNo} (+₹{seat.amount})
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            </>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {!ancillary.loading && ancillary.segments.length ? (
            <View style={styles.ancillaryFooter}>
              <Text style={styles.ancillaryFooterAmount}>Total: ₹{computeAncillaryAmount().toLocaleString()}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={submitAncillaries} disabled={ancillaryBusy}>
                <Text style={styles.primaryButtonText}>{ancillaryBusy ? 'Adding…' : 'Add Selected Extras'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </SafeAreaView>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  routeSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  routeSummaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  routeSummaryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FBE4E2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.error,
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  optionalTag: {
    marginLeft: 'auto',
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optionalTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  travellerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  travellerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travellerBadgeText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  paxTypeTag: {
    marginLeft: 'auto',
    backgroundColor: Colors.background,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paxTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  subsectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 10,
    marginBottom: 4,
  },
  subsectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 2,
    marginBottom: 2,
  },
  hintText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
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
  metaValueAccent: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  ticketDivider: {
    borderStyle: 'dashed',
    borderTopWidth: 1.5,
    borderColor: Colors.border,
    marginVertical: 12,
  },
  ctaHelperText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  statusHeaderCard: {
    alignItems: 'center',
    borderRadius: 18,
    padding: 22,
    marginBottom: 14,
  },
  statusHeaderHold: {
    backgroundColor: '#FFF8E8',
  },
  statusHeaderConfirmed: {
    backgroundColor: '#EDF9EE',
  },
  statusHeaderCancelled: {
    backgroundColor: '#FDEDEC',
  },
  statusHeaderIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  statusHeaderSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
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
    flexDirection: 'row',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: Colors.card,
  },
  secondaryButtonText: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  dangerButton: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: Colors.card,
  },
  dangerButtonText: {
    color: Colors.error,
    fontWeight: '700',
  },
  ancillaryLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ancillaryTravellerBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ancillarySectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  seatScroll: {
    flexDirection: 'row',
  },
  ancillaryFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  ancillaryFooterAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default FlightBookingScreen;
