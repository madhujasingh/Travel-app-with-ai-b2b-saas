import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { fetchHotelJson, SEARCH_SESSION_MS } from '../utils/hotelApiErrors';
import DatePickerModal from '../components/DatePickerModal';

// imagesJson is the raw fetch-hotel-content images[] array, stored as text -
// each entry has links keyed by size (Standard/XXL/...), not a flat url.
const parseGalleryImages = (imagesJson) => {
  if (!imagesJson) return [];
  try {
    const parsed = JSON.parse(imagesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((img) => img?.links?.Standard?.href || img?.links?.XXL?.href || Object.values(img?.links || {})[0]?.href)
      .filter(Boolean)
      .slice(0, 10);
  } catch (err) {
    return [];
  }
};

const buildViewerImages = (heroImageUrl, galleryImages) => {
  const urls = [heroImageUrl, ...galleryImages].filter(Boolean);
  return Array.from(new Set(urls));
};

// hotels/static-detail's rooms[*].images entries are already-parsed objects
// (not a JSON string like catalogHotel.imagesJson), so this is the same
// links.XXL/Standard extraction as parseGalleryImages without the JSON.parse.
const extractRoomImageUrls = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => img?.links?.XXL?.href || img?.links?.Standard?.href || Object.values(img?.links || {})[0]?.href)
    .filter(Boolean);
};

// catalogHotel.descriptionsJson is a JSON-stringified object with keys like
// headline/location/dining/attractions/amenities/default - "default" itself
// duplicates the same keys as another nested JSON string, so it's ignored.
const parseDescriptions = (descriptionsJson) => {
  if (!descriptionsJson) return null;
  try {
    const parsed = JSON.parse(descriptionsJson);
    return typeof parsed === 'object' && parsed ? parsed : null;
  } catch (err) {
    return null;
  }
};

// catalogHotel.amenitiesJson is a JSON-stringified object keyed by array
// index (e.g. {"0": {"id": "...", "name": "Wifi"}, "1": {...}}), not an array -
// and TripJack's own list frequently repeats the same id/name at multiple
// indexes, so dedupe by name (case-insensitive) rather than trusting id
// uniqueness.
const parseAmenities = (amenitiesJson) => {
  if (!amenitiesJson) return [];
  try {
    const parsed = JSON.parse(amenitiesJson);
    if (!parsed || typeof parsed !== 'object') return [];
    const seen = new Set();
    return Object.values(parsed).filter((item) => {
      if (!item?.name) return false;
      const key = item.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (err) {
    return [];
  }
};

const AMENITY_ICON_RULES = [
  [/wifi|internet/i, 'wifi-outline'],
  [/restaurant|dining/i, 'restaurant-outline'],
  [/parking/i, 'car-outline'],
  [/pool/i, 'water-outline'],
  [/bar|lounge/i, 'wine-outline'],
  [/breakfast/i, 'cafe-outline'],
  [/air condition/i, 'snow-outline'],
  [/elevator|lift/i, 'swap-vertical-outline'],
  [/laundry/i, 'shirt-outline'],
  [/concierge|front desk/i, 'people-outline'],
  [/spa/i, 'flower-outline'],
  [/gym|fitness/i, 'barbell-outline'],
  [/tv|television/i, 'tv-outline'],
  [/room service/i, 'fast-food-outline'],
];

const getAmenityIcon = (name = '') => {
  const rule = AMENITY_ICON_RULES.find(([regex]) => regex.test(name));
  return rule ? rule[1] : 'checkmark-circle-outline';
};

const formatPenaltyDate = (isoDateTime) => {
  if (!isoDateTime) return '';
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDeadline = (isoDateTime) => {
  if (!isoDateTime) return '';
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatCountdown = (remainingMs) => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// checkIn/checkOut are always YYYY-MM-DD strings (see HotelsScreen), so this
// only needs to go the other way, for display and for the DatePickerModal's
// initialDate/minDate.
const parseDateValue = (value) => {
  const match = (value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const formatDisplayDate = (value) => {
  const date = parseDateValue(value);
  if (!date) return value;
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

// Policy text fields (instructions, mandatory_fees, etc.) can contain HTML.
const stripHtml = (raw) => {
  if (!raw) return '';
  return raw
    .replace(/<\/?br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

// TripJack's static-detail policy fields (mandatory_fees, special_instructions) are
// themselves a JSON object serialized as a string (e.g. {"Optional":"...",
// "Instructions":"..."}), and the individual items inside each value are often run
// together with no separator (e.g. "...occupancy 4)Rollaway bed fee..."). Parse the
// JSON and break on the lowercase->uppercase run-on boundary so this renders as
// readable paragraphs instead of a raw JSON blob.
const parsePolicyText = (raw) => {
  if (!raw) return [];
  let value = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      value = Object.values(parsed).join('\n\n');
    } else if (typeof parsed === 'string') {
      value = parsed;
    }
  } catch {
    // Not JSON - use the raw string as-is.
  }
  return stripHtml(value)
    .replace(/([a-z0-9)])([A-Z])/g, '$1\n\n$2')
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const cancellationSummary = (cancellation) => {
  if (!cancellation) return null;
  if (!cancellation.isRefundable) {
    return { text: 'Non-refundable', tone: 'error' };
  }

  const freeSlab = (cancellation.penalties || []).find((slab) => Number(slab.amount) === 0);
  if (freeSlab) {
    return { text: `Free cancellation until ${formatPenaltyDate(freeSlab.to)}`, tone: 'success' };
  }
  return { text: 'Refundable, penalty applies', tone: 'warning' };
};

const HotelDetailScreen = ({ route, navigation }) => {
  const { tjHotelId, hotelName } = route.params;

  // Held in state (not just destructured from route.params) because changing
  // the stay dates on this screen re-searches and swaps in a new session
  // (new correlationId/expiresAt) rather than navigating back.
  const [searchContext, setSearchContext] = useState(route.params.searchContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [staticDetail, setStaticDetail] = useState(null);
  const [catalogHotel, setCatalogHotel] = useState(null);

  const [reviewingOptionId, setReviewingOptionId] = useState(null);
  const [soldOutOptionIds, setSoldOutOptionIds] = useState(new Set());
  const [reviewResult, setReviewResult] = useState(null);
  // TripJack's Review response returns a different, newly-generated option.optionId
  // than the one that was requested - track the requested id separately so
  // "which option was reviewed" can still be matched back to the right card.
  const [reviewedOptionId, setReviewedOptionId] = useState(null);
  const [now, setNow] = useState(Date.now());
  // { images: string[], index: number } | null - shared by the hero/gallery
  // photos and each rate option's own room photos, so every tappable image
  // on this screen opens the same full-screen viewer.
  const [viewerState, setViewerState] = useState(null);
  const [feesExpanded, setFeesExpanded] = useState(false);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);

  // Inline date editing - 'checkIn' | 'checkOut' | null selects which field
  // the DatePickerModal is editing. Tapping Check-in opens the picker in
  // range mode (both dates picked in one session); tapping Check-out opens
  // it in single mode to adjust just that date.
  const [datePickerField, setDatePickerField] = useState(null);
  const [changingDates, setChangingDates] = useState(false);

  // Room filters - client-side over the current Detail response.
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [selectedMealBasis, setSelectedMealBasis] = useState(() => new Set());

  // hotels/static-detail's rooms map is keyed by an arbitrary index, not the
  // room id - re-key it by room.id so option.roomInfo[].id (from
  // hotels/detail) can look up that room's own photos directly.
  const roomImagesById = useMemo(() => {
    if (!staticDetail?.rooms) return {};
    return Object.values(staticDetail.rooms).reduce((acc, room) => {
      if (room?.id) acc[room.id] = extractRoomImageUrls(room.images);
      return acc;
    }, {});
  }, [staticDetail]);

  useEffect(() => {
    fetchDetail();
    fetchStaticDetail();
    fetchCatalogHotel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchContext.expiresAt) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [searchContext.expiresAt]);

  const remainingMs = searchContext.expiresAt ? searchContext.expiresAt - now : null;
  const sessionExpired = remainingMs !== null && remainingMs <= 0;

  const availableOptions = (detail?.options || []).filter((option) => option.inventory?.available !== false);
  // Built from whatever meal-basis values are actually present in this
  // hotel's options, rather than a hardcoded list - TripJack doesn't
  // guarantee every hotel offers the same set (e.g. some only have "Room
  // Only" and "Breakfast", others also have "Half Board"/"Full Board").
  const mealBasisValues = Array.from(
    new Set(availableOptions.map((option) => option.mealBasis).filter(Boolean))
  );
  const filteredOptions = availableOptions.filter((option) => {
    if (refundableOnly && !option.cancellation?.isRefundable) return false;
    if (selectedMealBasis.size > 0 && !selectedMealBasis.has(option.mealBasis)) return false;
    return true;
  });

  const toggleMealBasisFilter = (meal) => {
    setSelectedMealBasis((current) => {
      const next = new Set(current);
      if (next.has(meal)) next.delete(meal);
      else next.add(meal);
      return next;
    });
  };

  const fetchDetail = async (context = searchContext) => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        hid: tjHotelId,
        checkIn: context.checkIn,
        checkOut: context.checkOut,
        rooms: context.rooms,
        currency: context.currency,
        nationality: context.nationality,
      };

      if (__DEV__) console.log('[hotel detail] REQUEST', JSON.stringify(payload));
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/detail`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Unable to load hotel options right now.'
      );
      if (__DEV__) console.log('[hotel detail] RESPONSE', JSON.stringify(data));

      setDetail(data);
    } catch (err) {
      setError(err.message || 'Unable to load hotel options right now.');
    } finally {
      setLoading(false);
    }
  };

  // Changing dates on this screen re-runs Listing scoped to just this hotel
  // to mint a fresh correlationId/session for the new dates (Detail can't
  // reuse the old session's correlationId - it was tied to the original
  // search's checkIn/checkOut), then re-fetches Detail under that session.
  // This is the same two-step flow HotelsScreen's search bar does, just
  // without leaving this screen.
  const applyDateChange = async (nextCheckIn, nextCheckOut) => {
    setChangingDates(true);
    try {
      const correlationId = generateCorrelationId();
      const payload = {
        hids: [tjHotelId],
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        rooms: searchContext.rooms,
        currency: searchContext.currency,
        correlationId,
        nationality: searchContext.nationality,
      };

      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/listing`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Unable to check availability for these dates.'
      );

      if (!data.hotels || data.hotels.length === 0) {
        Alert.alert('No availability', 'This hotel has no rooms available for the selected dates.');
        return;
      }

      const nextContext = {
        correlationId,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        rooms: searchContext.rooms,
        currency: searchContext.currency,
        nationality: searchContext.nationality,
        expiresAt: Date.now() + SEARCH_SESSION_MS,
      };

      setSearchContext(nextContext);
      setReviewResult(null);
      setReviewedOptionId(null);
      setSoldOutOptionIds(new Set());
      await fetchDetail(nextContext);
    } catch (err) {
      Alert.alert('Dates', err.message || 'Unable to check availability for these dates.');
    } finally {
      setChangingDates(false);
    }
  };

  // Check-out tapped on its own - adjust just that date, keeping check-in.
  const handleCheckOutSelected = (dateString) => {
    setDatePickerField(null);
    applyDateChange(searchContext.checkIn, dateString);
  };

  // Check-in tapped - the picker runs in range mode, so both dates arrive
  // together already validated (end > start) rather than needing the
  // "hold the new check-in until a valid check-out is picked" dance this
  // used to require.
  const handleDateRangeSelected = (startDateString, endDateString) => {
    setDatePickerField(null);
    applyDateChange(startDateString, endDateString);
  };

  // Static Detail: property policies, check-in/out times, and mandatory fees
  // payable at the property. TripJack requires this be considered before
  // booking (mandatory_fees in particular "must be displayed to users before
  // booking" per their docs) - fetched alongside Detail, not gating it, since
  // this endpoint is supplementary/cacheable and shouldn't block the room list
  // if it's slow or unavailable.
  const fetchStaticDetail = async () => {
    try {
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/static-detail`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hid: tjHotelId }),
        },
        'Unable to load property policies.'
      );
      setStaticDetail(data);
    } catch (err) {
      // Silent - policies are supplementary; don't block the booking flow over it.
    }
  };

  // TripJack's dynamic Detail/Static-Detail responses don't carry photos -
  // images/amenities/descriptions/policies only ever come from this content
  // endpoint. The bulk catalog sync deliberately doesn't pre-store this for
  // every hotel (it's the heavy part - see HotelCatalogService.
  // mapToHotelForCatalog), so this fetches it live for just this one hotel,
  // same as TripJack's own site loading detail content on demand.
  const fetchCatalogHotel = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/hotel-catalog/${tjHotelId}/live`);
      if (!response.ok) return;
      const data = await response.json();
      setCatalogHotel(data);
    } catch (err) {
      // Silent - photos are supplementary; don't block the booking flow over it.
    }
  };

  // Step 3 - Review: re-validates price + availability. Must be called immediately
  // before Book, with the same correlationId used in Listing/Detail.
  const reviewOption = async (option) => {
    if (sessionExpired) {
      Alert.alert('Search expired', 'Your search session has expired. Please go back and search again.');
      return;
    }

    try {
      setReviewingOptionId(option.optionId);

      const payload = {
        correlationId: searchContext.correlationId,
        optionId: option.optionId,
        reviewHash: detail.reviewHash,
        hid: tjHotelId,
      };

      if (__DEV__) console.log('[hotel review] REQUEST', JSON.stringify(payload));
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Unable to review this option right now.'
      );
      if (__DEV__) console.log('[hotel review] RESPONSE', JSON.stringify(data));

      setReviewResult(data);
      setReviewedOptionId(option.optionId);
    } catch (err) {
      if (err.soldOut) {
        setSoldOutOptionIds((current) => new Set(current).add(option.optionId));
      }
      Alert.alert('Review', err.message || 'Unable to review this option right now.');
    } finally {
      setReviewingOptionId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {detail?.hotelName || hotelName}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      {loading && (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDetail}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && detail && (
        <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
          {(() => {
            const galleryImages = parseGalleryImages(catalogHotel?.imagesJson);
            const viewerImages = buildViewerImages(catalogHotel?.heroImageUrl, galleryImages);

            return (
              <>
                {catalogHotel?.heroImageUrl && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setViewerState({ images: viewerImages, index: 0 })}
                  >
                    <Image source={{ uri: catalogHotel.heroImageUrl }} style={styles.heroImage} resizeMode="cover" />
                    {viewerImages.length > 1 && (
                      <View style={styles.photoCountPill} pointerEvents="none">
                        <Ionicons name="images-outline" size={13} color="#fff" />
                        <Text style={styles.photoCountPillText}>{viewerImages.length} photos</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {galleryImages.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryRow}>
                    {galleryImages.map((url) => (
                      <TouchableOpacity
                        key={url}
                        activeOpacity={0.85}
                        onPress={() =>
                          setViewerState({ images: viewerImages, index: Math.max(viewerImages.indexOf(url), 0) })
                        }
                      >
                        <Image source={{ uri: url }} style={styles.galleryThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            );
          })()}

          {catalogHotel?.starRating && (
            <View style={styles.hotelRatingRow}>
              {Array.from({ length: Math.round(parseFloat(catalogHotel.starRating)) || 0 }).map((_, i) => (
                <Ionicons key={i} name="star" size={14} color={Colors.warning} />
              ))}
              <Text style={styles.hotelRatingText}>{catalogHotel.starRating}-star hotel</Text>
            </View>
          )}

          {(() => {
            const descriptions = parseDescriptions(catalogHotel?.descriptionsJson);
            const aboutText = stripHtml(descriptions?.location || descriptions?.amenities || '');
            if (!aboutText) return null;

            return (
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>About the property</Text>
                {descriptions?.headline && <Text style={styles.aboutHeadline}>{descriptions.headline}</Text>}
                <Text style={styles.aboutText} numberOfLines={aboutExpanded ? undefined : 3}>
                  {aboutText}
                </Text>
                <TouchableOpacity onPress={() => setAboutExpanded((v) => !v)}>
                  <Text style={styles.readMoreText}>{aboutExpanded ? 'Read less' : 'Read more'}</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {(() => {
            const amenities = parseAmenities(catalogHotel?.amenitiesJson);
            if (amenities.length === 0) return null;
            const visibleAmenities = amenitiesExpanded ? amenities : amenities.slice(0, 6);

            return (
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>Amenities</Text>
                <View style={styles.amenitiesGrid}>
                  {visibleAmenities.map((item, idx) => (
                    <View key={idx} style={styles.amenityItem}>
                      <Ionicons name={getAmenityIcon(item.name)} size={18} color={Colors.primary} />
                      <Text style={styles.amenityText} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  ))}
                </View>
                {amenities.length > 6 && (
                  <TouchableOpacity onPress={() => setAmenitiesExpanded((v) => !v)}>
                    <Text style={styles.readMoreText}>
                      {amenitiesExpanded ? 'Show less' : `View all (${amenities.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          <View style={styles.stayInfoRow}>
            <View style={styles.dateEditRow}>
              <TouchableOpacity
                style={styles.datePill}
                activeOpacity={0.7}
                onPress={() => setDatePickerField('checkIn')}
                disabled={changingDates}
              >
                <Ionicons name="calendar-outline" size={13} color={Colors.primaryDark} />
                <Text style={styles.datePillText}>{formatDisplayDate(searchContext.checkIn)}</Text>
              </TouchableOpacity>
              <Ionicons name="arrow-forward" size={13} color={Colors.textMuted} />
              <TouchableOpacity
                style={styles.datePill}
                activeOpacity={0.7}
                onPress={() => setDatePickerField('checkOut')}
                disabled={changingDates}
              >
                <Ionicons name="calendar-outline" size={13} color={Colors.primaryDark} />
                <Text style={styles.datePillText}>{formatDisplayDate(searchContext.checkOut)}</Text>
              </TouchableOpacity>
              {changingDates && (
                <ActivityIndicator size="small" color={Colors.primary} style={styles.dateEditSpinner} />
              )}
            </View>
            {remainingMs !== null && (
              <Text style={[styles.countdown, sessionExpired && styles.countdownExpired]}>
                {sessionExpired ? 'Search expired' : `Expires in ${formatCountdown(remainingMs)}`}
              </Text>
            )}
          </View>

          {staticDetail?.policies && (
            <View style={styles.policiesCard}>
              <Text style={styles.policiesTitle}>Property policies</Text>
              {staticDetail.policies.checkInCheckOut && (
                <Text style={styles.policiesRow}>
                  Check-in {staticDetail.policies.checkInCheckOut.checkin_from}
                  {staticDetail.policies.checkInCheckOut.checkin_till
                    ? `–${staticDetail.policies.checkInCheckOut.checkin_till}`
                    : ''}
                  {'  ·  '}
                  Check-out {staticDetail.policies.checkInCheckOut.checkout_from}
                  {staticDetail.policies.checkInCheckOut.checkout_till
                    ? `–${staticDetail.policies.checkInCheckOut.checkout_till}`
                    : ''}
                </Text>
              )}

              {staticDetail.policies.mandatory_fees && (
                <View style={styles.policiesSection}>
                  <TouchableOpacity
                    style={styles.policiesToggle}
                    activeOpacity={0.7}
                    onPress={() => setFeesExpanded((v) => !v)}
                  >
                    <Text style={styles.policiesLabel}>Mandatory fees (payable at the property)</Text>
                    <Ionicons
                      name={feesExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                  {feesExpanded &&
                    parsePolicyText(staticDetail.policies.mandatory_fees).map((line, idx) => (
                      <Text key={idx} style={styles.policiesRow}>{line}</Text>
                    ))}
                </View>
              )}

              {staticDetail.policies.special_instructions && (
                <View style={styles.policiesSection}>
                  <TouchableOpacity
                    style={styles.policiesToggle}
                    activeOpacity={0.7}
                    onPress={() => setInstructionsExpanded((v) => !v)}
                  >
                    <Text style={styles.policiesLabel}>Special instructions</Text>
                    <Ionicons
                      name={instructionsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                  {instructionsExpanded &&
                    parsePolicyText(staticDetail.policies.special_instructions).map((line, idx) => (
                      <Text key={idx} style={styles.policiesRow}>{line}</Text>
                    ))}
                </View>
              )}
            </View>
          )}

          {availableOptions.length > 0 && (
            <>
              <Text style={styles.roomsSectionTitle}>Choose your room</Text>

              <View style={styles.filterBar}>
                <TouchableOpacity
                  style={[styles.filterChip, refundableOnly && styles.filterChipSelected]}
                  activeOpacity={0.7}
                  onPress={() => setRefundableOnly((v) => !v)}
                >
                  <Text style={[styles.filterChipText, refundableOnly && styles.filterChipTextSelected]}>
                    Free cancellation
                  </Text>
                </TouchableOpacity>
                {mealBasisValues.map((meal) => {
                  const selected = selectedMealBasis.has(meal);
                  return (
                    <TouchableOpacity
                      key={meal}
                      style={[styles.filterChip, selected && styles.filterChipSelected]}
                      activeOpacity={0.7}
                      onPress={() => toggleMealBasisFilter(meal)}
                    >
                      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                        {meal}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {filteredOptions.length === 0 && (
                <Text style={styles.noResultsText}>No rooms match the selected filters.</Text>
              )}
            </>
          )}

          {filteredOptions.map((option) => {
            const cancellation = cancellationSummary(option.cancellation);
            const isSoldOut = soldOutOptionIds.has(option.optionId);
            const isReviewing = reviewingOptionId === option.optionId;
            const isReviewed = reviewedOptionId === option.optionId;
            // TripJack's option.inclusions frequently repeats the same rate-remarks
            // text as multiple array entries, and bookingNotes often duplicates it
            // again - dedupe by cleaned text so the same paragraph isn't shown 2-3x.
            const cleanedInclusions = Array.from(
              new Set((option.inclusions || []).map((entry) => stripHtml(entry)).filter(Boolean))
            );
            const cleanedBookingNotes = stripHtml(option.bookingNotes);
            const showBookingNotes = cleanedBookingNotes && !cleanedInclusions.includes(cleanedBookingNotes);

            return (
              <View key={option.optionId} style={[styles.optionCard, isReviewed && styles.optionCardSelected]}>
                <View style={styles.optionHeader}>
                  <Text style={styles.mealBasis}>{option.mealBasis}</Text>
                </View>

                {(option.roomInfo || []).map((room, index) => {
                  const roomImages = roomImagesById[room.id] || [];
                  return (
                    <View key={index}>
                      <Text style={styles.roomName}>
                        Room {index + 1}: {room.name}
                      </Text>
                      {roomImages.length > 0 && (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.roomImageRow}
                        >
                          {roomImages.map((url) => (
                            <TouchableOpacity
                              key={url}
                              activeOpacity={0.85}
                              onPress={() =>
                                setViewerState({ images: roomImages, index: Math.max(roomImages.indexOf(url), 0) })
                              }
                            >
                              <Image source={{ uri: url }} style={styles.roomImageThumb} resizeMode="cover" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  );
                })}

                {cleanedInclusions.length > 0 && (
                  <View style={styles.inclusionsBlock}>
                    <Text style={styles.inclusionsLabel}>Rate notes</Text>
                    {cleanedInclusions.map((text, idx) => (
                      <Text key={idx} style={styles.inclusions}>{text}</Text>
                    ))}
                  </View>
                )}

                {showBookingNotes && <Text style={styles.bookingNotes}>{cleanedBookingNotes}</Text>}

                <View style={styles.priceBreakup}>
                  {option.pricing?.strikeThrough && (
                    <Text style={styles.strikethrough}>
                      {option.pricing.currency} {Number(option.pricing.strikeThrough).toLocaleString()}
                    </Text>
                  )}
                  <View style={styles.priceRow}>
                    <Text style={styles.priceRowLabel}>Base price</Text>
                    <Text style={styles.priceRowValue}>{Number(option.pricing?.basePrice || 0).toLocaleString()}</Text>
                  </View>
                  {option.pricing?.discount > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceRowLabel}>Discount</Text>
                      <Text style={styles.priceRowValue}>-{Number(option.pricing.discount).toLocaleString()}</Text>
                    </View>
                  )}
                  <View style={styles.priceRow}>
                    <Text style={styles.priceRowLabel}>Taxes</Text>
                    <Text style={styles.priceRowValue}>{Number(option.pricing?.taxes || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceRowLabel}>Management fee</Text>
                    <Text style={styles.priceRowValue}>{Number(option.pricing?.mf || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceRowLabel}>Management fee tax</Text>
                    <Text style={styles.priceRowValue}>{Number(option.pricing?.mft || 0).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.priceRow, styles.priceRowTotal]}>
                    <Text style={styles.priceRowTotalLabel}>Total</Text>
                    <Text style={styles.priceRowTotalValue}>
                      {option.pricing?.currency} {Number(option.pricing?.totalPrice || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.badgeRow}>
                  {cancellation && (
                    <View style={[styles.badge, styles[`badge_${cancellation.tone}`]]}>
                      <Text style={[styles.badgeText, styles[`badgeText_${cancellation.tone}`]]}>
                        {cancellation.text}
                      </Text>
                    </View>
                  )}
                  {option.compliance?.panRequired && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>PAN required</Text>
                    </View>
                  )}
                  {option.compliance?.passportRequired && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Passport required</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    isReviewed && styles.selectButtonSelected,
                    (isSoldOut || sessionExpired) && styles.selectButtonDisabled,
                  ]}
                  onPress={() => reviewOption(option)}
                  disabled={isSoldOut || isReviewing || sessionExpired}
                >
                  {isReviewing ? (
                    <ActivityIndicator color={Colors.secondary} />
                  ) : (
                    <Text style={styles.selectButtonText}>
                      {isSoldOut ? 'Sold out' : isReviewed ? 'Reviewed' : 'Select this option'}
                    </Text>
                  )}
                </TouchableOpacity>

                {isReviewed && reviewResult && (
                  <View style={styles.reviewResultCard}>
                    <View style={styles.reviewResultHeader}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                      <Text style={styles.reviewResultTitle}>Reviewed &amp; held</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setReviewResult(null);
                          setReviewedOptionId(null);
                        }}
                      >
                        <Ionicons name="close" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.reviewResultRow}>Booking ID: {reviewResult.bookingId}</Text>
                    <Text style={styles.reviewResultRow}>
                      Confirmed total: {reviewResult.option?.pricing?.currency}{' '}
                      {Number(reviewResult.option?.pricing?.totalPrice || 0).toLocaleString()}
                    </Text>
                    {reviewResult.option?.deadlineDateTime && (
                      <Text style={styles.reviewResultRow}>
                        Hold deadline: {formatDeadline(reviewResult.option.deadlineDateTime)}
                      </Text>
                    )}
                    {(() => {
                      // Cancellation policy can change between browsing and review -
                      // TripJack's docs say to treat the Review response (not the
                      // earlier Detail/Listing one) as the final reference for both
                      // price and cancellation policy before the user commits.
                      const reviewCancellation = cancellationSummary(reviewResult.option?.cancellation);
                      return reviewCancellation ? (
                        <View
                          style={[styles.reviewResultCancellationBadge, styles[`badge_${reviewCancellation.tone}`]]}
                        >
                          <Text
                            style={[
                              styles.reviewResultCancellationText,
                              styles[`badgeText_${reviewCancellation.tone}`],
                            ]}
                          >
                            {reviewCancellation.text}
                          </Text>
                        </View>
                      ) : null;
                    })()}
                    {reviewResult.onholdAllowed !== undefined && (
                      <Text style={styles.reviewResultRow}>
                        {reviewResult.onholdAllowed
                          ? 'You can hold this room now and pay later.'
                          : 'Payment is required now to confirm this booking.'}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() =>
                        navigation.navigate('HotelBooking', {
                          tjHotelId,
                          hotelName: detail.hotelName,
                          searchContext,
                          reviewResult,
                        })
                      }
                    >
                      <Text style={styles.continueButtonText}>Continue to Book</Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={viewerState !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerState(null)}
      >
        <View style={styles.viewerOverlay}>
          <SafeAreaView style={styles.viewerSafeArea}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerCounter}>
                {viewerState ? viewerState.index + 1 : 0} / {viewerState?.images.length || 0}
              </Text>
              <TouchableOpacity onPress={() => setViewerState(null)} style={styles.viewerCloseButton}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {viewerState && (
              <FlatList
                data={viewerState.images}
                keyExtractor={(url) => url}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={viewerState.index}
                getItemLayout={(_, index) => ({
                  length: Dimensions.get('window').width,
                  offset: Dimensions.get('window').width * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                  setViewerState((current) => (current ? { ...current, index } : current));
                }}
                renderItem={({ item }) => (
                  <View style={styles.viewerImageWrapper}>
                    <Image source={{ uri: item }} style={styles.viewerImage} resizeMode="contain" />
                  </View>
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <DatePickerModal
        visible={datePickerField !== null}
        title={datePickerField === 'checkOut' ? 'Check-out date' : 'Check-in → Check-out'}
        rangeMode={datePickerField === 'checkIn'}
        initialDate={
          datePickerField === 'checkOut'
            ? parseDateValue(searchContext.checkOut)
            : parseDateValue(searchContext.checkIn)
        }
        minDate={
          datePickerField === 'checkOut'
            ? new Date(parseDateValue(searchContext.checkIn).getTime() + 24 * 60 * 60 * 1000)
            : startOfTomorrow()
        }
        onSelect={handleCheckOutSelected}
        onSelectRange={handleDateRangeSelected}
        onClose={() => setDatePickerField(null)}
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
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginHorizontal: 8,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  errorText: {
    marginTop: 10,
    color: Colors.textLight,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 15,
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: Colors.primaryLight,
  },
  photoCountPill: {
    position: 'absolute',
    right: 10,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  photoCountPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  galleryRow: {
    marginBottom: 12,
  },
  galleryThumb: {
    width: 90,
    height: 70,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: Colors.primaryLight,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerSafeArea: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewerCounter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewerCloseButton: {
    padding: 4,
  },
  viewerImageWrapper: {
    width: Dimensions.get('window').width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: Dimensions.get('window').width,
    height: '100%',
  },
  hotelRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 10,
  },
  hotelRatingText: {
    marginLeft: 6,
    fontSize: 13,
    color: Colors.textMuted,
  },
  stayInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  dateEditSpinner: {
    marginLeft: 2,
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.card,
  },
  filterChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
  },
  filterChipTextSelected: {
    color: Colors.secondary,
  },
  noResultsText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  aboutCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  aboutHeadline: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  aboutText: {
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 19,
  },
  readMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 8,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '50%',
    paddingVertical: 6,
    paddingRight: 8,
  },
  amenityText: {
    fontSize: 13,
    color: Colors.textLight,
    flexShrink: 1,
  },
  roomsSectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  stayInfo: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  countdown: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  countdownExpired: {
    color: Colors.error,
    fontWeight: '600',
  },
  policiesCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  policiesTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  policiesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    flex: 1,
  },
  policiesRow: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 4,
  },
  policiesSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  policiesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewResultCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  reviewResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewResultTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  reviewResultRow: {
    fontSize: 13,
    color: Colors.text,
    marginBottom: 2,
  },
  reviewResultCancellationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  reviewResultCancellationText: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '600',
  },
  reviewResultNote: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  continueButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  optionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mealBasis: {
    fontSize: 13,
    color: Colors.textLight,
  },
  roomName: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  roomImageRow: {
    marginBottom: 8,
  },
  roomImageThumb: {
    width: 76,
    height: 60,
    borderRadius: 8,
    marginRight: 6,
    backgroundColor: Colors.primaryLight,
  },
  inclusionsBlock: {
    marginTop: 6,
  },
  inclusionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  inclusions: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  bookingNotes: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  priceBreakup: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  strikethrough: {
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  priceRowLabel: {
    fontSize: 13,
    color: Colors.textLight,
  },
  priceRowValue: {
    fontSize: 13,
    color: Colors.text,
  },
  priceRowTotal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceRowTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  priceRowTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  badge_success: {
    borderColor: Colors.success,
  },
  badgeText_success: {
    color: Colors.success,
  },
  badge_warning: {
    borderColor: Colors.warning,
  },
  badgeText_warning: {
    color: Colors.warning,
  },
  badge_error: {
    borderColor: Colors.error,
  },
  badgeText_error: {
    color: Colors.error,
  },
  selectButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectButtonSelected: {
    backgroundColor: Colors.success,
  },
  selectButtonDisabled: {
    backgroundColor: Colors.textMuted,
  },
  selectButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default HotelDetailScreen;
