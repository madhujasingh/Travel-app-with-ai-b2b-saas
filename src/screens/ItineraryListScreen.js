import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';

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
  const { destination, budget, people, adults, children, type } = route.params;
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchItineraries = async () => {
      try {
        let data = [];

        if (destination) {
          const searchResponse = await fetch(
            `${API_CONFIG.BASE_URL}/itineraries/search?destination=${encodeURIComponent(destination)}`
          );

          if (!searchResponse.ok) {
            throw new Error(`Failed to fetch itineraries: ${searchResponse.status}`);
          }

          data = await searchResponse.json();
        }

        if (!destination || data.length === 0) {
          const fallbackResponse = await fetch(`${API_CONFIG.BASE_URL}/itineraries`);

          if (!fallbackResponse.ok) {
            throw new Error(`Failed to fetch itineraries: ${fallbackResponse.status}`);
          }

          data = await fallbackResponse.json();
        }

        const normalized = data.map(normalizeItinerary);
        let filtered = normalized;

        if (budget) {
          const budgetNum = parseInt(budget, 10);
          filtered = normalized.filter((item) => item.price <= budgetNum * 1.2);
        }

        setItineraries(filtered);
      } catch (error) {
        console.error('Error fetching itineraries', error);
        setItineraries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchItineraries();
  }, [destination, budget]);

  const getFilteredItineraries = () => {
    if (filter === 'all') return itineraries;
    return itineraries.filter((item) => item.type === filter);
  };

  const handleItineraryPress = (itinerary) => {
    navigation.navigate('ItineraryDetail', {
      itinerary,
      destination,
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
        <Ionicons name={item.image} size={60} color={Colors.secondary} style={styles.cardImage} />
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
          <Text style={styles.headerSubtitle}>{destination}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
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
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={52} color={Colors.primary} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>
                No itineraries found yet. Add one in the backend and it will appear here.
              </Text>
            </View>
          }
        />
      )}

      {/* Talk to Agent Button */}
      <TouchableOpacity
        style={styles.talkToAgentButton}
        onPress={() =>
          navigation.navigate('TalkToAgent', {
            destination,
            budget,
            people,
            adults,
            children,
            itineraries: getFilteredItineraries(),
          })
        }
      >
        <Ionicons name="chatbubble-ellipses" size={22} color={Colors.secondary} style={styles.talkToAgentIcon} />
        <Text style={styles.talkToAgentText}>Talk to Travel Agent</Text>
      </TouchableOpacity>
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
