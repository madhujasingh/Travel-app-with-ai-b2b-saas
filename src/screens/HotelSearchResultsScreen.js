import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Callout, Marker } from '../components/MapViewCompat';
import { Colors } from '../constants/Colors';

const RESULTS_PAGE_SIZE = 20;

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

// Listing only ever returns ONE option per hotel (its cheapest), so every
// filter here (meal basis, price, GST) reflects that one cheapest option,
// not the hotel's full range of rates.
const getTopOption = (item) => (item.options || []).find((option) => option.inventory?.available !== false);

// This screen owns everything that happens AFTER a search - filters, view
// mode, pagination - so the search form (HotelsScreen) doesn't need to
// scroll past a results list every time. HotelsScreen navigates here with
// the already-fetched hotels + searchSession once a search succeeds.
const HotelSearchResultsScreen = ({ route, navigation }) => {
  const { hotels, searchSession, destinationLabel } = route.params;
  const { checkIn, checkOut } = searchSession;

  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [selectedStars, setSelectedStars] = useState(() => new Set());
  const [selectedMealBasis, setSelectedMealBasis] = useState(() => new Set());
  const [selectedPriceBucketKeys, setSelectedPriceBucketKeys] = useState(() => new Set());
  const [gstApplicableOnly, setGstApplicableOnly] = useState(false);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState(() => new Set());
  const [viewMode, setViewMode] = useState('list');
  const [visibleCount, setVisibleCount] = useState(RESULTS_PAGE_SIZE);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollViewRef = useRef(null);

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

  const openHotelDetail = (hotel) => {
    if (!searchSession || Date.now() >= searchSession.expiresAt) {
      Alert.alert('Search expired', 'Your search session has expired. Please search again.');
      return;
    }

    navigation.navigate('HotelDetail', {
      // Listing/Detail responses use "hotelId", not the "tjHotelId" the docs
      // describe - confirmed against real captured responses.
      tjHotelId: hotel.hotelId,
      hotelName: hotel.name,
      searchContext: searchSession,
    });
  };

  // Filter option lists + counts, computed from the full unfiltered result
  // set (not filteredHotels) so a count always reflects "how many hotels
  // this option would show if picked on its own" - matches TripJack's own
  // per-option counts rather than counts that shrink as other filters are
  // layered on.
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
  // as TripJack's own Price Range filter rather than fixed-width bands that
  // could leave most buckets empty depending on the city's price spread.
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
    () => filteredHotels.filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)),
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
              <Marker key={item.hotelId} coordinate={{ latitude: item.latitude, longitude: item.longitude }}>
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
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={Colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{destinationLabel || 'Search Results'}</Text>
          {!!(checkIn && checkOut) && (
            <Text style={styles.headerSubtitle}>
              {formatDisplayDate(checkIn)} - {formatDisplayDate(checkOut)}
            </Text>
          )}
        </View>
        <View style={{ width: 26 }} />
      </View>

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
        {hotels.length > 0 && (
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

        {hotels.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="bed-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyStateText}>No hotels found for this search.</Text>
            <Text style={styles.emptyStateSubtext}>Try different dates or another city.</Text>
          </View>
        )}

        {hotels.length > 0 && filteredHotels.length === 0 && (
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
                    <TouchableOpacity style={styles.filterOptionRow} onPress={() => setGstApplicableOnly((v) => !v)}>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  resultsToolbar: {
    paddingHorizontal: 20,
    marginTop: 16,
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

export default HotelSearchResultsScreen;
