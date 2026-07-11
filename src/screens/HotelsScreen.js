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
import { parseHotelError, SEARCH_SESSION_MS } from '../utils/hotelApiErrors';

const pad = (value) => String(value).padStart(2, '0');

// Accepts YYYY-MM-DD (TripJack format) or DD/MM/YYYY (easier to type), returns YYYY-MM-DD or null.
const formatDateForApi = (value) => {
  if (!value) return null;
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return null;
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
  const [currency, setCurrency] = useState('INR');

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchSession, setSearchSession] = useState(null);

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
    const checkInDate = formatDateForApi(checkIn);
    const checkOutDate = formatDateForApi(checkOut);

    if (!checkInDate || !checkOutDate) {
      Alert.alert('Dates required', 'Enter check-in and check-out as DD/MM/YYYY or YYYY-MM-DD.');
      return;
    }
    if (checkOutDate <= checkInDate) {
      Alert.alert('Invalid dates', 'Check-out must be after check-in.');
      return;
    }
    if (!nationality.trim()) {
      Alert.alert('Nationality required', 'Enter the guest nationality country ID (e.g. 106 for India).');
      return;
    }

    try {
      const hids = buildHotelIds();
      if (hids.length === 0) {
        Alert.alert(
          'Hotel IDs required',
          'Enter at least one TripJack hotel ID to search. City search will be added once the destination lookup API is available.'
        );
        return;
      }

      const roomsPayload = buildRoomsPayload();
      const correlationId = generateCorrelationId();
      const payload = {
        checkIn: checkInDate,
        checkOut: checkOutDate,
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/hotels/listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('[hotel listing] RESPONSE', JSON.stringify(data));
      if (!response.ok) {
        throw new Error(parseHotelError(data, 'Unable to search hotels right now.').message);
      }

      setHotels(data.hotels || []);
      setTotalResults(data.totalResults || 0);
      // Same correlationId (the docs call it "searchId" in prose) must be reused
      // for Detail and Review - the session is valid ~15 minutes from Listing.
      setSearchSession({
        correlationId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
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
      tjHotelId: hotel.tjHotelId,
      hotelName: hotel.name,
      searchContext: searchSession,
    });
  };

  const renderHotel = ({ item }) => {
    const topOption = item.options?.[0];
    const pricing = topOption?.pricing;

    return (
      <TouchableOpacity style={styles.hotelCard} activeOpacity={0.85} onPress={() => openHotelDetail(item)}>
        <View style={styles.hotelHeader}>
          <Ionicons name="business" size={44} color={Colors.secondary} />
        </View>

        <View style={styles.hotelContent}>
          <Text style={styles.hotelName}>{item.name}</Text>
          <Text style={styles.hotelId}>ID: {item.tjHotelId}</Text>

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
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={Colors.textMuted}
                value={checkIn}
                onChangeText={setCheckIn}
              />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Check-out</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={Colors.textMuted}
                value={checkOut}
                onChangeText={setCheckOut}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Hotel IDs (comma separated)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1234, 5464"
            placeholderTextColor={Colors.textMuted}
            value={hotelIdsInput}
            onChangeText={setHotelIdsInput}
            keyboardType="numbers-and-punctuation"
          />

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Nationality (country ID)</Text>
              <TextInput
                style={styles.input}
                placeholder="106"
                placeholderTextColor={Colors.textMuted}
                value={nationality}
                onChangeText={setNationality}
                keyboardType="number-pad"
              />
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
          keyExtractor={(item) => item.tjHotelId}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={false}
        />
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
  hotelContent: {
    padding: 20,
  },
  hotelName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  hotelId: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 10,
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
});

export default HotelsScreen;
