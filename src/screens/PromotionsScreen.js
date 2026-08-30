import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import PromoBannerCarousel from '../components/PromoBannerCarousel';

// One section per known banner placement - add an entry here whenever a new
// placement is introduced elsewhere in the app (see PromoBannerCarousel
// usages in HomeScreen/HotelsScreen).
const CATEGORIES = [
  { placement: 'HOME', label: 'Holiday Deals', icon: 'airplane' },
  { placement: 'HOTELS', label: 'Hotel Offers', icon: 'bed' },
];

const PromotionsScreen = () => {
  const [countsByPlacement, setCountsByPlacement] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      CATEGORIES.map((category) =>
        fetch(`${API_CONFIG.BASE_URL}/promo-banners/${category.placement}`)
          .then((res) => res.json())
          .then((data) => [category.placement, Array.isArray(data) ? data.length : 0])
          .catch(() => [category.placement, 0])
      )
    ).then((entries) => {
      if (!cancelled) {
        setCountsByPlacement(Object.fromEntries(entries));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCategories = CATEGORIES.filter((category) => countsByPlacement[category.placement] > 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="pricetags" size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>Deals & Promotions</Text>
        <Text style={styles.heroSubtitle}>Handpicked offers, just for you</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : visibleCategories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No promotions right now - check back soon!</Text>
          </View>
        ) : (
          visibleCategories.map((category) => (
            <View key={category.placement} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBadge}>
                  <Ionicons name={category.icon} size={16} color={Colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>{category.label}</Text>
              </View>
              <PromoBannerCarousel placement={category.placement} />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    paddingTop: 30,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 4,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  loader: {
    marginTop: 60,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
});

export default PromotionsScreen;
