import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Alert,
  Animated,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { destinationMediaFor } from '../utils/destinationMedia';

const MOOD_OPTIONS = [
  { label: 'Relaxed', icon: 'leaf-outline' },
  { label: 'Adventurous', icon: 'trail-sign-outline' },
  { label: 'Romantic', icon: 'heart-outline' },
  { label: 'Party', icon: 'musical-notes-outline' },
  { label: 'Spiritual', icon: 'sparkles-outline' },
];

const WEATHER_OPTIONS = [
  { label: 'Warm', icon: 'sunny-outline' },
  { label: 'Cool', icon: 'partly-sunny-outline' },
  { label: 'Cold', icon: 'snow-outline' },
  { label: 'Temperate', icon: 'cloud-outline' },
  { label: 'Rainy', icon: 'rainy-outline' },
];

const MARKET_OPTIONS = [
  { label: 'All', icon: 'globe-outline' },
  { label: 'India', icon: 'business-outline' },
  { label: 'International', icon: 'airplane-outline' },
];

const FALLBACK_DESTINATION_GROUPS = {
  goa: ['Goa', 'Kerala', 'Bali'],
  jaipur: ['Jaipur', 'Udaipur', 'Agra'],
  kerala: ['Kerala', 'Goa', 'Bali'],
  manali: ['Manali', 'Shimla', 'Switzerland'],
  varanasi: ['Varanasi', 'Jaipur', 'Agra'],
  udaipur: ['Udaipur', 'Jaipur', 'Paris'],
  shimla: ['Shimla', 'Manali', 'Switzerland'],
  agra: ['Agra', 'Jaipur', 'Varanasi'],
  paris: ['Paris', 'Udaipur', 'Maldives'],
  tokyo: ['Tokyo', 'Kyoto', 'Singapore'],
  dubai: ['Dubai', 'Singapore', 'Maldives'],
  bali: ['Bali', 'Goa', 'Thailand'],
  maldives: ['Maldives', 'Bali', 'Goa'],
  singapore: ['Singapore', 'Tokyo', 'Dubai'],
  thailand: ['Thailand', 'Bali', 'Goa'],
  switzerland: ['Switzerland', 'Shimla', 'Manali'],
};

const INDIA_DESTINATIONS = new Set(['goa', 'jaipur', 'kerala', 'manali', 'varanasi', 'udaipur', 'shimla', 'agra']);
const INTERNATIONAL_DESTINATIONS = new Set([
  'paris',
  'tokyo',
  'dubai',
  'bali',
  'maldives',
  'singapore',
  'thailand',
  'switzerland',
  'kyoto',
  'phuket',
  'krabi',
]);

const toLower = (v) => (v || '').toLowerCase();

const marketForDestination = (destination, title) => {
  const media = destinationMediaFor(destination, title);
  if (media.market && media.market !== 'UNKNOWN') {
    return media.market;
  }

  const normalized = toLower(destination).trim();
  if (INDIA_DESTINATIONS.has(normalized)) {
    return 'INDIA';
  }
  if (INTERNATIONAL_DESTINATIONS.has(normalized)) {
    return 'INTERNATIONAL';
  }
  return 'UNKNOWN';
};

const applyMarketFilter = (items, selectedMarket) => {
  if (selectedMarket === 'All') {
    return items;
  }

  const marketKey = selectedMarket.toUpperCase();
  return items.filter((item) => marketForDestination(item.destination, item.title) === marketKey);
};

const buildFallbackRecommendations = ({ destinationInput, parsedBudget, mood, weather }) => {
  const normalizedDestination = toLower(destinationInput).trim();
  const destinations = FALLBACK_DESTINATION_GROUPS[normalizedDestination] || ['Jaipur', 'Goa', 'Kerala'];

  return destinations.map((place, index) => ({
    id: `fallback-${place.toLowerCase()}-${index}`,
    title: index === 0 ? `${place} Match Escape` : `${place} Discovery Escape`,
    destination: place,
    price: Math.max(parsedBudget - 2000 + (index * 4500), 12000),
    duration: `${4 + index} Days / ${3 + index} Nights`,
    rating: 4.4 + (index * 0.1),
    match_score: 89 - (index * 4.5),
    reasons: [
      normalizedDestination && place.toLowerCase() === normalizedDestination
        ? `Matches destination: ${place}`
        : `Works well for ${mood.toLowerCase()} travel`,
      `Weather fit: ${weather}`,
      'Offline smart fallback',
    ],
    image: index === 0 ? 'sparkles-outline' : index === 1 ? 'compass-outline' : 'airplane-outline',
    ...destinationMediaFor(place, `${place} Escape`),
  }));
};

const buildFallbackInsights = ({ destinationInput, parsedBudget }) => {
  const normalizedDestination = toLower(destinationInput).trim();
  const destinations = FALLBACK_DESTINATION_GROUPS[normalizedDestination] || ['Goa', 'Kerala', 'Manali'];
  const discoveryTargets = destinations.slice(1).length ? destinations.slice(1) : ['Kerala', 'Manali'];

  return {
    budget_upgrade_suggestions: [
      {
        id: 'fallback-stretch',
        title: `${destinations[0]} Premium Escape`,
        destination: destinations[0],
        price: parsedBudget + 10000,
        extra_budget_required: 10000,
      },
    ],
    destination_discovery: discoveryTargets.map((place, index) => ({
      destination: place,
      sample_itinerary: `${place} Curated Journey`,
      starting_price: parsedBudget * (0.9 + index * 0.05),
      rating: 4.5 + index * 0.1,
    })),
  };
};

const AIRecommendationsScreen = ({ route, navigation }) => {
  const { budget, destination, people } = route.params || {};
  const canGoBack = navigation.canGoBack();

  const algorithm = 'hybrid';
  const [budgetInput, setBudgetInput] = useState(String(budget || '25000'));
  const [destinationInput, setDestinationInput] = useState(destination || '');
  const [peopleInput, setPeopleInput] = useState(String(people || '2'));
  const [mood, setMood] = useState('Relaxed');
  const [weather, setWeather] = useState('Temperate');
  const [market, setMarket] = useState('All');
  const [loading, setLoading] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [insights, setInsights] = useState({
    budget_upgrade_suggestions: [],
    destination_discovery: [],
  });

  const ctaScale = useRef(new Animated.Value(1)).current;
  const hasAutoRequested = useRef(false);

  const parsedBudget = useMemo(() => Number(budgetInput || 0), [budgetInput]);
  const parsedPeople = useMemo(() => Number(peopleInput || 1), [peopleInput]);

  const animateCta = (toValue) => {
    Animated.spring(ctaScale, {
      toValue,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const adjustBudget = (delta) => {
    const current = Number(budgetInput || 0);
    const next = Math.max(5000, current + delta);
    setBudgetInput(String(next));
  };

  const adjustPeople = (delta) => {
    const current = Number(peopleInput || 1);
    const next = Math.max(1, current + delta);
    setPeopleInput(String(next));
  };

  const fetchRecommendations = async () => {
    if (!parsedBudget || parsedBudget <= 0) {
      Alert.alert('Budget required', 'Please enter a valid budget.');
      return;
    }
    if (!parsedPeople || parsedPeople <= 0) {
      Alert.alert('People required', 'Please enter at least 1 traveler.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        user_preferences: {
          budget: parsedBudget,
          destination: destinationInput.trim() ? destinationInput.trim() : null,
          num_people: parsedPeople,
          travel_style: 'balanced',
          mood: toLower(mood),
          weather_preference: toLower(weather),
          interests: [],
        },
        num_recommendations: 6,
        recommendation_type: algorithm,
      };

      const response = await fetch(`${API_CONFIG.AI_SERVICE_URL}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to generate recommendations');
      }

      const enriched = [...(data?.recommendations || [])]
        .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
        .map((item) => ({ ...item, ...destinationMediaFor(item.destination, item.title) }));
      const filteredRecommendations = applyMarketFilter(enriched, market);
      const filteredDiscovery = applyMarketFilter(data?.insights?.destination_discovery || [], market);

      setRecommendations(filteredRecommendations);
      setInsights({
        budget_upgrade_suggestions: data?.insights?.budget_upgrade_suggestions || [],
        destination_discovery: filteredDiscovery,
      });
    } catch (error) {
      Alert.alert('AI Service', 'Using curated fallback recommendations.');
      const fallback = applyMarketFilter(buildFallbackRecommendations({
        destinationInput,
        parsedBudget,
        mood,
        weather,
      }), market);
      setRecommendations(fallback);
      const fallbackInsights = buildFallbackInsights({ destinationInput, parsedBudget });
      setInsights({
        ...fallbackInsights,
        destination_discovery: applyMarketFilter(fallbackInsights.destination_discovery || [], market),
      });
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const renderChips = (items, selectedValue, onSelect) => (
    <View style={styles.chipWrap}>
      {items.map((item) => {
        const active = selectedValue === item.label;
        return (
          <TouchableOpacity
            key={item.label}
            activeOpacity={0.86}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(item.label)}
          >
            <Ionicons
              name={item.icon}
              size={15}
              color={active ? Colors.secondary : Colors.primaryDark}
              style={styles.chipIcon}
            />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const bestId = recommendations.length ? recommendations[0].id : null;

  useEffect(() => {
    if (hasAutoRequested.current) {
      return;
    }

    const hasEnoughContext = Number(budget || budgetInput) > 0 || (destination || '').trim();
    if (!hasEnoughContext) {
      return;
    }

    hasAutoRequested.current = true;
    fetchRecommendations();
  }, []);

  useEffect(() => {
    if (!hasAutoRequested.current) {
      return;
    }
    fetchRecommendations();
  }, [market]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.heroBackGlow} />
      <View style={styles.heroBackGlowSecondary} />

      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={22} color={Colors.secondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navSpacer} />
        )}
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>AI Trip Planner</Text>
          <Text style={styles.headerSub}>Travel suggestions tuned to your vibe</Text>
        </View>
        <View style={styles.navButton}>
          <Ionicons name="sparkles" size={20} color={Colors.secondary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroOrbLarge} />
          <View style={styles.heroOrbSmall} />
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={13} color={Colors.secondary} />
            <Text style={styles.heroBadgeText}>Trained hybrid engine</Text>
          </View>
          <Text style={styles.heroHeadline}>Design a trip that feels like you.</Text>
          <Text style={styles.heroDescription}>
            Tell us your vibe, budget, and travel mood. We’ll surface the most relevant escapes instantly.
          </Text>
          <View style={styles.heroMetrics}>
            <View style={styles.heroMetricPill}>
              <Text style={styles.heroMetricValue}>AI</Text>
              <Text style={styles.heroMetricLabel}>Ranked Picks</Text>
            </View>
            <View style={styles.heroMetricPill}>
              <Text style={styles.heroMetricValue}>{parsedPeople || 1}</Text>
              <Text style={styles.heroMetricLabel}>Travelers</Text>
            </View>
            <View style={styles.heroMetricPill}>
              <Text style={styles.heroMetricValue}>₹{Math.max(parsedBudget || 0, 5000).toLocaleString()}</Text>
              <Text style={styles.heroMetricLabel}>Budget Lens</Text>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formHeading}>Plan Your Perfect Escape</Text>
          <Text style={styles.formHint}>Tell us mood, weather, and budget. We’ll do the rest.</Text>

          <Text style={styles.label}>Mood</Text>
          {renderChips(MOOD_OPTIONS, mood, setMood)}

          <Text style={styles.label}>Preferred Weather</Text>
          {renderChips(WEATHER_OPTIONS, weather, setWeather)}

          <Text style={styles.label}>Trip Lane</Text>
          {renderChips(MARKET_OPTIONS, market, setMarket)}

          <Text style={styles.label}>Destination (optional)</Text>
          <View style={styles.searchInputRow}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchInputIcon} />
              <TextInput
                style={styles.searchInput}
                value={destinationInput}
                onChangeText={setDestinationInput}
                placeholder="Search destination or leave blank to discover"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={fetchRecommendations}
              />
            </View>
            <TouchableOpacity style={styles.searchActionButton} onPress={fetchRecommendations} activeOpacity={0.88}>
              <Ionicons name="arrow-forward" size={16} color={Colors.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={styles.stepperBlock}>
              <Text style={styles.label}>Budget</Text>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => adjustBudget(-5000)} style={styles.stepperBtn}>
                  <Ionicons name="remove" size={16} color={Colors.primaryDark} />
                </TouchableOpacity>
                <View style={styles.stepperValueWrap}>
                  <TextInput
                    style={styles.stepperInput}
                    value={budgetInput}
                    onChangeText={setBudgetInput}
                    keyboardType="numeric"
                    placeholder="25000"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Text style={styles.stepperMeta}>INR</Text>
                </View>
                <TouchableOpacity onPress={() => adjustBudget(5000)} style={styles.stepperBtn}>
                  <Ionicons name="add" size={16} color={Colors.primaryDark} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperBlock}>
              <Text style={styles.label}>Travelers</Text>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => adjustPeople(-1)} style={styles.stepperBtn}>
                  <Ionicons name="remove" size={16} color={Colors.primaryDark} />
                </TouchableOpacity>
                <View style={styles.stepperValueWrap}>
                  <TextInput
                    style={styles.stepperInput}
                    value={peopleInput}
                    onChangeText={setPeopleInput}
                    keyboardType="numeric"
                    placeholder="2"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Text style={styles.stepperMeta}>people</Text>
                </View>
                <TouchableOpacity onPress={() => adjustPeople(1)} style={styles.stepperBtn}>
                  <Ionicons name="add" size={16} color={Colors.primaryDark} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Recommendation Engine</Text>
          <View style={styles.engineCard}>
            <View style={styles.engineIconWrap}>
              <Ionicons name="hardware-chip-outline" size={18} color={Colors.secondary} />
            </View>
            <View style={styles.engineCopy}>
              <Text style={styles.engineTitle}>Trained Hybrid Recommender</Text>
              <Text style={styles.engineText}>
                Uses your dataset-backed model plus rule-based ranking for stronger matches and fallback stability.
              </Text>
            </View>
          </View>
          <View style={styles.engineFootnote}>
            <Ionicons name="sparkles-outline" size={14} color={Colors.primaryDark} />
            <Text style={styles.engineFootnoteText}>
              Powered by a trained model using real travel interaction data and filtered by your India or International choice.
            </Text>
          </View>
        </View>

        {(insights.destination_discovery?.length > 0 || insights.budget_upgrade_suggestions?.length > 0) && (
          <View style={styles.smartSection}>
            <Text style={styles.smartTitle}>Smart Suggestions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {insights.destination_discovery?.map((item) => (
                <View key={`discovery-${item.destination}`} style={styles.smartCard}>
                  <View style={styles.smartCardTop}>
                    <View style={styles.smartIconWrap}>
                      <Ionicons name="compass-outline" size={15} color={Colors.secondary} />
                    </View>
                  </View>
                  <Text style={styles.smartCardTitle}>Try {item.destination}</Text>
                  <Text style={styles.smartCardSub}>{item.sample_itinerary}</Text>
                  <Text style={styles.smartCardPrice}>From INR {Number(item.starting_price).toLocaleString()}</Text>
                </View>
              ))}
              {insights.budget_upgrade_suggestions?.map((item) => (
                <View key={`upgrade-${item.id}`} style={styles.smartCard}>
                  <View style={styles.smartCardTop}>
                    <View style={styles.smartIconWrap}>
                      <Ionicons name="trending-up-outline" size={15} color={Colors.secondary} />
                    </View>
                  </View>
                  <Text style={styles.smartCardTitle}>Budget Upgrade Pick</Text>
                  <Text style={styles.smartCardSub}>{item.destination}</Text>
                  <Text style={styles.smartCardPrice}>+INR {Number(item.extra_budget_required || 0).toLocaleString()}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingTitle}>Designing your next trip...</Text>
            <Text style={styles.loadingSub}>Matching mood, weather, budget, and destination style.</Text>
          </View>
        ) : recommendations.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="sparkles-outline" size={26} color={Colors.primary} />
            <Text style={styles.emptyTitle}>No matches in this trip lane yet</Text>
            <Text style={styles.emptySub}>
              Try switching between India and International, or loosen the destination to discover more options.
            </Text>
          </View>
        ) : (
          recommendations.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate('ItineraryDetail', { itinerary: item, destination: item.destination, people: String(parsedPeople) })}
              style={({ pressed }) => [styles.recCard, pressed && { opacity: 0.9 }]}
            >
              <Image source={{ uri: item.imageUrl }} style={styles.recImage} />
              <View style={styles.recBanner}>
                <Ionicons name={item.image || 'compass-outline'} size={34} color={Colors.secondary} />
                <View style={styles.recBannerRight}>
                  {item.id === bestId && (
                    <View style={styles.bestPickBadge}>
                      <Text style={styles.bestPickText}>Best Pick</Text>
                    </View>
                  )}
                  <View style={styles.matchPill}>
                    <Text style={styles.matchPillText}>{item.match_score}% match</Text>
                  </View>
                </View>
              </View>

              <View style={styles.recBody}>
                <Text style={styles.recTitle}>{item.title}</Text>
                <Text style={styles.recSub}>{item.destination} • {item.duration}</Text>
                <Text style={styles.recBlurb}>{item.blurb}</Text>
                <Text style={styles.recPrice}>INR {Number(item.price).toLocaleString()}</Text>

                <View style={styles.tagRow}>
                  <View style={styles.tag}>
                    <Ionicons name="cash-outline" size={12} color={Colors.primaryDark} />
                    <Text style={styles.tagText}>Budget Fit</Text>
                  </View>
                  <View style={styles.tag}>
                    <Ionicons name="leaf-outline" size={12} color={Colors.primaryDark} />
                    <Text style={styles.tagText}>{mood}</Text>
                  </View>
                  <View style={styles.tag}>
                    <Ionicons name="sunny-outline" size={12} color={Colors.primaryDark} />
                    <Text style={styles.tagText}>{weather}</Text>
                  </View>
                </View>

                <View style={styles.quickFactCard}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.primary} />
                  <Text style={styles.quickFactText}>{item.quickFact}</Text>
                </View>

                <TouchableOpacity
                  style={styles.placeStoryButton}
                  onPress={() => navigation.navigate('AIPlaceInsight', { recommendation: item })}
                >
                  <Text style={styles.placeStoryButtonText}>View Place Details</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primaryDark} />
                </TouchableOpacity>

                <View style={styles.reasonWrap}>
                  {(item.reasons || []).slice(0, 2).map((reason, idx) => (
                    <Text key={`${item.id}-r-${idx}`} style={styles.reasonText}>• {reason}</Text>
                  ))}
                </View>
              </View>
            </Pressable>
          ))
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.ctaDock}>
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <Pressable
            onPressIn={() => animateCta(0.97)}
            onPressOut={() => animateCta(1)}
            onPress={fetchRecommendations}
            style={styles.ctaButton}
          >
            {loading ? (
              <ActivityIndicator color={Colors.secondary} />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={Colors.secondary} style={{ marginRight: 8 }} />
                <Text style={styles.ctaText}>Generate Recommendations</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF6EF',
  },
  heroBackGlow: {
    position: 'absolute',
    top: -130,
    right: -70,
    width: 280,
    height: 280,
    borderRadius: 150,
    backgroundColor: 'rgba(246,106,42,0.16)',
  },
  heroBackGlowSecondary: {
    position: 'absolute',
    top: 220,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 150,
    backgroundColor: 'rgba(255,155,106,0.12)',
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSpacer: { width: 30 },
  headerTextWrap: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    color: Colors.secondary,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSub: {
    color: Colors.secondary,
    opacity: 0.9,
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  heroOrbLarge: {
    position: 'absolute',
    top: -24,
    right: -10,
    width: 118,
    height: 118,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroOrbSmall: {
    position: 'absolute',
    bottom: -18,
    right: 72,
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroHeadline: {
    color: Colors.secondary,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginTop: 14,
    maxWidth: '88%',
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: '88%',
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  heroMetricPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  heroMetricValue: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: '800',
  },
  heroMetricLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F3D6C6',
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 7,
  },
  formHeading: {
    fontSize: 22,
    color: Colors.text,
    fontWeight: '800',
  },
  formHint: {
    marginTop: 4,
    color: Colors.textLight,
    fontSize: 13,
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: Colors.text,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  searchInputIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: Colors.text,
  },
  searchActionButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F2CDB8',
    backgroundColor: '#FFF6F0',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  chipIcon: { marginRight: 6 },
  chipText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: Colors.secondary,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  stepperBlock: {
    flex: 1,
  },
  stepper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    paddingVertical: 0,
    textAlign: 'center',
    minWidth: 72,
  },
  stepperMeta: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: -1,
  },
  engineCard: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF6F1',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1D0BC',
    padding: 12,
  },
  engineIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  engineCopy: {
    flex: 1,
  },
  engineTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  engineText: {
    marginTop: 3,
    color: Colors.textLight,
    fontSize: 12,
    lineHeight: 17,
  },
  engineFootnote: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engineFootnoteText: {
    flex: 1,
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  smartSection: {
    marginTop: 16,
  },
  smartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
  },
  smartCardTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  smartIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartCard: {
    width: 220,
    marginRight: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#F2D6C6',
    padding: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  smartCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  smartCardSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textLight,
  },
  smartCardPrice: {
    marginTop: 8,
    color: Colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyWrap: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#F0D6C7',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
  },
  loadingWrap: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: '#F0D6C7',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  loadingTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  loadingSub: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
  },
  recCard: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1D4C5',
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  recImage: {
    width: '100%',
    height: 168,
    backgroundColor: '#F3D9CB',
  },
  recBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recBannerRight: {
    alignItems: 'flex-end',
  },
  bestPickBadge: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bestPickText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '800',
  },
  matchPill: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  matchPillText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '800',
  },
  recBody: { padding: 12 },
  recTitle: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '800',
  },
  recSub: {
    marginTop: 4,
    color: Colors.textLight,
    fontSize: 12,
  },
  recBlurb: {
    marginTop: 8,
    color: Colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  recPrice: {
    marginTop: 7,
    color: Colors.primaryDark,
    fontWeight: '800',
    fontSize: 20,
  },
  tagRow: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: '#F4D5C4',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  quickFactCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4EC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2D8C8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickFactText: {
    marginLeft: 6,
    flex: 1,
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  placeStoryButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF9F5',
    borderWidth: 1,
    borderColor: '#F3D9CB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placeStoryButtonText: {
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  tagText: {
    marginLeft: 4,
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  reasonWrap: {
    marginTop: 9,
    gap: 3,
  },
  reasonText: {
    color: Colors.textLight,
    fontSize: 12,
  },
  ctaDock: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  ctaButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: '#C9460E',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaText: {
    color: Colors.secondary,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default AIRecommendationsScreen;
