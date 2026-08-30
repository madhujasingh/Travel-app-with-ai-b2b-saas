import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { parseActivitiesError } from '../utils/activitiesApiErrors';
import { formatInrEquivalent } from '../utils/currencyConversion';
import { buildPaxBreakdown } from '../utils/activityPaxPricing';

// Content descriptions come back as HTML (<br />, <strong>, etc.) - RN has
// no HTML renderer wired up here, so this strips tags down to plain text
// with paragraph breaks preserved well enough to read.
const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?strong>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
};

const getHeroImage = (content) => {
  const images = content?.media?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const urls = images[0]?.urls;
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const large = urls.find((u) => u.sizeType === 'LARGE2') || urls.find((u) => u.sizeType === 'MEDIUM') || urls[0];
  return large?.resource || null;
};

const ActivityDetailScreen = ({ route, navigation }) => {
  const { activityCode, name, from, to, adults, childAges } = route.params;
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);

  // useFocusEffect (not a plain useEffect) - React Navigation keeps this
  // screen mounted when the booking screen pushes on top of it, so a plain
  // useEffect would only ever fetch once and never again on the way back.
  // Since rateKeys expire after ~30 minutes and can't be reused once tried
  // (confirmed live - a failed confirm attempt still burns the rateKey),
  // every time this screen comes back into focus needs a fresh fetch, not
  // the same stale rateKey that just failed.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const fetchDetail = async () => {
        try {
          setLoading(true);
          setSelectedRate(null);
          // Deliberately NOT sending modalityCode even when we have one -
          // confirmed live that HotelBeds' API 500s when it's included (at
          // least in this test environment), while omitting it succeeds and
          // simply returns every modality for the activity instead of just one.
          const payload = {
            code: activityCode,
            from,
            to,
            language: 'en',
            paxes: [
              ...Array.from({ length: adults || 1 }, () => ({ age: 30 })),
              ...(childAges || []).map((age) => ({ age })),
            ],
          };
          const response = await fetch(`${API_CONFIG.BASE_URL}/activities/details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok || data?.errors) {
            throw new Error(parseActivitiesError(data, 'Unable to load activity details.'));
          }
          if (!cancelled) {
            setActivity(data?.activity || null);
          }
        } catch (error) {
          if (!cancelled) {
            Alert.alert('Activity Details', error.message || 'Unable to load activity details.');
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      fetchDetail();

      return () => {
        cancelled = true;
      };
    }, [activityCode, from, to, adults, childAges])
  );

  const heroImage = getHeroImage(activity?.content);
  const breakdown = selectedRate
    ? buildPaxBreakdown({ paxAmounts: selectedRate.paxAmounts, adults, childAges })
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name || 'Activity'}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading && (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      )}

      {!loading && !activity && (
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>Unable to load this activity right now.</Text>
        </View>
      )}

      {!loading && activity && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {heroImage && <Image source={{ uri: heroImage }} style={styles.heroImage} />}

          <Text style={styles.activityName}>{activity?.content?.name || name}</Text>
          {activity?.country?.destinations?.[0]?.name && (
            <Text style={styles.destination}>
              <Ionicons name="location-outline" size={14} color={Colors.textMuted} /> {activity.country.destinations[0].name}
            </Text>
          )}

          {!!activity?.content?.description && (
            <Text style={styles.description}>{stripHtml(activity.content.description)}</Text>
          )}

          <Text style={styles.sectionTitle}>Available options</Text>
          {(activity?.modalities || []).map((modality) => (
            <View key={modality.code} style={styles.modalityCard}>
              <Text style={styles.modalityName}>{modality.name}</Text>
              {modality.minChildrenAge != null && modality.maxChildrenAge != null && (
                <Text style={styles.childAgeNote}>
                  Child pricing applies ages {modality.minChildrenAge}-{modality.maxChildrenAge}; older children are priced as adults
                </Text>
              )}
              {(modality.rates || []).map((rate) =>
                (rate.rateDetails || []).map((detail) => {
                  const isSelected = selectedRate?.rateKey === detail.rateKey;
                  return (
                    <TouchableOpacity
                      key={detail.rateKey}
                      style={[styles.rateRow, isSelected && styles.rateRowSelected]}
                      onPress={() => setSelectedRate({ ...detail, questions: modality.questions })}
                    >
                      <View style={{ flex: 1 }}>
                        {detail.languages?.[0]?.description && (
                          <Text style={styles.rateLanguage}>{detail.languages[0].description}</Text>
                        )}
                        {detail.sessions?.[0]?.name && (
                          <Text style={styles.rateSession}>Session: {detail.sessions[0].name}</Text>
                        )}
                        {rate.freeCancellation === false && (
                          <Text style={styles.rateCancellation}>Non-refundable</Text>
                        )}
                      </View>
                      <View>
                        <Text style={styles.ratePrice}>
                          {activity?.currency} {Number(detail.totalAmount?.amount || 0).toLocaleString()}
                        </Text>
                        {!!formatInrEquivalent(detail.totalAmount?.amount, activity?.currency) && (
                          <Text style={styles.ratePriceInr}>
                            {formatInrEquivalent(detail.totalAmount?.amount, activity?.currency)}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'chevron-forward'}
                        size={20}
                        color={isSelected ? Colors.primary : Colors.textMuted}
                        style={{ marginLeft: 10 }}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {selectedRate && (
        <View style={styles.footer}>
          {breakdown && (
            <View style={styles.breakdownBox}>
              {breakdown.lines.map((line, index) => (
                <View key={index} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{line.label}</Text>
                  <Text style={styles.breakdownAmount}>
                    {activity?.currency} {Number(line.lineTotal).toLocaleString()}
                  </Text>
                </View>
              ))}
              <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                <Text style={styles.breakdownTotalLabel}>Total</Text>
                <Text style={styles.breakdownTotalAmount}>
                  {activity?.currency} {Number(breakdown.total).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => {
              // Confirm requires from/to to span exactly the modality's
              // duration (e.g. a 1-day pass needs from === to) - confirmed
              // live that passing the broader search date range instead
              // gets rejected as "rateKey ... does not exist", which reads
              // like an invalid-key error but is actually a date mismatch.
              // operationDates lists the specific valid date(s) for this
              // rate; default to the first one rather than the search range.
              const bookingDates = selectedRate.operationDates?.[0];
              navigation.navigate('ActivityBooking', {
                activityCode,
                name: activity?.content?.name || name,
                rateKey: selectedRate.rateKey,
                from: bookingDates?.from || from,
                to: bookingDates?.to || to,
                adults,
                childAges,
                price: selectedRate.totalAmount?.amount,
                currency: activity?.currency,
                questions: selectedRate.questions || [],
                paxAmounts: selectedRate.paxAmounts || [],
              });
            }}
          >
            <Text style={styles.continueButtonText}>Continue with this option</Text>
          </TouchableOpacity>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginHorizontal: 10,
    textAlign: 'center',
  },
  centerState: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 14,
  },
  activityName: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.text,
  },
  destination: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  description: {
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  modalityCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  modalityName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  childAgeNote: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: -4,
    marginBottom: 8,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    borderRadius: 10,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 6,
    marginTop: 8,
  },
  rateRowSelected: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  rateLanguage: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
  rateSession: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rateCancellation: {
    fontSize: 11,
    color: Colors.error,
    marginTop: 2,
  },
  ratePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  ratePriceInr: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'right',
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  breakdownBox: {
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  breakdownAmount: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 6,
    paddingTop: 8,
  },
  breakdownTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  breakdownTotalAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ActivityDetailScreen;
