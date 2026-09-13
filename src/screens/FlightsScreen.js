import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
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
import useResponsive from '../hooks/useResponsive';
import useHeroHeader from '../hooks/useHeroHeader';
import WebStickyHeader from '../components/web/WebStickyHeader';
import WebHero from '../components/web/WebHero';
import WebSearchPanel, { WebPanelTabs, WebPanelChips } from '../components/web/WebSearchPanel';
import WebField from '../components/web/WebField';
import RangeSlider from '../components/RangeSlider';
import MarkupPrice from '../components/MarkupPrice';
import { useMarkup } from '../context/MarkupContext';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useCart } from '../context/CartContext';
import { AIRPORT_OPTIONS } from '../data/airports';
import { AIRLINE_LOGOS } from '../data/airlineLogos';
import { parseTripJackError } from '../utils/tripjackErrors';

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

const SORT_OPTIONS = [
  { label: 'Best', value: 'BEST', icon: 'sparkles-outline' },
  { label: 'Cheapest', value: 'CHEAPEST', icon: 'cash-outline' },
  { label: 'Fastest', value: 'FASTEST', icon: 'flash-outline' },
  { label: 'Earliest', value: 'EARLIEST', icon: 'time-outline' },
];

// Four-hour-block time-of-day buckets, matching how every airline site slices
// departure/arrival windows.
const TIME_BANDS = [
  { value: 'EARLY', label: '00-06', icon: 'partly-sunny-outline', from: 0, to: 6 },
  { value: 'MORNING', label: '06-12', icon: 'sunny-outline', from: 6, to: 12 },
  { value: 'AFTERNOON', label: '12-18', icon: 'partly-sunny-outline', from: 12, to: 18 },
  { value: 'NIGHT', label: '18-24', icon: 'moon-outline', from: 18, to: 24 },
];

const timeBandOf = (iso) => {
  if (!iso) return null;
  const hour = new Date(iso).getHours();
  return TIME_BANDS.find((band) => hour >= band.from && hour < band.to)?.value || null;
};

const STOPS_FILTERS = [
  { label: 'All stops', value: 'ALL' },
  { label: 'Non-stop', value: 'NONSTOP' },
  { label: '1+ stop', value: 'ONE_PLUS' },
];

const SORT_COMPARATORS = {
  CHEAPEST: (a, b) => a.price - b.price,
  FASTEST: (a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0),
  EARLIEST: (a, b) => new Date(a.departureRaw || 0) - new Date(b.departureRaw || 0),
};

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

const getAirportSuggestions = (query) => {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return [];

  return AIRPORT_OPTIONS.filter(
    (option) => option.city.toUpperCase().includes(normalized) || option.code.includes(normalized)
  ).slice(0, 6);
};

// TripJack's segment city names come back inconsistently cased (e.g. "Navi
// mumbai", "Delhi") - title-case each word so they read as proper names.
const titleCaseCityName = (value) => {
  if (!value) return null;
  return value
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
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

const minutesBetweenIso = (isoStart, isoEnd) => {
  const start = new Date(isoStart);
  const end = new Date(isoEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
};

// Per-segment breakdown for the "View flight details" expand panel - the
// layover between two segments isn't a field TripJack provides directly,
// it's just the gap between one segment's arrival and the next one's
// departure, which we already have from the same search response.
const buildSegmentBreakdown = (segments) =>
  segments.map((segment, index) => {
    const nextSegment = segments[index + 1];
    const gapMinutes = nextSegment ? minutesBetweenIso(segment?.at, nextSegment?.dt) : null;

    return {
      id: segment?.id || `segment-${index}`,
      airline: segment?.fD?.aI?.name || 'Airline',
      flightNo: `${segment?.fD?.aI?.code || ''}-${segment?.fD?.fN || ''}`.replace(/^-|-$/g, ''),
      fromCode: segment?.da?.code || '--',
      fromCity: titleCaseCityName(segment?.da?.city),
      toCode: segment?.aa?.code || '--',
      toCity: titleCaseCityName(segment?.aa?.city),
      departure: formatTime(segment?.dt),
      arrival: formatTime(segment?.at),
      durationLabel: formatDuration(Number(segment?.duration || 0)),
      layover: nextSegment
        ? {
            label: gapMinutes != null ? formatDuration(gapMinutes) : null,
            // Raw minutes as well as the label - the layover-duration filter
            // needs a number, and re-parsing "2h 45m" would be silly.
            minutes: gapMinutes,
            airportCode: segment?.aa?.code || null,
            cityName: titleCaseCityName(segment?.aa?.city),
          }
        : null,
    };
  });

const getBaggageLabel = (fareDetails) => {
  const carry = fareDetails?.bI?.cB;
  const checkIn = fareDetails?.bI?.iB;

  return {
    checkIn: checkIn ? `Baggage ${checkIn}` : 'Baggage info later',
    carry: carry ? `Cabin ${carry}` : 'Cabin bag policy',
  };
};

// Per TripJack's documented Common Object Structure, fd.ADULT.rT is a
// mandatory field on every fare: 0 = Non-Refundable, 1 = Refundable,
// 2 = Partial Refundable - matches the "Refundable"/"Non-refundable" tag
// TripJack's own site shows under each fare.
const REFUNDABLE_LABELS = {
  0: 'Non-refundable',
  1: 'Refundable',
  2: 'Partially refundable',
};

const CABIN_CLASS_LABELS = {
  ECONOMY: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business',
  FIRST: 'First',
};

// Builds the same kind of comma-separated tag line TripJack's site shows
// under each fare (e.g. "Refundable, Economy, Free Meal") from fd.ADULT's
// rT/cc/mI fields - cc and rT are mandatory per the docs, mI is optional and
// only surfaced when true (TripJack's own UI only ever shows "Free Meal",
// never "No Meal").
const getFareTags = (adultFare) => {
  const tags = [];
  if (adultFare?.rT != null && REFUNDABLE_LABELS[adultFare.rT]) {
    tags.push(REFUNDABLE_LABELS[adultFare.rT]);
  }
  if (adultFare?.cc) {
    tags.push(CABIN_CLASS_LABELS[adultFare.cc] || adultFare.cc);
  }
  if (adultFare?.mI) {
    tags.push('Free Meal');
  }
  return tags;
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

// International Return/Multi-City results come back in a single "COMBO" bucket
// with every leg's segments flattened into one sI array (e.g. onward DEL->SIN
// then return SIN->MAA->DEL all in the same array, distinguished only by isRs
// and by sN resetting to 0 at each new leg's first segment) - split on that
// reset so from/to/duration/stops reflect one leg, not the whole chain.
const splitSegmentsIntoLegs = (segments) => {
  const legs = [];
  segments.forEach((segment) => {
    if (legs.length === 0 || Number(segment?.sN) === 0) {
      legs.push([segment]);
    } else {
      legs[legs.length - 1].push(segment);
    }
  });
  return legs;
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

// TripJack's own rule engine expresses these windows in raw hours (e.g.
// 8760 = exactly 365 days = 1 year) - accurate but unreadable as-is.
// Converts to whichever unit reads most naturally: hours under a day,
// otherwise days, rolling up to whole years at 365+ days.
const formatFareRuleHours = (hrs) => {
  const value = Number(hrs);
  if (!Number.isFinite(value)) return String(hrs);
  if (value === 0) return 'departure time';
  if (value < 24) return `${value} hour${value === 1 ? '' : 's'}`;
  const days = Math.round(value / 24);
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
};

const formatFareRulePolicyWindow = (policy) => {
  if (policy?.pp) {
    return policy.pp.replace(/_/g, ' ');
  }
  if (policy?.st != null && policy?.et != null) {
    if (Number(policy.st) === 0) {
      return `Up to ${formatFareRuleHours(policy.et)} before departure`;
    }
    return `${formatFareRuleHours(policy.st)} – ${formatFareRuleHours(policy.et)} before departure`;
  }
  return null;
};

// Cat 16 fare rules can come back as supplier free text wrapped in raw RTF,
// AND/OR with leftover unresolved template placeholder tokens (e.g.
// "__nls_____bs__" gluing straight onto real text) - strip both so the
// plain policy text is readable in the app. Used for both the miscInfo
// free-text path and the structured tfr[].policyInfo path - TripJack's raw
// supplier text can carry this junk in either place.
const stripFareRuleRtf = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/\\par\b/g, '\n')
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r/g, '')
    .replace(/_{2,}(?:[a-zA-Z0-9]{1,8}_{2,})+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const buildFlightCartItem = ({ flights, reviewResponse, passengerCounts, markupAmount = 0 }) => {
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
    id: `flight-${legs.map((leg) => leg.fareId || leg.id).join('_')}`,
    title,
    destination,
    duration: primaryLeg.duration,
    // lineTotal is what the CART and CHECKOUT display, so it is the customer
    // price - supplier fare plus our markup. supplierTotal keeps the amount
    // TripJack is actually paid, which no display should use.
    price: (lineTotal + markupAmount) / (people || 1),
    people: people || 1,
    supplierTotal: lineTotal || primaryLeg?.price || 0,
    markupAmount,
    lineTotal: (lineTotal || primaryLeg?.price || 0) + markupAmount,
    adults: Number(passengerCounts?.adults || 0),
    children: Number(passengerCounts?.children || 0),
    infants: Number(passengerCounts?.infants || 0),
    image: 'Flight',
    iconName: 'airplane-outline',
    // Which markup and coupon rules apply to this line. Without it the cart
    // has to guess, and a FLIGHT-only coupon was being rejected on a flight.
    productType: 'FLIGHT',
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
    const legs = splitSegmentsIntoLegs(segments);
    const primaryLegSegments = legs[0] || segments;
    const additionalLegs = legs.slice(1);
    const firstSegment = primaryLegSegments[0];
    const lastSegment = primaryLegSegments[primaryLegSegments.length - 1];
    // Connecting flights can switch operating carrier mid-journey - show the
    // generic "multi-airline" logo rather than just the first segment's one.
    const distinctCarrierCodes = new Set(
      primaryLegSegments.map((segment) => segment?.fD?.aI?.code).filter(Boolean)
    );
    const airlineCode = distinctCarrierCodes.size > 1 ? 'MULTI' : firstSegment?.fD?.aI?.code || null;
    const totalDuration = primaryLegSegments.reduce((sum, segment) => sum + Number(segment?.duration || 0), 0);
    // segment.stops is each individual flight's own technical stopover count
    // (rare, usually 0) - it does NOT count the connections between segments
    // themselves. A leg with 2 segments and a layover (e.g. NMI -> PAT via a
    // plane change) has both segments individually non-stop, so summing just
    // segment.stops always read 0 and mislabeled every connecting itinerary
    // as "Non-stop". The real stop count is (segments - 1) connections, plus
    // whatever technical stops each individual segment additionally has.
    const totalStops =
      (primaryLegSegments.length - 1) +
      primaryLegSegments.reduce((sum, segment) => sum + Number(segment?.stops || 0), 0);
    const additionalLegSummaries = additionalLegs.map((legSegments) => {
      const legFirst = legSegments[0];
      const legLast = legSegments[legSegments.length - 1];
      return `${legFirst?.da?.code || '--'} → ${legLast?.aa?.code || '--'}`;
    });
    const journeyLabel = additionalLegSummaries.length
      ? `${buildJourneyLabel(bucket)} (+ ${additionalLegSummaries.join(', ')})`
      : buildJourneyLabel(bucket);
    const priceOptions = Array.isArray(trip?.totalPriceList) ? trip.totalPriceList : [];
    if (priceOptions.length === 0) {
      return;
    }

    // Each entry in totalPriceList is a DIFFERENT alternate fare (e.g. Classic vs
    // Flex) for this SAME flight - not a different leg. They used to become
    // separate cards, which duplicated the same flight in the list; now they're
    // collapsed into one card with a fare toggle (see fareOptions/renderFlight).
    const fareOptions = priceOptions.map((priceOption, priceIndex) => {
      const adultFare = priceOption?.fd?.ADULT;
      const baggage = getBaggageLabel(adultFare);
      return {
        id: priceOption?.id || `${firstSegment?.id}-${priceIndex}`,
        price: Number(adultFare?.fC?.TF || 0),
        checkInBaggage: baggage.checkIn,
        cabinBaggage: baggage.carry,
        fareType: priceOption?.fareIdentifier || 'PUBLISHED',
        fareTags: getFareTags(adultFare),
        // The Review API expects exactly one price id per leg.
        priceIds: priceOption?.id ? [priceOption.id] : [],
        passengerPricing: getPassengerPricing(priceOption?.fd),
        // Special Return fares (fareIdentifier === 'SPECIAL_RETURN') are
        // priced as a matched onward+return pair per TripJack's FAQ: this
        // fare's own "sri" tag must appear in the OTHER leg's selected
        // fare's "msri" list (and vice versa) - see validateFarePairing.
        // Ordinary fares have no sri and an empty msri, i.e. no constraint.
        sri: priceOption?.sri || null,
        msri: Array.isArray(priceOption?.msri) ? priceOption.msri : [],
      };
    });
    const cheapestFareIndex = fareOptions.reduce(
      (bestIndex, option, index) => (option.price < fareOptions[bestIndex].price ? index : bestIndex),
      0
    );
    const defaultFare = fareOptions[cheapestFareIndex];

    const legBreakdown = buildSegmentBreakdown(primaryLegSegments);
    const layoverStats = legBreakdown.reduce(
      (acc, segment) => {
        if (!segment.layover) return acc;
        if (typeof segment.layover.minutes === 'number') {
          acc.maxMinutes = Math.max(acc.maxMinutes, segment.layover.minutes);
        }
        if (segment.layover.airportCode) acc.airports.push(segment.layover.airportCode);
        return acc;
      },
      { maxMinutes: 0, airports: [] },
    );

    cards.push({
      id: `${bucket}-${tripIndex}-${firstSegment?.id}`,
      groupKey: bucket,
      airline: firstSegment?.fD?.aI?.name || 'Airline',
      airlineCode,
      flightNo: `${firstSegment?.fD?.aI?.code || ''}-${firstSegment?.fD?.fN || ''}`.replace(/^-|-$/g, ''),
      from: firstSegment?.da?.code || firstSegment?.da?.city || '--',
      // A city search (e.g. "Mumbai") can return itineraries departing from
      // a DIFFERENT airport serving that same metro area (e.g. NMI - Navi
      // Mumbai Intl - instead of BOM) - showing the bare code with no city
      // name made a perfectly correct connecting itinerary look broken.
      fromCityName: titleCaseCityName(firstSegment?.da?.city),
      // TripJack's own segment data already carries the real ISO country
      // code per airport - used by FlightBookingScreen to auto-detect the
      // TripSafe Embedded insurance destination/eligibility without any
      // separate airport->country lookup table.
      fromCountryCode: firstSegment?.da?.countryCode || null,
      to: lastSegment?.aa?.code || lastSegment?.aa?.city || '--',
      toCityName: titleCaseCityName(lastSegment?.aa?.city),
      toCountryCode: lastSegment?.aa?.countryCode || null,
      // TripJack reports a terminal per airport on most domestic segments, but
      // not all - null means "not published", which the filter treats as
      // unfilterable rather than as its own bucket.
      departureTerminal: firstSegment?.da?.terminal || null,
      arrivalTerminal: lastSegment?.aa?.terminal || null,
      // Longest single layover on this leg, and the airports stopped at.
      // Non-stop itineraries get 0 and an empty list, which the filters read
      // as "no layover to constrain" rather than excluding them.
      maxLayoverMinutes: layoverStats.maxMinutes,
      layoverAirports: layoverStats.airports,
      departure: formatTime(firstSegment?.dt),
      departureRaw: firstSegment?.dt || null,
      arrival: formatTime(lastSegment?.at),
      arrivalRaw: lastSegment?.at || null,
      duration: formatDuration(totalDuration || firstSegment?.duration),
      durationMinutes: Number(totalDuration || firstSegment?.duration || 0),
      stops: totalStops === 0 ? 'Non-stop' : `${totalStops} stop`,
      stopsCount: totalStops,
      image: 'airplane',
      journeyLabel,
      segmentCount: segments.length,
      segments: legBreakdown,
      fareOptions,
      defaultFareIndex: cheapestFareIndex,
      // Mirror the default (cheapest) fare at the top level so sorting,
      // filtering, cart building, and multi-leg review - all of which read
      // these fields directly off the flight/leg object - keep working
      // whether or not the user has touched the fare toggle on this card.
      price: defaultFare.price,
      checkInBaggage: defaultFare.checkInBaggage,
      cabinBaggage: defaultFare.cabinBaggage,
      fareType: defaultFare.fareType,
      fareTags: defaultFare.fareTags,
      priceIds: defaultFare.priceIds,
      passengerPricing: defaultFare.passengerPricing,
    });
  });

  return cards;
};

const FlightsScreen = ({ navigation }) => {
  const { centeredContent, isDesktop } = useResponsive();
  const { markupFor } = useMarkup();
  const { scrolled, scrollProps } = useHeroHeader();
  const { addItemToCart } = useCart();
  const [tripType, setTripType] = useState('ONE_WAY');
  const [routes, setRoutes] = useState([createEmptyRoute('', '', '')]);
  const [returnDate, setReturnDate] = useState('');
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const [infants, setInfants] = useState('0');
  const [cabinClass, setCabinClass] = useState('ECONOMY');
  const [connectionFilter, setConnectionFilter] = useState('BOTH');

  // Multi-city has a variable number of legs, so it keeps the stacked form even
  // on desktop - there is no honest way to put N legs on one row.
  // Declared after tripType: reading a const before its declaration throws.
  const useWebPanel = isDesktop;

  // Which markup rule applies: domestic/international x oneway/round. Derived
  // from the results themselves so a city search that returns an international
  // routing is priced correctly.
  const markupCategory = (flight) => {
    const international =
      flight?.fromCountryCode && flight?.toCountryCode
        ? flight.fromCountryCode !== flight.toCountryCode
        : false;
    const round = tripType === 'RETURN';
    if (international) return round ? 'INTERNATIONAL_ROUND' : 'INTERNATIONAL_ONEWAY';
    return round ? 'DOMESTIC_ROUND' : 'DOMESTIC_ONEWAY';
  };

  // Customer-facing price for a flight: supplier fare plus whatever markup
  // applies to that airline and trip type. Used by every display below; the
  // supplier amount is never shown.
  const sell = (flight, base) =>
    Number(base || 0) +
    markupFor('FLIGHT', markupCategory(flight), Number(base || 0), 1, flight?.airlineCode);
  const [sortBy, setSortBy] = useState('BEST');
  const [stopsFilter, setStopsFilter] = useState('ALL');

  // Result filters. Empty set = no constraint, so a fresh search shows
  // everything without having to seed these from the response.
  const [priceRange, setPriceRange] = useState(null);   // { low, high } or null
  const [stopCounts, setStopCounts] = useState(new Set());
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [departBands, setDepartBands] = useState(new Set());
  const [arriveBands, setArriveBands] = useState(new Set());
  const [airlineCodes, setAirlineCodes] = useState(new Set());
  const [depTerminals, setDepTerminals] = useState(new Set());
  const [arrTerminals, setArrTerminals] = useState(new Set());
  const [durationRange, setDurationRange] = useState(null);
  const [layoverRange, setLayoverRange] = useState(null);
  const [layoverAirports, setLayoverAirports] = useState(new Set());
  const [depAirports, setDepAirports] = useState(new Set());
  const [arrAirports, setArrAirports] = useState(new Set());
  const [flightNoQuery, setFlightNoQuery] = useState('');
  const [returnLayoutMode, setReturnLayoutMode] = useState('split');
  const [fareType, setFareType] = useState('REGULAR');
  const [preferredAirlines, setPreferredAirlines] = useState('');
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState([]);
  const [searched, setSearched] = useState(false);
  const [reviewedFare, setReviewedFare] = useState(null);
  const [fareRuleState, setFareRuleState] = useState({ visible: false, loading: false, data: null, error: null });
  const [selectedByGroup, setSelectedByGroup] = useState({});
  // Which fare (Classic/Flex/...) is toggled on for each flight card, keyed
  // by flight.id. Falls back to that card's cheapest fare when untouched.
  const [selectedFareIndexById, setSelectedFareIndexById] = useState({});
  const [expandedDetailIds, setExpandedDetailIds] = useState({});
  const [activeGroupKey, setActiveGroupKey] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [travellerModalVisible, setTravellerModalVisible] = useState(false);
  const [showAirlineInput, setShowAirlineInput] = useState(false);
  const [airportSuggestFor, setAirportSuggestFor] = useState(null);
  const today = startOfDay(new Date());
  const [calendarState, setCalendarState] = useState({
    visible: false,
    target: null,
    routeIndex: null,
    month: startOfMonth(today),
    selected: today,
    // Round-trip's Departure field opens in range mode - one continuous
    // session picks both dates instead of two separate opens. pendingStart
    // holds the departure date once picked, while selected stays the day
    // currently highlighted in the grid (start, until the return is
    // confirmed and the modal closes).
    rangeMode: false,
    pendingStart: null,
  });

  const updateRoute = (index, key, value) => {
    setRoutes((currentRoutes) =>
      currentRoutes.map((route, routeIndex) =>
        routeIndex === index ? { ...route, [key]: value } : route
      )
    );
  };

  const chooseAirportSuggestion = (index, field, option) => {
    updateRoute(index, field, option.city);
    setAirportSuggestFor(null);
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
      const second = routes[1] || createEmptyRoute('', '', '');
      setRoutes([first, second]);
    }
  };

  const swapRouteCities = (index) => {
    setAirportSuggestFor(null);
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
      appAlert('Route limit', 'TripJack multi-city search supports up to 6 route segments.');
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
    setAirportSuggestFor(null);
    const adultCount = Number(adults || 0);
    const childCount = Number(children || 0);
    const infantCount = Number(infants || 0);

    if (adultCount <= 0) {
      appAlert('Passengers required', 'Enter at least 1 adult passenger.');
      return;
    }

    if (infantCount > adultCount) {
      appAlert('Infant limit', 'Infants cannot be more than adults.');
      return;
    }

    // TripJack error codes 1119/1120: children/infants can't be included in
    // a Student or Senior Citizen fare search - catch this before the round
    // trip to the API rather than surfacing their raw error code.
    if ((fareType === 'STUDENT' || fareType === 'SENIOR_CITIZEN') && (childCount > 0 || infantCount > 0)) {
      appAlert(
        'Fare type restriction',
        `${fareType === 'STUDENT' ? 'Student' : 'Senior Citizen'} fares only support adult passengers - remove children/infants or switch to Regular fare.`
      );
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
      setActiveGroupKey(null);
      setSortBy('BEST');
      setStopsFilter('ALL');
      // Facets are derived from the previous result set, so carrying filters
      // across a new search would silently hide everything.
      setPriceRange(null);
      setStopCounts(new Set());
      setDepartBands(new Set());
      setArriveBands(new Set());
      setAirlineCodes(new Set());
      setDepTerminals(new Set());
      setArrTerminals(new Set());
      setDurationRange(null);
      setLayoverRange(null);
      setLayoverAirports(new Set());
      setDepAirports(new Set());
      setArrAirports(new Set());
      setFlightNoQuery('');

      console.log('[search] REQUEST', JSON.stringify(payload));
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('[search] RESPONSE', JSON.stringify(data));
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to search flights right now.');
      }

      const results = mapFlightsFromResponse(data);
      setFlights(results);
      setShowFilters(results.length === 0);
    } catch (error) {
      setFlights([]);
      appAlert('Flight Search', error.message || 'Unable to fetch flights right now.');
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
  // Which leg's options are currently shown below the chips - defaults to the
  // first leg (Onward) until the user taps a different chip or a selection
  // auto-advances it.
  const effectiveActiveGroupKey = activeGroupKey || groupKeys[0];

  // Sort/stop-filter the already-fetched results client-side (no re-search
  // round trip), then scope down to just the active leg - with 900+ combined
  // onward+return options in a domestic round trip, showing everything in one
  // flat list makes the return leg practically unreachable by scrolling.
  // Everything the filter UI needs, derived from the flights actually returned
  // for the leg being viewed - so the options and counts always match what is
  // on screen rather than the whole multi-leg response.
  const filterPool = useMemo(
    () =>
      isMultiLeg && effectiveActiveGroupKey
        ? flights.filter((flight) => flight.groupKey === effectiveActiveGroupKey)
        : flights,
    [flights, isMultiLeg, effectiveActiveGroupKey],
  );

  const facets = useMemo(() => {
    if (!filterPool.length) {
      return {
        priceMin: 0,
        priceMax: 0,
        airlines: [],
        stops: [],
        departBands: new Set(),
        arriveBands: new Set(),
        originLabel: '',
        destinationLabel: '',
        depTerminals: [],
        arrTerminals: [],
        durationMin: 0,
        durationMax: 0,
        layoverMin: 0,
        layoverMax: 0,
        layoverAirports: [],
        depAirports: [],
        arrAirports: [],
      };
    }

    const prices = filterPool.map((flight) => flight.price || 0);
    const byAirline = new Map();
    const stopSet = new Set();
    const departSet = new Set();
    const arriveSet = new Set();
    const depTerminalSet = new Map();
    const arrTerminalSet = new Map();
    const layoverAirportSet = new Map();
    const depAirportSet = new Map();
    const arrAirportSet = new Map();

    filterPool.forEach((flight) => {
      const code = flight.airlineCode || flight.airline;
      const entry = byAirline.get(code);
      if (entry) {
        entry.count += 1;
        entry.minPrice = Math.min(entry.minPrice, flight.price || 0);
      } else {
        byAirline.set(code, {
          code,
          label: flight.airline,
          count: 1,
          minPrice: flight.price || 0,
        });
      }

      stopSet.add(Math.min(flight.stopsCount || 0, 3));
      const d = timeBandOf(flight.departureRaw);
      if (d) departSet.add(d);
      const a = timeBandOf(flight.arrivalRaw);
      if (a) arriveSet.add(a);

      if (flight.departureTerminal) {
        depTerminalSet.set(`${flight.from}|${flight.departureTerminal}`, {
          airport: flight.from,
          terminal: flight.departureTerminal,
        });
      }
      if (flight.arrivalTerminal) {
        arrTerminalSet.set(`${flight.to}|${flight.arrivalTerminal}`, {
          airport: flight.to,
          terminal: flight.arrivalTerminal,
        });
      }

      (flight.layoverAirports || []).forEach((code) => {
        if (code) layoverAirportSet.set(code, { code });
      });
      if (flight.from) depAirportSet.set(flight.from, { code: flight.from, label: flight.fromCityName });
      if (flight.to) arrAirportSet.set(flight.to, { code: flight.to, label: flight.toCityName });
    });

    const durations = filterPool.map((flight) => flight.durationMinutes || 0);
    const layovers = filterPool
      .map((flight) => flight.maxLayoverMinutes || 0)
      .filter((minutes) => minutes > 0);

    const groupTerminals = (map) => {
      const byAirport = new Map();
      [...map.entries()].forEach(([key, value]) => {
        const list = byAirport.get(value.airport) || [];
        list.push({ key, terminal: value.terminal });
        byAirport.set(value.airport, list);
      });
      return [...byAirport.entries()].map(([airport, terminals]) => ({
        airport,
        terminals: terminals.sort((a, b) => a.terminal.localeCompare(b.terminal)),
      }));
    };

    return {
      priceMin: Math.floor(Math.min(...prices)),
      priceMax: Math.ceil(Math.max(...prices)),
      airlines: [...byAirline.values()].sort((a, b) => a.minPrice - b.minPrice),
      stops: [...stopSet].sort((a, b) => a - b),
      departBands: departSet,
      arriveBands: arriveSet,
      // Taken from the results rather than the search form, so a city search
      // that returned a different airport still labels the section correctly.
      originLabel: filterPool[0]?.fromCityName || filterPool[0]?.from || '',
      destinationLabel: filterPool[0]?.toCityName || filterPool[0]?.to || '',
      depTerminals: groupTerminals(depTerminalSet),
      arrTerminals: groupTerminals(arrTerminalSet),
      durationMin: Math.floor(Math.min(...durations)),
      durationMax: Math.ceil(Math.max(...durations)),
      layoverMin: layovers.length ? Math.floor(Math.min(...layovers)) : 0,
      layoverMax: layovers.length ? Math.ceil(Math.max(...layovers)) : 0,
      layoverAirports: [...layoverAirportSet.values()],
      depAirports: [...depAirportSet.values()],
      arrAirports: [...arrAirportSet.values()],
    };
  }, [filterPool]);

  const activeFilterCount =
    (priceRange ? 1 : 0) +
    stopCounts.size +
    departBands.size +
    arriveBands.size +
    airlineCodes.size +
    depTerminals.size +
    arrTerminals.size +
    (durationRange ? 1 : 0) +
    (layoverRange ? 1 : 0) +
    layoverAirports.size +
    depAirports.size +
    arrAirports.size +
    (flightNoQuery.trim() ? 1 : 0);

  const clearAllFilters = () => {
    setPriceRange(null);
    setStopCounts(new Set());
    setDepartBands(new Set());
    setArriveBands(new Set());
    setAirlineCodes(new Set());
    setDepTerminals(new Set());
    setArrTerminals(new Set());
    setDurationRange(null);
    setLayoverRange(null);
    setLayoverAirports(new Set());
    setDepAirports(new Set());
    setArrAirports(new Set());
    setFlightNoQuery('');
  };

  const toggleInSet = (setter, value) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const visibleFlights = useMemo(() => {
    let list = flights;
    if (isMultiLeg && effectiveActiveGroupKey) {
      list = list.filter((flight) => flight.groupKey === effectiveActiveGroupKey);
    }
    if (stopsFilter === 'NONSTOP') {
      list = list.filter((flight) => flight.stopsCount === 0);
    } else if (stopsFilter === 'ONE_PLUS') {
      list = list.filter((flight) => flight.stopsCount > 0);
    }

    if (priceRange) {
      list = list.filter(
        (flight) => (flight.price || 0) >= priceRange.low && (flight.price || 0) <= priceRange.high,
      );
    }
    if (stopCounts.size) {
      list = list.filter((flight) => stopCounts.has(Math.min(flight.stopsCount || 0, 3)));
    }
    if (departBands.size) {
      list = list.filter((flight) => departBands.has(timeBandOf(flight.departureRaw)));
    }
    if (arriveBands.size) {
      list = list.filter((flight) => arriveBands.has(timeBandOf(flight.arrivalRaw)));
    }
    if (airlineCodes.size) {
      list = list.filter((flight) => airlineCodes.has(flight.airlineCode || flight.airline));
    }
    // Departure and arrival terminals are independent groups: selections inside
    // one are an OR, across the two an AND.
    if (depTerminals.size) {
      list = list.filter((flight) => depTerminals.has(`${flight.from}|${flight.departureTerminal}`));
    }
    if (arrTerminals.size) {
      list = list.filter((flight) => arrTerminals.has(`${flight.to}|${flight.arrivalTerminal}`));
    }
    if (durationRange) {
      list = list.filter(
        (flight) =>
          (flight.durationMinutes || 0) >= durationRange.low &&
          (flight.durationMinutes || 0) <= durationRange.high,
      );
    }
    if (layoverRange) {
      // A non-stop has no layover to constrain, so it always qualifies rather
      // than being excluded for falling below the lower bound.
      list = list.filter(
        (flight) =>
          !flight.maxLayoverMinutes ||
          (flight.maxLayoverMinutes >= layoverRange.low &&
            flight.maxLayoverMinutes <= layoverRange.high),
      );
    }
    if (layoverAirports.size) {
      list = list.filter((flight) =>
        (flight.layoverAirports || []).some((code) => layoverAirports.has(code)),
      );
    }
    if (depAirports.size) {
      list = list.filter((flight) => depAirports.has(flight.from));
    }
    if (arrAirports.size) {
      list = list.filter((flight) => arrAirports.has(flight.to));
    }
    if (flightNoQuery.trim()) {
      // Match "6E-123", "6E123" or "123" against the leg's own number and every
      // segment's, so a connecting itinerary is findable by any of its flights.
      const needle = flightNoQuery.replace(/[\s-]/g, '').toUpperCase();
      list = list.filter((flight) => {
        const candidates = [flight.flightNo, ...(flight.segments || []).map((seg) => seg.flightNo)];
        return candidates.some((value) =>
          (value || '').replace(/[\s-]/g, '').toUpperCase().includes(needle),
        );
      });
    }

    const comparator = SORT_COMPARATORS[sortBy];
    if (!comparator) {
      return list;
    }
    return [...list].sort(comparator);
  }, [
    flights,
    sortBy,
    stopsFilter,
    isMultiLeg,
    effectiveActiveGroupKey,
    priceRange,
    stopCounts,
    departBands,
    arriveBands,
    airlineCodes,
    depTerminals,
    arrTerminals,
    durationRange,
    layoverRange,
    layoverAirports,
    depAirports,
    arrAirports,
    flightNoQuery,
  ]);

  const runReview = async (legs) => {
    const priceIds = legs.flatMap((leg) => leg.priceIds || []);
    if (!priceIds.length) {
      appAlert('Review unavailable', 'This fare is missing the TripJack review identifier.');
      return;
    }

    try {
      setLoading(true);
      console.log('[review] REQUEST', JSON.stringify({ priceIds }));
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceIds }),
      });

      const data = await response.json();
      console.log('[review] RESPONSE', JSON.stringify(data));
      if (!response.ok) {
        throw parseTripJackError(data, 'Unable to review this fare right now.');
      }

      const passengerCounts = {
        adults: Number(adults || 0),
        children: Number(children || 0),
        infants: Number(infants || 0),
      };
      const reviewTotal = getReviewGrandTotal(data) || 0;
      const cartItem = buildFlightCartItem({
        flights: legs,
        reviewResponse: data,
        passengerCounts,
        markupAmount: markupFor(
          'FLIGHT',
          markupCategory(legs[0]),
          reviewTotal,
          Number(adults || 0) + Number(children || 0) + Number(infants || 0),
          legs[0]?.airlineCode,
        ),
      });

      setReviewedFare({
        flights: legs,
        reviewResponse: data,
        passengerCounts,
        cartItem,
      });
    } catch (error) {
      const message = error.message || 'Unable to review this fare right now.';
      // Fares/priceIds returned by Search go stale after a while server-side
      // (confirmed live: TripJack rejects a review made ~10 minutes after
      // the original search with "Keys Passed... already expired" - see
      // parseTripJackError's TEXT_MATCHED_ERRORS) - offer to search again
      // right from here instead of just showing a dead end.
      if (error.sessionDead) {
        appAlert('Review Fare', message, [
          { text: 'Search Again', onPress: () => searchFlights() },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        appAlert('Review Fare', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const reviewFare = (flight) => runReview([flight]);

  const closeFareRules = () => setFareRuleState({ visible: false, loading: false, data: null, error: null });

  const viewFareRules = async () => {
    const bookingId = reviewedFare?.reviewResponse?.bookingId;
    if (!bookingId) {
      appAlert('Fare Rules', 'Fare rule lookup needs a reviewed fare first.');
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

  const getSelectedFareIndex = (flight) => selectedFareIndexById[flight.id] ?? flight.defaultFareIndex ?? 0;

  // Returns a copy of the flight card with its top-level price/baggage/fareType/
  // priceIds/passengerPricing swapped to the given fare option, so every place
  // downstream that reads those fields directly (sorting, review, cart, the
  // multi-leg selection summary) sees whichever fare is currently toggled on.
  const getFlightWithFare = (flight, fareIndex = getSelectedFareIndex(flight)) => {
    const fare = flight.fareOptions?.[fareIndex];
    if (!fare) return flight;
    return {
      ...flight,
      price: fare.price,
      checkInBaggage: fare.checkInBaggage,
      cabinBaggage: fare.cabinBaggage,
      fareType: fare.fareType,
      fareTags: fare.fareTags,
      priceIds: fare.priceIds,
      passengerPricing: fare.passengerPricing,
      sri: fare.sri,
      msri: fare.msri,
      // Kept separate from `id` (which stays the flight card's id, used for
      // leg-selection matching in isSelected/selectedByGroup) so cart items
      // built from different fares of the same flight get distinct ids
      // instead of one overwriting the other - see buildFlightCartItem.
      fareId: fare.id,
    };
  };

  const toggleFlightDetails = (flightId) => {
    setExpandedDetailIds((prev) => ({ ...prev, [flightId]: !prev[flightId] }));
  };

  const chooseFareForFlight = (flight, fareIndex) => {
    setSelectedFareIndexById((prev) => ({ ...prev, [flight.id]: fareIndex }));
    // If this flight is already the selected pick for its leg, keep the
    // selection in sync with the newly toggled fare rather than leaving it
    // pointed at the fare that was active when it was first selected.
    if (isMultiLeg && selectedByGroup[flight.groupKey]?.id === flight.id) {
      selectFlightForGroup(getFlightWithFare(flight, fareIndex));
    }
  };

  const selectFlightForGroup = (flight) => {
    setSelectedByGroup((prev) => {
      const next = { ...prev, [flight.groupKey]: flight };
      // Auto-advance to the next leg that still needs a pick (e.g. Onward ->
      // Return), same flow real flight sites use, instead of leaving the user
      // to notice and tap the next chip themselves.
      const nextUnselected = groupKeys.find((key) => key !== flight.groupKey && !next[key]);
      if (nextUnselected) {
        setActiveGroupKey(nextUnselected);
      }
      return next;
    });
    setReviewedFare(null);
  };

  // Per TripJack's FAQ ("How to support Special Return Fare in case of
  // Domestic Return?"): a SPECIAL_RETURN fare's own "sri" tag must appear in
  // the OTHER leg's selected fare's "msri" list, and vice versa - it's
  // priced as a matched pair, not an independent per-leg choice. Catches
  // the mismatch before hitting TripJack's review endpoint (error 1080)
  // instead of after.
  const validateSpecialReturnPairing = (onwardFare, returnFare) => {
    if (!onwardFare || !returnFare) return null;

    const onwardIsSpecial = onwardFare.fareType === 'SPECIAL_RETURN' && onwardFare.sri;
    const returnIsSpecial = returnFare.fareType === 'SPECIAL_RETURN' && returnFare.sri;

    if (!onwardIsSpecial && !returnIsSpecial) {
      return null;
    }

    const onwardMatchesReturn = onwardIsSpecial && (returnFare.sri ? (onwardFare.msri || []).includes(returnFare.sri) : false);
    const returnMatchesOnward = returnIsSpecial && (onwardFare.sri ? (returnFare.msri || []).includes(onwardFare.sri) : false);

    if (onwardIsSpecial && returnIsSpecial && onwardMatchesReturn && returnMatchesOnward) {
      return null;
    }

    return 'Your onward and return fares don\'t match up. A "Special Return" fare on one leg can only be booked with its paired "Special Return" fare on the other leg - pick matching fares for both, or switch both legs to a regular fare instead.';
  };

  const reviewSelectedFares = () => {
    if (!allLegsSelected) {
      return;
    }

    if (groupKeys.length === 2) {
      const pairingIssue = validateSpecialReturnPairing(selectedByGroup[groupKeys[0]], selectedByGroup[groupKeys[1]]);
      if (pairingIssue) {
        appAlert('Fares Don\'t Match', pairingIssue);
        return;
      }
    }

    runReview(groupKeys.map((key) => selectedByGroup[key]));
  };

  const addReviewedFareToCart = () => {
    if (!reviewedFare?.cartItem) {
      return;
    }

    addItemToCart(reviewedFare.cartItem);
    appAlert('Added to cart', `${reviewedFare.cartItem.title} is ready in your cart.`);
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

  const holdThisFare = () => {
    if (!reviewedFare) {
      return;
    }

    const { flights, reviewResponse, passengerCounts } = reviewedFare;
    setReviewedFare(null);
    // push, not navigate - if a FlightBooking screen from an earlier hold is
    // already in the stack, navigate() would jump back to that existing
    // instance instead of opening a new one, silently popping this Flights
    // screen out of the stack in between. That left the back button on the
    // booking screen going all the way to Home instead of back to search.
    navigation.push('FlightBooking', { flights, reviewResponse, passengerCounts });
  };

  const renderFlight = ({ item }) => {
    const isSelected = isMultiLeg && selectedByGroup[item.groupKey]?.id === item.id;
    const hasFareChoice = (item.fareOptions?.length || 0) > 1;
    const selectedFareIndex = getSelectedFareIndex(item);
    const selectedFare = item.fareOptions?.[selectedFareIndex] || item;

    return (
      <TouchableOpacity
        style={[styles.flightCard, isSelected && styles.flightCardSelected]}
        activeOpacity={0.8}
        onPress={isMultiLeg ? () => selectFlightForGroup(getFlightWithFare(item, selectedFareIndex)) : undefined}
      >
        <View style={styles.flightHeader}>
          <View style={styles.airlineInfo}>
            {AIRLINE_LOGOS[item.airlineCode] ? (
              <Image source={AIRLINE_LOGOS[item.airlineCode]} style={styles.airlineLogo} resizeMode="contain" />
            ) : (
              <Ionicons name={item.image} size={26} color={Colors.primary} style={styles.flightImage} />
            )}
            <View>
              <Text style={styles.airlineName}>{item.airline}</Text>
              <Text style={styles.flightNo}>{item.flightNo || 'Flight details'}</Text>
              <Text style={styles.journeyLabel}>{item.journeyLabel}{item.segmentCount > 1 ? ` • ${item.segmentCount} segments` : ''}</Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <MarkupPrice
              service="FLIGHT"
              category={markupCategory(item)}
              entityKey={item.airlineCode}
              baseAmount={selectedFare.price}
              paxCount={1}
              priceStyle={styles.price}
            />
            <Text style={styles.perPerson}>per adult</Text>
          </View>
        </View>

        <View style={styles.flightDetails}>
          <View style={styles.timeContainer}>
            <Text style={styles.time}>{item.departure}</Text>
            <Text style={styles.city}>{item.from}</Text>
            {item.fromCityName ? (
              <Text style={styles.cityName} numberOfLines={1}>{item.fromCityName}</Text>
            ) : null}
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
            {item.toCityName ? (
              <Text style={styles.cityName} numberOfLines={1}>{item.toCityName}</Text>
            ) : null}
          </View>
        </View>

        {item.segmentCount > 1 ? (
          <TouchableOpacity
            style={styles.detailsToggle}
            activeOpacity={0.7}
            onPress={() => toggleFlightDetails(item.id)}
          >
            <Text style={styles.detailsToggleText}>
              {expandedDetailIds[item.id] ? 'Hide flight details' : 'View flight details'}
            </Text>
            <Ionicons
              name={expandedDetailIds[item.id] ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={Colors.primaryDark}
            />
          </TouchableOpacity>
        ) : null}

        {item.segmentCount > 1 && expandedDetailIds[item.id] ? (
          <View style={styles.segmentBreakdown}>
            {item.segments.map((segment) => (
              <React.Fragment key={segment.id}>
                <View style={styles.segmentRow}>
                  <View style={styles.segmentTimeCol}>
                    <Text style={styles.segmentTime}>{segment.departure}</Text>
                    <Text style={styles.segmentCode}>{segment.fromCode}</Text>
                    {segment.fromCity ? (
                      <Text style={styles.segmentCityName} numberOfLines={1}>{segment.fromCity}</Text>
                    ) : null}
                  </View>
                  <View style={styles.segmentMidCol}>
                    <Ionicons name="airplane" size={13} color={Colors.primary} />
                    <Text style={styles.segmentFlightNo} numberOfLines={1}>
                      {segment.airline} · {segment.flightNo}
                    </Text>
                    <Text style={styles.segmentDuration}>{segment.durationLabel}</Text>
                  </View>
                  <View style={styles.segmentTimeCol}>
                    <Text style={styles.segmentTime}>{segment.arrival}</Text>
                    <Text style={styles.segmentCode}>{segment.toCode}</Text>
                    {segment.toCity ? (
                      <Text style={styles.segmentCityName} numberOfLines={1}>{segment.toCity}</Text>
                    ) : null}
                  </View>
                </View>

                {segment.layover ? (
                  <View style={styles.layoverRow}>
                    <Ionicons name="time-outline" size={13} color="#8A6100" />
                    <Text style={styles.layoverText}>
                      {segment.layover.label ? `${segment.layover.label} layover` : 'Layover'}
                      {segment.layover.cityName
                        ? ` at ${segment.layover.cityName} (${segment.layover.airportCode})`
                        : ''}
                    </Text>
                  </View>
                ) : null}
              </React.Fragment>
            ))}
          </View>
        ) : null}

        {hasFareChoice && (
          <View style={styles.fareOptionsRow}>
            {item.fareOptions.map((fare, index) => {
              const active = index === selectedFareIndex;
              return (
                <TouchableOpacity
                  key={fare.id}
                  style={[styles.fareOptionChip, active && styles.fareOptionChipActive]}
                  activeOpacity={0.7}
                  onPress={() => chooseFareForFlight(item, index)}
                >
                  <Text style={[styles.fareOptionChipLabel, active && styles.fareOptionChipLabelActive]}>
                    {fare.fareType}
                  </Text>
                  <Text style={[styles.fareOptionChipPrice, active && styles.fareOptionChipPriceActive]}>
                    ₹{Math.round(sell(item, fare.price)).toLocaleString()}
                  </Text>
                  {fare.fareTags.length > 0 && (
                    <Text style={[styles.fareOptionChipTags, active && styles.fareOptionChipTagsActive]}>
                      {fare.fareTags.join(' · ')}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.flightFooter}>
          <View style={styles.amenities}>
            <View style={styles.amenityBadge}>
              <Ionicons name="briefcase-outline" size={11} color={Colors.primaryDark} />
              <Text style={styles.amenityText}>{selectedFare.checkInBaggage}</Text>
            </View>
            <View style={styles.amenityBadge}>
              <Ionicons name="bag-handle-outline" size={11} color={Colors.primaryDark} />
              <Text style={styles.amenityText}>{selectedFare.cabinBaggage}</Text>
            </View>
            {!hasFareChoice && (
              <>
                <View style={[styles.amenityBadge, styles.fareTypeBadge]}>
                  <Text style={styles.fareTypeBadgeText}>{selectedFare.fareType}</Text>
                </View>
                {selectedFare.fareTags.map((tag) => (
                  <View key={tag} style={styles.amenityBadge}>
                    <Text style={styles.amenityText}>{tag}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
          {isMultiLeg ? (
            <View style={[styles.bookButton, isSelected && styles.bookButtonSelected]}>
              <Text style={styles.bookButtonText}>{isSelected ? 'Selected' : 'Select'}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => reviewFare(getFlightWithFare(item, selectedFareIndex))}
            >
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

    if (flights.length > 0 && stopsFilter !== 'ALL') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="filter-outline" size={34} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No {stopsFilter === 'NONSTOP' ? 'non-stop' : '1+ stop'} flights</Text>
          <Text style={styles.emptySubtitle}>Clear the stops filter to see all {flights.length} result{flights.length === 1 ? '' : 's'}.</Text>
          <TouchableOpacity style={styles.clearFilterButton} onPress={() => setStopsFilter('ALL')}>
            <Text style={styles.clearFilterButtonText}>Clear Filter</Text>
          </TouchableOpacity>
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

  // Per TripJack: adults+children <= 9 total, infants <= adults (FAQ: "Minimum
  // time between two consecutive trips" section / paxInfo rules).
  const adjustPassenger = (type, delta) => {
    const current = { adults: Number(adults), children: Number(children), infants: Number(infants) };
    const next = { ...current, [type]: current[type] + delta };

    if (type === 'adults' && next.adults < 1) return;
    if (type !== 'adults' && next[type] < 0) return;
    if (next.adults + next.children > 9) return;
    if (next.infants > next.adults) return;

    if (type === 'adults') setAdults(String(next.adults));
    if (type === 'children') setChildren(String(next.children));
    if (type === 'infants') setInfants(String(next.infants));
  };

  const openCalendar = ({ target, routeIndex = null, currentValue = '', rangeMode = false }) => {
    setAirportSuggestFor(null);
    const parsedDate = parseDisplayDate(currentValue);
    const safeDate = parsedDate && parsedDate >= today ? parsedDate : today;

    setCalendarState({
      visible: true,
      target,
      routeIndex,
      month: startOfMonth(safeDate),
      selected: safeDate,
      rangeMode,
      pendingStart: null,
    });
  };

  const closeCalendar = () => {
    setCalendarState((currentState) => ({
      ...currentState,
      visible: false,
    }));
  };

  // Picking a standalone Return date (not the combined departure+return range
  // session) must not allow a date before the already-chosen departure - the
  // day grid only ever disabled dates before today, so a return date earlier
  // than departure was selectable in the UI and only rejected later by the
  // search request.
  const getCalendarMinDate = () => {
    if (calendarState.target === 'return' && !calendarState.rangeMode) {
      const departureDate = parseDisplayDate(routes[0]?.travelDate);
      if (departureDate && departureDate > today) {
        return departureDate;
      }
    }
    return today;
  };

  const handleCalendarDateSelect = (date) => {
    if (date < getCalendarMinDate()) {
      return;
    }

    if (calendarState.rangeMode) {
      const { pendingStart } = calendarState;
      // Round trips can be same-day, so an equal-or-later date confirms the
      // return; only a strictly earlier one restarts the departure pick.
      if (!pendingStart || date < pendingStart) {
        setCalendarState((current) => ({ ...current, pendingStart: date, selected: date }));
        return;
      }
      if (typeof calendarState.routeIndex === 'number') {
        updateRoute(calendarState.routeIndex, 'travelDate', formatDateForDisplay(pendingStart));
      }
      setReturnDate(formatDateForDisplay(date));
      closeCalendar();
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

  const calendarMinDate = getCalendarMinDate();
  const canGoToPreviousMonth =
    startOfMonth(calendarState.month) > startOfMonth(calendarMinDate);
  const calendarDays = buildCalendarDays(calendarState.month);

  // Round trips get a side-by-side Onward/Return comparison instead of the
  // tap-a-chip-to-switch single list every other trip type uses - with only
  // 2 legs ever, both columns comfortably fit on screen at once and can be
  // scrolled independently to compare combinations directly.
  // The header's back button used to always call navigation.goBack(), which
  // exited the Flights screen entirely straight from the results view -
  // skipping past the search form. When results are showing (collapsed
  // form), first reveal the form again instead, matching what "Edit" does;
  // only actually leave the screen once the form itself is what's visible.
  const handleHeaderBack = () => {
    if (searched && !showFilters) {
      setShowFilters(true);
      return;
    }
    navigation.goBack();
  };
  // Only split into dual columns once the form is actually collapsed - the
  // header (summary bar + sort/stop pills) is then guaranteed small, so the
  // columns below always get the rest of the screen with no leftover gap.
  // While editing (showFilters), fall back to the normal full-page form.
  const isReturnDualView =
    tripType === 'RETURN' &&
    isMultiLeg &&
    searched &&
    groupKeys.length === 2 &&
    !showFilters &&
    returnLayoutMode === 'split';

  // Desktop, a search has run, and the form has collapsed: swap the hero for a
  // compact search bar and move sort/stop filters into a left sidebar so the
  // results get the width. Dual-view already owns the full width, so it opts out.
  const showWebResults = isDesktop && searched && !showFilters;

  const renderReturnLayoutToggle = () => (
    <View style={styles.layoutToggleRow}>
      <TouchableOpacity
        style={[styles.layoutToggleButton, returnLayoutMode === 'split' && styles.layoutToggleButtonActive]}
        onPress={() => setReturnLayoutMode('split')}
      >
        <Ionicons
          name="grid-outline"
          size={13}
          color={returnLayoutMode === 'split' ? Colors.secondary : Colors.accentBlueDark}
        />
        <Text style={[styles.layoutToggleText, returnLayoutMode === 'split' && styles.layoutToggleTextActive]}>
          Side by side
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.layoutToggleButton, returnLayoutMode === 'single' && styles.layoutToggleButtonActive]}
        onPress={() => setReturnLayoutMode('single')}
      >
        <Ionicons
          name="list-outline"
          size={13}
          color={returnLayoutMode === 'single' ? Colors.secondary : Colors.accentBlueDark}
        />
        <Text style={[styles.layoutToggleText, returnLayoutMode === 'single' && styles.layoutToggleTextActive]}>
          One at a time
        </Text>
      </TouchableOpacity>
    </View>
  );

  const getFlightsForGroup = (groupKey) => {
    let list = flights.filter((flight) => flight.groupKey === groupKey);
    if (stopsFilter === 'NONSTOP') {
      list = list.filter((flight) => flight.stopsCount === 0);
    } else if (stopsFilter === 'ONE_PLUS') {
      list = list.filter((flight) => flight.stopsCount > 0);
    }
    const comparator = SORT_COMPARATORS[sortBy];
    if (!comparator) return list;
    return [...list].sort(comparator);
  };

  const dualColumnFlights = isReturnDualView ? groupKeys.map((key) => getFlightsForGroup(key)) : null;

  // Compact card for the dual-column view - the full renderFlight card (fare
  // toggle, amenities, segment breakdown) is too much detail for a half-width
  // column; this keeps just what's needed to compare and pick a leg.
  const renderCompactFlight = (groupKey) => ({ item }) => {
    const isSelected = selectedByGroup[groupKey]?.id === item.id;
    const selectedFareIndex = getSelectedFareIndex(item);
    const selectedFare = item.fareOptions?.[selectedFareIndex] || item;
    const hasFareChoice = (item.fareOptions?.length || 0) > 1;
    const detailsExpanded = !!expandedDetailIds[item.id];

    return (
      <TouchableOpacity
        style={[styles.compactCard, isSelected && styles.compactCardSelected]}
        activeOpacity={0.8}
        onPress={() => selectFlightForGroup(getFlightWithFare(item, selectedFareIndex))}
      >
        {isSelected ? (
          <View style={styles.compactSelectedBadge}>
            <Ionicons name="checkmark" size={11} color={Colors.secondary} />
          </View>
        ) : null}

        <View style={styles.compactCardHeader}>
          {AIRLINE_LOGOS[item.airlineCode] ? (
            <Image source={AIRLINE_LOGOS[item.airlineCode]} style={styles.compactAirlineLogo} resizeMode="contain" />
          ) : (
            <Ionicons name={item.image} size={15} color={Colors.accentBlue} />
          )}
          <Text style={styles.compactFlightNo} numberOfLines={1}>{item.flightNo}</Text>
        </View>
        <Text style={styles.compactTimes} numberOfLines={1}>{item.departure} → {item.arrival}</Text>
        <Text style={styles.compactStops} numberOfLines={1}>{item.duration} · {item.stops}</Text>
        <MarkupPrice
          service="FLIGHT"
          category={markupCategory(item)}
          entityKey={item.airlineCode}
          baseAmount={selectedFare.price}
          paxCount={1}
          priceStyle={styles.compactPrice}
        />

        {hasFareChoice ? (
          <>
            <View style={styles.compactSelectedFareBadge}>
              <Text style={styles.compactSelectedFareBadgeText} numberOfLines={1}>
                {selectedFare.fareType} ₹{Math.round(sell(item, selectedFare.price)).toLocaleString()}
              </Text>
            </View>
            <View style={styles.compactFareList}>
              {item.fareOptions.map((fare, index) => {
                if (index === selectedFareIndex) return null;
                return (
                  <TouchableOpacity
                    key={fare.id}
                    style={styles.compactFareListRow}
                    activeOpacity={0.6}
                    onPress={() => chooseFareForFlight(item, index)}
                  >
                    <Text style={styles.compactFareListLabel} numberOfLines={1}>{fare.fareType}</Text>
                    <Text style={styles.compactFareListPrice}>₹{Math.round(sell(item, fare.price)).toLocaleString()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        {item.segmentCount > 1 ? (
          <TouchableOpacity
            style={styles.compactDetailsToggle}
            activeOpacity={0.7}
            onPress={() => toggleFlightDetails(item.id)}
          >
            <Text style={styles.compactDetailsToggleText}>
              {detailsExpanded ? 'Hide details' : 'View flight details'}
            </Text>
            <Ionicons
              name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={Colors.accentBlue}
            />
          </TouchableOpacity>
        ) : null}

        {item.segmentCount > 1 && detailsExpanded ? (
          <View style={styles.compactSegmentBreakdown}>
            {item.segments.map((segment) => (
              <React.Fragment key={segment.id}>
                <Text style={styles.compactSegmentLine} numberOfLines={1}>
                  {segment.departure} {segment.fromCode} → {segment.arrival} {segment.toCode}
                </Text>
                <Text style={styles.compactSegmentSub} numberOfLines={1}>
                  {segment.airline} · {segment.flightNo} · {segment.durationLabel}
                </Text>
                {segment.layover ? (
                  <View style={styles.compactLayoverRow}>
                    <Ionicons name="time-outline" size={11} color="#8A6100" />
                    <Text style={styles.compactLayoverText} numberOfLines={1}>
                      {segment.layover.label ? `${segment.layover.label} layover` : 'Layover'}
                      {segment.layover.cityName ? ` at ${segment.layover.cityName}` : ''}
                    </Text>
                  </View>
                ) : null}
              </React.Fragment>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };


  // Desktop one-row search panel, rendered inside the hero. Deliberately reuses
  // the phone form's handlers verbatim (updateRoute, swapRouteCities,
  // openCalendar, searchFlights) - only the layout differs, so the certified
  // trip-type and fare behaviour is untouched.
  //
  // MULTI_CITY is excluded: N legs cannot honestly be squeezed onto one row, so
  // that trip type falls through to the existing stacked form.

  // --- Desktop results layout ----------------------------------------------
  // Once a search has run, the hero collapses to a compact bar and the sort /
  // stop filters move into a left sidebar, so the results get the full width.


  // Extracted so the same markup serves both the phone layout and the desktop
  // sidebar layout, rather than existing twice.
  const renderDualColumns = () => (
            <View style={styles.dualColumnsRow}>
              <View style={styles.dualColumn}>
                <View style={styles.dualColumnTitleRow}>
                  <Ionicons name="airplane" size={14} color={Colors.accentBlue} />
                  <Text style={styles.dualColumnTitle}>
                    Onward{selectedByGroup[groupKeys[0]] ? ` · ₹${Math.round(sell(selectedByGroup[groupKeys[0]], selectedByGroup[groupKeys[0]].price)).toLocaleString()}` : ''}
                  </Text>
                </View>
                <FlatList
                  data={dualColumnFlights[0]}
                  renderItem={renderCompactFlight(groupKeys[0])}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.dualColumnListContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={<Text style={styles.dualColumnEmpty}>No options match your filters.</Text>}
                />
              </View>
              <View style={styles.dualColumnDivider} />
              <View style={styles.dualColumn}>
                <View style={styles.dualColumnTitleRow}>
                  <Ionicons name="airplane" size={14} color={Colors.accentBlue} style={{ transform: [{ scaleX: -1 }] }} />
                  <Text style={styles.dualColumnTitle}>
                    Return{selectedByGroup[groupKeys[1]] ? ` · ₹${Math.round(sell(selectedByGroup[groupKeys[1]], selectedByGroup[groupKeys[1]].price)).toLocaleString()}` : ''}
                  </Text>
                </View>
                <FlatList
                  data={dualColumnFlights[1]}
                  renderItem={renderCompactFlight(groupKeys[1])}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.dualColumnListContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={<Text style={styles.dualColumnEmpty}>No options match your filters.</Text>}
                />
              </View>
            </View>
  );

  const renderResultsList = (centered) => (
    <FlatList
      data={visibleFlights}
      renderItem={renderFlight}
      keyExtractor={(item) => item.id}
      style={styles.flatListFlex}
      contentContainerStyle={[
        flights.length ? styles.listContainer : styles.listContainerEmpty,
        isMultiLeg && searched && flights.length > 0 ? styles.listContainerWithFooter : null,
        centered ? centeredContent : null,
      ]}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
      ListHeaderComponent={renderSearchFormHeader()}
      ListEmptyComponent={renderEmptyState}
    />
  );


  // One definition of the filter controls, rendered in the desktop sidebar and
  // in the phone's Filters modal.
  const renderFilterControls = () => {
    const priceLow = priceRange ? priceRange.low : facets.priceMin;
    const priceHigh = priceRange ? priceRange.high : facets.priceMax;
    const hasPriceSpread = facets.priceMax > facets.priceMin;

    const CheckRow = ({ active, label, meta, onPress }) => (
      <TouchableOpacity style={styles.filterRow} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.filterBox, active && styles.filterBoxActive]}>
          {active ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
        </View>
        <Text style={[styles.filterRowLabel, active && styles.filterRowLabelActive]} numberOfLines={1}>
          {label}
        </Text>
        {!!meta && <Text style={styles.filterRowMeta}>{meta}</Text>}
      </TouchableOpacity>
    );

    const BandGrid = ({ available, selected, setter }) => (
      <View style={styles.bandGrid}>
        {TIME_BANDS.map((band) => {
          const enabled = available.has(band.value);
          const active = selected.has(band.value);
          return (
            <TouchableOpacity
              key={band.value}
              disabled={!enabled}
              onPress={() => toggleInSet(setter, band.value)}
              style={[styles.bandCell, active && styles.bandCellActive, !enabled && styles.bandCellOff]}
            >
              <Ionicons
                name={band.icon}
                size={17}
                color={active ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.bandLabel, active && styles.bandLabelActive]}>{band.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    return (
      <>
        {hasPriceSpread ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Price</Text>
            <RangeSlider
              min={facets.priceMin}
              max={facets.priceMax}
              low={priceLow}
              high={priceHigh}
              onChange={(low, high) => setPriceRange({ low, high })}
              formatLabel={(value) => `₹${Math.round(value).toLocaleString('en-IN')}`}
            />
          </View>
        ) : null}

        {facets.stops.length > 1 ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Stops</Text>
            <View style={styles.stopsRow}>
              {facets.stops.map((count) => {
                const active = stopCounts.has(count);
                return (
                  <TouchableOpacity
                    key={count}
                    style={[styles.stopCell, active && styles.stopCellActive]}
                    onPress={() => toggleInSet(setStopCounts, count)}
                  >
                    <Text style={[styles.stopCellText, active && styles.stopCellTextActive]}>
                      {count === 3 ? '3+' : count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.filterCard}>
          <Text style={styles.filterCardTitle}>
            Departure{facets.originLabel ? ` from ${facets.originLabel}` : ''}
          </Text>
          <BandGrid available={facets.departBands} selected={departBands} setter={setDepartBands} />
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterCardTitle}>
            Arrival{facets.destinationLabel ? ` at ${facets.destinationLabel}` : ''}
          </Text>
          <BandGrid available={facets.arriveBands} selected={arriveBands} setter={setArriveBands} />
        </View>

        {facets.durationMax > facets.durationMin ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Journey Duration</Text>
            <RangeSlider
              min={facets.durationMin}
              max={facets.durationMax}
              low={durationRange ? durationRange.low : facets.durationMin}
              high={durationRange ? durationRange.high : facets.durationMax}
              onChange={(low, high) => setDurationRange({ low, high })}
              formatLabel={(value) => formatDuration(Math.round(value))}
            />
          </View>
        ) : null}

        {facets.layoverMax > 0 ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Layover Duration</Text>
            <RangeSlider
              min={facets.layoverMin}
              max={facets.layoverMax}
              low={layoverRange ? layoverRange.low : facets.layoverMin}
              high={layoverRange ? layoverRange.high : facets.layoverMax}
              onChange={(low, high) => setLayoverRange({ low, high })}
              formatLabel={(value) => formatDuration(Math.round(value))}
            />
            <Text style={styles.filterHint}>Non-stop flights always match.</Text>
          </View>
        ) : null}

        {facets.layoverAirports.length ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Layover Airport</Text>
            {facets.layoverAirports.map((airport) => (
              <CheckRow
                key={airport.code}
                active={layoverAirports.has(airport.code)}
                label={airport.code}
                onPress={() => toggleInSet(setLayoverAirports, airport.code)}
              />
            ))}
          </View>
        ) : null}

        {facets.depAirports.length > 1 || facets.arrAirports.length > 1 ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Airport</Text>
            {[
              { label: 'Departure', list: facets.depAirports, selected: depAirports, setter: setDepAirports },
              { label: 'Arrival', list: facets.arrAirports, selected: arrAirports, setter: setArrAirports },
            ].map((section) =>
              section.list.length > 1 ? (
                <View key={section.label} style={styles.terminalSection}>
                  <Text style={styles.terminalSectionLabel}>{section.label.toUpperCase()}</Text>
                  {section.list.map((airport) => (
                    <CheckRow
                      key={airport.code}
                      active={section.selected.has(airport.code)}
                      label={airport.label ? `${airport.code} - ${airport.label}` : airport.code}
                      onPress={() => toggleInSet(section.setter, airport.code)}
                    />
                  ))}
                </View>
              ) : null,
            )}
          </View>
        ) : null}

        <View style={styles.filterCard}>
          <View style={styles.filterTitleRow}>
            <Text style={styles.filterCardTitle}>Flight Number</Text>
            {flightNoQuery.trim() ? (
              <TouchableOpacity onPress={() => setFlightNoQuery('')}>
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TextInput
            style={styles.filterInput}
            placeholder="Eg. 123 or 6E-123"
            placeholderTextColor={Colors.textMuted}
            value={flightNoQuery}
            onChangeText={setFlightNoQuery}
            autoCapitalize="characters"
          />
        </View>

        {facets.depTerminals.length || facets.arrTerminals.length ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Terminal</Text>

            {[
              { label: 'Departure', groups: facets.depTerminals, selected: depTerminals, setter: setDepTerminals },
              { label: 'Arrival', groups: facets.arrTerminals, selected: arrTerminals, setter: setArrTerminals },
            ].map((section) =>
              section.groups.length ? (
                <View key={section.label} style={styles.terminalSection}>
                  <Text style={styles.terminalSectionLabel}>{section.label.toUpperCase()}</Text>
                  {section.groups.map((group) => (
                    <View key={group.airport} style={styles.terminalGroup}>
                      <Text style={styles.terminalAirport}>{group.airport}</Text>
                      {group.terminals.map((item) => (
                        <CheckRow
                          key={item.key}
                          active={section.selected.has(item.key)}
                          label={item.terminal}
                          onPress={() => toggleInSet(section.setter, item.key)}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              ) : null,
            )}
          </View>
        ) : null}

        {facets.airlines.length > 1 ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterCardTitle}>Airlines</Text>
            {facets.airlines.map((airline) => (
              <CheckRow
                key={airline.code}
                active={airlineCodes.has(airline.code)}
                label={`${airline.label} ${airline.count}`}
                meta={`₹${Math.round(airline.minPrice).toLocaleString('en-IN')}`}
                onPress={() => toggleInSet(setAirlineCodes, airline.code)}
              />
            ))}
          </View>
        ) : null}
      </>
    );
  };

  const renderWebSummaryBar = () => {
    const route = routes[0] || {};
    const travellers = Number(adults) + Number(children) + Number(infants);
    const fareLabel = PASSENGER_FARE_TYPES.find((f) => f.value === fareType)?.label;
    const tripLabel = TRIP_TYPES.find((t) => t.value === tripType)?.label;
    // Any field reopens the full form rather than editing in place - the pickers
    // it needs (calendar, traveller modal) already live there.
    const reopen = () => setShowFilters(true);

    const Cell = ({ label, value, flex = 1 }) => (
      <TouchableOpacity style={[styles.webBarCell, { flex }]} onPress={reopen}>
        <Text style={styles.webBarLabel}>{label}</Text>
        <Text style={styles.webBarValue} numberOfLines={1}>{value || '-'}</Text>
      </TouchableOpacity>
    );

    return (
      <View style={styles.webBar}>
        <View style={styles.webBarInner}>
          <Cell label="Trip type" value={tripLabel} flex={0.7} />
          <Cell label="From" value={route.from} flex={1.5} />
          <TouchableOpacity style={styles.webBarSwap} onPress={() => swapRouteCities(0)}>
            <Ionicons name="swap-horizontal" size={17} color="#FFFFFF" />
          </TouchableOpacity>
          <Cell label="To" value={route.to} flex={1.5} />
          <Cell label="Departure" value={route.travelDate} flex={0.9} />
          {tripType === 'RETURN' ? <Cell label="Return" value={returnDate} flex={0.9} /> : null}
          <Cell
            label="Travellers | Class | Fare"
            value={`${travellers} Pax, ${cabinClass.replace(/_/g, ' ')}${
              fareType !== 'REGULAR' && fareLabel ? `, ${fareLabel}` : ''
            }`}
            flex={1.4}
          />
          <TouchableOpacity
            style={styles.webBarSearch}
            onPress={searchFlights}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.webBarSearchText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderWebFilterSidebar = () => {
    const total = isMultiLeg
      ? flights.filter((f) => f.groupKey === effectiveActiveGroupKey).length
      : flights.length;

    const Group = ({ title, options, value, onChange }) => (
      <View style={styles.webSideCard}>
        <Text style={styles.webSideTitle}>{title}</Text>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={styles.webSideRow}
              onPress={() => onChange(option.value)}
            >
              <View style={[styles.webSideBox, active && styles.webSideBoxActive]}>
                {active ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
              </View>
              <Text style={[styles.webSideLabel, active && styles.webSideLabelActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

    return (
      // Its own scroller: the row is flex:1 so the column is viewport-height,
      // and with this many filter groups the content runs past it. The results
      // list scrolls separately, which is the point of the two-pane layout.
      <ScrollView
        style={styles.webSidebar}
        contentContainerStyle={styles.webSidebarContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.webSideCount}>
          <Text style={styles.webSideCountText}>
            Total <Text style={styles.webSideCountNum}>{total}</Text> flight{total === 1 ? '' : 's'} found
          </Text>
        </View>
        <Group title="Sort By" options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />

        {activeFilterCount > 0 ? (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAllFilters}>
            <Ionicons name="close-circle-outline" size={15} color={Colors.primary} />
            <Text style={styles.clearFiltersText}>
              Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {renderFilterControls()}

        <Group
          title="Connections"
          options={CONNECTION_FILTERS}
          value={connectionFilter}
          onChange={setConnectionFilter}
        />
      </ScrollView>
    );
  };

  const renderWebAirportField = (label, index, field, icon) => {
    const route = routes[index] || {};
    const isSuggesting =
      airportSuggestFor?.routeIndex === index && airportSuggestFor?.field === field;
    const suggestions = isSuggesting ? getAirportSuggestions(route[field]) : [];

    return (
      <View style={styles.webFieldWrap}>
        <Text style={styles.webFieldLabel}>{label}</Text>
        <View style={styles.webPill}>
          <Ionicons name={icon} size={17} color={Colors.textMuted} />
          <TextInput
            style={styles.webPillInput}
            placeholder="City or airport code"
            placeholderTextColor={Colors.textMuted}
            value={route[field] || ''}
            onChangeText={(value) => {
              updateRoute(index, field, value);
              setAirportSuggestFor({ routeIndex: index, field });
            }}
            onFocus={() => setAirportSuggestFor({ routeIndex: index, field })}
          />
        </View>

        {suggestions.length > 0 ? (
          <ScrollView
            style={styles.webSuggestBox}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={styles.webSuggestRow}
                onPress={() => chooseAirportSuggestion(index, field, option)}
              >
                <Ionicons name="location-outline" size={15} color={Colors.primaryDark} />
                <Text style={styles.webSuggestCity} numberOfLines={1}>{option.city}</Text>
                <Text style={styles.webSuggestCode}>{option.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  };

  // Multi-city stacks one row per leg inside the same panel; every other trip
  // type puts its fields on a single row.
  const renderWebMultiCityLegs = () => (
    <>
      {routes.map((route, index) => (
        <View
          key={`web-leg-${index}`}
          // Descending order so an earlier leg's autocomplete paints over the
          // legs below it; siblings otherwise stack later-on-top.
          style={[styles.webLegRow, { zIndex: routes.length - index }]}
        >
          <Text style={styles.webLegTag}>Leg {index + 1}</Text>
          {renderWebAirportField('From', index, 'from', 'airplane-outline')}
          {renderWebAirportField('To', index, 'to', 'location-outline')}
          <WebField
            label="Departure"
            icon="calendar-outline"
            value={route.travelDate}
            placeholder="Select date"
            onPress={() =>
              openCalendar({ target: 'route', routeIndex: index, currentValue: route.travelDate })
            }
          />
          {routes.length > 2 ? (
            <TouchableOpacity
              style={styles.webLegRemove}
              onPress={() => removeMultiCityRoute(index)}
            >
              <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.webLegRemovePlaceholder} />
          )}
        </View>
      ))}

      <View style={styles.webLegRow}>
        <View style={styles.webLegTagSpacer} />
        <WebField
          label="Travellers | Class"
          icon="person-outline"
          value={`${Number(adults) + Number(children) + Number(infants)} Pax, ${cabinClass.replace(/_/g, ' ')}`}
          onPress={() => setTravellerModalVisible(true)}
        />
        <TouchableOpacity style={styles.webAddLeg} onPress={addMultiCityRoute}>
          <Ionicons name="add-circle-outline" size={17} color="#FFFFFF" />
          <Text style={styles.webAddLegText}>Add another leg</Text>
        </TouchableOpacity>
        <View style={styles.webLegRemovePlaceholder} />
      </View>
    </>
  );

  const renderWebSearchPanel = () => {
    const travellers = Number(adults) + Number(children) + Number(infants);
    const fareLabel = PASSENGER_FARE_TYPES.find((f) => f.value === fareType)?.label;
    const isMultiCity = tripType === 'MULTI_CITY';

    return (
      <WebSearchPanel
        onSearch={searchFlights}
        searching={loading}
        stacked={isMultiCity}
        searchLabel="Search Flights"
        tabs={
          <WebPanelTabs options={TRIP_TYPES} value={tripType} onChange={setTripTypeWithDefaults} />
        }
        chips={
          <View style={styles.webChipsRow}>
            <WebPanelChips
              options={CONNECTION_FILTERS}
              value={connectionFilter}
              onChange={setConnectionFilter}
            />
            <TouchableOpacity
              style={styles.webAirlineLink}
              onPress={() => setShowAirlineInput((current) => !current)}
            >
              <Ionicons name={showAirlineInput ? 'remove' : 'add'} size={15} color="#FFFFFF" />
              <Text style={styles.webAirlineLinkText}>Preferred airlines</Text>
            </TouchableOpacity>
            {showAirlineInput ? (
              <TextInput
                style={styles.webAirlineInput}
                placeholder="SG, 6E, AI"
                placeholderTextColor={Colors.textMuted}
                value={preferredAirlines}
                onChangeText={setPreferredAirlines}
                autoCapitalize="characters"
              />
            ) : null}
          </View>
        }
      >
        {isMultiCity ? renderWebMultiCityLegs() : (
        <>
        {renderWebAirportField('From', 0, 'from', 'airplane-outline')}

        <TouchableOpacity style={styles.webSwapButton} onPress={() => swapRouteCities(0)}>
          <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
        </TouchableOpacity>

        {renderWebAirportField('To', 0, 'to', 'location-outline')}

        <WebField
          label="Departure"
          icon="calendar-outline"
          value={routes[0]?.travelDate}
          placeholder="Select date"
          onPress={() =>
            openCalendar({
              target: 'route',
              routeIndex: 0,
              currentValue: routes[0]?.travelDate,
              rangeMode: tripType === 'RETURN',
            })
          }
        />

        {tripType === 'RETURN' ? (
          <WebField
            label="Return"
            icon="calendar-outline"
            value={returnDate}
            placeholder="Select date"
            onPress={() =>
              openCalendar({ target: 'return', currentValue: returnDate || routes[0]?.travelDate })
            }
          />
        ) : null}

        <WebField
          label="Travellers | Class"
          icon="person-outline"
          minWidth={190}
          flex={1.2}
          value={`${travellers} Pax, ${cabinClass.replace(/_/g, ' ')}${
            fareType !== 'REGULAR' && fareLabel ? ` · ${fareLabel}` : ''
          }`}
          onPress={() => setTravellerModalVisible(true)}
        />
        </>
        )}
      </WebSearchPanel>
    );
  };

  const renderSearchFormHeader = () => (
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
            <Ionicons name="create-outline" size={15} color={Colors.primary} />
            <Text style={styles.summaryBarEditText}>Edit</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {showFilters && !useWebPanel ? (
        <>
      <View style={styles.formSurface}>
        <View style={styles.tripTypeRow}>
          {TRIP_TYPES.map((option) => {
            const active = tripType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.tripTypeTab, active && styles.tripTypeTabActive]}
                onPress={() => setTripTypeWithDefaults(option.value)}
              >
                <Text style={[styles.tripTypeTabText, active && styles.tripTypeTabTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionBlock}>
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
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>From</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="airplane-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="City or airport code"
                      placeholderTextColor={Colors.textMuted}
                      value={route.from}
                      onChangeText={(value) => {
                        updateRoute(index, 'from', value);
                        setAirportSuggestFor({ routeIndex: index, field: 'from' });
                      }}
                      onFocus={() => setAirportSuggestFor({ routeIndex: index, field: 'from' })}
                    />
                  </View>
                </View>

                <View style={[styles.inputContainer, styles.routeFieldStacked]}>
                  <Text style={styles.inputLabel}>To</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="location-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="City or airport code"
                      placeholderTextColor={Colors.textMuted}
                      value={route.to}
                      onChangeText={(value) => {
                        updateRoute(index, 'to', value);
                        setAirportSuggestFor({ routeIndex: index, field: 'to' });
                      }}
                      onFocus={() => setAirportSuggestFor({ routeIndex: index, field: 'to' })}
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.swapButtonFloating} onPress={() => swapRouteCities(index)}>
                  <Ionicons name="swap-vertical" size={18} color={Colors.secondary} />
                </TouchableOpacity>
              </View>

              {airportSuggestFor?.routeIndex === index ? (() => {
                const suggestions = getAirportSuggestions(route[airportSuggestFor.field]);
                if (!suggestions.length) return null;
                return (
                  <View style={styles.airportSuggestBox}>
                    {suggestions.map((option) => (
                      <TouchableOpacity
                        key={option.code}
                        style={styles.airportSuggestRow}
                        onPress={() => chooseAirportSuggestion(index, airportSuggestFor.field, option)}
                      >
                        <Ionicons name="location-outline" size={15} color={Colors.primaryDark} />
                        <Text style={styles.airportSuggestCity}>{option.city}</Text>
                        <Text style={styles.airportSuggestCode}>{option.code}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })() : null}

              {tripType !== 'RETURN' ? (
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
              ) : null}
            </View>
          ))}

          {tripType === 'MULTI_CITY' ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={addMultiCityRoute}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.primaryDark} />
              <Text style={styles.secondaryButtonText}>Add Route Leg</Text>
            </TouchableOpacity>
          ) : null}

          {tripType === 'RETURN' ? (
            // Departure + Return shown side by side as one connected
            // control (like a real travel site's combo date field)
            // instead of two full-width boxes stacked on top of each
            // other, which read as unrelated/disconnected fields.
            <View style={styles.dateRow}>
              <View style={[styles.inputContainer, styles.routeField]}>
                <Text style={styles.inputLabel}>Departure</Text>
                <Pressable
                  style={styles.inputShell}
                  onPress={() =>
                    openCalendar({
                      target: 'route',
                      routeIndex: 0,
                      currentValue: routes[0]?.travelDate,
                      // Round trip: pick departure + return together in
                      // one session instead of two separate opens.
                      rangeMode: true,
                    })
                  }
                >
                  <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                  <Text style={[styles.dateDisplayText, !routes[0]?.travelDate && styles.dateDisplayPlaceholder]}>
                    {routes[0]?.travelDate || 'Select date'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.dateRowDivider} />

              <View style={[styles.inputContainer, styles.routeField]}>
                <Text style={styles.inputLabel}>Return</Text>
                <Pressable
                  style={styles.inputShell}
                  onPress={() =>
                    openCalendar({
                      target: 'return',
                      // Falls back to the already-picked departure date
                      // so the calendar opens on that month instead of
                      // always jumping back to the current month.
                      currentValue: returnDate || routes[0]?.travelDate,
                    })
                  }
                >
                  <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
                  <Text style={[styles.dateDisplayText, !returnDate && styles.dateDisplayPlaceholder]}>
                    {returnDate || 'Select date'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.travellerSummaryRow} onPress={() => setTravellerModalVisible(true)}>
          <Ionicons name="people-outline" size={18} color={Colors.primaryDark} />
          <Text style={styles.travellerSummaryText} numberOfLines={1}>
            {Number(adults) + Number(children) + Number(infants)} traveller{Number(adults) + Number(children) + Number(infants) === 1 ? '' : 's'} · {cabinClass.replace(/_/g, ' ')}
            {fareType !== 'REGULAR' ? ` · ${PASSENGER_FARE_TYPES.find((f) => f.value === fareType)?.label}` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

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

        {showAirlineInput ? (
          <View style={styles.inputContainer}>
            <View style={styles.inputShell}>
              <Ionicons name="sparkles-outline" size={16} color={Colors.primaryDark} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Airline codes, e.g. SG, 6E, AI"
                placeholderTextColor={Colors.textMuted}
                value={preferredAirlines}
                onChangeText={setPreferredAirlines}
                autoCapitalize="characters"
              />
            </View>
            <Text style={styles.helperText}>Up to 10 airline codes, separated by commas.</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.inlineLinkButton} onPress={() => setShowAirlineInput(true)}>
            <Ionicons name="add" size={16} color={Colors.primaryDark} />
            <Text style={styles.inlineLinkText}>Preferred airlines (optional)</Text>
          </TouchableOpacity>
        )}

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

      {searched && flights.length > 0 && !isReturnDualView && !showWebResults ? (
        <View style={styles.resultsToolbar}>
          <TouchableOpacity
            style={styles.filtersButtonRow}
            onPress={() => setFiltersModalVisible(true)}
          >
            <Ionicons name="options-outline" size={16} color={Colors.primary} />
            <Text style={styles.pillText}>Filters</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filtersBadge}>
                <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultsToolbarRow}>
            {SORT_OPTIONS.map((option) => {
              const active = sortBy === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pill, styles.sortPill, active && styles.pillActive]}
                  onPress={() => setSortBy(option.value)}
                >
                  <Ionicons name={option.icon} size={13} color={active ? Colors.secondary : Colors.primaryDark} />
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultsToolbarRow}>
            {STOPS_FILTERS.map((option) => {
              const active = stopsFilter === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pill, styles.sortPill, active && styles.pillActiveBlue]}
                  onPress={() => setStopsFilter(option.value)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.resultsCount}>
            {visibleFlights.length} of {isMultiLeg ? flights.filter((f) => f.groupKey === effectiveActiveGroupKey).length : flights.length} option{flights.length === 1 ? '' : 's'}
            {isMultiLeg ? ` for ${buildJourneyLabel(effectiveActiveGroupKey)}` : ''}
          </Text>
          {tripType === 'RETURN' && isMultiLeg && groupKeys.length === 2 ? renderReturnLayoutToggle() : null}
        </View>
      ) : null}

      {isReturnDualView ? (
        <View style={styles.resultsToolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultsToolbarRow}>
            {SORT_OPTIONS.map((option) => {
              const active = sortBy === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pill, styles.sortPill, active && styles.pillActive]}
                  onPress={() => setSortBy(option.value)}
                >
                  <Ionicons name={option.icon} size={13} color={active ? Colors.secondary : Colors.primaryDark} />
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultsToolbarRow}>
            {STOPS_FILTERS.map((option) => {
              const active = stopsFilter === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pill, styles.sortPill, active && styles.pillActiveBlue]}
                  onPress={() => setStopsFilter(option.value)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.resultsCount}>
            {groupKeys
              .map(
                (key, index) =>
                  `${dualColumnFlights[index].length} of ${flights.filter((f) => f.groupKey === key).length} for ${buildJourneyLabel(key)}`
              )
              .join('  •  ')}
          </Text>
          {renderReturnLayoutToggle()}
        </View>
      ) : null}

      {isMultiLeg && searched && !isReturnDualView ? (
        <View style={styles.legSelectionCard}>
          <Text style={styles.legSelectionTitle}>
            {tripType === 'MULTI_CITY' ? 'Pick one flight per route leg' : 'Pick your onward and return flight'}
          </Text>
          <Text style={styles.legSelectionHint}>
            Tap a leg below to switch what's shown, tap a flight card to pick it - the next leg comes up
            automatically. TripJack prices these as a single itinerary.
          </Text>
          <View style={styles.legSelectionChips}>
            {groupKeys.map((key) => {
              const selection = selectedByGroup[key];
              const isActive = key === effectiveActiveGroupKey;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.legSelectionChip,
                    selection && styles.legSelectionChipDone,
                    isActive && styles.legSelectionChipActive,
                  ]}
                  onPress={() => setActiveGroupKey(key)}
                >
                  <Ionicons
                    name={selection ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={selection ? Colors.success : isActive ? Colors.primaryDark : Colors.textMuted}
                  />
                  <Text
                    style={[styles.legSelectionChipText, isActive && styles.legSelectionChipTextActive]}
                    numberOfLines={1}
                  >
                    {buildJourneyLabel(key)}{selection ? `: ₹${Math.round(sell(selection, selection.price)).toLocaleString()}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {isDesktop ? (
        showWebResults ? (
          <>
            {renderWebSummaryBar()}
            <View style={styles.webResultsRow}>
              {renderWebFilterSidebar()}
              <View style={styles.webResultsMain}>
                {isReturnDualView ? (
                  <>
                    {renderSearchFormHeader()}
                    {renderDualColumns()}
                  </>
                ) : (
                  renderResultsList(false)
                )}
              </View>
            </View>
          </>
        ) : (
          // Search-form state. The hero lives inside a ScrollView because a
          // multi-city panel with several legs is taller than the viewport and
          // was otherwise unreachable - the hero was a sibling of the scrolling
          // list, so nothing moved it.
          //
          // Results are deliberately NOT rendered here: reopening the form used
          // to leave the previous results dangling below it, clipped mid-card.
          <ScrollView
            style={styles.flatListFlex}
            contentContainerStyle={styles.webFormScroll}
            showsVerticalScrollIndicator={false}
            {...scrollProps}
          >
            <WebHero
              image={require('../../assets/flights/hero-sunset.jpg')}
              title="Flight Booking"
              subtitle="Compare fares across airlines and find the best price for your trip."
              activeProduct="flights"
            >
              {renderWebSearchPanel()}
            </WebHero>

            {/* A search that returned nothing leaves the form open (see
                setShowFilters(results.length === 0)), so the empty state has to
                render here or the user gets no feedback at all. */}
            {searched && !loading && flights.length === 0 ? (
              <View style={[styles.webEmptyWrap, centeredContent]}>{renderEmptyState()}</View>
            ) : null}
          </ScrollView>
        )
      ) : (
        <>
      <ImageBackground
        source={require('../../assets/flights/hero-sunset.jpg')}
        style={styles.heroHeader}
        imageStyle={styles.heroHeaderImage}
      >
        <View style={styles.heroOverlay} />

        <View style={styles.heroTopRow}>
          <TouchableOpacity style={styles.heroCircleButton} onPress={handleHeaderBack}>
            <Ionicons name="chevron-back" size={22} color={Colors.accentBlueDark} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroCircleButton} onPress={() => navigation.navigate('MyFlightBookings')}>
            <Ionicons name="briefcase-outline" size={19} color={Colors.accentBlueDark} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>Flights</Text>
      </ImageBackground>

          {isReturnDualView ? (
            <>
              <View style={[styles.dualHeaderPadding, centeredContent]}>{renderSearchFormHeader()}</View>
              {renderDualColumns()}
            </>
          ) : (
            renderResultsList(true)
          )}
        </>
      )}

      {isMultiLeg && searched && flights.length > 0 ? (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyFooterText}>
            <Text style={styles.stickyFooterTitle}>
              {groupKeys.filter((key) => selectedByGroup[key]).length} of {groupKeys.length} legs selected
            </Text>
            <Text style={styles.stickyFooterSubtitle} numberOfLines={1}>
              {allLegsSelected
                ? groupKeys.map((key) => `${buildJourneyLabel(key)} ₹${Math.round(sell(selectedByGroup[key], selectedByGroup[key].price)).toLocaleString()}`).join('  •  ')
                : tripType === 'RETURN'
                ? 'Select an onward and return flight'
                : 'Tap a flight card above for each leg'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.stickyFooterButton, (!allLegsSelected || loading) && styles.legReviewButtonDisabled]}
            onPress={reviewSelectedFares}
            disabled={!allLegsSelected || loading}
          >
            <Text
              style={[
                styles.stickyFooterButtonText,
                (!allLegsSelected || loading) && styles.legReviewButtonTextDisabled,
              ]}
            >
              {loading ? 'Reviewing...' : 'Review Combined Fare'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={!!reviewedFare}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (fareRuleState.visible) return closeFareRules();
          return setReviewedFare(null);
        }}
      >
        <Pressable
          style={styles.calendarOverlay}
          onPress={() => {
            if (fareRuleState.visible) return closeFareRules();
            return setReviewedFare(null);
          }}
        >
          <Pressable style={styles.reviewModalCard} onPress={() => {}}>
            {reviewedFare && fareRuleState.visible ? (
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
                                      {stripFareRuleRtf(policy.policyInfo) || 'No details available'}
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
            ) : reviewedFare ? (
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

                <View style={styles.fareRuleLinkRow}>
                  <TouchableOpacity style={styles.fareRuleLinkButton} onPress={viewFareRules}>
                    <Ionicons name="document-text-outline" size={16} color={Colors.primaryDark} />
                    <Text style={styles.fareRuleLinkText}>View Fare Rules</Text>
                  </TouchableOpacity>
                </View>
                {reviewedFare?.reviewResponse?.conditions?.isa ? (
                  <Text style={styles.seatHintText}>Seat selection is available on the next step.</Text>
                ) : null}

                <TouchableOpacity style={styles.bookCtaButton} onPress={holdThisFare} activeOpacity={0.85}>
                  <View>
                    <Text style={styles.bookCtaTitle}>Book This Fare</Text>
                    <Text style={styles.bookCtaSubtitle}>
                      ₹{Math.round(reviewedFare.cartItem.lineTotal).toLocaleString()} total
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={30} color={Colors.secondary} />
                </TouchableOpacity>

                <Text style={styles.reviewHelper}>Or manage this fare as a regular cart item instead:</Text>

                <View style={styles.reviewActions}>
                  <TouchableOpacity style={styles.reviewSecondaryButton} onPress={addReviewedFareToCart}>
                    <Text style={styles.reviewSecondaryButtonText}>Add to Cart</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reviewTertiaryButton} onPress={continueReviewedFareToCheckout}>
                    <Text style={styles.reviewTertiaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={filtersModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFiltersModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFiltersModalVisible(false)}>
          <Pressable style={styles.filterModalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <View style={styles.modalHeaderActions}>
                {activeFilterCount > 0 ? (
                  <TouchableOpacity onPress={clearAllFilters}>
                    <Text style={styles.clearFiltersText}>Clear all</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setFiltersModalVisible(false)}>
                  <Ionicons name="close" size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterModalBody}>
              {renderFilterControls()}
            </ScrollView>

            <TouchableOpacity
              style={styles.filterApplyButton}
              onPress={() => setFiltersModalVisible(false)}
            >
              <Text style={styles.filterApplyText}>
                Show {visibleFlights.length} flight{visibleFlights.length === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
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
                <Text style={styles.calendarEyebrow}>
                  {calendarState.rangeMode && calendarState.pendingStart ? 'Now pick the return date' : 'Choose date'}
                </Text>
                <Text style={styles.calendarTitle}>
                  {calendarState.rangeMode
                    ? 'Departure → Return'
                    : calendarState.target === 'return'
                    ? 'Return date'
                    : 'Departure date'}
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
                const isPast = date < calendarMinDate;
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

            <Text style={styles.calendarHint}>
              {calendarState.target === 'return' && !calendarState.rangeMode && calendarMinDate > today
                ? `Dates before your departure (${formatDateForDisplay(calendarMinDate)}) are disabled.`
                : 'Past dates are disabled for flight search.'}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={travellerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTravellerModalVisible(false)}
      >
        <Pressable style={styles.calendarOverlay} onPress={() => setTravellerModalVisible(false)}>
          <Pressable style={styles.calendarModal} onPress={() => {}}>
            <View style={styles.calendarModalHeader}>
              <View>
                <Text style={styles.calendarEyebrow}>Travellers &amp; fare</Text>
                <Text style={styles.calendarTitle}>Who's flying?</Text>
              </View>
              <TouchableOpacity style={styles.calendarCloseButton} onPress={() => setTravellerModalVisible(false)}>
                <Ionicons name="close" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: 'adults', label: 'Adults', helper: '12+ years', value: adults },
                { key: 'children', label: 'Children', helper: '2-12 years', value: children },
                { key: 'infants', label: 'Infants', helper: 'Under 2 years', value: infants },
              ].map((row) => (
                <View key={row.key} style={styles.stepperRow}>
                  <View>
                    <Text style={styles.stepperLabel}>{row.label}</Text>
                    <Text style={styles.stepperHelper}>{row.helper}</Text>
                  </View>
                  <View style={styles.stepperControls}>
                    <TouchableOpacity style={styles.stepperButton} onPress={() => adjustPassenger(row.key, -1)}>
                      <Ionicons name="remove" size={18} color={Colors.primaryDark} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{row.value}</Text>
                    <TouchableOpacity style={styles.stepperButton} onPress={() => adjustPassenger(row.key, 1)}>
                      <Ionicons name="add" size={18} color={Colors.primaryDark} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <Text style={styles.modalSectionLabel}>Cabin Class</Text>
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

              <Text style={styles.modalSectionLabel}>Fare Type</Text>
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

              <TouchableOpacity style={styles.searchButton} onPress={() => setTravellerModalVisible(false)}>
                <Text style={styles.searchButtonText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {isDesktop && <WebStickyHeader visible={scrolled} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Extremely light blue-gray rather than the app's default warm
    // off-white - this screen's premium travel-booking redesign leans on a
    // blue+orange palette instead of the usual all-orange one.
    backgroundColor: '#F7FAFC',
  },
  // Without an explicit flex here, react-native-web sizes the FlatList to its
  // content instead of the available screen height, so it never becomes a
  // bounded scroll container (native RN doesn't need this - only web does).
  flatListFlex: {
    flex: 1,
  },
  // Matches listContainer's padding (used by the non-dual FlatList) so the
  // collapsed summary bar/filters don't sit flush against the screen edges
  // the way they briefly did before this was added.
  dualHeaderPadding: {
    paddingHorizontal: 15,
  },
  dualColumnsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  dualColumn: {
    flex: 1,
  },
  dualColumnDivider: {
    width: 1,
    backgroundColor: '#E1E8F0',
  },
  dualColumnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  dualColumnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.accentBlueDark,
  },
  dualColumnListContent: {
    paddingHorizontal: 8,
    paddingBottom: 120,
  },
  dualColumnEmpty: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 12,
    marginTop: 20,
    textAlign: 'center',
  },
  compactCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7ECF2',
    padding: 12,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  compactCardSelected: {
    borderColor: Colors.accentBlue,
    borderWidth: 2,
    backgroundColor: Colors.accentBlueSoft,
  },
  compactSelectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  compactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  compactAirlineLogo: {
    width: 16,
    height: 16,
  },
  compactFlightNo: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  compactTimes: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accentBlueDark,
  },
  compactStops: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  compactPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accentBlueDark,
    marginTop: 8,
  },
  compactSelectedFareBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentBlueDark,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  compactSelectedFareBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.secondary,
  },
  compactFareList: {
    marginTop: 6,
  },
  compactFareListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F7',
  },
  compactFareListLabel: {
    flex: 1,
    fontSize: 11,
    color: Colors.textLight,
  },
  compactFareListPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
  },
  compactDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  compactDetailsToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accentBlue,
  },
  compactSegmentBreakdown: {
    marginTop: 8,
  },
  compactSegmentLine: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 6,
  },
  compactSegmentSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  compactLayoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8E8',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  compactLayoverText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8A6100',
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.secondary,
    letterSpacing: 0.2,
  },
  heroHeader: {
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 46,
    overflow: 'hidden',
  },
  heroHeaderImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Tints the photo so the white buttons/title stay legible regardless of
    // how bright the sky is in that particular crop.
    backgroundColor: 'rgba(11,59,102,0.35)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.secondary,
    marginTop: 18,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // --- Desktop results layout ----------------------------------------------
  webBar: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  webBarInner: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  webBarCell: {
    gap: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.45)',
    paddingBottom: 7,
    minWidth: 0,
  },
  webBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  webBarValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  webBarSwap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  webBarSearch: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBarSearchText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },

  webResultsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 22,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  webSidebar: {
    width: 250,
    // flexGrow:0 stops the ScrollView claiming the row's spare width.
    flexGrow: 0,
    flexShrink: 0,
  },
  webSidebarContent: {
    gap: 14,
    paddingBottom: 28,
  },
  webResultsMain: {
    flex: 1,
    minWidth: 0,
  },
  webFormScroll: {
    paddingBottom: 40,
  },
  webEmptyWrap: {
    paddingTop: 28,
  },
  webSideCount: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webSideCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  webSideCountNum: {
    fontWeight: '800',
    color: Colors.text,
  },
  // --- Filter controls (shared by the desktop sidebar and the phone modal) ---
  filterCard: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 3,
  },
  filterBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBoxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterRowLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textLight,
  },
  filterRowLabelActive: {
    color: Colors.text,
  },
  filterRowMeta: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  stopsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stopCell: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  stopCellActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  stopCellText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textLight,
  },
  stopCellTextActive: {
    color: Colors.primaryDark,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterHint: {
    fontSize: 11.5,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  filterInput: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    outlineStyle: 'none',
  },

  terminalSection: {
    gap: 6,
  },
  terminalSectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginTop: 4,
  },
  terminalGroup: {
    gap: 2,
    paddingLeft: 2,
  },
  terminalAirport: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },

  bandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bandCell: {
    flexGrow: 1,
    minWidth: 62,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 3,
  },
  bandCellActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  bandCellOff: {
    opacity: 0.35,
  },
  bandLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
  },
  bandLabelActive: {
    color: Colors.primaryDark,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  filterApplyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
  },

  filterModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    alignSelf: 'center',
    backgroundColor: Colors.background,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  filterModalBody: {
    gap: 12,
  },
  filtersButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 9,
  },
  filtersBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.secondary,
  },

  webSideCard: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webSideTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  webSideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webSideBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webSideBoxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  webSideLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
  },
  webSideLabelActive: {
    color: Colors.text,
  },

  // --- Desktop hero search panel -------------------------------------------
  // Mirrors WebField's pill styling, but these two need an autocomplete list
  // anchored under them, which WebField doesn't do.
  webFieldWrap: {
    flex: 1.4,
    minWidth: 190,
    gap: 8,
    // The suggestion list is absolutely positioned against this box, and has to
    // paint above the chips row that follows it in the panel - otherwise the
    // chips show through it and swallow clicks on anything past the third row.
    position: 'relative',
    zIndex: 40,
  },
  webFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  webPill: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  webPillInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    outlineStyle: 'none',
  },
  webSuggestBox: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingVertical: 6,
    // Long airport lists scroll inside the dropdown rather than running off the
    // bottom of the panel where they can't be reached.
    maxHeight: 260,
    zIndex: 50,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  webSuggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  webSuggestCity: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  webSuggestCode: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  webLegRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  webLegTag: {
    width: 52,
    paddingBottom: 18,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  webLegTagSpacer: {
    width: 52,
  },
  webLegRemove: {
    width: 44,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webLegRemovePlaceholder: {
    width: 44,
  },
  webAddLeg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  webAddLegText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  webSwapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    // Sits on the field baseline, between From and To.
    marginBottom: 8,
  },
  webChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 1,
  },
  webAirlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  webAirlineLinkText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  webAirlineInput: {
    height: 38,
    minWidth: 170,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.card,
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.text,
    outlineStyle: 'none',
  },

  searchForm: {
    paddingTop: 0,
    marginTop: -32,
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
    position: 'relative',
    marginBottom: 14,
  },
  routeFieldStacked: {
    marginTop: 14,
  },
  swapButtonFloating: {
    position: 'absolute',
    top: '50%',
    right: 14,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  dateRowDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#F3D4C2',
    marginHorizontal: 12,
    marginBottom: 16,
  },
  airportSuggestBox: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3D4C2',
    marginTop: -6,
    marginBottom: 14,
    overflow: 'hidden',
  },
  airportSuggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  airportSuggestCity: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  airportSuggestCode: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
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
  smallInput: {
    flex: 1,
    marginRight: 10,
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
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: Colors.card,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E1E8F0',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillActiveBlue: {
    backgroundColor: Colors.accentBlueDark,
    borderColor: Colors.accentBlueDark,
  },
  pillText: {
    color: Colors.accentBlueDark,
    fontWeight: '700',
    fontSize: 13,
  },
  pillTextActive: {
    color: Colors.secondary,
  },
  resultsToolbar: {
    marginBottom: 14,
  },
  resultsToolbarRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 6,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 4,
  },
  layoutToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  layoutToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: Colors.card,
    paddingVertical: 8,
    paddingHorizontal: 13,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  layoutToggleButtonActive: {
    backgroundColor: Colors.accentBlueDark,
  },
  layoutToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accentBlueDark,
  },
  layoutToggleTextActive: {
    color: Colors.secondary,
  },
  clearFilterButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  clearFilterButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
  tripTypeRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF4EC',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tripTypeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  tripTypeTabActive: {
    backgroundColor: Colors.primary,
  },
  tripTypeTabText: {
    color: Colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  tripTypeTabTextActive: {
    color: Colors.secondary,
  },
  travellerSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  travellerSummaryText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  inlineLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  inlineLinkText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepperLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  stepperHelper: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    width: 36,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 10,
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
  legSelectionChipActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  legSelectionChipText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  legSelectionChipTextActive: {
    color: Colors.primaryDark,
  },
  legReviewButtonDisabled: {
    backgroundColor: '#DCE3EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  legReviewButtonTextDisabled: {
    color: Colors.textMuted,
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
    color: Colors.accentBlueDark,
  },
  stickyFooterSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textLight,
  },
  stickyFooterButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
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
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  summaryBarIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryBarText: {
    flex: 1,
  },
  summaryBarRoute: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.accentBlueDark,
  },
  summaryBarMeta: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.textMuted,
  },
  summaryBarEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 8,
  },
  summaryBarEditText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
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
  reviewTertiaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reviewTertiaryButtonText: {
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  bookCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  bookCtaTitle: {
    color: Colors.secondary,
    fontSize: 17,
    fontWeight: '800',
  },
  bookCtaSubtitle: {
    color: Colors.primarySoft,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  fareRuleLinkRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  fareRuleLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  fareRuleLinkText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  seatHintText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: -4,
    marginBottom: 8,
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
    // Without a cap the sheet fills the window width, and because each day cell
    // is 14.28% wide with aspectRatio 1, the grid grows to ~250px per day and
    // the month controls end up off screen.
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    alignSelf: 'center',
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
  airlineLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 6,
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
  cityName: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
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
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  detailsToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  segmentBreakdown: {
    paddingHorizontal: 15,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
  },
  segmentTimeCol: {
    flex: 1,
  },
  segmentTime: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  segmentCode: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  segmentCityName: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  segmentMidCol: {
    flex: 1.2,
    alignItems: 'center',
  },
  segmentFlightNo: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  segmentDuration: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  layoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E8',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    alignSelf: 'stretch',
  },
  layoverText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A6100',
  },
  fareOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 15,
    paddingBottom: 12,
  },
  fareOptionChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.card,
  },
  fareOptionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  fareOptionChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
  },
  fareOptionChipLabelActive: {
    color: Colors.secondary,
  },
  fareOptionChipPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  fareOptionChipPriceActive: {
    color: Colors.secondary,
  },
  fareOptionChipTags: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  fareOptionChipTagsActive: {
    color: Colors.primarySoft,
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
