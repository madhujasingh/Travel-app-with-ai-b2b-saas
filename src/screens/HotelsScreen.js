import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import useResponsive, { CONTENT_MAX_WIDTH } from '../hooks/useResponsive';
import { LinearGradient } from 'expo-linear-gradient';
import useHeroHeader from '../hooks/useHeroHeader';
import WebStickyHeader from '../components/web/WebStickyHeader';
import WebHero from '../components/web/WebHero';
import WebSearchPanel from '../components/web/WebSearchPanel';
import WebValueProps from '../components/web/WebValueProps';
import WebField from '../components/web/WebField';
import { appAlert } from '../utils/appAlert';
import { encodeRooms } from '../utils/searchParams';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { fetchHotelJson, SEARCH_SESSION_MS } from '../utils/hotelApiErrors';
import DatePickerModal from '../components/DatePickerModal';
import { digitsOnly } from '../utils/inputSanitizers';
import PromoBannerCarousel from '../components/PromoBannerCarousel';

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

// Used by the hero's quick chips and the Popular Destinations row. Tapping one
// opens the city picker already filtered to that name, so these are real
// shortcuts into the existing flow rather than decoration.
const POPULAR_CITIES = ['Goa', 'Dubai', 'Bali', 'Singapore', 'Bangkok', 'Hong Kong'];
const RECENT_SEARCH_CITIES = POPULAR_CITIES.slice(0, 5);

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

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const HotelsScreen = ({ navigation }) => {
  const { centeredContent, isDesktop } = useResponsive();
  const { scrolled, scrollProps } = useHeroHeader();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [hotelIdsInput, setHotelIdsInput] = useState('');
  // Hotel-name matches for the destination picker, alongside the city list.
  const [hotelMatches, setHotelMatches] = useState([]);
  const [searchingHotels, setSearchingHotels] = useState(false);
  const [rooms, setRooms] = useState([createEmptyRoom()]);
  const [roomsModal, setRoomsModal] = useState(false);
  const scrollRef = useRef(null);

  // "2 Rooms, 5 Guests" - the collapsed form shown in the desktop hero field.
  const roomsSummary = (() => {
    const guests = rooms.reduce(
      (total, room) => total + (Number(room.adults) || 0) + (Number(room.children) || 0),
      0,
    );
    const roomLabel = `${rooms.length} Room${rooms.length === 1 ? '' : 's'}`;
    const guestLabel = `${guests} Guest${guests === 1 ? '' : 's'}`;
    return `${roomLabel}, ${guestLabel}`;
  })();

  const [nationality, setNationality] = useState('106');
  const [nationalityLabel, setNationalityLabel] = useState('India');
  const [currency, setCurrency] = useState('INR');

  const [loading, setLoading] = useState(false);

  const [nationalities, setNationalities] = useState(null);
  const [nationalityModal, setNationalityModal] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [loadingNationalities, setLoadingNationalities] = useState(false);

  const [cities, setCities] = useState(null);
  const [cityModal, setCityModal] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [selectingCity, setSelectingCity] = useState(false);
  const [destinationLabel, setDestinationLabel] = useState('');
  // What the traveller picked, in a form the URL can carry: a city name to
  // re-resolve, or a single hotel id. The resolved id list itself cannot go in
  // the URL - Dubai alone is 6,772 ids, about 90KB.
  const [searchCity, setSearchCity] = useState('');
  const [searchHotelId, setSearchHotelId] = useState('');

  const [datePickerField, setDatePickerField] = useState(null); // 'checkIn' | 'checkOut' | null

  const openDatePicker = (field) => setDatePickerField(field);
  const closeDatePicker = () => setDatePickerField(null);

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
      appAlert('Dates required', 'Choose your check-in and check-out dates.');
      return;
    }
    if (!nationality.trim()) {
      appAlert('Nationality required', 'Choose the guest nationality.');
      return;
    }

    try {
      const hids = buildHotelIds();
      if (hids.length === 0) {
        appAlert('Destination required', 'Choose a city to search.');
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

      // Criteria only. The results screen resolves hotel ids and fetches the
      // listings itself, so the URL alone is enough to reproduce the search -
      // a refresh or a shared link re-runs it rather than showing nothing.
      navigation.navigate('HotelSearchResults', {
        city: searchCity,
        hotelId: searchHotelId,
        checkIn,
        checkOut,
        rooms: encodeRooms(rooms),
        currency: currency.trim().toUpperCase(),
        nationality: nationality.trim(),
        destinationLabel,
      });
    } catch (error) {
      appAlert('Hotel Search', error.message || 'Unable to fetch hotels right now.');
    } finally {
      setLoading(false);
    }
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
      appAlert('Nationalities', error.message || 'Unable to load nationalities right now.');
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

  // Opens empty. It used to download every city with synced hotels - 26,500+
  // rows, 1.6MB, about ten seconds - and filter them in the browser, which
  // meant staring at an alphabetical list starting at "Aadit" before typing
  // anything. Both cities and hotels are searched server-side as you type.
  const openCityModal = async () => {
    setCityModal(true);
  };

  // Opens the picker pre-filtered to a city name.
  const openCityForName = (city) => {
    setCitySearch(city);
    openCityModal();
  };

  const selectCity = async (cityEntry) => {
    try {
      setSelectingCity(true);
      // Hotels near the city, not hotels labelled with its name. TripJack
      // files localities as separate cities - Danapur is 8km from the centre
      // of Patna with its own 110 hotels - so matching on the string alone
      // missed about a fifth of what its own site shows.
      const ids = (await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotel-catalog/near?city=${encodeURIComponent(cityEntry.city)}&radiusKm=25&idsOnly=true`,
        { method: 'GET' },
        'Unable to load hotels for this city right now.'
      )).filter(Boolean);
      if (ids.length === 0) {
        appAlert('No hotels', 'No synced hotels found for this city.');
        return;
      }

      setHotelIdsInput(ids.join(', '));
      setDestinationLabel(`${cityEntry.city}, ${cityEntry.countryName}`);
      setSearchCity(cityEntry.city);
      setSearchHotelId('');
      setCityModal(false);
      setCitySearch('');
    } catch (error) {
      appAlert('City Search', error.message || 'Unable to load hotels for this city right now.');
    } finally {
      setSelectingCity(false);
    }
  };

  // Looks up hotels by name as the traveller types. Debounced because this
  // fires per keystroke, and held to three characters - below that nearly
  // every hotel matches and the answer is useless.
  useEffect(() => {
    const term = citySearch.trim();
    if (term.length < 3) {
      setHotelMatches([]);
      setCities([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchingHotels(true);
        const [hotels, cityMatches] = await Promise.all([
          fetchHotelJson(
            `${API_CONFIG.BASE_URL}/hotel-catalog/search?q=${encodeURIComponent(term)}`,
            { method: 'GET' },
            'Unable to search hotels right now.'
          ).catch(() => []),
          fetchHotelJson(
            `${API_CONFIG.BASE_URL}/hotel-catalog/cities?q=${encodeURIComponent(term)}`,
            { method: 'GET' },
            'Unable to search cities right now.'
          ).catch(() => []),
        ]);
        if (!cancelled) {
          setHotelMatches(Array.isArray(hotels) ? hotels : []);
          setCities(Array.isArray(cityMatches) ? cityMatches : []);
        }
      } catch (error) {
        // Silent - an error toast on every keystroke would be worse than no
        // suggestions.
        if (!cancelled) {
          setHotelMatches([]);
          setCities([]);
        }
      } finally {
        if (!cancelled) setSearchingHotels(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [citySearch]);

  // Picking one hotel sends TripJack a single id instead of every hotel in its
  // city - one Listing call rather than 68 for somewhere like Dubai.
  const selectHotel = (hotel) => {
    setHotelIdsInput(String(hotel.tjHotelId));
    setSearchHotelId(String(hotel.tjHotelId));
    setSearchCity('');
    setDestinationLabel(hotel.city ? `${hotel.name}, ${hotel.city}` : hotel.name);
    setCityModal(false);
    setCitySearch('');
    setHotelMatches([]);
  };

  // Already filtered server-side - see the lookup effect above.
  const filteredCities = cities || [];

  // The full room editor. Rendered in the phone form card, and in a modal from
  // the desktop hero's Rooms & Guests field so it never needs a scroll.
  const renderRoomsEditor = () => (
    <>
          <View style={isDesktop ? styles.roomGrid : null}>
          {rooms.map((room, index) => (
            <View key={index} style={[styles.roomCard, isDesktop && styles.roomCardDesktop]}>
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
                        onChangeText={(value) => setChildAge(index, childIndex, digitsOnly(value))}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          </View>

          <TouchableOpacity style={styles.addRoomButton} onPress={addRoom}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.addRoomText}>Add another room</Text>
          </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.accentBlueDark} barStyle="light-content" />


      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        {...scrollProps}
        contentContainerStyle={isDesktop ? null : centeredContent}
      >
      {isDesktop ? (
        <WebHero
          image={require('../../assets/hotels/hero-sunset.jpg')}
          align="left"
          eyebrow="Stay more. Explore more."
          title="Hotel Booking"
          subtitle="Discover amazing stays at the best prices around the world."
          badges={[
            { icon: 'pricetag-outline', label: 'Best Price Guarantee' },
            { icon: 'headset-outline', label: '24/7 Support' },
            { icon: 'shield-checkmark-outline', label: 'Secure Booking' },
          ]}
          activeProduct="hotels"
        >
          <WebSearchPanel
            variant="light"
            searchLabel="Search Hotels"
            onSearch={searchHotels}
            searching={loading}
            secondary={
              <>
                <WebField
                  tone="onLight"
                  label="Nationality"
                  icon="people-outline"
                  flex={1}
                  minWidth={200}
                  value={nationalityLabel}
                  onPress={openNationalityModal}
                />
                <WebField
                  tone="onLight"
                  label="Currency"
                  icon="card-outline"
                  flex={0.6}
                  minWidth={140}
                  value={currency}
                  onChangeText={setCurrency}
                  placeholder="INR"
                  maxLength={3}
                />
                <View style={styles.secondarySpacer} />
              </>
            }
            chips={
              <View style={styles.recentRow}>
                <Text style={styles.recentLabel}>Recent searches:</Text>
                {RECENT_SEARCH_CITIES.map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={styles.recentChip}
                    onPress={() => openCityForName(city)}
                  >
                    <Text style={styles.recentChipText}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
          >
            <WebField
              tone="onLight"
              label="Destination"
              icon="location-outline"
              flex={2}
              minWidth={260}
              value={destinationLabel}
              placeholder="Where do you want to go?"
              loading={selectingCity}
              onPress={openCityModal}
            />
            <WebField
              tone="onLight"
              label="Check In"
              icon="calendar-outline"
              value={formatDisplayDate(checkIn)}
              placeholder="Select date"
              onPress={() => openDatePicker('checkIn')}
            />
            <WebField
              tone="onLight"
              label="Check Out"
              icon="calendar-outline"
              value={formatDisplayDate(checkOut)}
              placeholder="Select date"
              disabled={!checkIn}
              onPress={() => checkIn && openDatePicker('checkOut')}
            />
            <WebField
              tone="onLight"
              label="Rooms & Guests"
              icon="person-outline"
              value={roomsSummary}
              onPress={() => setRoomsModal(true)}
            />
          </WebSearchPanel>
        </WebHero>
      ) : (
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
      )}

        <View style={isDesktop ? styles.webBody : null}>
        <PromoBannerCarousel placement="HOTELS" heading="Offers for you" />

        {isDesktop && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Popular Destinations</Text>
            <View style={styles.destinationRow}>
              {POPULAR_CITIES.map((city) => (
                <TouchableOpacity
                  key={city}
                  style={styles.destinationCard}
                  onPress={() => openCityForName(city)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.accentBlue, Colors.accentBlueDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.destinationImage}
                  >
                    <Ionicons name="business-outline" size={26} color="rgba(255,255,255,0.65)" />
                  </LinearGradient>
                  <Text style={styles.destinationName}>{city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!isDesktop && <>
        <View style={styles.formCard}>
          {/* Destination and the date pair live in the hero panel on desktop;
              showing them again here would be two sources of truth on screen. */}
          {!isDesktop && <>
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
          </>}

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
          {renderRoomsEditor()}


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
        </>}

        </View>

        {isDesktop && <WebValueProps />}
      </ScrollView>

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

      <Modal visible={cityModal} transparent animationType="fade" onRequestClose={() => setCityModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCityModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Where to?</Text>
              <TouchableOpacity onPress={() => setCityModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search a city or hotel name..."
              placeholderTextColor={Colors.textMuted}
              value={citySearch}
              onChangeText={setCitySearch}
            />
            {/* One scroller for both sections. They used to be a fixed hotel
                block above a FlatList, so the list took whatever height was
                left - about two cities - and the rest were unreachable.

                Cities lead: a city is the broader answer and what most people
                are after. Someone who typed a hotel name finds it below, and
                that section is short. */}
            {citySearch.trim().length < 3 ? (
              <Text style={styles.modalEmptyText}>Start typing a city or hotel name.</Text>
            ) : filteredCities.length === 0 && hotelMatches.length === 0 && !searchingHotels ? (
              <Text style={styles.modalEmptyText}>Nothing matches "{citySearch.trim()}".</Text>
            ) : (
              <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                {filteredCities.length > 0 && (
                  <>
                    <Text style={styles.modalSectionLabel}>Cities</Text>
                    {filteredCities.map((item) => (
                      <TouchableOpacity
                        key={`${item.city}-${item.countryName}`}
                        style={styles.modalListRow}
                        onPress={() => selectCity(item)}
                        disabled={selectingCity}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalListRowText}>{item.city}</Text>
                          <Text style={styles.modalListRowMeta}>
                            {item.countryName}
                            {item.hotelCount ? ` · ${item.hotelCount} hotels` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {(searchingHotels || hotelMatches.length > 0) && (
                  <>
                    <Text style={styles.modalSectionLabel}>
                      Hotels{searchingHotels ? ' · searching…' : ''}
                    </Text>
                    {hotelMatches.map((hotel) => (
                      <TouchableOpacity
                        key={hotel.tjHotelId}
                        style={styles.modalListRow}
                        onPress={() => selectHotel(hotel)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalListRowText} numberOfLines={1}>{hotel.name}</Text>
                          <Text style={styles.modalListRowMeta}>
                            {[hotel.city, hotel.countryName].filter(Boolean).join(', ')}
                          </Text>
                        </View>
                        <Ionicons name="bed-outline" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={roomsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRoomsModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRoomsModal(false)}>
          <Pressable style={styles.roomsModalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rooms & Guests</Text>
              <TouchableOpacity onPress={() => setRoomsModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {renderRoomsEditor()}
            </ScrollView>
            <TouchableOpacity style={styles.roomsDoneButton} onPress={() => setRoomsModal(false)}>
              <Text style={styles.roomsDoneText}>Done</Text>
            </TouchableOpacity>
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
      {isDesktop && <WebStickyHeader visible={scrolled} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
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

  // Desktop: the leftover trip details (nationality, currency, rooms) were still
  // rendering as the stacked phone card under a full-width hero.
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
  },
  recentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginRight: 4,
  },
  recentChip: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.accentBlueSoft,
  },
  recentChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accentBlue,
  },

  section: {
    marginTop: 38,
    gap: 18,
  },
  sectionHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.accentBlueDark,
  },
  destinationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  destinationCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  destinationImage: {
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  whyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  whyCard: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    borderRadius: 12,
    padding: 18,
  },
  whyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyText: {
    flex: 1,
    gap: 5,
  },
  whyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accentBlueDark,
  },
  whyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textLight,
  },

  secondarySpacer: {
    flex: 1.4,
    minWidth: 0,
  },
  roomsModalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '86%',
    alignSelf: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  roomsDoneButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  roomsDoneText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.secondary,
  },

  webBody: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  formCardDesktop: {
    marginHorizontal: 0,
    marginTop: 24,
    paddingVertical: 24,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 16,
  },
  roomCardDesktop: {
    // Two rooms per row; they grow to fill a lone trailing card.
    width: '48%',
    flexGrow: 1,
    marginBottom: 0,
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
