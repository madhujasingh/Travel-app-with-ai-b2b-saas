import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { fetchHotelJson } from '../utils/hotelApiErrors';

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

// Static Detail's image "links" key varies (seen "original", "Standard", "70px"
// across different responses/docs) - just grab whichever link is present.
const firstImageUrl = (images) => {
  const hero = images?.find((img) => img.is_hero_image) || images?.[0];
  const links = hero?.links;
  if (!links) return null;
  const firstLink = Object.values(links)[0];
  return firstLink?.href || null;
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
  const { tjHotelId, hotelName, searchContext, demoDetail } = route.params;

  const [loading, setLoading] = useState(!demoDetail);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(demoDetail || null);

  const [reviewingOptionId, setReviewingOptionId] = useState(null);
  const [soldOutOptionIds, setSoldOutOptionIds] = useState(new Set());
  const [reviewResult, setReviewResult] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [staticContent, setStaticContent] = useState(null);
  const [loadingStaticContent, setLoadingStaticContent] = useState(false);

  useEffect(() => {
    if (demoDetail) {
      fetchStaticContent();
    } else {
      fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Demo mode only: the property content (photos/amenities/address) is real,
  // fetched from the working Static Detail API - only the pricing is fabricated.
  // Best-effort - if this fails, the rest of the demo screen still renders.
  const fetchStaticContent = async () => {
    try {
      setLoadingStaticContent(true);
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/static-detail`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hid: tjHotelId }),
        },
        'Unable to load property content.'
      );
      setStaticContent(data);
    } catch (err) {
      console.log('[hotel static-detail] failed', err.message);
    } finally {
      setLoadingStaticContent(false);
    }
  };

  useEffect(() => {
    if (!searchContext.expiresAt) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [searchContext.expiresAt]);

  const remainingMs = searchContext.expiresAt ? searchContext.expiresAt - now : null;
  const sessionExpired = remainingMs !== null && remainingMs <= 0;

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        hid: tjHotelId,
        checkIn: searchContext.checkIn,
        checkOut: searchContext.checkOut,
        rooms: searchContext.rooms,
        currency: searchContext.currency,
        nationality: searchContext.nationality,
      };

      console.log('[hotel detail] REQUEST', JSON.stringify(payload));
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/detail`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Unable to load hotel options right now.'
      );
      console.log('[hotel detail] RESPONSE', JSON.stringify(data));

      setDetail(data);
    } catch (err) {
      setError(err.message || 'Unable to load hotel options right now.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 - Review: re-validates price + availability. Must be called immediately
  // before Book, with the same correlationId used in Listing/Detail.
  const reviewOption = async (option) => {
    if (demoDetail) {
      Alert.alert(
        'Demo data',
        'This hotel and its rates are sample data for preview only - TripJack has no live inventory activated for this account yet, so Review/Book can\'t be completed here.'
      );
      return;
    }

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

      console.log('[hotel review] REQUEST', JSON.stringify(payload));
      const data = await fetchHotelJson(
        `${API_CONFIG.BASE_URL}/hotels/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        'Unable to review this option right now.'
      );
      console.log('[hotel review] RESPONSE', JSON.stringify(data));

      setReviewResult(data);
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
          {demoDetail && (
            <View style={styles.demoBanner}>
              <Ionicons name="information-circle" size={18} color={Colors.warning} />
              <Text style={styles.demoBannerText}>
                Demo data - real hotel, sample rates. TripJack has no live inventory activated for this account yet.
              </Text>
            </View>
          )}

          {demoDetail && loadingStaticContent && (
            <ActivityIndicator color={Colors.primary} style={{ marginBottom: 14 }} />
          )}

          {demoDetail && staticContent && (
            <View style={styles.propertyCard}>
              {firstImageUrl(staticContent.images) && (
                <Image
                  source={{ uri: firstImageUrl(staticContent.images) }}
                  style={styles.propertyImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.propertyCardBody}>
                {staticContent.star_rating && (
                  <Text style={styles.propertyRating}>{'★'.repeat(Number(staticContent.star_rating) || 0)} {staticContent.star_rating}-star</Text>
                )}
                {staticContent.locale?.address?.fulladdr && (
                  <View style={styles.propertyAddressRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.propertyAddress}>{staticContent.locale.address.fulladdr}</Text>
                  </View>
                )}
                {staticContent.descriptions?.headline && (
                  <Text style={styles.propertyDescription} numberOfLines={4}>
                    {staticContent.descriptions.headline}
                  </Text>
                )}
                {Object.values(staticContent.amenities || {}).length > 0 && (
                  <View style={styles.amenityChipRow}>
                    {Object.values(staticContent.amenities)
                      .slice(0, 10)
                      .map((amenity, index) => (
                        <View key={index} style={styles.amenityChip}>
                          <Text style={styles.amenityChipText}>{amenity.name}</Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.stayInfoRow}>
            <Text style={styles.stayInfo}>
              {searchContext.checkIn} → {searchContext.checkOut}
            </Text>
            {remainingMs !== null && (
              <Text style={[styles.countdown, sessionExpired && styles.countdownExpired]}>
                {sessionExpired ? 'Search expired' : `Expires in ${formatCountdown(remainingMs)}`}
              </Text>
            )}
          </View>

          {reviewResult && (
            <View style={styles.reviewResultCard}>
              <View style={styles.reviewResultHeader}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.reviewResultTitle}>Reviewed &amp; held</Text>
                <TouchableOpacity onPress={() => setReviewResult(null)}>
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
              {reviewResult.onholdAllowed !== undefined && (
                <Text style={styles.reviewResultRow}>
                  On-hold allowed: {String(reviewResult.onholdAllowed)}
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

          {(detail.options || [])
            .filter((option) => option.inventory?.available !== false)
            .map((option) => {
            const cancellation = cancellationSummary(option.cancellation);
            const isSoldOut = soldOutOptionIds.has(option.optionId);
            const isReviewing = reviewingOptionId === option.optionId;
            const isReviewed = reviewResult?.option?.optionId === option.optionId;

            return (
              <View key={option.optionId} style={[styles.optionCard, isReviewed && styles.optionCardSelected]}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionType}>{option.optionType}</Text>
                  <Text style={styles.mealBasis}>{option.mealBasis}</Text>
                </View>

                {(option.roomInfo || []).map((room, index) => (
                  <Text key={index} style={styles.roomName}>
                    Room {index + 1}: {room.name}
                  </Text>
                ))}

                {option.inclusions?.length > 0 && (
                  <Text style={styles.inclusions}>Includes: {option.inclusions.join(', ')}</Text>
                )}

                {option.bookingNotes && <Text style={styles.bookingNotes}>{option.bookingNotes}</Text>}

                <View style={styles.priceBreakup}>
                  {option.pricing?.strikethrough && (
                    <Text style={styles.strikethrough}>
                      {option.pricing.currency} {Number(option.pricing.strikethrough).toLocaleString()}
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
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{option.commercial?.type}</Text>
                  </View>
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
              </View>
            );
          })}
        </ScrollView>
      )}
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
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7E0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  demoBannerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
  propertyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  propertyImage: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.background,
  },
  propertyCardBody: {
    padding: 14,
  },
  propertyRating: {
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginBottom: 6,
  },
  propertyAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 8,
  },
  propertyAddress: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
  },
  propertyDescription: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 10,
  },
  amenityChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenityChip: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amenityChipText: {
    fontSize: 11,
    color: Colors.textLight,
  },
  stayInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  reviewResultCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
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
  optionType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primaryDark,
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
  inclusions: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
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
