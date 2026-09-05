import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  FlatList,
  StatusBar,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import DatePickerModal from '../components/DatePickerModal';
import { digitsOnly } from '../utils/inputSanitizers';

const JOURNEY_TYPES = [
  { value: 'airport_transfer', label: 'Airport Transfer' },
  { value: 'outstation', label: 'Outstation' },
  { value: 'local', label: 'Local' },
];

// 30-min increments, 00:00-23:30 - simpler and more reliable on native than
// a full scrolling hour/minute wheel for a field that's really just "pick a
// rough time of day".
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0');
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CabsScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [journeyType, setJourneyType] = useState('airport_transfer');
  const [tripType, setTripType] = useState('oneway');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [searching, setSearching] = useState(false);

  const [locationPicker, setLocationPicker] = useState({ visible: false, target: null, query: '', results: [], loading: false });
  const [datePicker, setDatePicker] = useState({ visible: false, target: null });
  const [timePicker, setTimePicker] = useState({ visible: false, target: null });

  const openLocationPicker = (target) => {
    setLocationPicker({ visible: true, target, query: '', results: [], loading: false });
  };

  const searchLocations = async (query) => {
    setLocationPicker((prev) => ({ ...prev, query }));
    if (!query.trim()) {
      setLocationPicker((prev) => ({ ...prev, results: [] }));
      return;
    }
    setLocationPicker((prev) => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/cabs/location-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: query }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error?.message || data?.message || 'Unable to search locations right now.');
      }
      setLocationPicker((prev) => ({ ...prev, results: data?.data?.places || [], loading: false }));
    } catch (error) {
      setLocationPicker((prev) => ({ ...prev, loading: false }));
      // Silent - a mid-typing search hiccup shouldn't interrupt the user
      // with an alert; they can just keep typing or try again.
    }
  };

  const selectLocation = async (place) => {
    const target = locationPicker.target;
    setLocationPicker({ visible: false, target: null, query: '', results: [], loading: false });
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/cabs/lat-long`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ placeId: place.value }),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error?.message || data?.message || 'Unable to load this location right now.');
      }
      const locationDto = {
        type: 'location',
        displayAddress: place.displayLabel || place.name,
        lat: String(data?.data?.location?.lat ?? ''),
        long: String(data?.data?.location?.lng ?? ''),
        address: data?.data?.address || {},
      };
      if (target === 'origin') setOrigin(locationDto);
      else setDestination(locationDto);
    } catch (error) {
      Alert.alert('Location', error.message || 'Unable to load this location right now.');
    }
  };

  const openDatePicker = (target) => setDatePicker({ visible: true, target });
  const chooseDate = (dateString) => {
    if (datePicker.target === 'pickup') setPickupDate(dateString);
    else setReturnDate(dateString);
    setDatePicker({ visible: false, target: null });
  };

  const openTimePicker = (target) => setTimePicker({ visible: true, target });
  const chooseTime = (time) => {
    if (timePicker.target === 'pickup') setPickupTime(time);
    else setReturnTime(time);
    setTimePicker({ visible: false, target: null });
  };

  const runSearch = async () => {
    if (!origin || !destination) {
      Alert.alert('Locations required', 'Choose both a pickup and drop-off location.');
      return;
    }
    if (!pickupDate || !pickupTime) {
      Alert.alert('Pickup time required', 'Choose your pickup date and time.');
      return;
    }
    const pickupDateTime = new Date(`${pickupDate}T${pickupTime}:00`);
    // Doc: pickupDate "must be >=2 hours in future" - checked client-side too
    // so an obviously-invalid time is caught before hitting the API.
    if (pickupDateTime.getTime() < Date.now() + 2 * 60 * 60 * 1000) {
      Alert.alert('Pickup too soon', 'Pickup time must be at least 2 hours from now.');
      return;
    }

    let returnDateTimeString;
    if (tripType === 'roundtrip') {
      if (!returnDate || !returnTime) {
        Alert.alert('Return time required', 'Choose your return date and time.');
        return;
      }
      const returnDateTime = new Date(`${returnDate}T${returnTime}:00`);
      if (returnDateTime.getTime() < pickupDateTime.getTime() + 30 * 60 * 1000) {
        Alert.alert('Return too soon', 'Return time must be at least 30 minutes after pickup.');
        return;
      }
      returnDateTimeString = `${returnDate} ${returnTime}`;
    }

    const passengersCount = Math.min(10, Math.max(1, parseInt(passengers, 10) || 1));

    const payload = {
      pickupDate: `${pickupDate} ${pickupTime}`,
      ...(returnDateTimeString ? { returnDate: returnDateTimeString } : {}),
      origin,
      destination,
      journeyType,
      tripType,
      passengers: passengersCount,
    };

    try {
      setSearching(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/cabs/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error?.message || data?.message || 'Unable to fetch cab quotes right now.');
      }
      const quotesInfo = data?.data?.quotesInfo || [];
      if (quotesInfo.length === 0) {
        Alert.alert('No Cabs Available', 'No cabs were found for this route and time. Try a different time or location.');
        return;
      }
      navigation.navigate('CabResults', {
        quotesInfo,
        journeyInfo: data?.data?.journeyInfo,
        routeDetails: data?.data?.routeDetails,
        journeyType,
        tripType,
        passengers: passengersCount,
      });
    } catch (error) {
      Alert.alert('Cab Search', error.message || 'Unable to fetch cab quotes right now.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cabs</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.formCard}>
        <View style={styles.chipRow}>
          {JOURNEY_TYPES.map((jt) => (
            <TouchableOpacity
              key={jt.value}
              style={[styles.chip, journeyType === jt.value && styles.chipActive]}
              onPress={() => setJourneyType(jt.value)}
            >
              <Text style={[styles.chipText, journeyType === jt.value && styles.chipTextActive]}>{jt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, styles.chipHalf, tripType === 'oneway' && styles.chipActive]}
            onPress={() => setTripType('oneway')}
          >
            <Text style={[styles.chipText, tripType === 'oneway' && styles.chipTextActive]}>One Way</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, styles.chipHalf, tripType === 'roundtrip' && styles.chipActive]}
            onPress={() => setTripType('roundtrip')}
          >
            <Text style={[styles.chipText, tripType === 'roundtrip' && styles.chipTextActive]}>Round Trip</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Pickup Location</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={() => openLocationPicker('origin')}>
          <Ionicons name="radio-button-on-outline" size={17} color={Colors.primary} />
          <Text style={[styles.inputIconText, origin ? styles.pickerText : styles.pickerPlaceholder]} numberOfLines={1}>
            {origin?.displayAddress || 'Where should we pick you up?'}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Drop-off Location</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={() => openLocationPicker('destination')}>
          <Ionicons name="location-outline" size={17} color={Colors.primary} />
          <Text style={[styles.inputIconText, destination ? styles.pickerText : styles.pickerPlaceholder]} numberOfLines={1}>
            {destination?.displayAddress || 'Where are you going?'}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Pickup Date & Time</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.inputWithIcon, styles.inputFlex]} onPress={() => openDatePicker('pickup')}>
            <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
            <Text style={[styles.inputIconText, pickupDate ? styles.pickerText : styles.pickerPlaceholder]}>
              {pickupDate ? formatDisplayDate(pickupDate) : 'Date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.inputWithIcon, styles.inputFlex]} onPress={() => openTimePicker('pickup')}>
            <Ionicons name="time-outline" size={17} color={Colors.primary} />
            <Text style={[styles.inputIconText, pickupTime ? styles.pickerText : styles.pickerPlaceholder]}>
              {pickupTime || 'Time'}
            </Text>
          </TouchableOpacity>
        </View>

        {tripType === 'roundtrip' ? (
          <>
            <Text style={styles.fieldLabel}>Return Date & Time</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.inputWithIcon, styles.inputFlex]} onPress={() => openDatePicker('return')}>
                <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
                <Text style={[styles.inputIconText, returnDate ? styles.pickerText : styles.pickerPlaceholder]}>
                  {returnDate ? formatDisplayDate(returnDate) : 'Date'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inputWithIcon, styles.inputFlex]} onPress={() => openTimePicker('return')}>
                <Ionicons name="time-outline" size={17} color={Colors.primary} />
                <Text style={[styles.inputIconText, returnTime ? styles.pickerText : styles.pickerPlaceholder]}>
                  {returnTime || 'Time'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <Text style={styles.fieldLabel}>Passengers</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="people-outline" size={17} color={Colors.primary} />
          <TextInput
            style={styles.inputIconTextField}
            placeholder="1"
            placeholderTextColor={Colors.textMuted}
            value={passengers}
            onChangeText={(value) => setPassengers(digitsOnly(value))}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>

        <TouchableOpacity style={styles.searchButton} onPress={runSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color={Colors.secondary} />
          ) : (
            <Text style={styles.searchButtonText}>Search Cabs</Text>
          )}
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={datePicker.visible}
        title={datePicker.target === 'pickup' ? 'Pickup Date' : 'Return Date'}
        minDate={datePicker.target === 'return' && pickupDate ? new Date(pickupDate) : new Date()}
        onSelect={chooseDate}
        onClose={() => setDatePicker({ visible: false, target: null })}
      />

      <Modal visible={timePicker.visible} transparent animationType="fade" onRequestClose={() => setTimePicker({ visible: false, target: null })}>
        <Pressable style={styles.modalOverlay} onPress={() => setTimePicker({ visible: false, target: null })}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{timePicker.target === 'pickup' ? 'Pickup Time' : 'Return Time'}</Text>
              <TouchableOpacity onPress={() => setTimePicker({ visible: false, target: null })}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={TIME_SLOTS}
              keyExtractor={(item) => item}
              numColumns={4}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.timeSlot} onPress={() => chooseTime(item)}>
                  <Text style={styles.timeSlotText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={locationPicker.visible} transparent animationType="fade" onRequestClose={() => setLocationPicker({ visible: false, target: null, query: '', results: [], loading: false })}>
        <Pressable style={styles.modalOverlay} onPress={() => setLocationPicker({ visible: false, target: null, query: '', results: [], loading: false })}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{locationPicker.target === 'origin' ? 'Pickup Location' : 'Drop-off Location'}</Text>
              <TouchableOpacity onPress={() => setLocationPicker({ visible: false, target: null, query: '', results: [], loading: false })}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search for an area, landmark, or airport..."
              placeholderTextColor={Colors.textMuted}
              value={locationPicker.query}
              onChangeText={searchLocations}
              autoFocus
            />
            {locationPicker.loading ? (
              <ActivityIndicator color={Colors.primary} style={styles.modalLoading} />
            ) : (
              <FlatList
                data={locationPicker.results}
                keyExtractor={(item) => item.id}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalListRow} onPress={() => selectLocation(item)}>
                    <Ionicons name="location-outline" size={16} color={Colors.primary} />
                    <Text style={styles.modalListRowText} numberOfLines={2}>{item.displayLabel}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
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
    backgroundColor: Colors.card,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipHalf: {
    flex: 1,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.secondary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputIconTextField: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  inputIconText: {
    flex: 1,
    fontSize: 14,
  },
  pickerText: {
    color: Colors.text,
  },
  pickerPlaceholder: {
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  inputFlex: {
    flex: 1,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  searchButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 18,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  modalLoading: {
    marginVertical: 30,
  },
  modalList: {
    maxHeight: 380,
  },
  modalListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalListRowText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  timeSlot: {
    flex: 1,
    margin: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
});

export default CabsScreen;
