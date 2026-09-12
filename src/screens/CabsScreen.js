import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  FlatList,
  StatusBar,
  ScrollView,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import useHeroHeader from '../hooks/useHeroHeader';
import WebStickyHeader from '../components/web/WebStickyHeader';
import WebHero from '../components/web/WebHero';
import WebSearchPanel, { WebPanelTabs } from '../components/web/WebSearchPanel';
import WebField from '../components/web/WebField';
import WebValueProps from '../components/web/WebValueProps';
import { appAlert } from '../utils/appAlert';

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

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// The API wants 24h "HH:MM"; the picker works in 12h + AM/PM like TripJack's
// own booking site, so any minute is reachable rather than just :00 and :30.
const to24Hour = (hour12, minute, meridiem) => {
  let hour = Number(hour12) % 12;
  if (meridiem === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
};

const from24Hour = (value) => {
  const [rawHour, rawMinute] = String(value || '').split(':');
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return { hour12: '12', minute: '00', meridiem: 'PM' };
  return {
    hour12: String(hour % 12 === 0 ? 12 : hour % 12),
    minute: String(Number(rawMinute) || 0).padStart(2, '0'),
    meridiem: hour >= 12 ? 'PM' : 'AM',
  };
};

const formatDisplayTime = (value) => {
  if (!value) return '';
  const { hour12, minute, meridiem } = from24Hour(value);
  return `${hour12}:${minute} ${meridiem}`;
};

// Vehicle groups carry their own paxCapacity/luggageCapacity and those are
// accurate. TripJack's quoteFilter is NOT: asking for 4 bags drops both the
// 3-seat and the 10-seat vehicles, asking for 5 returns capacity-4 ones, and
// asking for 10 returns nothing at all even though a capacity-10 vehicle is
// on offer. So the party size is filtered here instead of being sent up.
const fitsParty = (group, passengers, bags) => {
  const seats = Number(group?.paxCapacity) || 0;
  const boot = Number(group?.luggageCapacity) || 0;
  return seats >= passengers && boot >= bags;
};

const CabsScreen = ({ route, navigation }) => {
  const { centeredForm, isDesktop } = useResponsive();
  const { scrolled, scrollProps } = useHeroHeader();
  const { token } = useAuth();
  // Set when arriving from FlightBookingScreen's "Add an Airport Transfer"
  // prompt after a successful flight booking (see cabs-api/cab-api-doc.txt's
  // Embedded API) - carried through to CabResults/CabBooking unchanged, and
  // the pickup date/time default to the flight's own arrival, matching the
  // doc's own Book Scenario ("Start date as same as the Flight arrival
  // date") while staying fully editable like any other search.
  const { sourceBookingId, prefillPickupDate, prefillPickupTime } = route?.params || {};

  const [journeyType, setJourneyType] = useState('airport_transfer');
  const [tripType, setTripType] = useState('oneway');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [pickupDate, setPickupDate] = useState(prefillPickupDate || '');
  const [pickupTime, setPickupTime] = useState(prefillPickupTime || '');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [bags, setBags] = useState('1');
  const [searching, setSearching] = useState(false);
  const [partyPicker, setPartyPicker] = useState(false);

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
      appAlert('Location', error.message || 'Unable to load this location right now.');
    }
  };

  const openDatePicker = (target) => setDatePicker({ visible: true, target });
  const chooseDate = (dateString) => {
    if (datePicker.target === 'pickup') setPickupDate(dateString);
    else setReturnDate(dateString);
    setDatePicker({ visible: false, target: null });
  };

  const openTimePicker = (target) => {
    const current = target === 'pickup' ? pickupTime : returnTime;
    setTimePicker({ visible: true, target, ...from24Hour(current || '12:00') });
  };
  const applyTime = () => {
    const value = to24Hour(timePicker.hour12, timePicker.minute, timePicker.meridiem);
    if (timePicker.target === 'pickup') setPickupTime(value);
    else setReturnTime(value);
    setTimePicker({ visible: false, target: null });
  };

  const swapLocations = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const passengerCountLabel = Math.min(10, Math.max(1, parseInt(passengers, 10) || 1));
  const bagCountLabel = Math.min(20, Math.max(0, parseInt(bags, 10) || 0));
  const partySummary =
    `${passengerCountLabel} Passenger${passengerCountLabel > 1 ? 's' : ''}, ` +
    `${bagCountLabel} Bag${bagCountLabel === 1 ? '' : 's'}`;

  const stepParty = (setter, current, delta, min, max) => {
    const next = Math.min(max, Math.max(min, (parseInt(current, 10) || min) + delta));
    setter(String(next));
  };

  const runSearch = async () => {
    if (!origin || !destination) {
      appAlert('Locations required', 'Choose both a pickup and drop-off location.');
      return;
    }
    if (!pickupDate || !pickupTime) {
      appAlert('Pickup time required', 'Choose your pickup date and time.');
      return;
    }
    const pickupDateTime = new Date(`${pickupDate}T${pickupTime}:00`);
    // Doc: pickupDate "must be >=2 hours in future" - checked client-side too
    // so an obviously-invalid time is caught before hitting the API.
    if (pickupDateTime.getTime() < Date.now() + 2 * 60 * 60 * 1000) {
      appAlert('Pickup too soon', 'Pickup time must be at least 2 hours from now.');
      return;
    }

    let returnDateTimeString;
    if (tripType === 'roundtrip') {
      if (!returnDate || !returnTime) {
        appAlert('Return time required', 'Choose your return date and time.');
        return;
      }
      const returnDateTime = new Date(`${returnDate}T${returnTime}:00`);
      if (returnDateTime.getTime() < pickupDateTime.getTime() + 30 * 60 * 1000) {
        appAlert('Return too soon', 'Return time must be at least 30 minutes after pickup.');
        return;
      }
      returnDateTimeString = `${returnDate} ${returnTime}`;
    }

    const passengersCount = Math.min(10, Math.max(1, parseInt(passengers, 10) || 1));
    const bagsCount = Math.min(20, Math.max(0, parseInt(bags, 10) || 0));

    // quoteFilter is deliberately NOT sent. The doc's sample includes it, but
    // live it filters incorrectly: {paxCount:1, luggageCount:4} drops both the
    // 3-seat and the 10-seat vehicles, luggageCount 5 returns capacity-4 ones,
    // and luggageCount 10 returns zero results while a capacity-10 vehicle is
    // plainly on offer. Sending it would hide cabs that genuinely fit. The
    // per-vehicle paxCapacity/luggageCapacity in the response are correct, so
    // the party filter is applied here instead (see fitsParty).
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
        appAlert('No Cabs Available', 'No cabs were found for this route and time. Try a different time or location.');
        return;
      }
      // Keep only vehicles that actually seat the party and take the bags. If
      // that leaves nothing, fall back to the full list rather than showing an
      // empty screen - better to show a too-small cab clearly labelled than to
      // claim there are none.
      const fitting = quotesInfo.filter((group) => fitsParty(group, passengersCount, bagsCount));
      if (fitting.length === 0) {
        appAlert(
          'No exact match',
          `No cab fits ${passengersCount} passenger${passengersCount > 1 ? 's' : ''} and ${bagsCount} bag${bagsCount === 1 ? '' : 's'}. Showing everything available for this route instead.`
        );
      }
      navigation.navigate('CabResults', {
        quotesInfo: fitting.length > 0 ? fitting : quotesInfo,
        journeyInfo: data?.data?.journeyInfo,
        routeDetails: data?.data?.routeDetails,
        journeyType,
        tripType,
        passengers: passengersCount,
        bags: bagsCount,
        sourceBookingId,
      });
    } catch (error) {
      appAlert('Cab Search', error.message || 'Unable to fetch cab quotes right now.');
    } finally {
      setSearching(false);
    }
  };


  // Desktop one-row search panel. Presentation only - every handler here is the
  // one the phone form already calls.
  const renderWebSearchPanel = () => (
    <WebSearchPanel
      onSearch={runSearch}
      searching={searching}
      tabs={
        <WebPanelTabs
          options={JOURNEY_TYPES}
          value={journeyType}
          onChange={setJourneyType}
        />
      }
      chips={
        <View style={styles.webTripRow}>
          {[
            { label: 'One Way', value: 'oneway' },
            { label: 'Round Trip', value: 'roundtrip' },
          ].map((option) => {
            const active = tripType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.webTripChip, active && styles.webTripChipActive]}
                onPress={() => setTripType(option.value)}
              >
                <Text style={[styles.webTripChipText, active && styles.webTripChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      }
    >
      <WebField
        label="Pickup Location"
        icon="radio-button-on-outline"
        flex={1.8}
        minWidth={220}
        value={origin?.displayAddress}
        placeholder="Where should we pick you up?"
        onPress={() => openLocationPicker('origin')}
      />

      <TouchableOpacity
        style={styles.webSwapButton}
        onPress={swapLocations}
        disabled={!origin && !destination}
        accessibilityLabel="Swap pickup and drop-off"
      >
        <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
      </TouchableOpacity>

      <WebField
        label="Drop-off Location"
        icon="location-outline"
        flex={1.8}
        minWidth={220}
        value={destination?.displayAddress}
        placeholder="Where are you going?"
        onPress={() => openLocationPicker('destination')}
      />

      <WebField
        label="Pickup Date"
        icon="calendar-outline"
        value={pickupDate ? formatDisplayDate(pickupDate) : ''}
        placeholder="Date"
        onPress={() => openDatePicker('pickup')}
      />

      <WebField
        label="Pickup Time"
        icon="time-outline"
        minWidth={120}
        flex={0.8}
        value={pickupTime ? formatDisplayTime(pickupTime) : ''}
        placeholder="Time"
        onPress={() => openTimePicker('pickup')}
      />

      {tripType === 'roundtrip' ? (
        <>
          <WebField
            label="Return Date"
            icon="calendar-outline"
            value={returnDate ? formatDisplayDate(returnDate) : ''}
            placeholder="Date"
            onPress={() => openDatePicker('return')}
          />
          <WebField
            label="Return Time"
            icon="time-outline"
            minWidth={120}
            flex={0.8}
            value={returnTime ? formatDisplayTime(returnTime) : ''}
            placeholder="Time"
            onPress={() => openTimePicker('return')}
          />
        </>
      ) : null}

      <WebField
        label="Passengers & Bags"
        icon="person-outline"
        minWidth={180}
        value={partySummary}
        onPress={() => setPartyPicker(true)}
      />
    </WebSearchPanel>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.bodyScroll}
        {...scrollProps}
      >
      {isDesktop ? (
        <WebHero
          image={require('../../assets/cabs/hero-sunset.jpg')}
          title="Cab Booking"
          subtitle="Airport transfers and outstation trips, booked in a couple of taps."
          activeProduct="cabs"
        >
          {renderWebSearchPanel()}
        </WebHero>
      ) : (
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{sourceBookingId ? 'Add Airport Transfer' : 'Cabs'}</Text>
        <View style={{ width: 30 }} />
      </View>
      )}

      {!isDesktop && <View style={[styles.formCard, centeredForm]}>
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

        <View style={styles.swapRow}>
          <View style={styles.swapLine} />
          <TouchableOpacity
            style={styles.swapButton}
            onPress={swapLocations}
            disabled={!origin && !destination}
            accessibilityLabel="Swap pickup and drop-off"
          >
            <Ionicons name="swap-vertical" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

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
              {pickupTime ? formatDisplayTime(pickupTime) : 'Time'}
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
                  {returnTime ? formatDisplayTime(returnTime) : 'Time'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <Text style={styles.fieldLabel}>Passengers & Bags</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={() => setPartyPicker(true)}>
          <Ionicons name="person-outline" size={17} color={Colors.primary} />
          <Text style={[styles.inputIconText, styles.pickerText]}>
            {partySummary}
          </Text>
          <Ionicons name="chevron-down" size={15} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.searchButton} onPress={runSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color={Colors.secondary} />
          ) : (
            <Text style={styles.searchButtonText}>Search Cabs</Text>
          )}
        </TouchableOpacity>
      </View>}

      {isDesktop && (
        <WebValueProps
          items={[
            { icon: 'time-outline', title: 'On-time Pickups', body: 'Drivers tracked from the moment you book.', tint: Colors.accentBlueSoft },
            { icon: 'pricetag-outline', title: 'Upfront Pricing', body: 'The fare you see is the fare you pay.', tint: Colors.primarySoft },
            { icon: 'headset-outline', title: '24/7 Support', body: "We're here whenever you need us.", tint: Colors.accentBlueSoft },
            { icon: 'car-outline', title: 'Airport & Outstation', body: 'Transfers, day trips and local rides.', tint: Colors.primarySoft },
          ]}
          heading="Why ride with MyItineri?"
        />
      )}
      </ScrollView>

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
            <Text style={styles.modalTitle}>Select Time</Text>
            <Text style={styles.modalSubtitle}>
              {timePicker.target === 'pickup' ? 'Pickup' : 'Return'}
              {(timePicker.target === 'pickup' ? pickupDate : returnDate)
                ? ` · ${formatDisplayDate(timePicker.target === 'pickup' ? pickupDate : returnDate)}`
                : ''}
            </Text>

            <View style={styles.timeEntryRow}>
              <TextInput
                style={styles.timeBox}
                value={timePicker.hour12}
                onChangeText={(value) => setTimePicker((prev) => ({ ...prev, hour12: digitsOnly(value).slice(0, 2) }))}
                onEndEditing={() => setTimePicker((prev) => {
                  const hour = Math.min(12, Math.max(1, parseInt(prev.hour12, 10) || 12));
                  return { ...prev, hour12: String(hour) };
                })}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Text style={styles.timeColon}>:</Text>
              <TextInput
                style={styles.timeBox}
                value={timePicker.minute}
                onChangeText={(value) => setTimePicker((prev) => ({ ...prev, minute: digitsOnly(value).slice(0, 2) }))}
                onEndEditing={() => setTimePicker((prev) => {
                  const minute = Math.min(59, Math.max(0, parseInt(prev.minute, 10) || 0));
                  return { ...prev, minute: String(minute).padStart(2, '0') };
                })}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <View style={styles.meridiemGroup}>
                {['AM', 'PM'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.meridiemBox, timePicker.meridiem === m && styles.meridiemBoxActive]}
                    onPress={() => setTimePicker((prev) => ({ ...prev, meridiem: m }))}
                  >
                    <Text style={[styles.meridiemText, timePicker.meridiem === m && styles.meridiemTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setTimePicker({ visible: false, target: null })}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApply} onPress={applyTime}>
                <Text style={styles.modalApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={partyPicker} transparent animationType="fade" onRequestClose={() => setPartyPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPartyPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Passengers & Bags</Text>

            {[
              { label: 'Passengers', hint: 'Travelling in the cab', value: passengers, setter: setPassengers, min: 1, max: 10 },
              { label: 'Bags', hint: 'Checked-in size luggage', value: bags, setter: setBags, min: 0, max: 20 },
            ].map((row) => (
              <View key={row.label} style={styles.stepperRow}>
                <View style={styles.stepperLabels}>
                  <Text style={styles.stepperLabel}>{row.label}</Text>
                  <Text style={styles.stepperHint}>{row.hint}</Text>
                </View>
                <View style={styles.stepperControls}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => stepParty(row.setter, row.value, -1, row.min, row.max)}
                  >
                    <Ionicons name="remove" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>
                    {Math.min(row.max, Math.max(row.min, parseInt(row.value, 10) || row.min))}
                  </Text>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => stepParty(row.setter, row.value, 1, row.min, row.max)}
                  >
                    <Ionicons name="add" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalApplyFull} onPress={() => setPartyPicker(false)}>
                <Text style={styles.modalApplyText}>Done</Text>
              </TouchableOpacity>
            </View>
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
      {isDesktop && <WebStickyHeader visible={scrolled} />}
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
  bodyScroll: {
    paddingBottom: 32,
  },

  // --- Desktop hero panel ---------------------------------------------------
  webSwapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  webTripRow: {
    flexDirection: 'row',
    gap: 10,
  },
  webTripChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  webTripChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(246, 106, 42, 0.14)',
  },
  webTripChipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  webTripChipTextActive: {
    color: Colors.primary,
    fontWeight: '700',
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
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: -4,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  swapButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 18,
  },
  timeEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  timeBox: {
    width: 64,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
  },
  timeColon: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginHorizontal: 8,
  },
  meridiemGroup: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  meridiemBox: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  meridiemBoxActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  meridiemText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  meridiemTextActive: {
    color: Colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  modalApply: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalApplyFull: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.secondary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stepperLabels: {
    flex: 1,
  },
  stepperLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  stepperHint: {
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
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
});

export default CabsScreen;
