import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import DatePickerModal from '../components/DatePickerModal';
import { digitsOnly } from '../utils/inputSanitizers';

// Standalone journey type only (see tripsafe-api/09-amt-api-integration.txt
// and 08-student-api-integration.txt for the AMT/Student variants - not
// built here yet). Region list per tripsafe-api/11-uat-certification.txt's
// "Popular Region Mapping" table - the only 5 rkey codes the doc actually
// confirms for rt: POPULARREGION.
const POPULAR_REGIONS = [
  { rkey: 'MDE', label: 'Middle East' },
  { rkey: 'EUR', label: 'Europe' },
  { rkey: 'SCH', label: 'Schengen' },
  { rkey: 'USC', label: 'USA/Canada' },
  { rkey: 'ASI', label: 'Asia' },
];

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TripSafeScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [selectedRegions, setSelectedRegions] = useState(['ASI']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ages, setAges] = useState(['30']);
  const [searching, setSearching] = useState(false);
  const [datePicker, setDatePicker] = useState({ visible: false, target: null });

  const toggleRegion = (rkey) => {
    setSelectedRegions((prev) =>
      prev.includes(rkey) ? prev.filter((value) => value !== rkey) : [...prev, rkey]
    );
  };

  const openDatePicker = (target) => setDatePicker({ visible: true, target });
  const chooseDate = (dateString) => {
    if (datePicker.target === 'start') setStartDate(dateString);
    else setEndDate(dateString);
    setDatePicker({ visible: false, target: null });
  };

  const updateAge = (index, value) => {
    setAges((prev) => prev.map((age, i) => (i === index ? digitsOnly(value) : age)));
  };

  const addTraveller = () => {
    if (ages.length >= 10) {
      Alert.alert('Traveller limit', 'A maximum of 10 travellers is allowed per search.');
      return;
    }
    setAges((prev) => [...prev, '']);
  };

  const removeTraveller = (index) => {
    if (ages.length <= 1) return;
    setAges((prev) => prev.filter((_, i) => i !== index));
  };

  const runSearch = async () => {
    if (selectedRegions.length === 0) {
      Alert.alert('Destination required', 'Choose at least one region you\'re travelling to.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Dates required', 'Choose your coverage start and end date.');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      Alert.alert('Invalid dates', 'End date must be after the start date.');
      return;
    }
    const parsedAges = ages.map((age) => parseInt(age, 10)).filter((age) => Number.isFinite(age));
    if (parsedAges.length !== ages.length) {
      Alert.alert('Traveller ages required', 'Enter an age for every traveller.');
      return;
    }
    // Doc FAQ (tripsafe-api/01-search-api.txt): valid age range 0-75.
    if (parsedAges.some((age) => age < 0 || age > 75)) {
      Alert.alert('Invalid age', 'Traveller ages must be between 0 and 75.');
      return;
    }

    const payload = {
      isq: {
        sd: startDate,
        ed: endDate,
        isc: { iri: selectedRegions.map((rkey) => ({ rkey, rt: 'POPULARREGION' })) },
        iti: parsedAges.map((age) => ({ age })),
      },
    };

    try {
      setSearching(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/tripsafe/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data?.errors) {
        throw new Error(data?.errors?.[0]?.message || data?.message || 'Unable to fetch insurance plans right now.');
      }
      const plans = data?.isr?.iinfo?.pli || [];
      if (plans.length === 0) {
        Alert.alert('No Plans Found', 'No insurance plans were found for this search. Try different dates or destinations.');
        return;
      }
      navigation.navigate('TripSafeResults', {
        plans,
        startDate,
        endDate,
        travellerAges: parsedAges,
        regionLabel: POPULAR_REGIONS.filter((r) => selectedRegions.includes(r.rkey)).map((r) => r.label).join(', '),
      });
    } catch (error) {
      Alert.alert('Travel Insurance Search', error.message || 'Unable to fetch insurance plans right now.');
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
        <Text style={styles.headerTitle}>Travel Insurance</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Where are you travelling to?</Text>
        <View style={styles.chipRow}>
          {POPULAR_REGIONS.map((region) => (
            <TouchableOpacity
              key={region.rkey}
              style={[styles.chip, selectedRegions.includes(region.rkey) && styles.chipActive]}
              onPress={() => toggleRegion(region.rkey)}
            >
              <Text style={[styles.chipText, selectedRegions.includes(region.rkey) && styles.chipTextActive]}>
                {region.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Coverage Dates</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.inputWithIcon, styles.inputFlex]} onPress={() => openDatePicker('start')}>
            <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
            <Text style={[styles.inputIconText, startDate ? styles.pickerText : styles.pickerPlaceholder]}>
              {startDate ? formatDisplayDate(startDate) : 'Start date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.inputWithIcon, styles.inputFlex]} onPress={() => openDatePicker('end')}>
            <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
            <Text style={[styles.inputIconText, endDate ? styles.pickerText : styles.pickerPlaceholder]}>
              {endDate ? formatDisplayDate(endDate) : 'End date'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.travellerHeaderRow}>
          <Text style={styles.fieldLabel}>Traveller Ages</Text>
          <TouchableOpacity onPress={addTraveller}>
            <Text style={styles.addTravellerText}>+ Add Traveller</Text>
          </TouchableOpacity>
        </View>
        {ages.map((age, index) => (
          <View key={index} style={styles.travellerRow}>
            <View style={[styles.inputWithIcon, styles.inputFlex]}>
              <Ionicons name="person-outline" size={17} color={Colors.primary} />
              <TextInput
                style={styles.inputIconTextField}
                placeholder={`Traveller ${index + 1} age`}
                placeholderTextColor={Colors.textMuted}
                value={age}
                onChangeText={(value) => updateAge(index, value)}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            {ages.length > 1 ? (
              <TouchableOpacity style={styles.removeTravellerButton} onPress={() => removeTraveller(index)}>
                <Ionicons name="close-circle" size={22} color={Colors.error} />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <TouchableOpacity style={styles.searchButton} onPress={runSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color={Colors.secondary} />
          ) : (
            <Text style={styles.searchButtonText}>Search Plans</Text>
          )}
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={datePicker.visible}
        title={datePicker.target === 'start' ? 'Coverage Start Date' : 'Coverage End Date'}
        minDate={datePicker.target === 'end' && startDate ? new Date(startDate) : new Date()}
        onSelect={chooseDate}
        onClose={() => setDatePicker({ visible: false, target: null })}
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
  travellerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addTravellerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 10,
  },
  travellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  removeTravellerButton: {
    padding: 4,
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
});

export default TripSafeScreen;
