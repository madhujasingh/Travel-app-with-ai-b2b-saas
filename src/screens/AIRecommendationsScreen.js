import React, { useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';

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

const ALGO_OPTIONS = ['hybrid', 'collaborative', 'content'];

const toLower = (v) => (v || '').toLowerCase();

const AIRecommendationsScreen = ({ route, navigation }) => {
  const { budget, destination, people } = route.params || {};
  const canGoBack = navigation.canGoBack();

  const [algorithm, setAlgorithm] = useState('hybrid');
  const [budgetInput, setBudgetInput] = useState(String(budget || '25000'));
  const [destinationInput, setDestinationInput] = useState(destination || '');
  const [peopleInput, setPeopleInput] = useState(String(people || '2'));
  const [mood, setMood] = useState('Relaxed');
  const [weather, setWeather] = useState('Temperate');
  const [loading, setLoading] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [insights, setInsights] = useState({
    budget_upgrade_suggestions: [],
    destination_discovery: [],
  });

  const ctaScale = useRef(new Animated.Value(1)).current;

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

      const sorted = [...(data?.recommendations || [])].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
      setRecommendations(sorted);
      setInsights(data?.insights || { budget_upgrade_suggestions: [], destination_discovery: [] });
    } catch (error) {
      Alert.alert('AI Service', 'Using curated fallback recommendations.');
      const fallback = [
        {
          id: 'fallback-1',
          title: 'Jaipur Heritage Escape',
          destination: 'Jaipur',
          price: Math.max(parsedBudget - 2000, 12000),
          duration: '3 Days / 2 Nights',
          rating: 4.5,
          match_score: 87.4,
          reasons: [`Mood fit: ${mood}`, `Weather fit: ${weather}`, 'Great value for this budget'],
          image: 'business',
        },
      ];
      setRecommendations(fallback);
      setInsights({
        budget_upgrade_suggestions: [
          {
            id: 'fallback-stretch',
            title: 'Goa Premium Beach Escape',
            destination: 'Goa',
            price: parsedBudget + 10000,
            extra_budget_required: 10000,
          },
        ],
        destination_discovery: [
          {
            destination: 'Kerala',
            sample_itinerary: 'Backwaters and Wellness',
            starting_price: parsedBudget * 0.9,
            rating: 4.6,
          },
          {
            destination: 'Manali',
            sample_itinerary: 'Mountain Adventure Circuit',
            starting_price: parsedBudget * 0.85,
            rating: 4.5,
          },
        ],
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.heroBackGlow} />

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
        <View style={styles.formCard}>
          <Text style={styles.formHeading}>Plan Your Perfect Escape</Text>
          <Text style={styles.formHint}>Tell us mood, weather, and budget. We’ll do the rest.</Text>

          <Text style={styles.label}>Mood</Text>
          {renderChips(MOOD_OPTIONS, mood, setMood)}

          <Text style={styles.label}>Preferred Weather</Text>
          {renderChips(WEATHER_OPTIONS, weather, setWeather)}

          <Text style={styles.label}>Destination (optional)</Text>
          <TextInput
            style={styles.input}
            value={destinationInput}
            onChangeText={setDestinationInput}
            placeholder="Not sure? Leave blank and discover"
            placeholderTextColor={Colors.textMuted}
          />

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

          <Text style={styles.label}>Engine</Text>
          <View style={styles.algoRow}>
            {ALGO_OPTIONS.map((algo) => {
              const active = algo === algorithm;
              return (
                <TouchableOpacity
                  key={algo}
                  style={[styles.algoChip, active && styles.algoChipActive]}
                  onPress={() => setAlgorithm(algo)}
                >
                  <Text style={[styles.algoText, active && styles.algoTextActive]}>
                    {algo.charAt(0).toUpperCase() + algo.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {(insights.destination_discovery?.length > 0 || insights.budget_upgrade_suggestions?.length > 0) && (
          <View style={styles.smartSection}>
            <Text style={styles.smartTitle}>Smart Suggestions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {insights.destination_discovery?.map((item) => (
                <View key={`discovery-${item.destination}`} style={styles.smartCard}>
                  <Text style={styles.smartCardTitle}>Try {item.destination}</Text>
                  <Text style={styles.smartCardSub}>{item.sample_itinerary}</Text>
                  <Text style={styles.smartCardPrice}>From INR {Number(item.starting_price).toLocaleString()}</Text>
                </View>
              ))}
              {insights.budget_upgrade_suggestions?.map((item) => (
                <View key={`upgrade-${item.id}`} style={styles.smartCard}>
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
        ) : (
          recommendations.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate('ItineraryDetail', { itinerary: item, destination: item.destination, people: String(parsedPeople) })}
              style={({ pressed }) => [styles.recCard, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.recBanner}>
                <Ionicons name={item.image || 'compass-outline'} size={34} color={Colors.secondary} />
                {item.id === bestId && (
                  <View style={styles.bestPickBadge}>
                    <Text style={styles.bestPickText}>Best Pick</Text>
                  </View>
                )}
                <View style={styles.matchPill}>
                  <Text style={styles.matchPillText}>{item.match_score}%</Text>
                </View>
              </View>

              <View style={styles.recBody}>
                <Text style={styles.recTitle}>{item.title}</Text>
                <Text style={styles.recSub}>{item.destination} • {item.duration}</Text>
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
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3D6C6',
    padding: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
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
    backgroundColor: '#FFF0E6',
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
    backgroundColor: '#FFFDFB',
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
  algoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  algoChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFF1E8',
    paddingVertical: 10,
    alignItems: 'center',
  },
  algoChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  algoText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  algoTextActive: {
    color: Colors.secondary,
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
  smartCard: {
    width: 220,
    marginRight: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#F2D6C6',
    padding: 12,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1D4C5',
    backgroundColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
  },
  recBanner: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: '#FFF0E6',
    borderWidth: 1,
    borderColor: '#F4D5C4',
    paddingHorizontal: 8,
    paddingVertical: 5,
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
    height: 52,
    borderRadius: 14,
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
