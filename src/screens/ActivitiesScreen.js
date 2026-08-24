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
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import DatePickerModal from '../components/DatePickerModal';
import { parseActivitiesError } from '../utils/activitiesApiErrors';
import { formatInrEquivalent } from '../utils/currencyConversion';

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
  // amountsFrom includes an entry per paxType regardless of what was actually
  // searched for - an untouched paxType (e.g. CHILD, when the search only
  // sent adult paxes) can carry a placeholder amount of 0, which would look
  // like "the cheapest price" but isn't a real price. Prefer the ADULT entry
  // (every search here always includes at least one adult pax) over blindly
  // taking the numeric minimum across all paxTypes.
  const adult = amounts.find((a) => a.paxType === 'ADULT' && a.amount > 0);
  const cheapest = adult || amounts.filter((a) => a.amount > 0).reduce((min, a) => (a.amount < min.amount ? a : min), amounts[0]);
  return { amount: cheapest.amount, currency: activity?.currencyName || activity?.content?.currency };
};

const ActivitiesScreen = ({ navigation }) => {
  const [destinationCode, setDestinationCode] = useState('');
  const [destinationLabel, setDestinationLabel] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [adults, setAdults] = useState('1');
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);

  const [countries, setCountries] = useState(null);
  const [countryModal, setCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [loadingCountries, setLoadingCountries] = useState(false);

  const [destinations, setDestinations] = useState(null);
  const [destinationModal, setDestinationModal] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [activeCountry, setActiveCountry] = useState(null);

  // Flattened from segmentationGroups[].segments[] - {code, name, groupName}.
  // Only one segment can be applied per search (per the Availability docs),
  // and it must be combined with destination/hotel/GPS, never used alone.
  const [segments, setSegments] = useState(null);
  const [segmentModal, setSegmentModal] = useState(false);
  const [segmentSearch, setSegmentSearch] = useState('');
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);

  const handleDateRangeSelected = (start, end) => {
    setFromDate(start);
    setToDate(end);
    setDatePickerVisible(false);
  };

  const openCountryPicker = async () => {
    setCountryModal(true);
    if (countries) return;
    try {
      setLoadingCountries(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/activities/countries/en`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(parseActivitiesError(data, 'Unable to load countries right now.'));
      }
      setCountries(data?.countries || []);
    } catch (error) {
      Alert.alert('Countries', error.message || 'Unable to load countries right now.');
    } finally {
      setLoadingCountries(false);
    }
  };

  const selectCountry = async (country) => {
    setActiveCountry(country);
    // Two RN Modals visible at once silently fails to open the second one -
    // close this one before opening the destination picker.
    setCountryModal(false);
    setCountrySearch('');
    setDestinationModal(true);
    setDestinations(null);
    try {
      setLoadingDestinations(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/activities/destinations/en/${country.code}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(parseActivitiesError(data, 'Unable to load destinations right now.'));
      }
      setDestinations(data?.country?.destinations || []);
    } catch (error) {
      Alert.alert('Destinations', error.message || 'Unable to load destinations right now.');
    } finally {
      setLoadingDestinations(false);
    }
  };

  const selectDestination = (dest) => {
    setDestinationCode(dest.code);
    setDestinationLabel(`${dest.name}, ${activeCountry?.name || ''}`);
    setDestinationModal(false);
    setDestinationSearch('');
  };

  const openSegmentPicker = async () => {
    setSegmentModal(true);
    if (segments) return;
    try {
      setLoadingSegments(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/activities/segments/en`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(parseActivitiesError(data, 'Unable to load categories right now.'));
      }
      const flattened = (data?.segmentationGroups || []).flatMap((group) =>
        (group.segments || []).map((segment) => ({ ...segment, groupName: group.name }))
      );
      setSegments(flattened);
    } catch (error) {
      Alert.alert('Categories', error.message || 'Unable to load categories right now.');
    } finally {
      setLoadingSegments(false);
    }
  };

  const selectSegment = (segment) => {
    setSelectedSegment(segment);
    setSegmentModal(false);
    setSegmentSearch('');
  };

  const filteredCountries = (countries || []).filter((c) =>
    c.name.toLowerCase().includes(countrySearch.trim().toLowerCase())
  );
  const filteredDestinations = (destinations || []).filter((d) =>
    d.name.toLowerCase().includes(destinationSearch.trim().toLowerCase())
  );
  const filteredSegments = (segments || []).filter((s) =>
    s.name.toLowerCase().includes(segmentSearch.trim().toLowerCase())
  );

  const runSearch = async () => {
    if (!destinationCode) {
      Alert.alert('Destination required', 'Choose a destination to search.');
      return;
    }
    if (!fromDate || !toDate) {
      Alert.alert('Dates required', 'Choose your travel dates.');
      return;
    }
    const adultsCount = Math.max(1, parseInt(adults, 10) || 1);

    // Segment can't be used alone - always paired with destination in the
    // same searchFilterItems array, per the Availability docs.
    const searchFilterItems = [{ type: 'destination', value: destinationCode }];
    if (selectedSegment) {
      searchFilterItems.push({ type: 'segment', value: String(selectedSegment.code) });
    }

    const payload = {
      filters: [{ searchFilterItems }],
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
        throw new Error(parseActivitiesError(data, 'Unable to search activities right now.'));
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
        <Text style={styles.fieldLabel}>Destination</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={openCountryPicker}>
          <Ionicons name="location-outline" size={17} color={Colors.primary} />
          <Text style={[styles.inputIconText, destinationLabel ? styles.pickerText : styles.pickerPlaceholder]}>
            {destinationLabel || 'Where do you want to go?'}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
        </TouchableOpacity>

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

        <Text style={styles.fieldLabel}>Category (optional)</Text>
        <TouchableOpacity style={styles.inputWithIcon} onPress={openSegmentPicker}>
          <Ionicons name="pricetags-outline" size={17} color={Colors.primary} />
          <Text style={[styles.inputIconText, selectedSegment ? styles.pickerText : styles.pickerPlaceholder]}>
            {selectedSegment ? selectedSegment.name : 'Any category'}
          </Text>
          {selectedSegment ? (
            <TouchableOpacity onPress={() => setSelectedSegment(null)}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
          )}
        </TouchableOpacity>

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
              <TouchableOpacity
                style={styles.resultCard}
                onPress={() =>
                  navigation.navigate('ActivityDetail', {
                    activityCode: item?.content?.activityCode,
                    name,
                    from: fromDate,
                    to: toDate,
                    adults: Math.max(1, parseInt(adults, 10) || 1),
                  })
                }
              >
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
                    <>
                      <Text style={styles.resultPrice}>
                        From {price.currency || ''} {Number(price.amount).toLocaleString()}
                      </Text>
                      {!!formatInrEquivalent(price.amount, price.currency) && (
                        <Text style={styles.resultPriceInr}>{formatInrEquivalent(price.amount, price.currency)}</Text>
                      )}
                    </>
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

      <Modal visible={countryModal} transparent animationType="fade" onRequestClose={() => setCountryModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCountryModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a country</Text>
              <TouchableOpacity onPress={() => setCountryModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
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
                keyExtractor={(item) => item.code}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalListRow} onPress={() => selectCountry(item)}>
                    <Text style={styles.modalListRowText}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={destinationModal} transparent animationType="fade" onRequestClose={() => setDestinationModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDestinationModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a destination</Text>
              <TouchableOpacity onPress={() => setDestinationModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search destination..."
              placeholderTextColor={Colors.textMuted}
              value={destinationSearch}
              onChangeText={setDestinationSearch}
            />
            {loadingDestinations ? (
              <ActivityIndicator color={Colors.primary} style={styles.modalLoading} />
            ) : filteredDestinations.length === 0 ? (
              <Text style={styles.modalEmptyText}>No destinations found for {activeCountry?.name}.</Text>
            ) : (
              <FlatList
                data={filteredDestinations}
                keyExtractor={(item) => item.code}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalListRow} onPress={() => selectDestination(item)}>
                    <Text style={styles.modalListRowText}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={segmentModal} transparent animationType="fade" onRequestClose={() => setSegmentModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSegmentModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a category</Text>
              <TouchableOpacity onPress={() => setSegmentModal(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search category..."
              placeholderTextColor={Colors.textMuted}
              value={segmentSearch}
              onChangeText={setSegmentSearch}
            />
            {loadingSegments ? (
              <ActivityIndicator color={Colors.primary} style={styles.modalLoading} />
            ) : (
              <FlatList
                data={filteredSegments}
                keyExtractor={(item) => `${item.groupName}-${item.code}`}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalListRow} onPress={() => selectSegment(item)}>
                    <View>
                      <Text style={styles.modalListRowText}>{item.name}</Text>
                      <Text style={styles.resultDestination}>{item.groupName}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
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
  resultPriceInr: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
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
});

export default ActivitiesScreen;
