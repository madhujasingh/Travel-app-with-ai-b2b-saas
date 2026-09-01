import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import DatePickerModal from '../components/DatePickerModal';
import { useAuth } from '../context/AuthContext';
import { parseTripJackError } from '../utils/tripjackErrors';

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
        airlineCode: entry.airlineCode,
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

// tripSeatMap.tripSeat is keyed by TripJack segment id, with rows/columns that
// include gaps for the aisle (e.g. a 3-3 layout skips column 4) - build a
// row-major grid from sInfo positions rather than assuming contiguous columns.
const buildSeatGrid = (segment) => {
  const rowCount = Number(segment?.sData?.row || 0);
  const columnCount = Number(segment?.sData?.column || 0);
  const seatByPosition = {};
  (segment?.seats || []).forEach((seat) => {
    const row = seat?.seatPosition?.row;
    const column = seat?.seatPosition?.column;
    if (row != null && column != null) {
      seatByPosition[`${row}-${column}`] = seat;
    }
  });

  const rows = [];
  for (let row = 1; row <= rowCount; row += 1) {
    const cols = [];
    for (let column = 1; column <= columnCount; column += 1) {
      cols.push(seatByPosition[`${row}-${column}`] || null);
    }
    rows.push(cols);
  }
  return rows;
};

// Static UI copy, not something TripJack's Seat Map API returns (its only
// text field is `nt`, which explains why a specific leg has no seat data -
// not a general seat-preference disclaimer) - mirrors the notice shown on
// TripJack's own booking site next to seat selection.
const SEAT_MAP_DISCLAIMER =
  '*Conditions apply. We will try our best to accommodate your seat preferences, however due to operational considerations we can not guarantee this selection. The seat map shown may not be the exact replica of flight layout, we shall not be responsible for losses arising from the same. Thank you for your understanding.';

const routeSummary = (flights) => {
  if (!Array.isArray(flights) || !flights.length) return 'Flight';
  return flights.map((leg) => `${leg.from}→${leg.to}`).join(' • ');
};

// Mirrors the same "multiple operating carriers -> MULTI" logic FlightsScreen
// uses per-card, but across every leg of the journey (e.g. onward + return).
const routeAirlineCode = (flights) => {
  if (!Array.isArray(flights) || !flights.length) return null;
  const codes = new Set(flights.map((leg) => leg.airlineCode).filter(Boolean));
  if (codes.size === 0) return null;
  return codes.size > 1 ? 'MULTI' : [...codes][0];
};

// Friendlier text for TripJack's documented error codes (error-codes/errorcodes.pdf)
// that can realistically occur in the Book / Confirm-Fare-Before-Ticket /
// Confirm-Book flow - keyed by errCode as a string.
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

// Falls back to the platform default (see backend PlatformSettings) if the
// live value can't be fetched, rather than showing ₹0 while loading or on a
// network hiccup.
const DEFAULT_CONVENIENCE_FEE = 300;

const FlightBookingScreen = ({ route, navigation }) => {
  const { token, user } = useAuth();
  const { flights, reviewResponse, passengerCounts, bookingId: resumeBookingId, openCancel } = route.params || {};
  const isResume = !reviewResponse;
  const autoCancelHandled = useRef(false);
  // Lets the top section tabs ("Passenger Details" / "Baggage & Meal" /
  // "Seats") jump-scroll the form instead of making the user hunt through
  // one long scroll - mirrors TripJack's own booking page.
  const formScrollRef = useRef(null);
  const sectionOffsets = useRef({});
  const [activeSection, setActiveSection] = useState('passenger');

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
  const [seatMapState, setSeatMapState] = useState({ loading: false, data: null, error: null });
  // { [segmentId]: { [travellerIndex]: seatCode } } - unlike baggage/meal
  // (one choice applied to the whole segment), a seat is inherently
  // per-traveller, so each non-infant traveller picks their own.
  const [seatSelections, setSeatSelections] = useState({});
  // { [segmentId]: travellerIndex } - which traveller a tap on the seat
  // grid currently assigns a seat to, per segment.
  const [activeSeatTraveller, setActiveSeatTraveller] = useState({});
  const [titlePicker, setTitlePicker] = useState({ visible: false, travellerIndex: null });
  const [datePicker, setDatePicker] = useState({ visible: false, travellerIndex: null, field: null });
  const [bookingDetails, setBookingDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cancelReasonPicker, setCancelReasonPicker] = useState({ visible: false });
  const [cancelled, setCancelled] = useState(false);
  const [ancillary, setAncillary] = useState({ visible: false, loading: false, segments: [] });
  const [ancillarySelections, setAncillarySelections] = useState({});
  const [ancillaryBusy, setAncillaryBusy] = useState(false);
  const [convenienceFee, setConvenienceFee] = useState(DEFAULT_CONVENIENCE_FEE);

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

  const gstRequired = !!conditions?.gst?.igm;
  const gstOptional = !gstRequired && !!conditions?.gst?.gstappl;
  const emergencyRequired = !!conditions?.iecr;
  // TripJack's "pm" (Passport Mandatory) is NOT the only condition that
  // needs the passport block - a real live fare can have pm:false while
  // pped (expiry date) and/or pid (issue date) are independently true, and
  // TripJack still needs them at booking time. Show (and require, see
  // validateBookingForm) the whole passport block whenever any of the three
  // is set - every certified sample payload sends number+nationality+issue+
  // expiry together regardless of which specific flag triggered it.
  const passportRequired = !!(conditions?.pcs?.pm || conditions?.pcs?.pped || conditions?.pcs?.pid);
  const documentIdApplicable = !!conditions?.dc?.ida;
  const documentIdRequired = !!conditions?.dc?.idm;
  const holdAllowed = isResume || conditions?.isBA !== false;
  const ssrSegments = getSsrSegments(reviewResponse);

  // dob.adobr/cdobr/idobr are per-paxType; pcs.dobe is a blanket "DOB for
  // every passenger" override on top of those - both live on the same
  // AirReviewResponse.conditions object (fare-validate-api.txt, "How to use
  // conditions from AirReviewResponse").
  const dobRequiredFor = (paxType) => {
    if (conditions?.pcs?.dobe) return true;
    if (paxType === 'ADULT') return !!conditions?.dob?.adobr;
    if (paxType === 'CHILD') return !!conditions?.dob?.cdobr;
    if (paxType === 'INFANT') return !!conditions?.dob?.idobr;
    return false;
  };

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

  // Infants don't get their own seat, so they're excluded from seat picking -
  // same filter buildAncillarySegments already applies post-booking.
  const nonInfantTravellers = travellers
    .map((traveller, travellerIndex) => ({ traveller, travellerIndex }))
    .filter(({ traveller }) => traveller.pt !== 'INFANT');

  // Seat availability isn't part of AirReviewResponse (unlike baggage/meal's
  // ssrInfo) - it's a separate TripJack call keyed by the same review
  // bookingId, fetched once the review is in hand (see the effect below).
  // `seats` keeps every seat (booked included) so the grid can grey those
  // out - selection itself still refuses anything with isBooked true.
  const seatOptionsBySegmentId = seatMapState.data?.tripSeatMap?.tripSeat || {};
  const seatSegmentsList = Array.isArray(reviewResponse?.tripInfos)
    ? reviewResponse.tripInfos.flatMap((trip) =>
        (trip?.sI || [])
          .map((segment) => {
            const seatEntry = seatOptionsBySegmentId[segment?.id];
            return {
              id: segment?.id,
              label: `${segment?.da?.code || '--'} → ${segment?.aa?.code || '--'}`,
              sData: seatEntry?.sData,
              seats: seatEntry?.sInfo || [],
              note: seatEntry?.nt || null,
            };
          })
          .filter((segment) => segment.seats.length > 0 || segment.note)
      )
    : [];

  const fetchSeatMap = async () => {
    if (!bookingId) return;
    setSeatMapState({ loading: true, data: null, error: null });
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/seat-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load seat availability right now.');
      }
      setSeatMapState({ loading: false, data, error: null });
    } catch (error) {
      // Silent - seat selection is optional; don't block the booking form if
      // this particular fare has no seat map (conditions.isa can be false).
      setSeatMapState({ loading: false, data: null, error: error.message || null });
    }
  };

  useEffect(() => {
    // Per the Seat Map API doc: without conditions.isa true, TripJack won't
    // return seat info for this fare regardless - skip the call entirely.
    if (isResume || !conditions?.isa) return;
    fetchSeatMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResume, bookingId, conditions?.isa]);

  const chooseSeat = (segmentId, travellerIndex, seat) => {
    if (seat.isBooked) {
      Alert.alert('Seat unavailable', `Seat ${seat.seatNo} is already booked.`);
      return;
    }
    setSeatSelections((prev) => {
      const current = prev[segmentId] || {};
      const alreadyMine = current[travellerIndex] === seat.code;
      if (!alreadyMine) {
        const takenBy = Object.entries(current).find(
          ([otherIndex, code]) => Number(otherIndex) !== travellerIndex && code === seat.code
        );
        if (takenBy) {
          const otherTraveller = travellers[Number(takenBy[0])];
          Alert.alert(
            'Seat taken',
            `Seat ${seat.seatNo} is already selected for ${otherTraveller?.fN || `traveller ${Number(takenBy[0]) + 1}`}.`
          );
          return prev;
        }
      }
      const next = { ...current, [travellerIndex]: alreadyMine ? undefined : seat.code };
      return { ...prev, [segmentId]: next };
    });
  };

  const recordSectionOffset = (key) => (event) => {
    sectionOffsets.current[key] = event.nativeEvent.layout.y;
  };

  const scrollToSection = (key) => {
    setActiveSection(key);
    const y = sectionOffsets.current[key];
    if (y != null) {
      formScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  };

  // Lightweight scroll-spy: highlight whichever section's recorded offset is
  // the closest one at or above the current scroll position.
  const handleFormScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    let closestKey = 'passenger';
    let closestY = -Infinity;
    Object.entries(sectionOffsets.current).forEach(([key, y]) => {
      if (y - 40 <= offsetY && y > closestY) {
        closestKey = key;
        closestY = y;
      }
    });
    setActiveSection(closestKey);
  };

  // Pre-booking baggage/meal/seat SSR add to the order total (same as post-
  // booking ancillaries, see computeAncillaryAmount below) - TripJack rejects
  // Book/Confirm-Book with errCode 1015 ("Total amount passed in payment
  // doesn't match with total order Amount") if paymentInfos.amount is just
  // the base fare while ssrBaggageInfos/ssrMealInfos/ssrSeatInfos are
  // attached to the same request.
  // Split out per-category so the fare-summary breakup below can show
  // Baggage/Meal/Seat as separate lines - computeSsrAmount (unchanged
  // total, still what TripJack's paymentInfos.amount must match together
  // with totalFare) just sums the three.
  const computeBaggageAmount = () => {
    let total = 0;
    ssrSegments.forEach((segment) => {
      const selection = ssrSelections[segment.id];
      if (selection?.baggage) {
        const option = segment.baggageOptions.find((o) => o.code === selection.baggage);
        total += Number(option?.amount || 0);
      }
    });
    return total;
  };

  const computeMealAmount = () => {
    let total = 0;
    ssrSegments.forEach((segment) => {
      const selection = ssrSelections[segment.id];
      if (selection?.meal) {
        const option = segment.mealOptions.find((o) => o.code === selection.meal);
        total += Number(option?.amount || 0);
      }
    });
    return total;
  };

  const computeSeatAmount = () => {
    let total = 0;
    seatSegmentsList.forEach((segment) => {
      const byTraveller = seatSelections[segment.id] || {};
      Object.values(byTraveller).forEach((seatCode) => {
        if (!seatCode) return;
        const option = segment.seats.find((s) => s.code === seatCode);
        total += Number(option?.amount || 0);
      });
    });
    return total;
  };

  const computeSsrAmount = () => computeBaggageAmount() + computeMealAmount() + computeSeatAmount();

  const totalWithSsr = totalFare + computeSsrAmount();
  // Convenience fee is OUR platform's own fee, charged separately - never
  // added to totalWithSsr, which is exactly what gets sent to TripJack as
  // paymentInfos.amount for Instant Book / Confirm & Pay (it must equal the
  // reviewed fare + SSR exactly, or TripJack 400s with errCode 1015). It
  // only affects what's DISPLAYED to the customer as their total.
  const customerTotal = totalWithSsr + convenienceFee;

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
    // Per TripJack's Book request schema (booking-api.txt / the "With SSR"
    // sample payload), ssrBaggageInfos/ssrMealInfos/ssrSeatInfos each live
    // nested INSIDE every travellerInfo[] entry, not at the request's top
    // level - baggage/meal is one choice per segment applied to every
    // non-infant traveller on it, while seat is whatever that traveller
    // individually picked.
    const ssrBaggageInfos = Object.entries(ssrSelections)
      .filter(([, sel]) => sel?.baggage)
      .map(([key, sel]) => ({ key, code: sel.baggage }));
    const ssrMealInfos = Object.entries(ssrSelections)
      .filter(([, sel]) => sel?.meal)
      .map(([key, sel]) => ({ key, code: sel.meal }));

    const body = {
      bookingId,
      travellerInfo: travellers.map((t, travellerIndex) => {
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

        if (t.pt !== 'INFANT') {
          if (ssrBaggageInfos.length) traveller.ssrBaggageInfos = ssrBaggageInfos;
          if (ssrMealInfos.length) traveller.ssrMealInfos = ssrMealInfos;

          const ssrSeatInfos = seatSegmentsList
            .map((segment) => {
              const code = seatSelections[segment.id]?.[travellerIndex];
              return code ? { key: segment.id, code } : null;
            })
            .filter(Boolean);
          if (ssrSeatInfos.length) traveller.ssrSeatInfos = ssrSeatInfos;
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

    return body;
  };

  // Mirrors HotelBookingScreen/ActivityBookingScreen's validate() pattern -
  // this screen previously had none at all, so a blank form (or one missing
  // a field this specific fare's conditions require) went straight to
  // TripJack's live API instead of being caught locally. Returns a message
  // to show, or null if the form is complete enough to submit.
  const validateBookingForm = () => {
    for (let i = 0; i < travellers.length; i += 1) {
      const t = travellers[i];
      const label = `Traveller ${i + 1}`;
      if (!t.fN.trim() || !t.lN.trim()) {
        return `${label}: enter a first and last name.`;
      }
      if (dobRequiredFor(t.pt) && !t.dob) {
        return `${label}: date of birth is required for this fare.`;
      }
      if (passportRequired) {
        if (!t.pNum.trim() || !t.pNat.trim() || !t.pid || !t.eD) {
          return `${label}: passport number, nationality, issue date, and expiry date are all required for this fare.`;
        }
      }
      if (documentIdRequired && !t.di.trim()) {
        return `${label}: document ID is required for this fare.`;
      }
    }

    if (!deliveryEmail.trim() || !deliveryEmail.includes('@')) {
      return 'Enter a valid email address for booking confirmation.';
    }
    // Doc: contacts "Followed with country code and valid mobile number -
    // Example (+919500112233)" - a number without one either gets rejected
    // by TripJack or silently fails to deliver the ticket to the customer.
    if (!/^\+\d{7,15}$/.test(deliveryPhone.trim())) {
      return 'Enter a valid contact phone number with country code (e.g. +919876543210).';
    }

    const gstFilled = [gstNumber, gstRegisteredName, gstMobile, gstEmail, gstAddress].some((v) => v.trim());
    if (gstRequired || (gstOptional && gstFilled)) {
      if (!gstNumber.trim() || !gstRegisteredName.trim() || !gstMobile.trim() || !gstEmail.trim() || !gstAddress.trim()) {
        return 'GST details are required together - fill in all GST fields, or leave them all blank.';
      }
      if (gstNumber.trim().length !== 15) {
        return 'GST number must be 15 characters.';
      }
    }

    if (emergencyRequired) {
      if (!emergencyName.trim() || !emergencyEmail.trim() || !emergencyPhone.trim()) {
        return 'This fare requires an emergency contact name, email, and phone number.';
      }
    }

    return null;
  };

  const handleHold = async () => {
    if (!bookingId) return;
    const validationError = validateBookingForm();
    if (validationError) {
      Alert.alert('Missing Information', validationError);
      return;
    }
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
        airlineCode: routeAirlineCode(flights),
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
    const validationError = validateBookingForm();
    if (validationError) {
      Alert.alert('Missing Information', validationError);
      return;
    }
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
        airlineCode: routeAirlineCode(flights),
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
        airlineCode: routeAirlineCode(flights),
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
            airlineCode: routeAirlineCode(flights),
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
          airlineCode: routeAirlineCode(flights),
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

  // One "leg" here = one TripJack trip (tripInfos[] entry), matching the
  // barcode spec's own worked example ("a return trip for 2 pax = 4
  // barcodes"). For a connecting trip we use its first segment's
  // carrier/flight number - TripJack's pnrDetails is itself keyed per trip
  // (e.g. "BOM-MLE"), not per individual connecting segment, so a real
  // boarding-pass-per-segment barcode isn't derivable from this response
  // anyway.
  const bookingLegsFromDetails = () => {
    const tripInfos = bookingDetails?.itemInfos?.AIR?.tripInfos || [];
    return tripInfos
      .map((trip) => (Array.isArray(trip?.sI) ? trip.sI : []))
      .filter((segments) => segments.length)
      .map((segments) => {
        const first = segments[0];
        const last = segments[segments.length - 1];
        return {
          routeKey: `${first?.da?.code || ''}-${last?.aa?.code || ''}`,
          from: first?.da?.code || first?.da?.city || '',
          to: last?.aa?.code || last?.aa?.city || '',
          carrierCode: first?.fD?.aI?.code || '',
          flightNumber: first?.fD?.fN || '',
          airlineName: first?.fD?.aI?.name || '',
          departureTime: first?.dt || null,
          arrivalTime: last?.at || null,
        };
      });
  };

  // Builds the request body for POST /flights/ticket-pdf, reading passengers
  // straight from bookingDetails.itemInfos.AIR.travellerInfos (same source
  // the "Add Baggage / Meal / Seat" flow above already uses) rather than the
  // local `travellers` form state - that state is only populated on a fresh
  // booking flow and is empty when this screen is opened in "resume" mode
  // from My Trips (bookingId-only route params). Excludes infants (Ministry
  // of Civil Aviation spec: no barcode for infants). PNR is looked up by
  // routeKey first (matches pnrDetails' own "FROM-TO" key format exactly),
  // falling back to positional/first-value matching for anything that
  // doesn't line up.
  const buildTicketPdfRequest = () => {
    const legs = bookingLegsFromDetails();
    const travellerInfos = bookingDetails?.itemInfos?.AIR?.travellerInfos || [];

    const passengers = travellerInfos
      .filter((info) => info?.pt !== 'INFANT')
      .map((info) => {
        const pnrDetails = info?.pnrDetails || travellerInfos?.[0]?.pnrDetails || {};
        const pnrValues = Object.values(pnrDetails);

        const legsWithPnr = legs.map((leg, legIndex) => ({
          pnr: pnrDetails[leg.routeKey] || pnrValues[legIndex] || pnrValues[0] || '',
          from: leg.from,
          to: leg.to,
          carrierCode: leg.carrierCode,
          flightNumber: leg.flightNumber,
          airlineName: leg.airlineName,
          date: leg.departureTime,
          departureTime: leg.departureTime,
          arrivalTime: leg.arrivalTime,
        }));

        return { title: info?.ti || '', firstName: info?.fN || '', lastName: info?.lN || '', legs: legsWithPnr };
      });

    return {
      bookingReference: bookingId,
      agencyName: 'MyItineri Travels',
      passengers,
    };
  };

  const handleDownloadTicket = async () => {
    if (!bookingDetails?.itemInfos?.AIR?.travellerInfos?.length) {
      Alert.alert('Ticket Not Ready', 'Tap Refresh Status once, then try downloading again.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/ticket-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildTicketPdfRequest()),
      });
      if (!response.ok) {
        throw new Error('Could not generate your ticket PDF. Please try again.');
      }
      const arrayBuffer = await response.arrayBuffer();
      const file = new FileSystem.File(FileSystem.Paths.cache, `itinerary-${bookingId}.pdf`);
      file.create({ overwrite: true });
      file.write(new Uint8Array(arrayBuffer));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Flight Ticket' });
      } else {
        Alert.alert('Ticket Saved', `Saved to ${file.uri}`);
      }
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Could not download your ticket.');
    } finally {
      setBusy(false);
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

      {phase === 'form' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabBar}>
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'passenger' && styles.sectionTabActive]}
            onPress={() => scrollToSection('passenger')}
          >
            <Text style={[styles.sectionTabText, activeSection === 'passenger' && styles.sectionTabTextActive]}>
              Passenger Details
            </Text>
          </TouchableOpacity>
          {ssrSegments.length > 0 ? (
            <TouchableOpacity
              style={[styles.sectionTab, activeSection === 'baggageMeal' && styles.sectionTabActive]}
              onPress={() => scrollToSection('baggageMeal')}
            >
              <Text style={[styles.sectionTabText, activeSection === 'baggageMeal' && styles.sectionTabTextActive]}>
                Baggage & Meal
              </Text>
            </TouchableOpacity>
          ) : null}
          {seatSegmentsList.length > 0 ? (
            <TouchableOpacity
              style={[styles.sectionTab, activeSection === 'seats' && styles.sectionTabActive]}
              onPress={() => scrollToSection('seats')}
            >
              <Text style={[styles.sectionTabText, activeSection === 'seats' && styles.sectionTabTextActive]}>
                Seats
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      ) : null}

      <ScrollView
        ref={formScrollRef}
        contentContainerStyle={styles.content}
        onScroll={handleFormScroll}
        scrollEventThrottle={32}
      >
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

            <View onLayout={recordSectionOffset('passenger')} />
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
                {dobRequiredFor(t.pt) ? (
                  <View style={styles.subsectionLabelRow}>
                    <Ionicons name="calendar-outline" size={13} color={Colors.primaryDark} />
                    <Text style={styles.cardSubtitle}>Date of birth required for this fare</Text>
                  </View>
                ) : null}
                <Pressable style={[styles.input, styles.selectRow]} onPress={() => openDatePicker(index, 'dob')}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                  <Text style={t.dob ? styles.selectValueText : styles.selectPlaceholderText}>
                    {t.dob || (dobRequiredFor(t.pt) ? 'Date of Birth (required)' : 'Date of Birth')}
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

            <View onLayout={recordSectionOffset('baggageMeal')} />
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
                    <View style={styles.ssrSubtitleRow}>
                      <Text style={styles.cardSubtitle}>Baggage</Text>
                      <View style={styles.ssrCountBadge}>
                        <Text style={styles.ssrCountBadgeText}>
                          {ssrSelections[segment.id]?.baggage ? 1 : 0}/1
                        </Text>
                      </View>
                    </View>
                    <View style={styles.chipRow}>
                      {segment.baggageOptions.map((option) => {
                        const selected = ssrSelections[segment.id]?.baggage === option.code;
                        return (
                          <TouchableOpacity
                            key={option.code}
                            style={[styles.ssrChip, styles.ssrChipWithIcon, selected ? styles.ssrChipSelected : null]}
                            onPress={() => setSsrChoice(segment.id, 'baggage', option.code)}
                          >
                            <Ionicons
                              name="briefcase-outline"
                              size={14}
                              color={selected ? Colors.primaryDark : Colors.textLight}
                            />
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

            {seatMapState.loading ? (
              <View style={styles.card}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : null}

            <View onLayout={recordSectionOffset('seats')} />
            {seatSegmentsList.map((segment) => {
              const activeTravellerIndex =
                activeSeatTraveller[segment.id] ?? nonInfantTravellers[0]?.travellerIndex ?? 0;

              return (
                <View key={segment.id} style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="grid-outline" size={15} color={Colors.primaryDark} />
                    <Text style={styles.cardTitle}>Choose Seats</Text>
                    <View style={styles.optionalTag}>
                      <Text style={styles.optionalTagText}>Optional</Text>
                    </View>
                  </View>
                  <Text style={styles.hintText}>{segment.label}</Text>

                  {segment.note ? <Text style={styles.hintText}>{segment.note}</Text> : null}

                  {segment.seats.length > 0 && nonInfantTravellers.length > 0 ? (
                    <>
                      <Text style={styles.cardSubtitle}>Selecting seat for</Text>
                      <View style={styles.chipRow}>
                        {nonInfantTravellers.map(({ traveller, travellerIndex }) => {
                          const active = travellerIndex === activeTravellerIndex;
                          const assignedSeat = seatSelections[segment.id]?.[travellerIndex];
                          return (
                            <TouchableOpacity
                              key={travellerIndex}
                              style={[styles.ssrChip, active ? styles.ssrChipSelected : null]}
                              onPress={() =>
                                setActiveSeatTraveller((prev) => ({ ...prev, [segment.id]: travellerIndex }))
                              }
                            >
                              <Text style={[styles.ssrChipText, active ? styles.ssrChipTextSelected : null]}>
                                {traveller.fN ? `${traveller.ti} ${traveller.fN}` : `Traveller ${travellerIndex + 1}`}
                                {assignedSeat ? ` · ${assignedSeat}` : ''}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.seatLegendRow}>
                        <View style={styles.seatLegendItem}>
                          <View style={[styles.seatLegendSwatch, styles.seatAvailable]} />
                          <Text style={styles.seatLegendLabel}>Available</Text>
                        </View>
                        <View style={styles.seatLegendItem}>
                          <View style={[styles.seatLegendSwatch, styles.seatChargeable]} />
                          <Text style={styles.seatLegendLabel}>Chargeable</Text>
                        </View>
                        <View style={styles.seatLegendItem}>
                          <View style={[styles.seatLegendSwatch, styles.seatSelectedSwatch]} />
                          <Text style={styles.seatLegendLabel}>Selected</Text>
                        </View>
                        <View style={styles.seatLegendItem}>
                          <View style={[styles.seatLegendSwatch, styles.seatBooked]} />
                          <Text style={styles.seatLegendLabel}>Booked</Text>
                        </View>
                        <View style={styles.seatLegendItem}>
                          <View style={[styles.seatLegendSwatch, styles.seatLegroom]} />
                          <Text style={styles.seatLegendLabel}>Legroom</Text>
                        </View>
                      </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View>
                          {buildSeatGrid(segment).map((rowSeats, rowIdx) => (
                            <View key={rowIdx} style={styles.seatRow}>
                              {rowSeats.map((seat, colIdx) => {
                                if (!seat) return <View key={colIdx} style={styles.seatGap} />;
                                const takenByEntry = Object.entries(seatSelections[segment.id] || {}).find(
                                  ([, code]) => code === seat.code
                                );
                                const takenByTravellerIndex = takenByEntry ? Number(takenByEntry[0]) : null;
                                const isMine = takenByTravellerIndex === activeTravellerIndex;
                                const isTakenByOther = takenByTravellerIndex != null && !isMine;
                                return (
                                  <TouchableOpacity
                                    key={colIdx}
                                    style={[
                                      styles.seatBox,
                                      seat.isBooked
                                        ? styles.seatBooked
                                        : isMine
                                        ? styles.seatSelectedSwatch
                                        : isTakenByOther
                                        ? styles.seatTakenByOther
                                        : Number(seat.amount) > 0
                                        ? styles.seatChargeable
                                        : styles.seatAvailable,
                                      seat.isLegroom ? styles.seatLegroom : null,
                                    ]}
                                    onPress={() => chooseSeat(segment.id, activeTravellerIndex, seat)}
                                  >
                                    <Text style={styles.seatBoxText}>{seat.seatNo}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </ScrollView>

                      <Text style={styles.seatDisclaimer}>{SEAT_MAP_DISCLAIMER}</Text>
                    </>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="receipt-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.cardTitle}>Fare Summary</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Flight Fare</Text>
                <Text style={styles.metaValue}>₹{Math.round(totalFare).toLocaleString()}</Text>
              </View>
              {computeBaggageAmount() > 0 ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Baggage</Text>
                  <Text style={styles.metaValue}>₹{Math.round(computeBaggageAmount()).toLocaleString()}</Text>
                </View>
              ) : null}
              {computeMealAmount() > 0 ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Meal</Text>
                  <Text style={styles.metaValue}>₹{Math.round(computeMealAmount()).toLocaleString()}</Text>
                </View>
              ) : null}
              {computeSeatAmount() > 0 ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Seat</Text>
                  <Text style={styles.metaValue}>₹{Math.round(computeSeatAmount()).toLocaleString()}</Text>
                </View>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Convenience Fee</Text>
                <Text style={styles.metaValue}>₹{Math.round(convenienceFee).toLocaleString()}</Text>
              </View>
              <View style={styles.ticketDivider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Total</Text>
                <Text style={styles.metaValueAccent}>₹{Math.round(customerTotal).toLocaleString()}</Text>
              </View>
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
              <TouchableOpacity style={styles.secondaryButton} onPress={handleDownloadTicket} disabled={busy}>
                <Ionicons name="download-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.secondaryButtonText}>Download Ticket</Text>
              </TouchableOpacity>
            ) : null}

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
  sectionTabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sectionTabActive: {
    borderBottomColor: Colors.primary,
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  sectionTabTextActive: {
    color: Colors.primary,
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
  ssrSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ssrCountBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  ssrCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryDark,
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
  ssrChipWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  seatLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  seatLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginBottom: 6,
  },
  seatLegendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 5,
  },
  seatLegendLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  seatRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  seatBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatGap: {
    width: 28,
    height: 28,
    marginRight: 4,
  },
  seatBoxText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.text,
  },
  seatAvailable: {
    backgroundColor: '#E3F5E5',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  seatChargeable: {
    backgroundColor: '#FFF3D6',
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  seatBooked: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  seatLegroom: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  seatSelectedSwatch: {
    backgroundColor: Colors.primarySoft,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  seatTakenByOther: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  seatDisclaimer: {
    fontSize: 10,
    lineHeight: 14,
    color: Colors.textMuted,
    marginTop: 10,
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
