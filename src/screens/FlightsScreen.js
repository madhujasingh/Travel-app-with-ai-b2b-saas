import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

const resolveAirportCode = (value) => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;

  const directCode = AIRPORT_OPTIONS.find((option) => option.code === normalized);
  if (directCode) {
    return directCode.code;
  }

  const byCity = AIRPORT_OPTIONS.find((option) => option.city.toUpperCase() === normalized);
  if (byCity) {
    return byCity.code;
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

const buildJourneyLabel = (bucket) => {
  if (bucket === 'RETURN') {
    return 'Return';
  }

  if (bucket === 'COMBO') {
    return 'Combo';
  }

  return 'Onward';
};

const flattenTripBuckets = (tripInfos = {}) => {
  const flattened = [];

  ['ONWARD', 'RETURN', 'COMBO'].forEach((bucket) => {
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

const mapFlightsFromResponse = (data) => {
  const flattenedTrips = flattenTripBuckets(data?.searchResult?.tripInfos);

  return flattenedTrips.map(({ bucket, trip, tripIndex }, index) => {
    const segments = Array.isArray(trip?.sI) ? trip.sI : [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const totalPrice = trip?.totalPriceList?.[0];
    const adultFare = totalPrice?.fd?.ADULT;
    const baggage = getBaggageLabel(adultFare);
    const totalDuration = segments.reduce((sum, segment) => sum + Number(segment?.duration || 0), 0);
    const totalStops = segments.reduce((sum, segment) => sum + Number(segment?.stops || 0), 0);
    const journeyLabel = buildJourneyLabel(bucket);

    return {
      id: `${bucket}-${tripIndex}-${totalPrice?.id || firstSegment?.id || index}`,
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
      fareType: totalPrice?.fareIdentifier || 'PUBLISHED',
      journeyLabel,
      segmentCount: segments.length,
      priceIds: trip?.totalPriceList?.map((priceInfo) => priceInfo?.id).filter(Boolean) || [],
    };
  });
};

const FlightsScreen = ({ navigation }) => {
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

      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to search flights right now.');
      }

      setFlights(mapFlightsFromResponse(data));
    } catch (error) {
      setFlights([]);
      Alert.alert('Flight Search', error.message || 'Unable to fetch flights right now.');
    } finally {
      setLoading(false);
    }
  };

  const reviewFare = async (flight) => {
    if (!flight?.priceIds?.length) {
      Alert.alert('Review unavailable', 'This fare is missing the TripJack review identifier.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/flights/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceIds: flight.priceIds,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to review this fare right now.');
      }

      Alert.alert(
        'Review Ready',
        `TripJack review loaded for ${flight.airline}. Response contains ${Array.isArray(data?.tripInfos) ? data.tripInfos.length : 0} reviewed trip(s).`
      );
    } catch (error) {
      Alert.alert('Review Fare', error.message || 'Unable to review this fare right now.');
    } finally {
      setLoading(false);
    }
  };

  const renderFlight = ({ item }) => (
    <TouchableOpacity style={styles.flightCard} activeOpacity={0.8}>
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
          <Text style={styles.amenity}>{item.checkInBaggage}</Text>
          <Text style={styles.amenity}>{item.cabinBaggage}</Text>
          <Text style={styles.amenity}>{item.fareType}</Text>
        </View>
        <TouchableOpacity style={styles.bookButton} onPress={() => reviewFare(item)}>
          <Text style={styles.bookButtonText}>Review Fare</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

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
        contentContainerStyle={flights.length ? styles.listContainer : styles.listContainerEmpty}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.searchForm}>
            <Text style={styles.sectionTitle}>Trip Type</Text>
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

            <Text style={styles.sectionTitle}>{routeHeaderLabel}</Text>
            {routes.map((route, index) => (
              <View key={`route-${index}`} style={styles.routeCard}>
                <View style={styles.routeHeader}>
                  <Text style={styles.routeTitle}>Leg {index + 1}</Text>
                  {tripType === 'MULTI_CITY' && routes.length > 2 ? (
                    <TouchableOpacity onPress={() => removeMultiCityRoute(index)}>
                      <Ionicons name="trash-outline" size={18} color={Colors.error} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.inputLabel}>From</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Delhi or DEL"
                      placeholderTextColor={Colors.textMuted}
                      value={route.from}
                      onChangeText={(value) => updateRoute(index, 'from', value)}
                      autoCapitalize="characters"
                    />
                  </View>
                  <TouchableOpacity style={styles.swapButton} onPress={() => swapRouteCities(index)}>
                    <Text style={styles.swapIcon}>⇄</Text>
                  </TouchableOpacity>
                  <View style={[styles.inputContainer, { flex: 1, marginLeft: 10 }]}>
                    <Text style={styles.inputLabel}>To</Text>
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

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Departure</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={Colors.textMuted}
                    value={route.travelDate}
                    onChangeText={(value) => updateRoute(index, 'travelDate', value)}
                  />
                </View>
              </View>
            ))}

            {tripType === 'MULTI_CITY' ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={addMultiCityRoute}>
                <Text style={styles.secondaryButtonText}>Add Route Leg</Text>
              </TouchableOpacity>
            ) : null}

            {tripType === 'RETURN' ? (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Return Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={Colors.textMuted}
                  value={returnDate}
                  onChangeText={setReturnDate}
                />
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>Passengers</Text>
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, styles.smallInput]}>
                <Text style={styles.inputLabel}>Adults</Text>
                <TextInput
                  style={styles.input}
                  value={adults}
                  onChangeText={setAdults}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputContainer, styles.smallInput]}>
                <Text style={styles.inputLabel}>Children</Text>
                <TextInput
                  style={styles.input}
                  value={children}
                  onChangeText={setChildren}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputContainer, styles.smallInput]}>
                <Text style={styles.inputLabel}>Infants</Text>
                <TextInput
                  style={styles.input}
                  value={infants}
                  onChangeText={setInfants}
                  keyboardType="numeric"
                />
              </View>
            </View>

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
              <TextInput
                style={styles.input}
                placeholder="Optional: SG, 6E, AI"
                placeholderTextColor={Colors.textMuted}
                value={preferredAirlines}
                onChangeText={setPreferredAirlines}
                autoCapitalize="characters"
              />
              <Text style={styles.helperText}>Enter up to 10 airline codes, separated by commas.</Text>
            </View>

            <TouchableOpacity style={styles.searchButton} onPress={searchFlights} disabled={loading}>
              <Text style={styles.searchButtonText}>{loading ? 'Searching...' : 'Search Flights'}</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={renderEmptyState}
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
  searchForm: {
    backgroundColor: Colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    marginTop: 4,
  },
  routeCard: {
    backgroundColor: Colors.background,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
  inputContainer: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    marginBottom: 10,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smallInput: {
    flex: 1,
    marginRight: 10,
  },
  swapButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
    marginRight: 10,
    marginBottom: 10,
  },
  pillActive: {
    backgroundColor: Colors.primary,
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
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  secondaryButtonText: {
    color: Colors.primaryDark,
    fontSize: 15,
    fontWeight: '700',
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 15,
  },
  listContainerEmpty: {
    flexGrow: 1,
    padding: 15,
  },
  flightCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
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
  },
  amenity: {
    fontSize: 12,
    color: Colors.textLight,
    marginRight: 15,
    marginBottom: 4,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 12,
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
