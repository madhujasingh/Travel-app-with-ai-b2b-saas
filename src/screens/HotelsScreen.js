import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  const [totalResults, setTotalResults] = useState(0);
  const [searchSession, setSearchSession] = useState(null);

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

  const [datePickerField, setDatePickerField] = useState(null); // 'checkIn' | 'checkOut' | null

  const openDatePicker = (field) => setDatePickerField(field);
  const closeDatePicker = () => setDatePickerField(null);

  const chooseDate = (dateString) => {
    if (datePickerField === 'checkIn') {
      setCheckIn(dateString);
      // Keep check-out valid relative to the new check-in - clear it if it
      // no longer makes sense rather than silently sending a bad search.
      if (checkOut && checkOut <= dateString) {
        setCheckOut('');
      }
    } else if (datePickerField === 'checkOut') {
      setCheckOut(dateString);
    }
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
    const ids = hotelIdsInput
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .map(Number);

    if (ids.length === 0) {
      return [];
    }
    if (ids.length > 100) {
      throw new Error('Enter at most 100 hotel IDs.');
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
      const correlationId = generateCorrelationId();
      const payload = {
        checkIn,
        checkOut,
        rooms: roomsPayload,
        currency: currency.trim().toUpperCase(),
        correlationId,
        nationality: nationality.trim(),
        hids,
      };

      setLoading(true);
      setSearched(true);
      setHotels([]);
      setSearchSession(null);

      console.log('[hotel listing] REQUEST', JSON.stringify(payload));
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/listing`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Unable to search hotels right now.'
      );
      console.log('[hotel listing] RESPONSE', JSON.stringify(data));

      setHotels(data.hotels || []);
      setTotalResults(data.totalResults || 0);
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

      const ids = hotelsInCity.map((h) => h.tjHotelId).filter(Boolean).slice(0, 100);
      if (ids.length === 0) {
        Alert.alert('No hotels', 'No synced hotels found for this city.');
        return;
      }

      setHotelIdsInput(ids.join(', '));
      setDestinationLabel(`${cityEntry.city}, ${cityEntry.countryName} · ${ids.length} hotel${ids.length === 1 ? '' : 's'}`);
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

  const renderHotel = ({ item }) => {
    // Best practice from the docs: filter out options where inventory.available
    // is explicitly false before picking what to display.
    const availableOptions = (item.options || []).filter((option) => option.inventory?.available !== false);
    const topOption = availableOptions[0];
    const pricing = topOption?.pricing;

    return (
      <TouchableOpacity style={styles.hotelCard} activeOpacity={0.85} onPress={() => openHotelDetail(item)}>
        {item.heroImageUrl ? (
          <Image source={{ uri: item.heroImageUrl }} style={styles.hotelImage} resizeMode="cover" />
        ) : (
          <View style={styles.hotelHeader}>
            <Ionicons name="business" size={44} color={Colors.secondary} />
          </View>
        )}

        <View style={styles.hotelContent}>
          <Text style={styles.hotelName}>{item.name}</Text>

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
                  <Text style={styles.price}>
                    {pricing?.currency} {Number(pricing?.totalPrice || 0).toLocaleString()}
                  </Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hotels</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Check-in</Text>
              <TouchableOpacity style={styles.input} onPress={() => openDatePicker('checkIn')}>
                <Text style={checkIn ? styles.pickerText : styles.pickerPlaceholder}>
                  {formatDisplayDate(checkIn) || 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Check-out</Text>
              <TouchableOpacity
                style={[styles.input, !checkIn && styles.inputDisabled]}
                onPress={() => checkIn && openDatePicker('checkOut')}
                disabled={!checkIn}
              >
                <Text style={checkOut ? styles.pickerText : styles.pickerPlaceholder}>
                  {formatDisplayDate(checkOut) || 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Destination</Text>
          <TouchableOpacity style={styles.browseButton} onPress={openCityModal} disabled={selectingCity}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.browseButtonText}>
              {selectingCity ? 'Loading hotels...' : destinationLabel || 'Choose a city'}
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
              <TouchableOpacity style={styles.input} onPress={openNationalityModal}>
                <Text style={styles.pickerText}>{nationalityLabel}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <TextInput
                style={styles.input}
                placeholder="INR"
                placeholderTextColor={Colors.textMuted}
                value={currency}
                onChangeText={setCurrency}
                autoCapitalize="characters"
                maxLength={3}
              />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Rooms</Text>
          {rooms.map((room, index) => (
            <View key={index} style={styles.roomCard}>
              <View style={styles.roomCardHeader}>
                <Text style={styles.roomCardTitle}>Room {index + 1}</Text>
                {rooms.length > 1 && (
                  <TouchableOpacity onPress={() => removeRoom(index)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Adults</Text>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => adjustRoomCount(index, 'adults', -1, 1, 9)}
                  >
                    <Ionicons name="remove" size={18} color={Colors.primaryDark} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{room.adults}</Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => adjustRoomCount(index, 'adults', 1, 1, 9)}
                  >
                    <Ionicons name="add" size={18} color={Colors.primaryDark} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Children</Text>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => adjustRoomCount(index, 'children', -1, 0, 6)}
                  >
                    <Ionicons name="remove" size={18} color={Colors.primaryDark} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{room.children}</Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => adjustRoomCount(index, 'children', 1, 0, 6)}
                  >
                    <Ionicons name="add" size={18} color={Colors.primaryDark} />
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

        {searched && !loading && (
          <Text style={styles.resultsSummary}>
            {hotels.length} of {totalResults} hotels shown
          </Text>
        )}

        {searched && !loading && hotels.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="bed-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>No hotels found for this search.</Text>
          </View>
        )}

        <FlatList
          data={hotels}
          renderItem={renderHotel}
          keyExtractor={(item) => item.hotelId}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
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
            ) : filteredCities.length === 0 ? (
              <Text style={styles.modalEmptyText}>No synced cities match your search.</Text>
            ) : (
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
                    <Text style={styles.modalListRowMeta}>
                      {item.hotelCount} hotel{item.hotelCount === 1 ? '' : 's'}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <DatePickerModal
        visible={datePickerField !== null}
        title={datePickerField === 'checkOut' ? 'Check-out date' : 'Check-in date'}
        initialDate={parseDateValue(datePickerField === 'checkOut' ? checkOut : checkIn)}
        minDate={
          datePickerField === 'checkOut' && checkIn
            ? new Date(parseDateValue(checkIn).getTime() + 24 * 60 * 60 * 1000)
            : startOfTomorrow()
        }
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
  formCard: {
    margin: 15,
    padding: 15,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.primarySoft,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  browseButtonText: {
    flex: 1,
    color: Colors.primaryDark,
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
  stepperLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
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
  resultsSummary: {
    paddingHorizontal: 20,
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 4,
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
});

export default HotelsScreen;
