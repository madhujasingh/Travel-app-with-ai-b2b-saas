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

// Embedded (flight-linked) journey type is NOT built here yet - it ties
// into the live Flights booking flow (see tripsafe-api/07-embedded-api-
// integration.txt) and is deliberately being held back until TripSafe is
// certified on the production key. Standalone/Student/AMT all share the
// same 6 backend endpoints - only the request fields differ per type.
const JOURNEY_TYPES = [
  { value: 'STANDALONE', label: 'Standalone' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'AMT', label: 'Annual Multi-Trip' },
];

// Region list per tripsafe-api/11-uat-certification.txt's "Popular Region
// Mapping" table - the only 5 rkey codes the doc actually confirms for
// rt: POPULARREGION.
const POPULAR_REGIONS = [
  { rkey: 'MDE', label: 'Middle East' },
  { rkey: 'EUR', label: 'Europe' },
  { rkey: 'SCH', label: 'Schengen' },
  { rkey: 'USC', label: 'USA/Canada' },
  { rkey: 'ASI', label: 'Asia' },
];

// tripsafe-api/08-student-api-integration.txt "Important Note" - the 4
// coverage durations documented specifically for ict: STUDENT (the doc's
// own sample comment lists 3 more values - 30/60/90/360 - but flags those
// as possibly belonging to a different channel type reusing the same "cd"
// field; only these 4 are confirmed for Student).
const STUDENT_DURATIONS = [
  { cd: '180', label: '6 Months' },
  { cd: '365', label: '1 Year' },
  { cd: '730', label: '2 Years' },
  { cd: '1095', label: '3 Years' },
];

// tripsafe-api/09-amt-api-integration.txt - AMT's region choice is
// restricted to exactly these 2 named presets (not a free multi-select
// like Standalone), each expanding to a fixed set of Popular Region codes.
const AMT_REGION_CHOICES = [
  { value: 'WW', label: 'Worldwide', rkeys: ['MDE', 'EUR', 'SCH', 'USC', 'ASI'] },
  { value: 'XUSC', label: 'Worldwide excl. US & Canada', rkeys: ['MDE', 'EUR', 'SCH', 'ASI'] },
];

// Confirmed live (2026-09-05) via TripJack's own validation error, which
// resolves open question #12: "ed" and "sd" must differ by EXACTLY 365
// days (the annual policy window) always, and separately, "coverage"
// (a "cd" field, same idea as Student's coverage-duration field) must be
// 30/45/60/90 - two independent things, not one. 90 IS valid after all -
// this list previously excluded it based on other doc pages that turned
// out to be incomplete.
const AMT_DURATIONS = [30, 45, 60, 90];

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Builds the result from local date components (year/month/day), same as
// DatePickerModal's own toDateString - NOT via toISOString(), which
// converts to UTC and silently shifts the date back a day in any positive
// UTC-offset timezone (e.g. IST), producing "sd + 364 days" instead of
// "+365" and tripping TripJack's exact-365-day AMT validation.
const addDays = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TripSafeScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [journeyType, setJourneyType] = useState('STANDALONE');

  const [selectedRegions, setSelectedRegions] = useState(['ASI']);
  const [countryCode, setCountryCode] = useState('');
  const [studentDuration, setStudentDuration] = useState('180');
  const [amtRegionChoice, setAmtRegionChoice] = useState('WW');
  const [amtDuration, setAmtDuration] = useState(30);

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
    if (journeyType === 'STANDALONE') {
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
    } else if (journeyType === 'STUDENT') {
      if (!countryCode.trim()) {
        Alert.alert('Country required', 'Enter the country code you\'re studying in (e.g. US, FR, DE).');
        return;
      }
      if (!startDate) {
        Alert.alert('Start date required', 'Choose your coverage start date.');
        return;
      }
    } else if (journeyType === 'AMT') {
      if (!startDate) {
        Alert.alert('Start date required', 'Choose your coverage start date.');
        return;
      }
    }

    const parsedAges = ages.map((age) => parseInt(age, 10)).filter((age) => Number.isFinite(age));
    if (parsedAges.length !== ages.length) {
      Alert.alert('Traveller ages required', 'Enter an age for every traveller.');
      return;
    }
    if (journeyType === 'STUDENT') {
      // Doc "Important Note" (tripsafe-api/08-student-api-integration.txt):
      // eligible age group is 18-45 ONLY for the Student channel.
      if (parsedAges.some((age) => age < 18 || age > 45)) {
        Alert.alert('Invalid age', 'Student plan travellers must be aged 18-45.');
        return;
      }
    } else if (parsedAges.some((age) => age < 0 || age > 75)) {
      // Doc FAQ (tripsafe-api/01-search-api.txt): valid age range 0-75.
      Alert.alert('Invalid age', 'Traveller ages must be between 0 and 75.');
      return;
    }

    let isq;
    let regionLabel;
    if (journeyType === 'STANDALONE') {
      isq = {
        sd: startDate,
        ed: endDate,
        isc: { iri: selectedRegions.map((rkey) => ({ rkey, rt: 'POPULARREGION' })) },
        iti: parsedAges.map((age) => ({ age })),
      };
      regionLabel = POPULAR_REGIONS.filter((r) => selectedRegions.includes(r.rkey)).map((r) => r.label).join(', ');
    } else if (journeyType === 'STUDENT') {
      isq = {
        sd: startDate,
        // Doc: "No ed in the request - TripSafe computes the end date from
        // sd+cd server-side" - confirmed by the doc's own sample response,
        // which echoes back a computed "ed" the request never supplied.
        cd: studentDuration,
        isc: { iri: [{ rkey: countryCode.trim().toUpperCase(), rt: 'COUNTRY' }] },
        iti: parsedAges.map((age) => ({ age })),
        ict: 'STUDENT',
      };
      regionLabel = `Studying in ${countryCode.trim().toUpperCase()}`;
    } else {
      const choice = AMT_REGION_CHOICES.find((c) => c.value === amtRegionChoice);
      isq = {
        sd: startDate,
        // Confirmed live (2026-09-05): despite TripJack's own error text
        // literally saying "must be equal to 365 days", the real
        // requirement is 364 - verified by direct API testing (365 always
        // fails, 364 always succeeds, isolated from every other field).
        // This matches the doc's own real sample payload's actual span
        // (2025-12-20 to 2026-12-19 = 364 days by calendar arithmetic,
        // despite the doc's surrounding prose calling it "12 months") -
        // an earlier pass here wrongly "corrected" this to 365 assuming
        // the doc's dates were a typo; they weren't.
        ed: addDays(startDate, 364),
        // "adr" (undocumented anywhere in the doc's verbose tables, only
        // ever appears in sample payloads) confirmed live as the real
        // coverage-duration field for AMT - "cd" (Student's field name)
        // does NOT work for AMT.
        adr: String(amtDuration),
        isc: { iri: choice.rkeys.map((rkey) => ({ rkey, rt: 'POPULARREGION' })) },
        iti: parsedAges.map((age) => ({ age })),
        ict: 'AMT',
      };
      regionLabel = `${choice.label} · ${amtDuration} days`;
    }

    try {
      setSearching(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/tripsafe/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isq }),
      });
      const data = await response.json();
      if (!response.ok || data?.errors) {
        throw new Error(data?.errors?.[0]?.message || data?.message || 'Unable to fetch insurance plans right now.');
      }
      // Search really does nest under "isr" live (confirmed 2026-09-05) -
      // unlike Review, which doesn't (see TripSafeResultsScreen) - but
      // falling back to the un-wrapped shape too costs nothing if that
      // ever turns out inconsistent across accounts/plans.
      const plans = data?.isr?.iinfo?.pli ?? data?.iinfo?.pli ?? [];
      if (plans.length === 0) {
        Alert.alert('No Plans Found', 'No insurance plans were found for this search. Try different dates or destinations.');
        return;
      }
      navigation.navigate('TripSafeResults', {
        plans,
        journeyType,
        startDate,
        endDate: data?.isq?.ed || endDate,
        travellerAges: parsedAges,
        regionLabel,
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

        {journeyType === 'STANDALONE' ? (
          <>
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
          </>
        ) : null}

        {journeyType === 'STUDENT' ? (
          <>
            <Text style={styles.fieldLabel}>Country you're studying in</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="school-outline" size={17} color={Colors.primary} />
              <TextInput
                style={styles.inputIconTextField}
                placeholder="Country code, e.g. US, FR, DE"
                placeholderTextColor={Colors.textMuted}
                value={countryCode}
                onChangeText={(v) => setCountryCode(v.toUpperCase().slice(0, 2))}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>

            <Text style={styles.fieldLabel}>Coverage Start Date</Text>
            <TouchableOpacity style={styles.inputWithIcon} onPress={() => openDatePicker('start')}>
              <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
              <Text style={[styles.inputIconText, startDate ? styles.pickerText : styles.pickerPlaceholder]}>
                {startDate ? formatDisplayDate(startDate) : 'Start date'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Coverage Duration</Text>
            <View style={styles.chipRow}>
              {STUDENT_DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d.cd}
                  style={[styles.chip, studentDuration === d.cd && styles.chipActive]}
                  onPress={() => setStudentDuration(d.cd)}
                >
                  <Text style={[styles.chipText, studentDuration === d.cd && styles.chipTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {journeyType === 'AMT' ? (
          <>
            <Text style={styles.fieldLabel}>Coverage Region</Text>
            <View style={styles.chipRow}>
              {AMT_REGION_CHOICES.map((choice) => (
                <TouchableOpacity
                  key={choice.value}
                  style={[styles.chip, amtRegionChoice === choice.value && styles.chipActive]}
                  onPress={() => setAmtRegionChoice(choice.value)}
                >
                  <Text style={[styles.chipText, amtRegionChoice === choice.value && styles.chipTextActive]}>
                    {choice.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Coverage Start Date</Text>
            <TouchableOpacity style={styles.inputWithIcon} onPress={() => openDatePicker('start')}>
              <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
              <Text style={[styles.inputIconText, startDate ? styles.pickerText : styles.pickerPlaceholder]}>
                {startDate ? formatDisplayDate(startDate) : 'Start date'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Trip Duration</Text>
            <View style={styles.chipRow}>
              {AMT_DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, amtDuration === d && styles.chipActive]}
                  onPress={() => setAmtDuration(d)}
                >
                  <Text style={[styles.chipText, amtDuration === d && styles.chipTextActive]}>{d} days</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

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
