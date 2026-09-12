import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import WebHero from '../components/web/WebHero';
import useHeroHeader from '../hooks/useHeroHeader';
import WebStickyHeader from '../components/web/WebStickyHeader';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';
import { AIRLINE_LOGOS } from '../data/airlineLogos';

// TripJack's authoritative status vocabulary (same set used in
// HotelBookingScreen.js's STATUS_LABELS) - PENDING/PAYMENT_PENDING/
// PAYMENT_SUCCESS are non-terminal (still processing), ABORTED/FAILED are
// terminal-dead and distinct from a recoverable ON_HOLD.
const STATUS_META = {
  SUCCESS: { label: 'Confirmed', icon: 'checkmark-circle', bg: '#E3F5E5', fg: Colors.success },
  CANCELLED: { label: 'Cancelled', icon: 'close-circle', bg: '#FBE4E2', fg: Colors.error },
  ON_HOLD: { label: 'On Hold', icon: 'time', bg: '#FFF3D6', fg: '#8A6100' },
  ABORTED: { label: 'Booking Failed', icon: 'close-circle', bg: '#FBE4E2', fg: Colors.error },
  FAILED: { label: 'Booking Failed', icon: 'close-circle', bg: '#FBE4E2', fg: Colors.error },
  PENDING: { label: 'Processing', icon: 'time', bg: '#FFF3D6', fg: '#8A6100' },
  PAYMENT_PENDING: { label: 'Payment Pending', icon: 'time', bg: '#FFF3D6', fg: '#8A6100' },
  PAYMENT_SUCCESS: { label: 'Payment Received - Confirming', icon: 'time', bg: '#FFF3D6', fg: '#8A6100' },
};

const statusMeta = (status) => STATUS_META[status] || { label: status, icon: 'ellipse', bg: '#FFF3D6', fg: '#8A6100' };

// TripJack hold windows are well under an hour - anything still ON_HOLD past
// that has almost certainly expired on TripJack's side and can never reach
// Confirm & Pay. No timestamp at all is treated as stale too, since it can't
// be trusted either way.
const STALE_HOLD_THRESHOLD_MS = 60 * 60 * 1000;

const isStaleHold = (item) => {
  if (item.status !== 'ON_HOLD') return false;
  const createdMs = new Date(item.createdAt).getTime();
  if (Number.isNaN(createdMs)) return true;
  return Date.now() - createdMs > STALE_HOLD_THRESHOLD_MS;
};

const formatWhen = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const MyFlightBookingsScreen = ({ navigation }) => {
  const { centeredContent, isDesktop } = useResponsive();
  const { scrolled, scrollProps } = useHeroHeader();
  const { token } = useAuth();
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        setHolds([]);
        setLoading(false);
        return;
      }

      let active = true;
      (async () => {
        setLoading(true);
        // Flights and hotels are separate endpoints; fetch both and merge into
        // one list so My Trips reads as a trip history rather than a flight log.
        // Settled rather than all, so one failing endpoint doesn't blank the other.
        const load = async (path, kind) => {
          try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data.map((row) => ({ ...row, kind })) : [];
          } catch (error) {
            return [];
          }
        };

        const [flights, hotels] = await Promise.all([
          load('/flight-bookings', 'FLIGHT'),
          load('/hotel-bookings', 'HOTEL'),
        ]);

        if (active) {
          setHolds(
            [...flights, ...hotels].sort(
              (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
            ),
          );
          setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [token])
  );

  // Only flights can be held, so only they can go stale.
  const staleCount = holds.filter((item) => item.kind !== 'HOTEL' && isStaleHold(item)).length;

  const clearStaleHolds = () => {
    if (!staleCount) return;
    const staleItems = holds.filter((item) => item.kind !== 'HOTEL' && isStaleHold(item));
    appAlert(
      'Clear Stale Holds',
      `Remove ${staleCount} on-hold booking${staleCount === 1 ? '' : 's'} that never got confirmed? This won't cancel anything with the airline.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const staleIds = new Set(staleItems.map((item) => item.id));
            setHolds((current) => current.filter((item) => !staleIds.has(item.id)));
            await Promise.all(
              staleItems.map((item) =>
                fetch(`${API_CONFIG.BASE_URL}/flight-bookings/${item.id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {})
              )
            );
          },
        },
      ]
    );
  };

  const renderHotel = (item) => {
    const meta = statusMeta(item.status);
    const stay = [item.checkIn, item.checkOut].filter(Boolean).join(' → ');
    // What the customer paid, falling back to the supplier rate for rows
    // written before the margin breakdown existed.
    const paid = item.customerTotal ?? item.totalFare ?? 0;

    return (
      // Not tappable: there is no read-only hotel booking view yet -
      // HotelBookingScreen needs a reviewResult, which a saved row doesn't have.
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.routeIconWrap}>
            <Ionicons name="business" size={18} color={Colors.primary} />
          </View>
          <View style={styles.cardTopText}>
            <Text style={styles.cardRoute} numberOfLines={1}>
              {item.hotelName || 'Hotel booking'}
            </Text>
            <Text style={styles.cardDate}>
              {[item.cityName, stay].filter(Boolean).join(' · ') || formatWhen(item.createdAt)}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={12} color={meta.fg} />
            <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <Text style={styles.cardBookingId}>Booking ID · {item.tripjackBookingId}</Text>
          <Text style={styles.cardFare}>₹{Math.round(paid).toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    if (item.kind === 'HOTEL') return renderHotel(item);

    const meta = statusMeta(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        // push, not navigate - reusing an existing FlightBooking instance
        // already in the stack would both skip re-fetching this specific
        // booking's details (its fetch effect only runs once on mount) and
        // pop this list screen out of the back stack.
        onPress={() => navigation.push('FlightBooking', { bookingId: item.tripjackBookingId })}
      >
        <View style={styles.cardTop}>
          <View style={styles.routeIconWrap}>
            {AIRLINE_LOGOS[item.airlineCode] ? (
              <Image source={AIRLINE_LOGOS[item.airlineCode]} style={styles.routeAirlineLogo} resizeMode="contain" />
            ) : (
              <Ionicons name="airplane" size={18} color={Colors.primary} />
            )}
          </View>
          <View style={styles.cardTopText}>
            <Text style={styles.cardRoute} numberOfLines={1}>
              {item.routeSummary}
            </Text>
            <Text style={styles.cardDate}>{formatWhen(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={12} color={meta.fg} />
            <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <Text style={styles.cardBookingId}>Booking ID · {item.tripjackBookingId}</Text>
          <Text style={styles.cardFare}>₹{Math.round(item.totalFare || 0).toLocaleString()}</Text>
        </View>

        {item.status === 'SUCCESS' ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => navigation.push('FlightReissue', { bookingId: item.tripjackBookingId })}
            >
              <Ionicons name="calendar-outline" size={14} color={Colors.primaryDark} />
              <Text style={styles.cardActionText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => navigation.push('FlightBooking', { bookingId: item.tripjackBookingId, openCancel: true })}
            >
              <Ionicons name="close-circle-outline" size={14} color={Colors.error} />
              <Text style={[styles.cardActionText, styles.cardActionTextDanger]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {['CANCELLED', 'ABORTED', 'FAILED'].includes(item.status) ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => navigation.navigate('Flights')}
            >
              <Ionicons name="refresh-outline" size={14} color={Colors.primaryDark} />
              <Text style={styles.cardActionText}>Book Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {isDesktop ? (
        <WebHero compact title="My Trips" subtitle="Every flight and hotel you have booked with us." />
      ) : (
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Trips</Text>
        <View style={{ width: 28 }} />
      </View>
      )}

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
      <FlatList
        data={holds}
        keyExtractor={(item) => `${item.kind || 'FLIGHT'}-${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={[holds.length ? styles.listContent : styles.listContentEmpty, centeredContent]}
        {...scrollProps}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          staleCount > 0 ? (
            <View style={styles.staleBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#8A6100" />
              <View style={styles.staleBannerText}>
                <Text style={styles.staleBannerTitle}>
                  {staleCount} old on-hold booking{staleCount === 1 ? '' : 's'}
                </Text>
                <Text style={styles.staleBannerSubtitle}>
                  These never got confirmed and TripJack's hold window has likely expired.
                </Text>
              </View>
              <TouchableOpacity style={styles.staleBannerButton} onPress={clearStaleHolds}>
                <Text style={styles.staleBannerButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="airplane-outline" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptyText}>
              Once you book a flight or a hotel, it'll show up here so you can track its status, add extras, or make changes.
            </Text>
          </View>
        }
      />
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: Colors.secondary,
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3D6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  staleBannerText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  staleBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C4400',
  },
  staleBannerSubtitle: {
    fontSize: 11,
    color: '#8A6100',
    marginTop: 2,
    lineHeight: 15,
  },
  staleBannerButton: {
    backgroundColor: '#8A6100',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  staleBannerButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  routeAirlineLogo: {
    width: 28,
    height: 28,
    borderRadius: 5,
  },
  cardTopText: {
    flex: 1,
  },
  cardRoute: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cardDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBookingId: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardFare: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  cardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  cardActionTextDanger: {
    color: Colors.error,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});

export default MyFlightBookingsScreen;
