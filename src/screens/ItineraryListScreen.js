import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { getSampleItineraries } from '../data/sampleItineraries';
import { marketForDestination } from '../data/packageDestinations';
import { useAuth } from '../context/AuthContext';

const TYPE_TO_ICON = {
  budget: 'wallet-outline',
  premium: 'sparkles',
  adventure: 'trail-sign',
  family: 'people',
  romantic: 'heart',
};

const normalizeItinerary = (item) => {
  const normalizedType = item.type ? item.type.toLowerCase() : 'premium';

  return {
    ...item,
    type: normalizedType,
    image: item.imageUrl || TYPE_TO_ICON[normalizedType] || 'briefcase-outline',
    // An admin-uploaded cover photo lives on the server, not in the row - the
    // icon above stays as the fallback for packages without one.
    photoUri: item.hasImage ? `${API_CONFIG.BASE_URL}/itineraries/${item.id}/image` : null,
    rating: Number(item.rating || 0),
    reviews: Number(item.reviewCount || 0),
    price: Number(item.price || 0),
    highlights: item.highlights || [],
    inclusions: item.inclusions || [],
    exclusions: item.exclusions || [],
    dayPlans: (item.dayPlans || []).map((plan) => ({
      ...plan,
      day: plan.dayNumber,
      activities: (plan.activities || []).map((activity) => ({
        ...activity,
        icon: activity.icon || 'ellipse-outline',
      })),
    })),
  };
};

const ItineraryListScreen = ({ route, navigation }) => {
  const { requireAuth } = useAuth();
  const { centeredContent } = useResponsive();
  const { destination, budget, people, adults, children, type } = route.params;
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchItineraries = async () => {
      try {
        let data = [];

        // Always include sample data first (detailed itineraries)
        if (destination) {
          const sampleData = getSampleItineraries(destination);
          if (sampleData.length > 0) {
            data = [...sampleData];
            console.log(`Added ${sampleData.length} sample itineraries for ${destination}`);
          }
        }

        // Then try to get additional itineraries from API. Home sends a
        // destination, a budget, or both - with no destination there is
        // nothing to generate for, so /search answers from existing inventory
        // (ours and anything Gemini generated on an earlier search) instead.
        try {
          if (destination || budget) {
            const searchQuery = destination
              ? `destination=${encodeURIComponent(destination)}`
              : `budget=${encodeURIComponent(budget)}`;
            const searchResponse = await fetch(
              `${API_CONFIG.BASE_URL}/itineraries/search?${searchQuery}`
            );

            if (searchResponse.ok) {
              const apiData = await searchResponse.json();
              if (apiData && apiData.length > 0) {
                // Filter out duplicates by title to avoid showing sample data twice
                const existingTitles = new Set(data.map(item => item.title));
                const uniqueApiData = apiData.filter(item => !existingTitles.has(item.title));
                data = [...data, ...uniqueApiData];
                console.log(`Added ${uniqueApiData.length} additional API itineraries for ${destination}`);
              }
            }
          }

          // If still no data, try general API endpoint. A budget-only search
          // is already an authoritative answer over the whole catalogue, so an
          // empty result there means nothing is affordable - falling back to
          // three arbitrary packages would only get budget-filtered away below.
          if (data.length === 0 && destination) {
            const fallbackResponse = await fetch(`${API_CONFIG.BASE_URL}/itineraries`);

            if (fallbackResponse.ok) {
              const apiData = await fallbackResponse.json();
              if (apiData && apiData.length > 0) {
                // Filter by destination if available, otherwise take first few
                let filteredApiData = apiData;
                if (destination) {
                  filteredApiData = apiData.filter(item =>
                    item.destination?.toLowerCase().includes(destination.toLowerCase()) ||
                    item.title?.toLowerCase().includes(destination.toLowerCase())
                  );
                }
                // Take only a few to not overwhelm
                data = filteredApiData.slice(0, 3);
                console.log(`Added ${data.length} fallback API itineraries`);
              }
            }
          }
        } catch (apiError) {
          console.log('API not available, using only sample data:', apiError.message);
        }

        // If still no data at all, show empty state
        if (data.length === 0) {
          console.log(`No itineraries available for ${destination}`);
          setItineraries([]);
          setLoading(false);
          return;
        }

        const normalized = data.map(normalizeItinerary);
        let filtered = normalized;

        if (budget) {
          const budgetNum = parseInt(budget, 10);
          filtered = normalized.filter((item) => item.price <= budgetNum * 1.2);
        }

        setItineraries(filtered);
      } catch (error) {
        console.error('Error loading itineraries', error);
        // Final fallback to sample data only
        if (destination) {
          const sampleData = getSampleItineraries(destination);
          const normalized = sampleData.map(normalizeItinerary);
          let filtered = normalized;

          if (budget) {
            const budgetNum = parseInt(budget, 10);
            filtered = normalized.filter((item) => item.price <= budgetNum * 1.2);
          }

          setItineraries(filtered);
        } else {
          setItineraries([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchItineraries();
  }, [destination, budget]);

  const getFilteredItineraries = () => {
    let list = itineraries;

    // `type` is the market the traveller picked - india or international.
    // It arrives from the Packages landing and used to be ignored entirely,
    // so both markets showed the same packages. Note item.type is the tier
    // (budget/premium/luxury) and is unrelated, which is what hid this.
    //
    // Packages carry no market of their own, so it is derived from the
    // destination name. An unrecognised destination is kept rather than
    // hidden: that means the destination lists need extending, and silently
    // dropping the package would be worse than showing it.
    if (type === 'india' || type === 'international') {
      const wanted = type.toUpperCase();
      list = list.filter((item) => {
        // Packages carry their own category - INDIA or INTERNATIONAL - set when
        // they're authored and by the AI generator too. Trust it when present.
        const category = String(item.category || '').toUpperCase();
        if (category === 'INDIA' || category === 'INTERNATIONAL') {
          return category === wanted;
        }
        // Only older or imported rows lack one; fall back to reading the
        // destination name, and keep anything still unrecognised rather than
        // making a sellable package unreachable.
        const market = marketForDestination(item.destination);
        return market === null || market === type;
      });
    }

    if (filter === 'all') return list;
    return list.filter((item) => item.type === filter);
  };

  const handleItineraryPress = (itinerary) => {
    navigation.navigate('ItineraryDetail', {
      itinerary,
      // A budget-only search has no destination of its own, so the package's
      // own destination is the only one that means anything downstream.
      destination: destination || itinerary.destination,
      people,
      adults,
      children,
    });
  };

  const renderItinerary = ({ item }) => (
    <TouchableOpacity
      style={styles.itineraryCard}
      onPress={() => handleItineraryPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={styles.cardPhoto} resizeMode="cover" />
        ) : (
          <Ionicons name={item.image} size={60} color={Colors.secondary} style={styles.cardImage} />
        )}
        {item.aiGenerated ? (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={11} color={Colors.secondary} />
            <Text style={styles.aiBadgeText}>AI Suggested</Text>
          </View>
        ) : null}
        <View style={styles.cardBadge}>
          <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDuration}>{item.duration}</Text>

        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color={Colors.warning} />
          <Text style={styles.rating}>{item.rating}</Text>
          <Text style={styles.reviews}>({item.reviews} reviews)</Text>
        </View>

        <View style={styles.highlightsContainer}>
          {item.highlights.map((highlight, index) => (
            <View key={index} style={styles.highlightBadge}>
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Starting from</Text>
            <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
            <Text style={styles.perPerson}>per person</Text>
          </View>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => handleItineraryPress(item)}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'budget', label: 'Budget' },
    { id: 'premium', label: 'Premium' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'family', label: 'Family' },
    { id: 'romantic', label: 'Romantic' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Itineraries</Text>
          <Text style={styles.headerSubtitle}>
            {destination || (budget ? `Anywhere under \u20B9${Number(budget).toLocaleString()}` : 'All packages')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('CustomerTabs', { screen: 'CartTab' })}>
          <Ionicons name="cart" size={24} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item: filterItem }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === filterItem.id && styles.filterChipActive,
              ]}
              onPress={() => setFilter(filterItem.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === filterItem.id && styles.filterChipTextActive,
                ]}
              >
                {filterItem.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Itineraries List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Finding best itineraries...</Text>
        </View>
      ) : (
        <FlatList
          data={getFilteredItineraries()}
          renderItem={renderItinerary}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContainer, centeredContent]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={52} color={Colors.primary} style={styles.emptyIcon} />
              {/* Customer-facing: this used to read "Add one in the backend and
                  it will appear here", which is an instruction to us, not to a
                  traveller. Offer a way onward instead of a dead end. */}
              <Text style={styles.emptyTitle}>No packages here yet</Text>
              <Text style={styles.emptyText}>
                {destination
                  ? `We don't have a package ready for ${destination} right now. Try another destination, or talk to us and we'll build one for you.`
                  : budget
                    ? `Nothing in our packages comes in under \u20B9${Number(budget).toLocaleString()} yet. Try a higher budget or name a destination, and we'll build something for you.`
                    : "We don't have a package matching that yet. Try another destination, or talk to us and we'll build one for you."}
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => requireAuth(() => navigation.navigate('TalkToAgent'), 'Sign in to chat with a travel expert.')}
              >
                <Ionicons name="headset-outline" size={18} color={Colors.secondary} />
                <Text style={styles.emptyCtaText}>Plan it with an expert</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Talk to Agent Button */}
      <TouchableOpacity
        style={styles.talkToAgentButton}
        onPress={() =>
          requireAuth(
            () =>
            navigation.navigate('TalkToAgent', {
              destination,
              budget,
              people,
              adults,
              children,
              itineraries: getFilteredItineraries(),
            }),
            'Sign in to chat with a travel expert.'
          )
        }
      >
        <Ionicons name="chatbubble-ellipses" size={22} color={Colors.secondary} style={styles.talkToAgentIcon} />
        <Text style={styles.talkToAgentText}>Talk to Travel Agent</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  emptyCtaText: { color: Colors.secondary, fontSize: 14, fontWeight: '700' },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 10,
  },
  headerContent: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.secondary,
    opacity: 0.8,
  },
  filtersContainer: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.secondary,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: Colors.textLight,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 100,
  },
  itineraryCard: {
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
  cardHeader: {
    backgroundColor: Colors.primaryLight,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  cardImage: {},
  // Negative margins cancel cardHeader's padding so a real photo reaches the
  // card's edges, where the icon it replaces was meant to sit inset instead.
  cardPhoto: {
    alignSelf: 'stretch',
    height: 160,
    marginHorizontal: -20,
    marginVertical: -20,
  },
  aiBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  cardBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  cardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  cardDuration: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  rating: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginRight: 5,
    marginLeft: 4,
  },
  reviews: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  highlightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  highlightBadge: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  highlightText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  cardFooter: {
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
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  perPerson: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  viewButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  viewButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
  },
  talkToAgentButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  talkToAgentIcon: {
    marginRight: 10,
  },
  talkToAgentText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ItineraryListScreen;
