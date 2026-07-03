import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useCart } from '../context/CartContext';

const AIRPORT_OPTIONS = [
  { code: 'DEL', city: 'Delhi' },
  { code: 'BOM', city: 'Mumbai' },
  { code: 'DXB', city: 'Dubai' },
  { code: 'SIN', city: 'Singapore' },
  { code: 'DMK', city: 'Bangkok Don Mueang' },
  { code: 'BKK', city: 'Bangkok' },
  { code: 'MAA', city: 'Chennai' },
  { code: 'BLR', city: 'Bengaluru' },
  { code: 'GOI', city: 'Goa' },
  { code: 'CCU', city: 'Kolkata' },
  { code: 'HYD', city: 'Hyderabad' },
  { code: 'COK', city: 'Kochi' },
  { code: 'JAI', city: 'Jaipur' },
];

const TRIP_TYPES = [
  { label: 'One Way', value: 'ONE_WAY' },
  { label: 'Return', value: 'RETURN' },
  { label: 'Multi City', value: 'MULTI_CITY' },
];

const CABIN_CLASSES = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];

const CONNECTION_FILTERS = [
  { label: 'Both', value: 'BOTH' },
  { label: 'Direct', value: 'DIRECT' },
  { label: 'Connecting', value: 'CONNECTING' },
];

const PASSENGER_FARE_TYPES = [
  { label: 'Regular', value: 'REGULAR' },
  { label: 'Student', value: 'STUDENT' },
  { label: 'Senior', value: 'SENIOR_CITIZEN' },
];

const createEmptyRoute = (from = '', to = '', travelDate = '') => ({
  from,
  to,
  travelDate,
});

const formatDateForApi = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month}-${day}`;
  }

  return null;
};

const formatDateForDisplay = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDisplayDate = (value) => {
  const normalized = formatDateForApi(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date, count) => new Date(date.getFullYear(), date.getMonth() + count, 1);

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const buildCalendarDays = (monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const firstWeekDay = monthStart.getDay();
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const nextDate = new Date(calendarStart);
    nextDate.setDate(calendarStart.getDate() + index);
    return nextDate;
  });
};

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const resolveAirportCode = (value) => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;

  const byCity = AIRPORT_OPTIONS.find((option) => option.city.toUpperCase() === normalized);
  if (byCity) {
    return byCity.code;
  }

  // TripJack accepts any valid IATA airport code, not just the curated quick-pick list above.
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  return null;
};

const formatTime = (isoDateTime) => {
  if (!isoDateTime) return '--';

  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return '--';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const getBaggageLabel = (fareDetails) => {
  const carry = fareDetails?.bI?.cB;
  const checkIn = fareDetails?.bI?.iB;

  return {
    checkIn: checkIn ? `Baggage ${checkIn}` : 'Baggage info later',
    carry: carry ? `Cabin ${carry}` : 'Cabin bag policy',
  };
};

const NAMED_BUCKETS = ['ONWARD', 'RETURN', 'COMBO'];

const buildJourneyLabel = (bucket) => {
  if (bucket === 'RETURN') {
    return 'Return';
  }

  if (bucket === 'COMBO') {
    return 'Combo';
  }

  if (bucket === 'ONWARD') {
    return 'Onward';
  }

  // Domestic multi-city results are keyed by numeric route-leg index ("0","1",...)
  // instead of ONWARD/RETURN/COMBO - see PDF: "Equivalent Number of Route Infos,
  // Equivalent index ids generated. (Each index id belongs to each route info)".
  const legNumber = Number(bucket);
  return Number.isNaN(legNumber) ? 'Onward' : `Leg ${legNumber + 1}`;
};

const flattenTripBuckets = (tripInfos = {}) => {
  const flattened = [];
  const allKeys = Object.keys(tripInfos || {});
  const bucketKeys = allKeys.some((key) => NAMED_BUCKETS.includes(key))
    ? NAMED_BUCKETS
    : allKeys.slice().sort((a, b) => Number(a) - Number(b));

  bucketKeys.forEach((bucket) => {
    const trips = tripInfos?.[bucket];
    if (!Array.isArray(trips)) {
      return;
    }

    trips.forEach((trip, tripIndex) => {
      flattened.push({
        bucket,
        tripIndex,
        trip,
      });
    });
  });

  return flattened;
};

const getPassengerPricing = (fareDetails = {}) => ({
  adult: Number(fareDetails?.ADULT?.fC?.TF || 0),
  child: Number(fareDetails?.CHILD?.fC?.TF || 0),
  infant: Number(fareDetails?.INFANT?.fC?.TF || 0),
});

// AirReviewResponse.totalPriceInfo.totalFareDetail is the authoritative grand total
// across every reviewed leg and every passenger - already summed by TripJack, so we
// don't need to (and shouldn't) re-derive it by multiplying per-pax fares ourselves.
const getReviewGrandTotal = (reviewResponse) => {
  const total = Number(reviewResponse?.totalPriceInfo?.totalFareDetail?.fC?.TF);
  return Number.isFinite(total) && total > 0 ? total : null;
};

const FARE_RULE_SECTIONS = [
  { key: 'CANCELLATION', label: 'Cancellation' },
  { key: 'DATECHANGE', label: 'Date Change' },
  { key: 'NO_SHOW', label: 'No Show' },
  { key: 'SEAT_CHARGEABLE', label: 'Seat Chargeable' },
];

const formatFareRulePolicyWindow = (policy) => {
  if (policy?.pp) {
    return policy.pp.replace(/_/g, ' ');
  }
  if (policy?.st != null && policy?.et != null) {
    return `${policy.st}–${policy.et} hrs before departure`;
  }
  return null;
};

// Cat 16 fare rules can come back as supplier free text wrapped in raw RTF -
// strip control words/groups so the plain policy text is readable in the app.
const stripFareRuleRtf = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/\\par\b/g, '\n')
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const buildFlightCartItem = ({ flights, reviewResponse, passengerCounts }) => {
  const legs = Array.isArray(flights) ? flights : [flights];
  const primaryLeg = legs[0] || {};
  const people =
    Number(passengerCounts?.adults || 0) +
    Number(passengerCounts?.children || 0) +
    Number(passengerCounts?.infants || 0);

  const grandTotal = getReviewGrandTotal(reviewResponse);
  const fallbackTotal = legs.reduce((sum, leg) => {
    const pricing = leg?.passengerPricing || {};
    return (
      sum +
      Number(passengerCounts?.adults || 0) * (pricing.adult || leg?.price || 0) +
      Number(passengerCounts?.children || 0) * (pricing.child || pricing.adult || leg?.price || 0) +
      Number(passengerCounts?.infants || 0) * (pricing.infant || 0)
    );
  }, 0);
  const lineTotal = grandTotal || fallbackTotal || primaryLeg?.price || 0;

  const title = legs
    .map((leg) => `${leg.airline}${leg.flightNo ? ` ${leg.flightNo}` : ''}`)
    .join(' + ');
  const destination = legs.length > 1
    ? `${legs[0].from} -> ${legs[legs.length - 1].to} (${legs.length} legs)`
    : `${primaryLeg.from} -> ${primaryLeg.to}`;

  return {
    id: `flight-${legs.map((leg) => leg.id).join('_')}`,
    title,
    destination,
    duration: primaryLeg.duration,
    price: lineTotal / (people || 1),
    people: people || 1,
    lineTotal: lineTotal || primaryLeg?.price || 0,
    adults: Number(passengerCounts?.adults || 0),
    children: Number(passengerCounts?.children || 0),
    infants: Number(passengerCounts?.infants || 0),
    image: 'Flight',
    iconName: 'airplane-outline',
    fareType: primaryLeg.fareType,
    journeyLabel: legs.map((leg) => leg.journeyLabel).join(' + '),
    reviewResponse,
    priceIds: legs.flatMap((leg) => leg.priceIds || []),
    addedAt: new Date().toISOString(),
  };
};

const mapFlightsFromResponse = (data) => {
  const flattenedTrips = flattenTripBuckets(data?.searchResult?.tripInfos);
  const cards = [];

  flattenedTrips.forEach(({ bucket, trip, tripIndex }) => {
    const segments = Array.isArray(trip?.sI) ? trip.sI : [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const totalDuration = segments.reduce((sum, segment) => sum + Number(segment?.duration || 0), 0);
    const totalStops = segments.reduce((sum, segment) => sum + Number(segment?.stops || 0), 0);
    const journeyLabel = buildJourneyLabel(bucket);
    const priceOptions = Array.isArray(trip?.totalPriceList) ? trip.totalPriceList : [];

    // Each entry in totalPriceList is a DIFFERENT alternate fare (e.g. PUBLISHED vs
    // FLEXI_PLUS) for this SAME flight - not a different leg. The Review API expects
    // exactly one price id per leg, so each fare option becomes its own selectable card.
    priceOptions.forEach((priceOption, priceIndex) => {
      const adultFare = priceOption?.fd?.ADULT;
      const baggage = getBaggageLabel(adultFare);

      cards.push({
        id: `${bucket}-${tripIndex}-${priceOption?.id || `${firstSegment?.id}-${priceIndex}`}`,
        groupKey: bucket,
        airline: firstSegment?.fD?.aI?.name || 'Airline',
        flightNo: `${firstSegment?.fD?.aI?.code || ''}-${firstSegment?.fD?.fN || ''}`.replace(/^-|-$/g, ''),
        from: firstSegment?.da?.code || firstSegment?.da?.city || '--',
        to: lastSegment?.aa?.code || lastSegment?.aa?.city || '--',
        departure: formatTime(firstSegment?.dt),
        arrival: formatTime(lastSegment?.at),
        duration: formatDuration(totalDuration || firstSegment?.duration),
        price: Number(adultFare?.fC?.TF || 0),
        stops: totalStops === 0 ? 'Non-stop' : `${totalStops} stop`,
        image: 'airplane',
        checkInBaggage: baggage.checkIn,
        cabinBaggage: baggage.carry,
        fareType: priceOption?.fareIdentifier || 'PUBLISHED',
        journeyLabel,
        segmentCount: segments.length,
        priceIds: priceOption?.id ? [priceOption.id] : [],
        passengerPricing: getPassengerPricing(priceOption?.fd),
      });
    });
  });

  return cards;
};

const FlightsScreen = ({ navigation }) => {
  const { addItemToCart } = useCart();
  const [tripType, setTripType] = useState('ONE_WAY');
  const [routes, setRoutes] = useState([createEmptyRoute('Delhi', 'Mumbai', '10/06/2026')]);
  const [returnDate, setReturnDate] = useState('12/06/2026');
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [infants, setInfants] = useState('0');
  const [cabinClass, setCabinClass] = useState('ECONOMY');
  const [connectionFilter, setConnectionFilter] = useState('BOTH');
  const [fareType, setFareType] = useState('REGULAR');
  const [preferredAirlines, setPreferredAirlines] = useState('');
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState([]);
  const [searched, setSearched] = useState(false);
  const [reviewedFare, setReviewedFare] = useState(null);
  const [fareRuleState, setFareRuleState] = useState({ visible: false, loading: false, data: null, error: null });
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [showFilters, setShowFilters] = useState(true);
  const today = startOfDay(new Date());
  const [calendarState, setCalendarState] = useState({
    visible: false,
    target: null,
    routeIndex: null,
    month: startOfMonth(today),
    selected: today,
  });

  const updateRoute = (index, key, value) => {
    setRoutes((currentRoutes) =>
      currentRoutes.map((route, routeIndex) =>
        routeIndex === index ? { ...route, [key]: value } : route
      )
    );
  };

  const setTripTypeWithDefaults = (nextType) => {
    setTripType(nextType);

    if (nextType === 'ONE_WAY') {
      setRoutes((currentRoutes) => [currentRoutes[0] || createEmptyRoute()]);
      return;
    }

    if (nextType === 'RETURN') {
      const outward = routes[0] || createEmptyRoute();
      setRoutes([outward]);
      return;
    }

    if (nextType === 'MULTI_CITY') {
      const first = routes[0] || createEmptyRoute();
      const second = routes[1] || createEmptyRoute('Mumbai', 'Bengaluru', '15/06/2026');
      setRoutes([first, second]);
    }
  };

  const swapRouteCities = (index) => {
    setRoutes((currentRoutes) =>
      currentRoutes.map((route, routeIndex) =>
        routeIndex === index
          ? { ...route, from: route.to, to: route.from }
          : route
      )
    );
  };

  const addMultiCityRoute = () => {
    if (routes.length >= 6) {
      Alert.alert('Route limit', 'TripJack multi-city search supports up to 6 route segments.');
      return;
    }

    setRoutes((currentRoutes) => [...currentRoutes, createEmptyRoute('', '', '')]);
  };

  const removeMultiCityRoute = (index) => {
    if (routes.length <= 2) {
      return;
    }

    setRoutes((currentRoutes) => currentRoutes.filter((_, routeIndex) => routeIndex !== index));
  };

  const buildRouteInfos = () => {
    const normalizedRoutes = [];

    for (const route of routes) {
      const fromCode = resolveAirportCode(route.from);
      const toCode = resolveAirportCode(route.to);
      const travelDate = formatDateForApi(route.travelDate);

      if (!fromCode || !toCode) {
        throw new Error('Use supported cities or 3-letter airport codes for every route.');
      }

      if (!travelDate) {
        throw new Error('Enter all travel dates as DD/MM/YYYY or YYYY-MM-DD.');
      }

      normalizedRoutes.push({
        fromCityOrAirport: { code: fromCode },
        toCityOrAirport: { code: toCode },
        travelDate,
      });
    }

    if (tripType === 'RETURN') {
      const outward = normalizedRoutes[0];
      const parsedReturnDate = formatDateForApi(returnDate);
      if (!parsedReturnDate) {
        throw new Error('Enter the return date as DD/MM/YYYY or YYYY-MM-DD.');
      }

      normalizedRoutes.push({
        fromCityOrAirport: { code: outward.toCityOrAirport.code },
        toCityOrAirport: { code: outward.fromCityOrAirport.code },
        travelDate: parsedReturnDate,
      });
    }

    return normalizedRoutes;
  };

  const buildSearchModifiers = () => {
    const modifiers = {};

    if (fareType) {
      modifiers.pft = fareType;
    }

    if (connectionFilter === 'DIRECT') {
      modifiers.isDirectFlight = true;
      modifiers.isConnectingFlight = false;
      return modifiers;
    }

    if (connectionFilter === 'CONNECTING') {
      modifiers.isDirectFlight = false;
      modifiers.isConnectingFlight = true;
      return modifiers;
    }

    modifiers.isDirectFlight = true;
    modifiers.isConnectingFlight = true;
    return modifiers;
  };

  const buildPreferredAirlinePayload = () => {
    const tokens = preferredAirlines
      .split(',')
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);

    if (tokens.length === 0) {
      return undefined;
    }

    if (tokens.length > 10) {
      throw new Error('Preferred airlines support up to 10 airline codes.');
    }

    return tokens.map((code) => ({ code }));
  };

  const searchFlights = async () => {
    const adultCount = Number(adults || 0);
    const childCount = Number(children || 0);
    const infantCount = Number(infants || 0);

    if (adultCount <= 0) {
      Alert.alert('Passengers required', 'Enter at least 1 adult passenger.');
      return;
    }

    if (infantCount > adultCount) {
      Alert.alert('Infant limit', 'Infants cannot be more than adults.');
      return;
    }

    try {
      const routeInfos = buildRouteInfos();
      const payload = {
        searchQuery: {
          cabinClass,
          paxInfo: {
            ADULT: String(adultCount),
            CHILD: String(childCount),
            INFANT: String(infantCount),
          },
          routeInfos,
          searchModifiers: buildSearchModifiers(),
        },
      };

      const preferredAirlinePayload = buildPreferredAirlinePayload();
      if (preferredAirlinePayload) {
        payload.searchQuery.preferredAirline = preferredAirlinePayload;
      }

      setLoading(true);
      setSearched(true);
      setReviewedFare(null);
      setSelectedByGroup({});

      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to search flights right now.');
      }

      const results = mapFlightsFromResponse(data);
      setFlights(results);
      setShowFilters(results.length === 0);
    } catch (error) {
      setFlights([]);
      Alert.alert('Flight Search', error.message || 'Unable to fetch flights right now.');
    } finally {
      setLoading(false);
    }
  };

  // Groups mirror the search response buckets (ONWARD/RETURN, or numeric multi-city
  // legs). Domestic Return and Domestic Multi-city require one price id PER leg,
  // reviewed together in a single request - see PDF: "In Case of Domestic Return -
  // 2 Price id has to be requested (1 from ONWARD and another from RETURN)".
  const groupKeys = useMemo(() => {
    const seen = [];
    flights.forEach((flight) => {
      if (!seen.includes(flight.groupKey)) {
        seen.push(flight.groupKey);
      }
    });
    return seen;
  }, [flights]);

  const isMultiLeg = groupKeys.length > 1;
  const allLegsSelected = isMultiLeg && groupKeys.every((key) => selectedByGroup[key]);

  const runReview = async (legs) => {
    const priceIds = legs.flatMap((leg) => leg.priceIds || []);
    if (!priceIds.length) {
      Alert.alert('Review unavailable', 'This fare is missing the TripJack review identifier.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceIds }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to review this fare right now.');
      }

      const passengerCounts = {
        adults: Number(adults || 0),
        children: Number(children || 0),
        infants: Number(infants || 0),
      };
      const cartItem = buildFlightCartItem({
        flights: legs,
        reviewResponse: data,
        passengerCounts,
      });

      setReviewedFare({
        flights: legs,
        reviewResponse: data,
        passengerCounts,
        cartItem,
      });
    } catch (error) {
      Alert.alert('Review Fare', error.message || 'Unable to review this fare right now.');
    } finally {
      setLoading(false);
    }
  };

  const reviewFare = (flight) => runReview([flight]);

  const closeFareRules = () => setFareRuleState({ visible: false, loading: false, data: null, error: null });

  const viewFareRules = async () => {
    const bookingId = reviewedFare?.reviewResponse?.bookingId;
    if (!bookingId) {
      Alert.alert('Fare Rules', 'Fare rule lookup needs a reviewed fare first.');
      return;
    }

    setFareRuleState({ visible: true, loading: true, data: null, error: null });
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/fare-rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookingId, flowType: 'REVIEW' }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to fetch fare rules right now.');
      }

      setFareRuleState({ visible: true, loading: false, data, error: null });
    } catch (error) {
      setFareRuleState({
        visible: true,
        loading: false,
        data: null,
        error: error.message || 'Unable to fetch fare rules right now.',
      });
    }
  };

  const selectFlightForGroup = (flight) => {
    setSelectedByGroup((prev) => ({ ...prev, [flight.groupKey]: flight }));
    setReviewedFare(null);
  };

  const reviewSelectedFares = () => {
    if (!allLegsSelected) {
      return;
    }
    runReview(groupKeys.map((key) => selectedByGroup[key]));
  };

  const addReviewedFareToCart = () => {
    if (!reviewedFare?.cartItem) {
      return;
    }

    addItemToCart(reviewedFare.cartItem);
    Alert.alert('Added to cart', `${reviewedFare.cartItem.title} is ready in your cart.`);
  };

  const continueReviewedFareToCheckout = () => {
    if (!reviewedFare?.cartItem) {
      return;
    }

    navigation.navigate('Checkout', {
      cartItems: [reviewedFare.cartItem],
      total: reviewedFare.cartItem.lineTotal,
    });
  };

  const renderFlight = ({ item }) => {
    const isSelected = isMultiLeg && selectedByGroup[item.groupKey]?.id === item.id;

    return (
      <TouchableOpacity
        style={[styles.flightCard, isSelected && styles.flightCardSelected]}
        activeOpacity={0.8}
        onPress={isMultiLeg ? () => selectFlightForGroup(item) : undefined}
      >
        <View style={styles.flightHeader}>
          <View style={styles.airlineInfo}>
            <Ionicons name={item.image} size={26} color={Colors.primary} style={styles.flightImage} />
            <View>
              <Text style={styles.airlineName}>{item.airline}</Text>
              <Text style={styles.flightNo}>{item.flightNo || 'Flight details'}</Text>
              <Text style={styles.journeyLabel}>{item.journeyLabel}{item.segmentCount > 1 ? ` • ${item.segmentCount} segments` : ''}</Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
            <Text style={styles.perPerson}>per adult</Text>
          </View>
        </View>

        <View style={styles.flightDetails}>
          <View style={styles.timeContainer}>
            <Text style={styles.time}>{item.departure}</Text>
            <Text style={styles.city}>{item.from}</Text>
          </View>

          <View style={styles.durationContainer}>
            <Text style={styles.duration}>{item.duration}</Text>
            <View style={styles.durationLine}>
              <View style={styles.dot} />
              <View style={styles.line} />
              <Ionicons name="airplane" size={14} color={Colors.primary} style={styles.planeIcon} />
              <View style={styles.line} />
              <View style={styles.dot} />
            </View>
            <Text style={styles.stops}>{item.stops}</Text>
          </View>

          <View style={styles.timeContainer}>
            <Text style={styles.time}>{item.arrival}</Text>
            <Text style={styles.city}>{item.to}</Text>
          </View>
        </View>

        <View style={styles.flightFooter}>
          <View style={styles.amenities}>
            <View style={styles.amenityBadge}>
              <Ionicons name="briefcase-outline" size={11} color={Colors.primaryDark} />
              <Text style={styles.amenityText}>{item.checkInBaggage}</Text>
            </View>
            <View style={styles.amenityBadge}>
              <Ionicons name="bag-handle-outline" size={11} color={Colors.primaryDark} />
              <Text style={styles.amenityText}>{item.cabinBaggage}</Text>
            </View>
            <View style={[styles.amenityBadge, styles.fareTypeBadge]}>
              <Text style={styles.fareTypeBadgeText}>{item.fareType}</Text>
            </View>
          </View>
          {isMultiLeg ? (
            <View style={[styles.bookButton, isSelected && styles.bookButtonSelected]}>
              <Text style={styles.bookButtonText}>{isSelected ? 'Selected' : 'Select'}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.bookButton} onPress={() => reviewFare(item)}>
              <Text style={styles.bookButtonText}>Review Fare</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyTitle}>Searching flights...</Text>
          <Text style={styles.emptySubtitle}>TripJack results can take a few seconds to come back.</Text>
        </View>
      );
    }

    if (!searched) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="airplane-outline" size={34} color={Colors.primary} />
          <Text style={styles.emptyTitle}>Search live flights</Text>
          <Text style={styles.emptySubtitle}>Use one-way, return, or multi-city search with adults, children, and infants.</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={34} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No flights found</Text>
        <Text style={styles.emptySubtitle}>Try another date, route, or broaden the search.</Text>
      </View>
    );
  };

  const routeHeaderLabel =
    tripType === 'MULTI_CITY' ? 'Route Legs' : 'Route';

  const openCalendar = ({ target, routeIndex = null, currentValue = '' }) => {
    const parsedDate = parseDisplayDate(currentValue);
    const safeDate = parsedDate && parsedDate >= today ? parsedDate : today;

    setCalendarState({
      visible: true,
      target,
      routeIndex,
      month: startOfMonth(safeDate),
      selected: safeDate,
    });
  };

  const closeCalendar = () => {
    setCalendarState((currentState) => ({
      ...currentState,
      visible: false,
    }));
  };

  const handleCalendarDateSelect = (date) => {
    if (date < today) {
      return;
    }

    const formatted = formatDateForDisplay(date);

    if (calendarState.target === 'return') {
      setReturnDate(formatted);
    } else if (typeof calendarState.routeIndex === 'number') {
      updateRoute(calendarState.routeIndex, 'travelDate', formatted);
    }

    closeCalendar();
  };

  const shiftCalendarMonth = (offset) => {
    setCalendarState((currentState) => ({
      ...currentState,
      month: addMonths(currentState.month, offset),
    }));
  };

  const searchSummary = useMemo(() => {
    const routeLabel = routes
      .map((route) => `${route.from || '?'} → ${route.to || '?'}`)
      .join('  •  ');
    const dateLabel = tripType === 'RETURN'
      ? `${routes[0]?.travelDate || '--'} → ${returnDate || '--'}`
      : routes.map((route) => route.travelDate || '--').join('  •  ');
    const paxCount = Number(adults || 0) + Number(children || 0) + Number(infants || 0);

    return { routeLabel, dateLabel, paxCount };
  }, [routes, tripType, returnDate, adults, children, infants]);

  const canGoToPreviousMonth =
    startOfMonth(calendarState.month) > startOfMonth(today);
  const calendarDays = buildCalendarDays(calendarState.month);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flights</Text>
        <View style={{ width: 30 }} />
      </View>

      <FlatList
        data={flights}
        renderItem={renderFlight}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          flights.length ? styles.listContainer : styles.listContainerEmpty,
          isMultiLeg && searched && flights.length > 0 ? styles.listContainerWithFooter : null,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.searchForm}>
            {!showFilters && searched ? (
              <TouchableOpacity
                style={styles.summaryBar}
                activeOpacity={0.85}
                onPress={() => setShowFilters(true)}
              >
                <View style={styles.summaryBarIcon}>
                  <Ionicons name="airplane" size={18} color={Colors.secondary} />
                </View>
                <View style={styles.summaryBarText}>
                  <Text style={styles.summaryBarRoute} numberOfLines={1}>{searchSummary.routeLabel}</Text>
                  <Text style={styles.summaryBarMeta} numberOfLines={1}>
                    {searchSummary.dateLabel} • {searchSummary.paxCount} traveller{searchSummary.paxCount === 1 ? '' : 's'} • {cabinClass.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={styles.summaryBarEdit}>
                  <Ionicons name="create-outline" size={16} color={Colors.primaryDark} />
                  <Text style={styles.summaryBarEditText}>Edit</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {showFilters ? (
              <>
            <View style={styles.heroCard}>
              <View style={styles.heroBadge}>
                <Ionicons name="airplane" size={14} color={Colors.secondary} />
                <Text style={styles.heroBadgeText}>Live airfare search</Text>
              </View>
              <Text style={styles.heroTitle}>Plan the smartest route, then lock the best fare.</Text>
              <Text style={styles.heroSubtitle}>
                Compare one-way, return, and multi-city options with live TripJack pricing and review-ready checkout.
              </Text>
              <View style={styles.heroMetrics}>
                <View style={styles.metricPill}>
                  <Text style={styles.metricLabel}>Cabin</Text>
                  <Text style={styles.metricValue}>{cabinClass.replace(/_/g, ' ')}</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricLabel}>Travellers</Text>
                  <Text style={styles.metricValue}>{Number(adults) + Number(children) + Number(infants)}</Text>
                </View>
                <View style={styles.metricPill}>
                  <Text style={styles.metricLabel}>Filter</Text>
                  <Text style={styles.metricValue}>{connectionFilter}</Text>
                </View>
              </View>
            </View>

            <View style={styles.formSurface}>
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionEyebrow}>Search setup</Text>
                    <Text style={styles.sectionTitle}>Trip Type</Text>
                  </View>
                </View>
                <View style={styles.pillWrap}>
                  {TRIP_TYPES.map((option) => {
                    const active = tripType === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setTripTypeWithDefaults(option.value)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionEyebrow}>Route builder</Text>
                    <Text style={styles.sectionTitle}>{routeHeaderLabel}</Text>
                  </View>
                </View>
                {routes.map((route, index) => (
                  <View key={`route-${index}`} style={styles.routeCard}>
                    <View style={styles.routeHeader}>
                      <View style={styles.routeTag}>
                        <Text style={styles.routeTagText}>Leg {index + 1}</Text>
                      </View>
                      {tripType === 'MULTI_CITY' && routes.length > 2 ? (
                        <TouchableOpacity style={styles.routeDeleteButton} onPress={() => removeMultiCityRoute(index)}>
                          <Ionicons name="trash-outline" size={16} color={Colors.error} />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View style={styles.routeGrid}>
                      <View style={[styles.inputContainer, styles.routeField]}>
                        <Text style={styles.inputLabel}>From</Text>
                        <View style={styles.inputShell}>
                          <Ionicons name="airplane-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Delhi or DEL"
                            placeholderTextColor={Colors.textMuted}
                            value={route.from}
                            onChangeText={(value) => updateRoute(index, 'from', value)}
                            autoCapitalize="characters"
                          />
                        </View>
                      </View>

                      <TouchableOpacity style={styles.swapButton} onPress={() => swapRouteCities(index)}>
                        <Ionicons name="swap-horizontal" size={18} color={Colors.secondary} />
                      </TouchableOpacity>

                      <View style={[styles.inputContainer, styles.routeField]}>
                        <Text style={styles.inputLabel}>To</Text>
                        <View style={styles.inputShell}>
                          <Ionicons name="location-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
                            placeholder="Mumbai or BOM"
                            placeholderTextColor={Colors.textMuted}
                            value={route.to}
                            onChangeText={(value) => updateRoute(index, 'to', value)}
                            autoCapitalize="characters"
                          />
                        </View>
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Departure</Text>
                      <Pressable
                        style={styles.inputShell}
                        onPress={() =>
                          openCalendar({
                            target: 'route',
                            routeIndex: index,
                            currentValue: route.travelDate,
                          })
                        }
                      >
                        <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                        <Text style={[styles.dateDisplayText, !route.travelDate && styles.dateDisplayPlaceholder]}>
                          {route.travelDate || 'Select departure date'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {tripType === 'MULTI_CITY' ? (
                  <TouchableOpacity style={styles.secondaryButton} onPress={addMultiCityRoute}>
                    <Ionicons name="add-circle-outline" size={18} color={Colors.primaryDark} />
                    <Text style={styles.secondaryButtonText}>Add Route Leg</Text>
                  </TouchableOpacity>
                ) : null}

                {tripType === 'RETURN' ? (
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Return Date</Text>
                    <Pressable
                      style={styles.inputShell}
                      onPress={() =>
                        openCalendar({
                          target: 'return',
                          currentValue: returnDate,
                        })
                      }
                    >
                      <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                      <Text style={[styles.dateDisplayText, !returnDate && styles.dateDisplayPlaceholder]}>
                        {returnDate || 'Select return date'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionEyebrow}>Traveller details</Text>
                    <Text style={styles.sectionTitle}>Passengers</Text>
                  </View>
                </View>
                <View style={styles.passengerGrid}>
                  <View style={[styles.inputContainer, styles.passengerCard]}>
                    <Text style={styles.inputLabel}>Adults</Text>
                    <TextInput
                      style={[styles.input, styles.numericInput]}
                      value={adults}
                      onChangeText={setAdults}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputContainer, styles.passengerCard]}>
                    <Text style={styles.inputLabel}>Children</Text>
                    <TextInput
                      style={[styles.input, styles.numericInput]}
                      value={children}
                      onChangeText={setChildren}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputContainer, styles.passengerCardNoMargin]}>
                    <Text style={styles.inputLabel}>Infants</Text>
                    <TextInput
                      style={[styles.input, styles.numericInput]}
                      value={infants}
                      onChangeText={setInfants}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionEyebrow}>Preferences</Text>
                <Text style={styles.sectionTitle}>Cabin Class</Text>
                <View style={styles.pillWrap}>
                  {CABIN_CLASSES.map((option) => {
                    const active = cabinClass === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setCabinClass(option)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.replace(/_/g, ' ')}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.sectionTitle}>Flight Filter</Text>
                <View style={styles.pillWrap}>
                  {CONNECTION_FILTERS.map((option) => {
                    const active = connectionFilter === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setConnectionFilter(option.value)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.sectionTitle}>Fare Type</Text>
                <View style={styles.pillWrap}>
                  {PASSENGER_FARE_TYPES.map((option) => {
                    const active = fareType === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => setFareType(option.value)}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Preferred Airlines</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="sparkles-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Optional: SG, 6E, AI"
                      placeholderTextColor={Colors.textMuted}
                      value={preferredAirlines}
                      onChangeText={setPreferredAirlines}
                      autoCapitalize="characters"
                    />
                  </View>
                  <Text style={styles.helperText}>Enter up to 10 airline codes, separated by commas.</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.searchButton} onPress={searchFlights} disabled={loading}>
                <View>
                  <Text style={styles.searchButtonText}>{loading ? 'Searching live fares...' : 'Search Flights'}</Text>
                  <Text style={styles.searchButtonSubtext}>Best live options across your selected route</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={Colors.secondary} />
              </TouchableOpacity>
            </View>
              </>
            ) : null}

            {isMultiLeg && searched ? (
              <View style={styles.legSelectionCard}>
                <Text style={styles.legSelectionTitle}>
                  {tripType === 'MULTI_CITY' ? 'Pick one flight per route leg' : 'Pick your onward and return flight'}
                </Text>
                <Text style={styles.legSelectionHint}>
                  Tap a flight in each group below, then review them together. TripJack prices these as a single itinerary.
                </Text>
                <View style={styles.legSelectionChips}>
                  {groupKeys.map((key) => {
                    const selection = selectedByGroup[key];
                    return (
                      <View key={key} style={[styles.legSelectionChip, selection && styles.legSelectionChipDone]}>
                        <Ionicons
                          name={selection ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={selection ? Colors.success : Colors.textMuted}
                        />
                        <Text style={styles.legSelectionChipText} numberOfLines={1}>
                          {buildJourneyLabel(key)}{selection ? `: ₹${selection.price.toLocaleString()}` : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={renderEmptyState}
      />

      {isMultiLeg && searched && flights.length > 0 ? (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyFooterText}>
            <Text style={styles.stickyFooterTitle}>
              {groupKeys.filter((key) => selectedByGroup[key]).length} of {groupKeys.length} legs selected
            </Text>
            <Text style={styles.stickyFooterSubtitle} numberOfLines={1}>
              {allLegsSelected
                ? groupKeys.map((key) => `${buildJourneyLabel(key)} ₹${selectedByGroup[key].price.toLocaleString()}`).join('  •  ')
                : 'Tap a flight card above for each leg'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.stickyFooterButton, (!allLegsSelected || loading) && styles.legReviewButtonDisabled]}
            onPress={reviewSelectedFares}
            disabled={!allLegsSelected || loading}
          >
            <Text style={styles.stickyFooterButtonText}>{loading ? 'Reviewing...' : 'Review Combined Fare'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={!!reviewedFare}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewedFare(null)}
      >
        <Pressable style={styles.calendarOverlay} onPress={() => setReviewedFare(null)}>
          <Pressable style={styles.reviewModalCard} onPress={() => {}}>
            {reviewedFare ? (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewHeaderCopy}>
                    <Text style={styles.reviewTitle}>Fare Review Ready</Text>
                    <Text style={styles.reviewSubtitle}>
                      {reviewedFare.flights.map((leg) => `${leg.airline} ${leg.flightNo || ''} (${leg.from}→${leg.to})`).join('  •  ')}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setReviewedFare(null)}>
                    <Ionicons name="close-circle" size={26} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.reviewMetaRow}>
                  <Text style={styles.reviewMetaLabel}>Passengers</Text>
                  <Text style={styles.reviewMetaValue}>
                    {reviewedFare.passengerCounts.adults}A / {reviewedFare.passengerCounts.children}C / {reviewedFare.passengerCounts.infants}I
                  </Text>
                </View>
                <View style={styles.reviewMetaRow}>
                  <Text style={styles.reviewMetaLabel}>Fare Type</Text>
                  <Text style={styles.reviewMetaValue}>{reviewedFare.flights[0].fareType}</Text>
                </View>
                <View style={styles.reviewMetaRow}>
                  <Text style={styles.reviewMetaLabel}>Total (all legs, all passengers)</Text>
                  <Text style={styles.reviewPrice}>₹{Math.round(reviewedFare.cartItem.lineTotal).toLocaleString()}</Text>
                </View>

                <Text style={styles.reviewHelper}>
                  Review response loaded from TripJack. You can now save this fare to cart or continue to checkout.
                </Text>

                <TouchableOpacity style={styles.fareRuleLinkButton} onPress={viewFareRules}>
                  <Ionicons name="document-text-outline" size={16} color={Colors.primaryDark} />
                  <Text style={styles.fareRuleLinkText}>View Fare Rules</Text>
                </TouchableOpacity>

                <View style={styles.reviewActions}>
                  <TouchableOpacity style={styles.reviewSecondaryButton} onPress={addReviewedFareToCart}>
                    <Text style={styles.reviewSecondaryButtonText}>Add to Cart</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reviewPrimaryButton} onPress={continueReviewedFareToCheckout}>
                    <Text style={styles.reviewPrimaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={fareRuleState.visible}
        transparent
        animationType="slide"
        onRequestClose={closeFareRules}
      >
        <Pressable style={styles.calendarOverlay} onPress={closeFareRules}>
          <Pressable style={styles.reviewModalCard} onPress={() => {}}>
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewHeaderCopy}>
                  <Text style={styles.reviewTitle}>Fare Rules</Text>
                  <Text style={styles.reviewSubtitle}>Cancellation, date change &amp; no-show policies</Text>
                </View>
                <TouchableOpacity onPress={closeFareRules}>
                  <Ionicons name="close-circle" size={26} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {fareRuleState.loading ? (
                <ActivityIndicator color={Colors.primary} style={styles.fareRuleLoader} />
              ) : fareRuleState.error ? (
                <Text style={styles.fareRuleText}>{fareRuleState.error}</Text>
              ) : (
                <ScrollView style={styles.fareRuleScroll}>
                  {Object.entries(fareRuleState.data?.fareRule || {}).map(([route, routeRule]) => (
                    <View key={route} style={styles.fareRuleSection}>
                      <Text style={styles.fareRuleRoute}>{route}</Text>
                      {routeRule?.miscInfo?.length ? (
                        routeRule.miscInfo.map((text, idx) => (
                          <Text key={idx} style={styles.fareRuleText}>{stripFareRuleRtf(text)}</Text>
                        ))
                      ) : (
                        FARE_RULE_SECTIONS.map(({ key, label }) => {
                          const policies = routeRule?.tfr?.[key];
                          if (!policies?.length) {
                            return null;
                          }
                          return (
                            <View key={key} style={styles.fareRulePolicyBlock}>
                              <Text style={styles.fareRulePolicyLabel}>{label}</Text>
                              {policies.map((policy, idx) => (
                                <View key={idx} style={styles.fareRulePolicyRow}>
                                  {formatFareRulePolicyWindow(policy) ? (
                                    <Text style={styles.fareRulePolicyWindow}>
                                      {formatFareRulePolicyWindow(policy)}
                                    </Text>
                                  ) : null}
                                  <Text style={styles.fareRulePolicyInfo}>
                                    {policy.policyInfo || 'No details available'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          );
                        })
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={calendarState.visible}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
      >
        <Pressable style={styles.calendarOverlay} onPress={closeCalendar}>
          <Pressable style={styles.calendarModal} onPress={() => {}}>
            <View style={styles.calendarModalHeader}>
              <View>
                <Text style={styles.calendarEyebrow}>Choose date</Text>
                <Text style={styles.calendarTitle}>
                  {calendarState.target === 'return' ? 'Return date' : 'Departure date'}
                </Text>
              </View>
              <TouchableOpacity style={styles.calendarCloseButton} onPress={closeCalendar}>
                <Ionicons name="close" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarMonthRow}>
              <TouchableOpacity
                style={[styles.calendarArrowButton, !canGoToPreviousMonth && styles.calendarArrowDisabled]}
                onPress={() => shiftCalendarMonth(-1)}
                disabled={!canGoToPreviousMonth}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={canGoToPreviousMonth ? Colors.text : Colors.textMuted}
                />
              </TouchableOpacity>
              <Text style={styles.calendarMonthLabel}>
                {MONTH_LABEL.format(calendarState.month)}
              </Text>
              <TouchableOpacity style={styles.calendarArrowButton} onPress={() => shiftCalendarMonth(1)}>
                <Ionicons name="chevron-forward" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekRow}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.calendarWeekday}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((date) => {
                const isCurrentMonth = date.getMonth() === calendarState.month.getMonth();
                const isPast = date < today;
                const isSelected = isSameDay(date, calendarState.selected);

                return (
                  <TouchableOpacity
                    key={date.toISOString()}
                    style={[
                      styles.calendarDay,
                      isSelected && styles.calendarDaySelected,
                      (!isCurrentMonth || isPast) && styles.calendarDayMuted,
                    ]}
                    onPress={() => handleCalendarDateSelect(date)}
                    disabled={isPast}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        !isCurrentMonth && styles.calendarDayTextFaded,
                        isPast && styles.calendarDayTextDisabled,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.calendarHint}>Past dates are disabled for flight search.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#FF6A21',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 0.2,
  },
  searchForm: {
    paddingTop: 18,
  },
  heroCard: {
    backgroundColor: '#1E2530',
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 10,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroTitle: {
    color: Colors.secondary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    maxWidth: '90%',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  heroMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
  },
  metricPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10,
    minWidth: 92,
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  formSurface: {
    backgroundColor: Colors.card,
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F9E5D8',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 14,
  },
  routeCard: {
    backgroundColor: '#FFF9F5',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F7DDCF',
    marginBottom: 14,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  routeTag: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  routeTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  routeDeleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF0EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textLight,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  routeGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  inputContainer: {
    marginBottom: 0,
  },
  routeField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3D4C2',
    paddingHorizontal: 14,
    minHeight: 58,
  },
  inputIcon: {
    marginRight: 8,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  dateDisplayText: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  dateDisplayPlaceholder: {
    color: Colors.textMuted,
    fontWeight: '500',
  },
  numericInput: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3D4C2',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  smallInput: {
    flex: 1,
    marginRight: 10,
  },
  passengerGrid: {
    flexDirection: 'row',
  },
  passengerCard: {
    flex: 1,
    marginRight: 10,
  },
  passengerCardNoMargin: {
    flex: 1,
  },
  swapButton: {
    backgroundColor: Colors.primary,
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    marginBottom: 7,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 6,
  },
  swapIcon: {
    fontSize: 20,
    color: Colors.secondary,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#FFF4EC',
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    color: Colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  pillTextActive: {
    color: Colors.secondary,
  },
  secondaryButton: {
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#FFF5EF',
  },
  secondaryButtonText: {
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: '#FF6A21',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  searchButtonText: {
    color: Colors.secondary,
    fontSize: 17,
    fontWeight: '800',
  },
  searchButtonSubtext: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 4,
  },
  legSelectionCard: {
    marginTop: 18,
    backgroundColor: '#FFF9F4',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F7DDCF',
    padding: 18,
  },
  legSelectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  legSelectionHint: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  legSelectionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legSelectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: '100%',
  },
  legSelectionChipDone: {
    borderColor: Colors.success,
    backgroundColor: '#EAF7EC',
  },
  legSelectionChipText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  legReviewButtonDisabled: {
    opacity: 0.5,
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  stickyFooterText: {
    flex: 1,
    marginRight: 12,
  },
  stickyFooterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  stickyFooterSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textLight,
  },
  stickyFooterButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stickyFooterButtonText: {
    color: Colors.secondary,
    fontWeight: '800',
    fontSize: 13,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3D4C2',
    padding: 12,
    marginBottom: 14,
  },
  summaryBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryBarText: {
    flex: 1,
  },
  summaryBarRoute: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  summaryBarMeta: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textMuted,
  },
  summaryBarEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  summaryBarEditText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  reviewCard: {
    backgroundColor: '#FFF9F4',
    borderRadius: 24,
    padding: 18,
  },
  reviewHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  reviewSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textLight,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewMetaLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  reviewMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  reviewHelper: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 6,
  },
  reviewActions: {
    flexDirection: 'row',
    marginTop: 14,
  },
  reviewSecondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  reviewSecondaryButtonText: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  reviewPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reviewPrimaryButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  fareRuleLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  fareRuleLinkText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  fareRuleLoader: {
    marginVertical: 24,
  },
  fareRuleScroll: {
    maxHeight: 380,
  },
  fareRuleSection: {
    marginBottom: 16,
  },
  fareRuleRoute: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  fareRulePolicyBlock: {
    marginBottom: 10,
  },
  fareRulePolicyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  fareRulePolicyRow: {
    marginBottom: 6,
  },
  fareRulePolicyWindow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  fareRulePolicyInfo: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 17,
  },
  fareRuleText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 34, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  reviewModalCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F7DDCF',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
    overflow: 'hidden',
  },
  calendarModal: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  calendarEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  calendarTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  calendarCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calendarArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarArrowDisabled: {
    opacity: 0.4,
  },
  calendarMonthLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 6,
  },
  calendarDaySelected: {
    backgroundColor: Colors.primary,
  },
  calendarDayMuted: {
    opacity: 0.8,
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  calendarDayTextFaded: {
    color: Colors.textMuted,
  },
  calendarDayTextDisabled: {
    color: '#C8CED8',
  },
  calendarDayTextSelected: {
    color: Colors.secondary,
  },
  calendarHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 32,
  },
  listContainerEmpty: {
    flexGrow: 1,
    padding: 15,
    paddingBottom: 32,
  },
  listContainerWithFooter: {
    paddingBottom: 96,
  },
  flightCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  flightCardSelected: {
    borderColor: Colors.primary,
  },
  flightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  airlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flightImage: {
    fontSize: 30,
    marginRight: 12,
  },
  airlineName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  flightNo: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  journeyLabel: {
    fontSize: 11,
    color: Colors.primaryDark,
    marginTop: 3,
    fontWeight: '700',
  },
  priceContainer: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  price: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  perPerson: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  flightDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  timeContainer: {
    alignItems: 'center',
    minWidth: 70,
  },
  time: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  city: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 4,
  },
  durationContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  duration: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 8,
  },
  durationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
  },
  planeIcon: {
    fontSize: 20,
    marginHorizontal: 5,
  },
  stops: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 8,
    fontWeight: '600',
  },
  flightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.background,
  },
  amenities: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amenityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  amenityText: {
    marginLeft: 4,
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '600',
  },
  fareTypeBadge: {
    backgroundColor: Colors.primarySoft,
  },
  fareTypeBadgeText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  bookButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 12,
  },
  bookButtonSelected: {
    backgroundColor: Colors.success,
  },
  bookButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    minHeight: 220,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default FlightsScreen;
