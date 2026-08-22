import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import DatePickerModal from '../components/DatePickerModal';

const formatDisplayDate = (isoDate) => {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Best-effort extraction - the exact response envelope hasn't been verified
// live yet (no secret configured), so this defensively checks a couple of
// likely shapes/field names rather than assuming one exact structure.
const getActivityImage = (activity) => {
  const images = activity?.content?.media?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const urls = images[0]?.urls;
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const medium = urls.find((u) => u.sizeType === 'MEDIUM') || urls[0];
  return medium?.resource || null;
};

const getActivityPrice = (activity) => {
  const amounts = activity?.amountsFrom;
  if (!Array.isArray(amounts) || amounts.length === 0) return null;
  const cheapest = amounts.reduce((min, a) => (a.amount < min.amount ? a : min), amounts[0]);
  return { amount: cheapest.amount, currency: activity?.currencyName || activity?.content?.currency };
};

const ActivitiesScreen = ({ navigation }) => {
  const [destination, setDestination] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [adults, setAdults] = useState('1');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleDateRangeSelected = (start, end) => {
    setFromDate(start);
    setToDate(end);
    setDatePickerVisible(false);
  };

  const runSearch = async () => {
    const destinationCode = destination.trim().toUpperCase();
    if (!destinationCode) {
      Alert.alert('Destination required', 'Enter a destination code (e.g. BCN).');
      return;
    }
    if (!fromDate || !toDate) {
      Alert.alert('Dates required', 'Choose your travel dates.');
      return;
    }
    const adultsCount = Math.max(1, parseInt(adults, 10) || 1);

    const payload = {
      filters: [{ searchFilterItems: [{ type: 'destination', value: destinationCode }] }],
      from: fromDate,
      to: toDate,
      paxes: Array.from({ length: adultsCount }, () => ({ age: 30 })),
      language: 'en',
      pagination: { itemsPerPage: 20, page: 1 },
      order: 'DEFAULT',
    };

    try {
      setSearching(true);
      setSearched(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/activities/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to search activities right now.');
      }
      setResults(Array.isArray(data?.activities) ? data.activities : []);
    } catch (error) {
      setResults([]);
      Alert.alert('Activities Search', error.message || 'Unable to search activities right now.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activities</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Destination code</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="location-outline" size={17} color={Colors.primary} />
          <TextInput
            style={styles.inputIconTextField}
            placeholder="e.g. BCN, MCO"
            placeholderTextColor={Colors.textMuted}
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="characters"
          />
        </View>

        <Text style={styles.fieldLabel}>Dates</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={() => setDatePickerVisible(true)}>
          <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
          <Text style={[styles.inputIconText, fromDate ? styles.pickerText : styles.pickerPlaceholder]}>
            {fromDate && toDate ? `${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}` : 'Select dates'}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Adults</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="people-outline" size={17} color={Colors.primary} />
          <TextInput
            style={styles.inputIconTextField}
            placeholder="1"
            placeholderTextColor={Colors.textMuted}
            value={adults}
            onChangeText={setAdults}
            keyboardType="number-pad"
          />
        </View>

        <TouchableOpacity style={styles.searchButton} onPress={runSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color={Colors.secondary} />
          ) : (
            <Text style={styles.searchButtonText}>Search Activities</Text>
          )}
        </TouchableOpacity>
      </View>

      {searching && (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      )}

      {!searching && searched && (results || []).length === 0 && (
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>No activities found for this search.</Text>
        </View>
      )}

      {!searching && (results || []).length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item, index) => item?.activityCode || item?.content?.activityCode || String(index)}
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => {
            const imageUrl = getActivityImage(item);
            const price = getActivityPrice(item);
            const name = item?.content?.name || 'Activity';
            const destinationName = item?.country?.destinations?.[0]?.name || '';
            return (
              <TouchableOpacity style={styles.resultCard}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.resultImage} />
                ) : (
                  <View style={[styles.resultImage, styles.resultImagePlaceholder]}>
                    <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={2}>{name}</Text>
                  {!!destinationName && <Text style={styles.resultDestination}>{destinationName}</Text>}
                  {price && (
                    <Text style={styles.resultPrice}>
                      From {price.currency || ''} {Number(price.amount).toLocaleString()}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <DatePickerModal
        visible={datePickerVisible}
        rangeMode
        minDate={new Date()}
        onSelectRange={handleDateRangeSelected}
        onClose={() => setDatePickerVisible(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  formCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
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
  centerState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  resultsList: {
    padding: 16,
    gap: 12,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultImage: {
    width: 96,
    height: 96,
  },
  resultImagePlaceholder: {
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  resultDestination: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  resultPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 6,
  },
});

export default ActivitiesScreen;
