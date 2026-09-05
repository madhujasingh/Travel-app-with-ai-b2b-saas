import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, StatusBar } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const SORT_OPTIONS = [
  { value: 'price', label: 'Price: Low to High' },
  { value: 'seats', label: 'Seats: Low to High' },
];

// One card per vehicle group (quotesInfo[]) - each carries its own single
// quote (quotes[0]) per every sample in the docs, so this flattens the two
// levels into one list item rather than nesting a second FlatList.
const CabResultsScreen = ({ route, navigation }) => {
  const { quotesInfo, journeyInfo, routeDetails, journeyType, tripType, passengers } = route.params || {};
  const [sortBy, setSortBy] = useState('price');

  // TripJack always returns every vehicle type available on the route,
  // regardless of passenger count, in whatever order their system happens
  // to list them - not sorted by relevance to this search or by price. A
  // customer sorting by seats still gets the cheapest-first tiebreak within
  // equal capacity, since that's the more common real-world preference.
  const cards = (quotesInfo || [])
    .map((group) => ({ group, quote: group?.quotes?.[0] }))
    .filter((item) => item.quote)
    .sort((a, b) => {
      const priceA = Number(a.quote?.fareBreakup?.totalFare) || 0;
      const priceB = Number(b.quote?.fareBreakup?.totalFare) || 0;
      const seatsA = Number(a.group.paxCapacity) || 0;
      const seatsB = Number(b.group.paxCapacity) || 0;
      if (sortBy === 'seats') {
        return seatsA - seatsB || priceA - priceB;
      }
      return priceA - priceB;
    });

  const renderCard = ({ item }) => {
    const { group, quote } = item;
    const fare = quote.fareBreakup || {};
    const totalFare = Number(fare.totalFare || 0);
    const totalTax = Number(fare.totalTax || 0);
    const inclusions = quote.policies?.inclusions || [];
    const cancellationPolicy = quote.policies?.cancellationPolicy || [];
    const bestRefund = cancellationPolicy.find((p) => p.refundPercentage === 100);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {group.vehicleImages?.[0] ? (
            <Image source={{ uri: group.vehicleImages[0] }} style={styles.vehicleImage} resizeMode="contain" />
          ) : (
            <View style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}>
              <Ionicons name="car-outline" size={28} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.cardHeaderText}>
            <Text style={styles.vehicleLabel}>{group.label}</Text>
            <Text style={styles.vehicleSimilar}>{group.similarType}</Text>
            <View style={styles.capacityRow}>
              <Ionicons name="people-outline" size={13} color={Colors.textLight} />
              {/* paxCapacity/luggageCapacity are the VEHICLE's own max
                  capacity, not the passenger count the customer searched
                  with (that's shown separately in the route summary above) -
                  spelled out with "seats"/"bags" so the numbers don't read
                  as an echo of the search input. */}
              <Text style={styles.capacityText}>{group.paxCapacity} seats</Text>
              <Ionicons name="briefcase-outline" size={13} color={Colors.textLight} style={{ marginLeft: 10 }} />
              <Text style={styles.capacityText}>{group.luggageCapacity} bags</Text>
            </View>
          </View>
        </View>

        {inclusions.length > 0 ? (
          <View style={styles.inclusionsBlock}>
            {inclusions.slice(0, 2).map((inclusion, index) => (
              <View key={index} style={styles.inclusionRow}>
                <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                <Text style={styles.inclusionText} numberOfLines={1}>{inclusion}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {bestRefund ? (
          <Text style={styles.cancellationText}>{bestRefund.description}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.fareValue}>₹{totalFare.toLocaleString()}</Text>
            {totalTax > 0 ? <Text style={styles.fareTaxNote}>incl. ₹{totalTax.toLocaleString()} taxes</Text> : null}
          </View>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() =>
              navigation.navigate('CabBooking', {
                quote,
                group,
                journeyInfo,
                routeDetails,
                journeyType,
                tripType,
                passengers,
              })
            }
          >
            <Text style={styles.bookButtonText}>Book This Cab</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a Cab</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.routeSummaryCard}>
        <Text style={styles.routeSummaryText} numberOfLines={1}>
          {routeDetails?.origin?.displayAddress} → {routeDetails?.destination?.displayAddress}
        </Text>
        <Text style={styles.routeSummarySubtext}>
          {journeyInfo?.distance} · {passengers} passenger{passengers === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.sortChip, sortBy === option.value && styles.sortChipActive]}
            onPress={() => setSortBy(option.value)}
          >
            <Text style={[styles.sortChipText, sortBy === option.value && styles.sortChipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No cabs available for this route.</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item, index) => item.quote?.quotationId || String(index)}
          contentContainerStyle={styles.list}
          renderItem={renderCard}
        />
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
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  routeSummaryCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  routeSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  routeSummarySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sortChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.text,
  },
  sortChipTextActive: {
    color: Colors.secondary,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleImage: {
    width: 72,
    height: 56,
  },
  vehicleImagePlaceholder: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  vehicleLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  vehicleSimilar: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  capacityText: {
    fontSize: 12,
    color: Colors.textLight,
    marginLeft: 4,
  },
  inclusionsBlock: {
    marginTop: 10,
    gap: 4,
  },
  inclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inclusionText: {
    fontSize: 12,
    color: Colors.textLight,
    flex: 1,
  },
  cancellationText: {
    fontSize: 11.5,
    color: Colors.accentBlueDark,
    marginTop: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fareValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  fareTaxNote: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  bookButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});

export default CabResultsScreen;
