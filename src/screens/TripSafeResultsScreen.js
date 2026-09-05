import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, StatusBar } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

// The doc's own diagrams disagree on exactly where the fare total (Ifc.TF)
// sits relative to "pi" (see tripsafe-api/13-open-questions-to-verify.txt,
// item 4) - tries every shape actually seen across the doc's samples rather
// than trusting one, and falls back to null (UI shows "View price on next
// step") instead of crashing if none match. Confirm the real shape once a
// live Search response comes back and simplify this to one path.
const extractFare = (planOrProduct) => {
  const candidates = [
    planOrProduct?.Pfd?.Ifc,
    planOrProduct?.pfd?.ifc,
    planOrProduct?.tfd?.ifc,
    planOrProduct?.fd?.ifc,
  ];
  for (const ifc of candidates) {
    const tf = ifc?.TF ?? ifc?.tf;
    if (tf != null) return Number(tf);
  }
  return null;
};

const extractPlanFare = (plan) => {
  const product = plan?.pi?.[0];
  return extractFare(plan) ?? extractFare(product);
};

const TripSafeResultsScreen = ({ route, navigation }) => {
  const { token } = useAuth();
  const { plans, startDate, endDate, travellerAges, regionLabel } = route.params || {};
  const [reviewingPlid, setReviewingPlid] = useState(null);

  const selectPlan = async (plan) => {
    const product = plan?.pi?.[0];
    if (!product?.pid) {
      Alert.alert('Plan Unavailable', 'This plan is missing product details and cannot be selected.');
      return;
    }
    setReviewingPlid(plan.plid);
    try {
      // The Review response's own "bid" IS the booking id the Book API
      // later expects - Review is what allocates it, same pattern as
      // TripJack Flights' AirReview (see tripsafe-api/02-review-api.txt).
      const response = await fetch(`${API_CONFIG.BASE_URL}/tripsafe/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pli: [{ plid: plan.plid, pi: [{ pid: product.pid }] }] }),
      });
      const data = await response.json();
      if (!response.ok || data?.errors) {
        throw new Error(data?.errors?.[0]?.message || data?.message || 'Unable to review this plan right now.');
      }
      const reviewedPlan = data?.isr?.iinfo?.pli?.[0] || plan;
      const reviewedProduct = reviewedPlan?.pi?.[0] || product;
      const fare = extractPlanFare(reviewedPlan) ?? extractPlanFare(plan);
      navigation.navigate('TripSafeBooking', {
        bookingId: data?.bid,
        plan: reviewedPlan,
        product: reviewedProduct,
        fare,
        startDate: data?.sd || startDate,
        endDate: data?.ed || endDate,
        travellerAges,
      });
    } catch (error) {
      Alert.alert('Travel Insurance', error.message || 'Unable to review this plan right now.');
    } finally {
      setReviewingPlid(null);
    }
  };

  const renderCard = ({ item: plan }) => {
    const product = plan?.pi?.[0] || {};
    const planName = product.pi || product.pn || 'Travel Insurance Plan';
    const provider = product.lp || product.Ip || product.ip || '';
    const benefits = (product.pbft || []).slice(0, 3);
    const fare = extractPlanFare(plan);
    const busy = reviewingPlid === plan.plid;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.planName}>{planName}</Text>
            {provider ? <Text style={styles.planProvider}>by {provider}</Text> : null}
            {product.rname ? <Text style={styles.planRegion}>{product.rname}</Text> : null}
          </View>
          <Ionicons name="shield-checkmark" size={26} color={Colors.primary} />
        </View>

        {benefits.length > 0 ? (
          <View style={styles.benefitsBlock}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                <Text style={styles.benefitText} numberOfLines={1}>{benefit.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View>
            {fare != null ? (
              <Text style={styles.fareValue}>₹{fare.toLocaleString()}</Text>
            ) : (
              <Text style={styles.farePending}>Price on next step</Text>
            )}
          </View>
          <TouchableOpacity style={styles.selectButton} onPress={() => selectPlan(plan)} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={Colors.secondary} size="small" />
            ) : (
              <Text style={styles.selectButtonText}>Select This Plan</Text>
            )}
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
        <Text style={styles.headerTitle}>Choose a Plan</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText} numberOfLines={1}>{regionLabel}</Text>
        <Text style={styles.summarySubtext}>
          {startDate} to {endDate} · {travellerAges?.length || 0} traveller{travellerAges?.length === 1 ? '' : 's'}
        </Text>
      </View>

      {(plans || []).length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No plans available for this search.</Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item, index) => item.plid || String(index)}
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
  summaryCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  summarySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderText: {
    flex: 1,
  },
  planName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  planProvider: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  planRegion: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  benefitsBlock: {
    marginTop: 10,
    gap: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 12,
    color: Colors.textLight,
    flex: 1,
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
  farePending: {
    fontSize: 12.5,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  selectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 130,
    alignItems: 'center',
  },
  selectButtonText: {
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

export default TripSafeResultsScreen;
