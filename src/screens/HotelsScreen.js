import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
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
import MapView, { Callout, Marker } from '../components/MapViewCompat';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { fetchHotelJson, SEARCH_SESSION_MS } from '../utils/hotelApiErrors';
import DatePickerModal from '../components/DatePickerModal';

// checkIn/checkOut are always set via DatePickerModal in YYYY-MM-DD, so this
// only needs to go the other way, for display.
const parseDateValue = (value) => {
  const match = (value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const nightsBetween = (checkInStr, checkOutStr) => {
  const from = parseDateValue(checkInStr);
  const to = parseDateValue(checkOutStr);
  if (!from || !to) return 0;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
};

const formatDisplayDate = (value) => {
  const date = parseDateValue(value);
  if (!date) return null;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const startOfTomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const generateCorrelationId = () =>
  `htl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const createEmptyRoom = () => ({ adults: 2, children: 0, childAge: [] });

// TripJack's /hotels/listing caps at 100 hids per call, so a city with more
// synced hotels than that needs multiple calls merged together.
const LISTING_CHUNK_SIZE = 100;
const RESULTS_PAGE_SIZE = 20;

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const HotelsScreen = ({ navigation }) => {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [hotelIdsInput, setHotelIdsInput] = useState('');
  const [rooms, setRooms] = useState([createEmptyRoom()]);
  const [nationality, setNationality] = useState('106');
  const [nationalityLabel, setNationalityLabel] = useState('India');
  const [currency, setCurrency] = useState('INR');

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [searchSession, setSearchSession] = useState(null);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [selectedStars, setSelectedStars] = useState(() => new Set());
  const [selectedMealBasis, setSelectedMealBasis] = useState(() => new Set());
  const [selectedPriceBucketKeys, setSelectedPriceBucketKeys] = useState(() => new Set());
  const [gstApplicableOnly, setGstApplicableOnly] = useState(false);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState(() => new Set());
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [visibleCount, setVisibleCount] = useState(RESULTS_PAGE_SIZE);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollViewRef = useRef(null);

  const [nationalities, setNationalities] = useState(null);
  const [nationalityModal, setNationalityModal] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [loadingNationalities, setLoadingNationalities] = useState(false);

  const [cities, setCities] = useState(null);
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [loadingCities, setLoadingCities] = useState(false);
  const [selectingCity, setSelectingCity] = useState(false);
  const [destinationLabel, setDestinationLabel] = useState('');
  const [citySyncTriggering, setCitySyncTriggering] = useState(false);

  // Fallback when the quick city-index lookup can't find a typed city
  // (fetch-city-regionIds has no name filter, so it can miss real cities -
  // see triggerCitySync) - lets the customer pick the country instead, which
  // syncs reliably. countryPickerCity remembers what they originally typed,
  // just for the modal's copy.
  const [countries, setCountries] = useState(null);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countryPickerCity, setCountryPickerCity] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countrySyncTriggering, setCountrySyncTriggering] = useState(false);

  const [datePickerField, setDatePickerField] = useState(null); // 'checkIn' | 'checkOut' | null

  const openDatePicker = (field) => setDatePickerField(field);
  const closeDatePicker = () => setDatePickerField(null);

  const clearAllFilters = () => {
    setSelectedStars(new Set());
    setSelectedMealBasis(new Set());
    setSelectedPriceBucketKeys(new Set());
    setGstApplicableOnly(false);
    setSelectedPropertyTypes(new Set());
  };

  const toggleSetValue = (setter, value) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  // Tapping Check-in opens the picker in range mode (see DatePickerModal) so
  // both dates are chosen in one continuous session; this only handles the
  // Check-out field being tapped on its own, to adjust just that date.
  const chooseDate = (dateString) => {
    setCheckOut(dateString);
    closeDatePicker();
  };

  const chooseDateRange = (startDateString, endDateString) => {
    setCheckIn(startDateString);
    setCheckOut(endDateString);
    closeDatePicker();
  };

  const adjustRoomCount = (index, field, delta, min, max) => {
    setRooms((current) =>
      current.map((room, i) => {
        if (i !== index) return room;
        const nextValue = Math.min(max, Math.max(min, room[field] + delta));
        if (field === 'children') {
          const nextChildAge = Array.from({ length: nextValue }, (_, ageIndex) => room.childAge[ageIndex] ?? '5');
          return { ...room, children: nextValue, childAge: nextChildAge };
        }
        return { ...room, [field]: nextValue };
      })
    );
  };

  const setChildAge = (roomIndex, childIndex, value) => {
    setRooms((current) =>
      current.map((room, i) => {
        if (i !== roomIndex) return room;
        const nextChildAge = [...room.childAge];
        nextChildAge[childIndex] = value;
        return { ...room, childAge: nextChildAge };
      })
    );
  };

  const addRoom = () => {
    setRooms((current) => (current.length >= 9 ? current : [...current, createEmptyRoom()]));
  };

  const removeRoom = (index) => {
    setRooms((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  };

  const buildHotelIds = () => {
    // Populated by selectCity() with every synced hotel for the chosen city -
    // unbounded here, searchHotels() chunks it into ≤100-id batches for
    // TripJack's per-call limit.
    const ids = hotelIdsInput
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .map(Number);

    if (ids.length === 0) {
      return [];
    }
    if (ids.some((id) => !Number.isFinite(id))) {
      throw new Error('Hotel IDs must be numbers, separated by commas.');
    }
    return ids;
  };

  const buildRoomsPayload = () => {
    return rooms.map((room, index) => {
      const adults = Number(room.adults);
      if (!Number.isInteger(adults) || adults < 1 || adults > 9) {
        throw new Error(`Room ${index + 1}: adults must be between 1 and 9.`);
      }

      const children = Number(room.children) || 0;
      if (children > 6) {
        throw new Error(`Room ${index + 1}: children must be 6 or fewer.`);
      }

      const payload = { adults };
      if (children > 0) {
        const childAge = room.childAge.map((age) => Number(age));
        if (childAge.length !== children || childAge.some((age) => !Number.isInteger(age) || age < 0 || age > 17)) {
          throw new Error(`Room ${index + 1}: enter a valid age (0-17) for each child.`);
        }
        payload.children = children;
        payload.childAge = childAge;
      }
      return payload;
    });
  };

  const searchHotels = async () => {
    if (!checkIn || !checkOut) {
      Alert.alert('Dates required', 'Choose your check-in and check-out dates.');
      return;
    }
    if (!nationality.trim()) {
      Alert.alert('Nationality required', 'Choose the guest nationality.');
      return;
    }

    try {
      const hids = buildHotelIds();
      if (hids.length === 0) {
        Alert.alert('Destination required', 'Choose a city to search.');
        return;
      }

      const roomsPayload = buildRoomsPayload();
      // One correlationId for the whole logical search, per TripJack's docs -
      // reused across every chunked Listing call below, and later for Detail
      // and Review. Not a per-request nonce.
      const correlationId = generateCorrelationId();
      const basePayload = {
        checkIn,
        checkOut,
        rooms: roomsPayload,
        currency: currency.trim().toUpperCase(),
        correlationId,
        nationality: nationality.trim(),
      };

      setLoading(true);
      setSearched(true);
      setHotels([]);
      clearAllFilters();
      setViewMode('list');
      setVisibleCount(RESULTS_PAGE_SIZE);
      setSearchSession(null);

      const chunks = chunkArray(hids, LISTING_CHUNK_SIZE);
      const responses = await Promise.all(
        chunks.map((chunkHids) => {
          const payload = { ...basePayload, hids: chunkHids };
          if (__DEV__) console.log('[hotel listing] REQUEST', JSON.stringify(payload));
          return fetchHotelJson(
            `${API_CONFIG.BASE_URL}/hotels/listing`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            },
            'Unable to search hotels right now.'
          );
        })
      );
      if (__DEV__) console.log('[hotel listing] RESPONSES', JSON.stringify(responses));

      const mergedHotels = responses.flatMap((data) => data.hotels || []);
      setHotels(mergedHotels);
      // Same correlationId (the docs call it "searchId" in prose) must be reused
      // for Detail and Review - the session is valid ~15 minutes from Listing.
      setSearchSession({
        correlationId,
        checkIn,
        checkOut,
        rooms: roomsPayload,
        currency: currency.trim().toUpperCase(),
        nationality: nationality.trim(),
        expiresAt: Date.now() + SEARCH_SESSION_MS,
      });
    } catch (error) {
      setHotels([]);
      Alert.alert('Hotel Search', error.message || 'Unable to fetch hotels right now.');
    } finally {
      setLoading(false);
    }
  };

  const openHotelDetail = (hotel) => {
    if (!searchSession || Date.now() >= searchSession.expiresAt) {
      Alert.alert('Search expired', 'Your search session has expired. Please search again.');
      return;
    }

    navigation.navigate('HotelDetail', {
      // Listing/Detail responses use "hotelId", not the "tjHotelId" the docs
      // describe - confirmed against real captured responses. Only the
      // static-content endpoints (hotel-mapping/hotel-content, used by
      // selectCity below) actually use tjHotelId.
      tjHotelId: hotel.hotelId,
      hotelName: hotel.name,
      searchContext: searchSession,
    });
  };

  // ---- Nationality picker (GET /hotels/nationalities) ----

  const openNationalityModal = async () => {
    setNationalityModal(true);
    if (nationalities) return;

    try {
      setLoadingNationalities(true);
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/nationalities`,
        { method: 'GET' },
        'Unable to load nationalities right now.'
      );
      setNationalities(data.nationalityInfos || []);
    } catch (error) {
      Alert.alert('Nationalities', error.message || 'Unable to load nationalities right now.');
    } finally {
      setLoadingNationalities(false);
    }
  };

  const selectNationality = (item) => {
    setNationality(item.countryId);
    setNationalityLabel(item.countryName);
    setNationalityModal(false);
    setNationalitySearch('');
  };

  const filteredNationalities = (nationalities || []).filter((item) =>
    item.countryName.toLowerCase().includes(nationalitySearch.trim().toLowerCase())
  );

  // ---- Search by city -> resolves to real hotel IDs from our own synced
  // catalogue (GET /hotel-catalog/cities, GET /hotel-catalog?city=X). No
  // manual per-hotel picking - selecting a city searches every synced hotel
  // in it, up to TripJack's 100-hids-per-request limit, same as a real OTA.

  const openCityModal = async () => {
    setCityModal(true);
    if (cities) return;

    try {
      setLoadingCities(true);
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotel-catalog/cities`,
        { method: 'GET' },
        'Unable to load cities right now.'
      );
      setCities(data || []);
    } catch (error) {
      Alert.alert('Cities', error.message || 'Unable to load cities right now.');
    } finally {
      setLoadingCities(false);
    }
  };

  const selectCity = async (cityEntry) => {
    try {
      setSelectingCity(true);
      const hotelsInCity = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotel-catalog?city=${encodeURIComponent(cityEntry.city)}`,
        { method: 'GET' },
        'Unable to load hotels for this city right now.'
      );

      const ids = hotelsInCity.map((h) => h.tjHotelId).filter(Boolean);
      if (ids.length === 0) {
        Alert.alert('No hotels', 'No synced hotels found for this city.');
        return;
      }

      setHotelIdsInput(ids.join(', '));
      setDestinationLabel(`${cityEntry.city}, ${cityEntry.countryName}`);
      setCityModal(false);
      setCitySearch('');
    } catch (error) {
      Alert.alert('City Search', error.message || 'Unable to load hotels for this city right now.');
    } finally {
      setSelectingCity(false);
    }
  };

  const filteredCities = (cities || []).filter((c) =>
    `${c.city} ${c.countryName}`.toLowerCase().includes(citySearch.trim().toLowerCase())
  );

  // Fallback for typing a city with no synced hotels yet - looks it up
  // against TripJack's own city index and, if found, starts a background
  // sync (see HotelSyncJobRunner) so it's searchable soon, without making
  // this search wait for that sync to finish.
  const triggerCitySync = async () => {
    const query = citySearch.trim();
    if (!query) return;

    try {
      setCitySyncTriggering(true);
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotel-catalog/search-and-sync-city?cityName=${encodeURIComponent(query)}`,
        { method: 'POST' },
        'Unable to search for this city right now.'
      );

      if (data.action === 'started' || data.action === 'already-running') {
        Alert.alert(
          'Loading this destination',
          `We're fetching hotels for "${query}" from our supplier - this can take a few minutes. Search again shortly and it should appear.`
        );
      } else if (data.action === 'already-fresh') {
        Alert.alert(
          'Already up to date',
          `"${query}" was already synced recently. If it's still not showing up, double-check the spelling.`
        );
      } else if (data.action === 'busy') {
        Alert.alert('Please try again', "We're already loading a few other destinations right now - try again in a minute.");
      } else if (data.action === 'need-country') {
        // TripJack's city index has no name filter, so a quick lookup can
        // miss a real city - fall back to a reliable country-level sync
        // instead of failing outright. Close the city modal first - two RN
        // Modals visible at once silently fails to open the second one.
        setCountryPickerCity(query);
        setCityModal(false);
        openCountryPicker();
      }
    } catch (error) {
      Alert.alert('City Search', error.message || 'Unable to search for this city right now.');
    } finally {
      setCitySyncTriggering(false);
    }
  };

  const openCountryPicker = async () => {
    setCountryPickerVisible(true);
    if (countries) return;

    try {
      setLoadingCountries(true);
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/countries`,
        { method: 'GET' },
        'Unable to load countries right now.'
      );
      setCountries(data.hotelCountries || []);
    } catch (error) {
      Alert.alert('Countries', error.message || 'Unable to load countries right now.');
    } finally {
      setLoadingCountries(false);
    }
  };

  const filteredCountries = (countries || []).filter((name) =>
    name.toLowerCase().includes(countrySearch.trim().toLowerCase())
  );

  const triggerCountrySync = async (countryName) => {
    try {
      setCountrySyncTriggering(true);
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotel-catalog/search-and-sync-country?countryName=${encodeURIComponent(countryName)}`,
        { method: 'POST' },
        'Unable to search this country right now.'
      );

      setCountryPickerVisible(false);
      setCountrySearch('');

      if (data.action === 'started' || data.action === 'already-running') {
        Alert.alert(
          'Loading this destination',
          `We're fetching hotels across ${countryName} from our supplier - this can take a few minutes. Search for "${countryPickerCity}" again shortly and it should appear.`
        );
      } else if (data.action === 'busy') {
        Alert.alert('Please try again', "We're already loading a few other destinations right now - try again in a minute.");
      }
    } catch (error) {
      Alert.alert('Country Search', error.message || 'Unable to search this country right now.');
    } finally {
      setCountrySyncTriggering(false);
    }
  };

  // Best practice from the docs: filter out options where inventory.available
  // is explicitly false before picking what to display. Listing only ever
  // returns ONE option per hotel (its cheapest) - unlike Detail, which
  // returns every rate - so every hotel-level filter below (meal basis,
  // price, GST) reflects that one cheapest option, not the hotel's full
  // range of rates.
  const getTopOption = (item) => (item.options || []).find((option) => option.inventory?.available !== false);

  // Filter option lists + counts, computed from the full unfiltered result
  // set (not filteredHotels) so a count always reflects "how many hotels
  // this option would show if picked on its own" - matches TripJack's own
  // per-option counts (see the reference screenshots) rather than counts
  // that shrink as other filters are layered on.
  const starRatingOptions = useMemo(() => {
    const counts = {};
    hotels.forEach((item) => {
      const stars = Math.round(parseFloat(item.starRating));
      if (Number.isFinite(stars) && stars >= 1 && stars <= 5) {
        counts[stars] = (counts[stars] || 0) + 1;
      }
    });
    return [5, 4, 3, 2, 1].filter((value) => counts[value] > 0).map((value) => ({ value, count: counts[value] }));
  }, [hotels]);

  const mealBasisOptions = useMemo(() => {
    const counts = {};
    hotels.forEach((item) => {
      const meal = getTopOption(item)?.mealBasis;
      if (meal) counts[meal] = (counts[meal] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [hotels]);

  const propertyTypeOptions = useMemo(() => {
    const counts = {};
    hotels.forEach((item) => {
      if (item.propertyType) counts[item.propertyType] = (counts[item.propertyType] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [hotels]);

  const gstApplicableCount = useMemo(
    () =>
      hotels.filter((item) => {
        const gst = getTopOption(item)?.compliance?.gstType;
        return gst && gst !== 'NA';
      }).length,
    [hotels]
  );

  // Roughly-equal-count buckets over the cheapest-option price, same shape
  // as TripJack's own Price Range filter (see reference screenshots) rather
  // than fixed-width bands that could leave most buckets empty depending on
  // the city's price spread.
  const priceBuckets = useMemo(() => {
    const prices = hotels
      .map((item) => getTopOption(item)?.pricing?.totalPrice)
      .filter((p) => Number.isFinite(p))
      .sort((a, b) => a - b);
    if (prices.length === 0) return [];
    const bucketCount = Math.min(6, prices.length);
    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
      const startIdx = Math.floor((i / bucketCount) * prices.length);
      const endIdx = i === bucketCount - 1 ? prices.length - 1 : Math.floor(((i + 1) / bucketCount) * prices.length) - 1;
      const min = prices[startIdx];
      const max = prices[Math.max(startIdx, endIdx)];
      buckets.push({
        key: `${min}-${max}`,
        min,
        max,
        count: endIdx - startIdx + 1,
        label:
          i === 0
            ? `Up to ₹${Math.round(max).toLocaleString()}`
            : `₹${Math.round(min).toLocaleString()} – ₹${Math.round(max).toLocaleString()}`,
      });
    }
    return buckets;
  }, [hotels]);

  const activeFilterCount =
    selectedStars.size +
    selectedMealBasis.size +
    selectedPriceBucketKeys.size +
    selectedPropertyTypes.size +
    (gstApplicableOnly ? 1 : 0);

  const filteredHotels = useMemo(() => {
    return hotels.filter((item) => {
      if (selectedStars.size > 0) {
        const stars = Math.round(parseFloat(item.starRating));
        if (!selectedStars.has(stars)) return false;
      }

      const topOption = getTopOption(item);

      if (selectedMealBasis.size > 0) {
        if (!topOption || !selectedMealBasis.has(topOption.mealBasis)) return false;
      }

      if (selectedPriceBucketKeys.size > 0) {
        const price = topOption?.pricing?.totalPrice;
        if (!Number.isFinite(price)) return false;
        const inSelectedBucket = priceBuckets.some(
          (bucket) => selectedPriceBucketKeys.has(bucket.key) && price >= bucket.min && price <= bucket.max
        );
        if (!inSelectedBucket) return false;
      }

      if (gstApplicableOnly) {
        const gst = topOption?.compliance?.gstType;
        if (!gst || gst === 'NA') return false;
      }

      if (selectedPropertyTypes.size > 0) {
        if (!item.propertyType || !selectedPropertyTypes.has(item.propertyType)) return false;
      }

      return true;
    });
  }, [hotels, selectedStars, selectedMealBasis, selectedPriceBucketKeys, gstApplicableOnly, selectedPropertyTypes, priceBuckets]);

  const mappableHotels = useMemo(
    () =>
      filteredHotels.filter(
        (item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
      ),
    [filteredHotels]
  );

  const mapRegion = useMemo(() => {
    if (mappableHotels.length === 0) return null;
    const lats = mappableHotels.map((item) => item.latitude);
    const lngs = mappableHotels.map((item) => item.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.4,
      longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.4,
    };
  }, [mappableHotels]);

  const renderHotel = ({ item, index }) => {
    const topOption = getTopOption(item);
    const pricing = topOption?.pricing;

    return (
      <TouchableOpacity style={styles.hotelCard} activeOpacity={0.85} onPress={() => openHotelDetail(item)}>
        <View style={styles.hotelIndexBadge} pointerEvents="none">
          <Text style={styles.hotelIndexBadgeText}>
            {index + 1} of {filteredHotels.length}
          </Text>
        </View>
        {item.heroImageUrl ? (
          <Image source={{ uri: item.heroImageUrl }} style={styles.hotelImage} resizeMode="cover" />
        ) : (
          <View style={styles.hotelHeader}>
            <Ionicons name="business" size={44} color={Colors.secondary} />
          </View>
        )}

        <View style={styles.hotelContent}>
          <Text style={styles.hotelName}>{item.name}</Text>

          {(item.starRating || item.city) && (
            <View style={styles.hotelMetaRow}>
              {item.starRating ? (
                <View style={styles.starRow}>
                  {Array.from({ length: Math.round(parseFloat(item.starRating)) || 0 }).map((_, i) => (
                    <Ionicons key={i} name="star" size={12} color={Colors.warning} />
                  ))}
                </View>
              ) : null}
              {item.city ? <Text style={styles.hotelCity}>{item.city}</Text> : null}
            </View>
          )}

          {topOption && (
            <>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{topOption.mealBasis}</Text>
                </View>
                {topOption.cancellation?.isRefundable && (
                  <View style={[styles.tag, styles.tagSuccess]}>
                    <Ionicons name="checkmark-circle-outline" size={12} color={Colors.success} />
                    <Text style={[styles.tagText, styles.tagSuccessText]}>Refundable</Text>
                  </View>
                )}
              </View>

              <View style={styles.hotelFooter}>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>Total for stay</Text>
                  {pricing?.strikeThrough > pricing?.totalPrice && (
                    <Text style={styles.strikeThroughPrice}>
                      {pricing.currency} {Number(pricing.strikeThrough).toLocaleString()}
                    </Text>
                  )}
                  <Text style={styles.price}>
                    {pricing?.currency} {Number(pricing?.totalPrice || 0).toLocaleString()}
                  </Text>
                  {(() => {
                    const nights = nightsBetween(checkIn, checkOut);
                    if (!pricing?.totalPrice || nights <= 1) return null;
                    return (
                      <Text style={styles.perNightPrice}>
                        {pricing.currency} {Math.round(pricing.totalPrice / nights).toLocaleString()} / night
                      </Text>
                    );
                  })()}
                </View>
                <View style={styles.viewOptionsButton}>
                  <Text style={styles.viewOptionsText}>View Options</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
                </View>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (viewMode === 'map' && mapRegion) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setViewMode('list')}>
            <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Map view</Text>
          <View style={{ width: 30 }} />
        </View>

        <MapView style={styles.map} initialRegion={mapRegion}>
          {mappableHotels.map((item) => {
            const pricing = getTopOption(item)?.pricing;
            return (
              <Marker
                key={item.hotelId}
                coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              >
                <Callout onPress={() => openHotelDetail(item)}>
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>{item.name}</Text>
                    {item.city ? <Text style={styles.calloutMeta}>{item.city}</Text> : null}
                    {pricing && (
                      <Text style={styles.calloutPrice}>
                        {pricing.currency} {Number(pricing.totalPrice || 0).toLocaleString()}
                      </Text>
                    )}
                    <Text style={styles.calloutLink}>View details</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.accentBlueDark} barStyle="light-content" />

      <ImageBackground
        source={require('../../assets/hotels/hero-sunset.jpg')}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroOverlay} />
        <TouchableOpacity style={styles.heroBackButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>
            Find Your{'\n'}
            <Text style={styles.heroTitleAccent}>Perfect Stay</Text>
          </Text>
          <Text style={styles.heroSubtitle}>Comfortable stays, unforgettable journeys.</Text>
        </View>
      </ImageBackground>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
          const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 300;
          if (nearBottom) {
            setVisibleCount((prev) => Math.min(prev + RESULTS_PAGE_SIZE, filteredHotels.length));
          }
          setShowScrollTop(contentOffset.y > 400);
        }}
        scrollEventThrottle={200}
      >
        <View style={styles.formCard}>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Check-in</Text>
              <TouchableOpacity style={styles.inputWithIcon} onPress={() => openDatePicker('checkIn')}>
                <Ionicons name="calendar-outline" size={17} color={Colors.accentBlue} />
                <Text style={[styles.inputIconText, checkIn ? styles.pickerText : styles.pickerPlaceholder]}>
                  {formatDisplayDate(checkIn) || 'Select date'}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Check-out</Text>
              <TouchableOpacity
                style={[styles.inputWithIcon, !checkIn && styles.inputDisabled]}
                onPress={() => checkIn && openDatePicker('checkOut')}
                disabled={!checkIn}
              >
                <Ionicons name="calendar-outline" size={17} color={Colors.accentBlue} />
                <Text style={[styles.inputIconText, checkOut ? styles.pickerText : styles.pickerPlaceholder]}>
                  {formatDisplayDate(checkOut) || 'Select date'}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Destination</Text>
          <TouchableOpacity style={styles.browseButton} onPress={openCityModal} disabled={selectingCity}>
            <Ionicons name="location-outline" size={18} color={Colors.accentBlue} />
            <Text style={styles.browseButtonText}>
              {selectingCity ? 'Loading hotels...' : destinationLabel || 'Where do you want to go?'}
            </Text>
            {selectingCity ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            )}
          </TouchableOpacity>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Nationality</Text>
              <TouchableOpacity style={styles.inputWithIcon} onPress={openNationalityModal}>
                <Ionicons name="people-outline" size={17} color={Colors.accentBlue} />
                <Text style={[styles.inputIconText, styles.pickerText]}>{nationalityLabel}</Text>
                <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <View style={styles.inputWithIcon}>
                <Ionicons name="card-outline" size={17} color={Colors.accentBlue} />
                <TextInput
                  style={styles.inputIconTextField}
                  placeholder="INR"
                  placeholderTextColor={Colors.textMuted}
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Rooms & Guests</Text>
          {rooms.map((room, index) => (
            <View key={index} style={styles.roomCard}>
              <View style={styles.roomCardHeader}>
                <View style={styles.roomCardTitleRow}>
                  <Ionicons name="bed-outline" size={16} color={Colors.accentBlue} />
                  <Text style={styles.roomCardTitle}>Room {index + 1}</Text>
                </View>
                {rooms.length > 1 && (
                  <TouchableOpacity onPress={() => removeRoom(index)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.stepperRow}>
                <View style={styles.stepperLabelRow}>
                  <Ionicons name="person-outline" size={15} color={Colors.accentBlue} />
                  <Text style={styles.stepperLabel}>Adults</Text>
                </View>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperButtonMinus}
                    onPress={() => adjustRoomCount(index, 'adults', -1, 1, 9)}
                  >
                    <Ionicons name="remove" size={18} color={Colors.accentBlue} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{room.adults}</Text>
                  <TouchableOpacity
                    style={styles.stepperButtonPlus}
                    onPress={() => adjustRoomCount(index, 'adults', 1, 1, 9)}
                  >
                    <Ionicons name="add" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperRow}>
                <View style={styles.stepperLabelRow}>
                  <Ionicons name="people-outline" size={15} color={Colors.accentBlue} />
                  <Text style={styles.stepperLabel}>Children</Text>
                </View>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperButtonMinus}
                    onPress={() => adjustRoomCount(index, 'children', -1, 0, 6)}
                  >
                    <Ionicons name="remove" size={18} color={Colors.accentBlue} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{room.children}</Text>
                  <TouchableOpacity
                    style={styles.stepperButtonPlus}
                    onPress={() => adjustRoomCount(index, 'children', 1, 0, 6)}
                  >
                    <Ionicons name="add" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {room.children > 0 && (
                <View style={styles.childAgeRow}>
                  {room.childAge.map((age, childIndex) => (
                    <View key={childIndex} style={styles.childAgeField}>
                      <Text style={styles.childAgeLabel}>Child {childIndex + 1} age</Text>
                      <TextInput
                        style={styles.childAgeInput}
                        value={String(age)}
                        onChangeText={(value) => setChildAge(index, childIndex, value)}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addRoomButton} onPress={addRoom}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.addRoomText}>Add another room</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.searchButton} onPress={searchHotels} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Colors.secondary} />
            ) : (
              <>
                <Ionicons name="search" size={18} color={Colors.secondary} />
                <Text style={styles.searchButtonText}>Search Hotels</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {!searched && (
          <>
            <View style={styles.trustBadgeRow}>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={Colors.accentBlue} />
                </View>
                <Text style={styles.trustBadgeText}>Best Price{'\n'}Guarantee</Text>
              </View>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIconWrap}>
                  <Ionicons name="headset-outline" size={18} color={Colors.accentBlue} />
                </View>
                <Text style={styles.trustBadgeText}>24/7{'\n'}Support</Text>
              </View>
              <View style={styles.trustBadge}>
                <View style={styles.trustBadgeIconWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.accentBlue} />
                </View>
                <Text style={styles.trustBadgeText}>Secure{'\n'}Booking</Text>
              </View>
            </View>

            <View style={styles.flightPathRow}>
              <View style={styles.flightPathLine} />
              <Ionicons name="airplane" size={16} color={Colors.accentBlue} style={styles.flightPathIcon} />
            </View>
          </>
        )}

        {searched && !loading && hotels.length > 0 && (
          <View style={styles.resultsToolbar}>
            <View style={styles.resultsToolbarRow}>
              <TouchableOpacity style={styles.filtersButton} onPress={() => setFiltersModalVisible(true)}>
                <Ionicons name="options-outline" size={16} color={Colors.primary} />
                <Text style={styles.filtersButtonText}>Filters</Text>
                {activeFilterCount > 0 && (
                  <View style={styles.filtersBadge}>
                    <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.resultsMetaRow}>
              <Text style={styles.resultsCount}>
                {Math.min(visibleCount, filteredHotels.length)} of {filteredHotels.length} hotel
                {filteredHotels.length === 1 ? '' : 's'} loaded
                {visibleCount < filteredHotels.length ? ' · scroll for more' : ''}
              </Text>
              {mappableHotels.length > 0 && (
                <TouchableOpacity style={styles.mapViewButton} onPress={() => setViewMode('map')}>
                  <Ionicons name="map-outline" size={14} color={Colors.primary} />
                  <Text style={styles.mapViewButtonText}>Map view</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {searched && !loading && hotels.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="bed-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>No hotels found for this search.</Text>
            <Text style={styles.emptyStateSubtext}>Try different dates or another city.</Text>
          </View>
        )}

        {searched && !loading && hotels.length > 0 && filteredHotels.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="filter-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>No hotels match these filters.</Text>
            <TouchableOpacity style={styles.clearFilterButton} onPress={clearAllFilters}>
              <Text style={styles.clearFilterButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={filteredHotels.slice(0, visibleCount)}
          renderItem={renderHotel}
          keyExtractor={(item) => item.hotelId}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
      </ScrollView>

      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopButton}
          activeOpacity={0.85}
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <Ionicons name="arrow-up" size={22} color={Colors.secondary} />
        </TouchableOpacity>
      )}

      <Modal visible={nationalityModal} transparent animationType="fade" onRequestClose={() => setNationalityModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setNationalityModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nationality</Text>
              <TouchableOpacity onPress={() => setNationalityModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search country..."
              placeholderTextColor={Colors.textMuted}
              value={nationalitySearch}
              onChangeText={setNationalitySearch}
            />
            {loadingNationalities ? (
              <ActivityIndicator color={Colors.primary} style={styles.modalLoading} />
            ) : (
              <FlatList
                data={filteredNationalities}
                keyExtractor={(item) => item.countryId}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalListRow} onPress={() => selectNationality(item)}>
                    <Text style={styles.modalListRowText}>{item.countryName}</Text>
                    <Text style={styles.modalListRowMeta}>+{item.dialCode}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCountryPickerVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Which country is "{countryPickerCity}" in?</Text>
              <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHintText}>
              We couldn't find this city directly - pick its country and we'll load hotels for the whole country instead.
            </Text>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search country..."
              placeholderTextColor={Colors.textMuted}
              value={countrySearch}
              onChangeText={setCountrySearch}
            />
            {loadingCountries ? (
              <ActivityIndicator color={Colors.primary} style={styles.modalLoading} />
            ) : (
              <FlatList
                data={filteredCountries}
                keyExtractor={(name) => name}
                style={styles.modalList}
                renderItem={({ item: name }) => (
                  <TouchableOpacity
                    style={styles.modalListRow}
                    onPress={() => triggerCountrySync(name)}
                    disabled={countrySyncTriggering}
                  >
                    <Text style={styles.modalListRowText}>{name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            {countrySyncTriggering && <ActivityIndicator color={Colors.primary} style={styles.modalLoading} />}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={cityModal} transparent animationType="fade" onRequestClose={() => setCityModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCityModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a city</Text>
              <TouchableOpacity onPress={() => setCityModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search city..."
              placeholderTextColor={Colors.textMuted}
              value={citySearch}
              onChangeText={setCitySearch}
            />
            {loadingCities ? (
              <ActivityIndicator color={Colors.primary} style={styles.modalLoading} />
            ) : (
              <>
                {filteredCities.length === 0 ? (
                  <Text style={styles.modalEmptyText}>No synced cities match "{citySearch.trim()}".</Text>
                ) : (
                  // Same-named places in different countries are real (e.g.
                  // there's a town called "Bali" in India, distinct from the
                  // Indonesian island) - matches here don't necessarily mean
                  // the city the customer actually wants is covered, so
                  // "Search anyway" stays available below regardless.
                  <FlatList
                    data={filteredCities}
                    keyExtractor={(item) => `${item.city}-${item.countryName}`}
                    style={styles.modalList}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.modalListRow} onPress={() => selectCity(item)} disabled={selectingCity}>
                        <View>
                          <Text style={styles.modalListRowText}>{item.city}</Text>
                          <Text style={styles.modalListRowMeta}>{item.countryName}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  />
                )}
                {citySearch.trim().length > 0 && (
                  <View style={styles.citySyncPrompt}>
                    {filteredCities.length > 0 && (
                      <Text style={styles.modalHintText}>Not the right one? It might be in a different country.</Text>
                    )}
                    <TouchableOpacity
                      style={styles.citySyncButton}
                      onPress={triggerCitySync}
                      disabled={citySyncTriggering}
                    >
                      {citySyncTriggering ? (
                        <ActivityIndicator size="small" color={Colors.secondary} />
                      ) : (
                        <>
                          <Ionicons name="cloud-download-outline" size={16} color={Colors.secondary} />
                          <Text style={styles.citySyncButtonText}>Search "{citySearch.trim()}" anyway</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={filtersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFiltersModalVisible(false)}>
          <Pressable style={styles.filtersModalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={clearAllFilters}>
                <Text style={styles.resetFiltersText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filtersScroll} showsVerticalScrollIndicator={false}>
              {starRatingOptions.length > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>Star Rating</Text>
                  <View style={styles.filterOptionsList}>
                    {starRatingOptions.map(({ value, count }) => {
                      const active = selectedStars.has(value);
                      return (
                        <TouchableOpacity
                          key={value}
                          style={styles.filterOptionRow}
                          onPress={() => toggleSetValue(setSelectedStars, value)}
                        >
                          <View style={[styles.checkbox, active && styles.checkboxActive]}>
                            {active && <Ionicons name="checkmark" size={13} color={Colors.secondary} />}
                          </View>
                          <View style={styles.starRow}>
                            {Array.from({ length: value }).map((_, i) => (
                              <Ionicons key={i} name="star" size={13} color={Colors.warning} />
                            ))}
                          </View>
                          <Text style={styles.filterOptionCount}>({count})</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {mealBasisOptions.length > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>Meal Basis</Text>
                  <View style={styles.filterOptionsList}>
                    {mealBasisOptions.map(({ value, count }) => {
                      const active = selectedMealBasis.has(value);
                      return (
                        <TouchableOpacity
                          key={value}
                          style={styles.filterOptionRow}
                          onPress={() => toggleSetValue(setSelectedMealBasis, value)}
                        >
                          <View style={[styles.checkbox, active && styles.checkboxActive]}>
                            {active && <Ionicons name="checkmark" size={13} color={Colors.secondary} />}
                          </View>
                          <Text style={styles.filterOptionLabel}>{value}</Text>
                          <Text style={styles.filterOptionCount}>({count})</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {priceBuckets.length > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>Price Range</Text>
                  <View style={styles.filterOptionsList}>
                    {priceBuckets.map((bucket) => {
                      const active = selectedPriceBucketKeys.has(bucket.key);
                      return (
                        <TouchableOpacity
                          key={bucket.key}
                          style={styles.filterOptionRow}
                          onPress={() => toggleSetValue(setSelectedPriceBucketKeys, bucket.key)}
                        >
                          <View style={[styles.checkbox, active && styles.checkboxActive]}>
                            {active && <Ionicons name="checkmark" size={13} color={Colors.secondary} />}
                          </View>
                          <Text style={styles.filterOptionLabel}>{bucket.label}</Text>
                          <Text style={styles.filterOptionCount}>({bucket.count})</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {gstApplicableCount > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>GST Applicable</Text>
                  <View style={styles.filterOptionsList}>
                    <TouchableOpacity
                      style={styles.filterOptionRow}
                      onPress={() => setGstApplicableOnly((v) => !v)}
                    >
                      <View style={[styles.checkbox, gstApplicableOnly && styles.checkboxActive]}>
                        {gstApplicableOnly && <Ionicons name="checkmark" size={13} color={Colors.secondary} />}
                      </View>
                      <Text style={styles.filterOptionLabel}>GST Applicable</Text>
                      <Text style={styles.filterOptionCount}>({gstApplicableCount})</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {propertyTypeOptions.length > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>Property Type</Text>
                  <View style={styles.filterOptionsList}>
                    {propertyTypeOptions.map(({ value, count }) => {
                      const active = selectedPropertyTypes.has(value);
                      return (
                        <TouchableOpacity
                          key={value}
                          style={styles.filterOptionRow}
                          onPress={() => toggleSetValue(setSelectedPropertyTypes, value)}
                        >
                          <View style={[styles.checkbox, active && styles.checkboxActive]}>
                            {active && <Ionicons name="checkmark" size={13} color={Colors.secondary} />}
                          </View>
                          <Text style={styles.filterOptionLabel}>{value}</Text>
                          <Text style={styles.filterOptionCount}>({count})</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.filtersFooter}>
              <TouchableOpacity style={styles.filtersCloseButton} onPress={() => setFiltersModalVisible(false)}>
                <Text style={styles.filtersCloseButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filtersApplyButton} onPress={() => setFiltersModalVisible(false)}>
                <Text style={styles.filtersApplyButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <DatePickerModal
        visible={datePickerField !== null}
        title={datePickerField === 'checkOut' ? 'Check-out date' : 'Check-in → Check-out'}
        rangeMode={datePickerField === 'checkIn'}
        initialDate={parseDateValue(datePickerField === 'checkOut' ? checkOut : checkIn)}
        minDate={
          datePickerField === 'checkOut' && checkIn
            ? new Date(parseDateValue(checkIn).getTime() + 24 * 60 * 60 * 1000)
            : startOfTomorrow()
        }
        onSelect={chooseDate}
        onSelectRange={chooseDateRange}
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
  hero: {
    backgroundColor: Colors.accentBlueDark,
    paddingTop: 16,
    paddingBottom: 56,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Darkens/blues the photo so the white/orange text on top stays
    // legible regardless of how bright that particular image is.
    backgroundColor: 'rgba(11,59,102,0.55)',
  },
  heroBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroContent: {
    maxWidth: '85%',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.secondary,
    lineHeight: 34,
  },
  heroTitleAccent: {
    color: Colors.primary,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  formCard: {
    marginHorizontal: 15,
    marginTop: -36,
    padding: 15,
    backgroundColor: Colors.card,
    borderRadius: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 6,
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIconText: {
    flex: 1,
  },
  inputIconTextField: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  pickerPlaceholder: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  pickerText: {
    fontSize: 15,
    color: Colors.text,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  browseButtonText: {
    flex: 1,
    color: Colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  roomCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roomCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  stepperLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButtonMinus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonPlus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    width: 32,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  childAgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  childAgeField: {
    width: 90,
  },
  childAgeLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  childAgeInput: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  addRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  addRoomText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  searchButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  trustBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  trustBadge: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.accentBlueSoft,
    borderRadius: 12,
    paddingVertical: 12,
  },
  trustBadgeIconWrap: {
    marginBottom: 6,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accentBlueDark,
    textAlign: 'center',
    lineHeight: 14,
  },
  flightPathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 18,
    marginBottom: 6,
  },
  flightPathLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accentBlueSoft,
  },
  flightPathIcon: {
    marginLeft: 8,
    transform: [{ rotate: '45deg' }],
  },
  resultsSummary: {
    paddingHorizontal: 20,
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  resultsToolbar: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  resultsToolbarRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFF4EC',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  filtersButtonText: {
    color: Colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  filtersBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersBadgeText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  resultsMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 4,
  },
  mapViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  mapViewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  map: {
    flex: 1,
  },
  calloutCard: {
    width: 180,
    padding: 4,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  calloutMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  calloutPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  calloutLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 6,
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
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyStateText: {
    marginTop: 10,
    color: Colors.textMuted,
    fontSize: 14,
  },
  emptyStateSubtext: {
    marginTop: 4,
    color: Colors.textMuted,
    fontSize: 12,
  },
  listContainer: {
    padding: 15,
  },
  hotelCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  hotelIndexBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hotelIndexBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  hotelHeader: {
    backgroundColor: Colors.primaryLight,
    padding: 20,
    alignItems: 'center',
  },
  hotelImage: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.primaryLight,
  },
  hotelContent: {
    padding: 20,
  },
  hotelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  hotelMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
  },
  hotelCity: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagSuccess: {
    borderColor: Colors.success,
  },
  tagText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  tagSuccessText: {
    color: Colors.success,
  },
  hotelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 15,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  price: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  strikeThroughPrice: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  perNightPrice: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  viewOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  viewOptionsText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  resetFiltersText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  filtersModalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  filtersScroll: {
    maxHeight: '100%',
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 14,
    marginBottom: 8,
  },
  filterOptionsList: {
    gap: 2,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterOptionLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  filterOptionCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  filtersFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filtersCloseButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  filtersCloseButtonText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  filtersApplyButton: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  filtersApplyButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
  },
  modalHintText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  modalSearchInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  modalLoading: {
    marginVertical: 30,
  },
  modalEmptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    marginVertical: 30,
  },
  citySyncPrompt: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  citySyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  citySyncButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
  modalList: {
    maxHeight: 380,
  },
  modalListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalListRowText: {
    fontSize: 14,
    color: Colors.text,
  },
  modalListRowMeta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  scrollTopButton: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default HotelsScreen;
