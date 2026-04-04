import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { adaptItineraryToWeather, fetchDestinationWeatherForecast } from '../utils/weatherPlanner';

const ItineraryDetailScreen = ({ route, navigation }) => {
  const { itinerary, destination, people, adults, children } = route.params;
  const dayPlans = itinerary.dayPlans || [];
  const [selectedDay, setSelectedDay] = useState(0);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherBundle, setWeatherBundle] = useState(null);
  const [weatherError, setWeatherError] = useState('');
  const heroIcon = itinerary.image || itinerary.imageUrl || 'briefcase-outline';
  const inclusions = itinerary.inclusions || [];
  const exclusions = itinerary.exclusions || [];
  const highlights = itinerary.highlights || [];
  const reviewCount = itinerary.reviews ?? itinerary.reviewCount ?? 0;
  const effectiveDestination = destination || itinerary.destination;

  useEffect(() => {
    let active = true;

    const loadWeather = async () => {
      if (!effectiveDestination) {
        return;
      }

      setWeatherLoading(true);
      setWeatherError('');

      try {
        const forecast = await fetchDestinationWeatherForecast(
          effectiveDestination,
          Math.max(dayPlans.length || 0, 3)
        );
        if (active) {
          setWeatherBundle(forecast);
        }
      } catch (error) {
        if (active) {
          setWeatherError(error.message || 'Unable to load live weather');
        }
      } finally {
        if (active) {
          setWeatherLoading(false);
        }
      }
    };

    loadWeather();
    return () => {
      active = false;
    };
  }, [dayPlans.length, effectiveDestination]);

  const weatherAdaptation = useMemo(
    () => adaptItineraryToWeather(dayPlans, weatherBundle?.daily || []),
    [dayPlans, weatherBundle]
  );
  const selectedPlan = weatherAdaptation.adaptedDayPlans[selectedDay] || dayPlans[selectedDay];

  const handleAddToCart = () => {
    Alert.alert(
      'Added to Cart!',
      `${itinerary.title} has been added to your cart.`,
      [
        {
          text: 'View Cart',
          onPress: () => navigation.navigate('Cart', { itinerary, destination, people, adults, children }),
        },
        {
          text: 'Continue Browsing',
          style: 'cancel',
        },
      ]
    );
  };

  const handleCustomize = () => {
    navigation.navigate('Customization', {
      itinerary,
      destination,
      people,
      adults,
      children,
    });
  };

  const handleTalkToAgent = () => {
    navigation.navigate('TalkToAgent', {
      itinerary,
      destination,
      people,
      adults,
      children,
    });
  };

  const handlePlanWithGroup = () => {
    navigation.navigate('GroupTripPlanner', {
      seedItinerary: itinerary,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Itinerary Details</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart" size={24} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Ionicons name={heroIcon} size={80} color={Colors.secondary} style={styles.heroImage} />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <Text style={styles.heroDuration}>{itinerary.duration}</Text>
            <View style={styles.heroRating}>
              <Ionicons name="star" size={16} color={Colors.warning} />
              <Text style={styles.ratingText}>{itinerary.rating}</Text>
              <Text style={styles.reviewText}>({reviewCount} reviews)</Text>
            </View>
          </View>
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Package Price</Text>
            <Text style={styles.priceAmount}>
              ₹{itinerary.price.toLocaleString()}
            </Text>
            <Text style={styles.pricePerPerson}>per person</Text>
            {people && (
              <Text style={styles.totalPrice}>
                Total: ₹{(itinerary.price * parseInt(people, 10)).toLocaleString()} for {people} people
                {adults || children ? ` (${adults || 0} adults, ${children || 0} children)` : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.groupPlanSection}>
          <View style={styles.groupPlanCard}>
            <View style={styles.groupPlanCopy}>
              <Text style={styles.groupPlanTitle}>Planning this with friends?</Text>
              <Text style={styles.groupPlanText}>
                Use this land package as your base plan, then let the group vote on stays, activities, and dining picks.
              </Text>
            </View>
            <TouchableOpacity style={styles.groupPlanButton} onPress={handlePlanWithGroup}>
              <Ionicons name="people-outline" size={18} color={Colors.secondary} style={styles.groupPlanButtonIcon} />
              <Text style={styles.groupPlanButtonText}>Plan With Group</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weatherSection}>
          <View style={styles.weatherCard}>
            <View style={styles.weatherHeader}>
              <View>
                <Text style={styles.weatherTitle}>Weather-adaptive forecast</Text>
                <Text style={styles.weatherSub}>
                  Live outlook for {weatherBundle?.locationName || effectiveDestination}
                </Text>
              </View>
              <View style={styles.weatherHeaderIcon}>
                <Ionicons name="rainy-outline" size={18} color={Colors.secondary} />
              </View>
            </View>

            {weatherLoading ? (
              <Text style={styles.weatherLoadingText}>Fetching live forecast and trip adjustments...</Text>
            ) : weatherError ? (
              <Text style={styles.weatherErrorText}>{weatherError}</Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.weatherStrip}>
                  {(weatherBundle?.daily || []).map((day, index) => (
                    <View key={`${day.date}-${index}`} style={styles.weatherDayCard}>
                      <Text style={styles.weatherDayLabel}>Day {index + 1}</Text>
                      <Ionicons name={day.icon} size={18} color={Colors.primary} style={styles.weatherDayIcon} />
                      <Text style={styles.weatherDaySummary}>{day.summary}</Text>
                      <Text style={styles.weatherDayTemp}>
                        {Math.round(day.temperatureMax)}° / {Math.round(day.temperatureMin)}°
                      </Text>
                      <Text style={styles.weatherDayRain}>{day.precipitationProbability}% rain</Text>
                    </View>
                  ))}
                </ScrollView>

                {weatherAdaptation.alerts.length > 0 ? (
                  <View style={styles.alertPanel}>
                    <Text style={styles.alertPanelTitle}>Live Trip Alerts</Text>
                    {weatherAdaptation.alerts.map((alert) => (
                      <View key={`${alert.dayNumber}-${alert.title}`} style={styles.alertCard}>
                        <View style={styles.alertTopRow}>
                          <Text style={styles.alertDay}>Day {alert.dayNumber}</Text>
                          <Text style={styles.alertSummary}>{alert.forecast?.summary}</Text>
                        </View>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                        <Text style={styles.alertText}>{alert.summary}</Text>
                        {alert.alternatives.slice(0, 1).map((alternative, index) => (
                          <Text key={`${alert.dayNumber}-alt-${index}`} style={styles.alertAlternative}>
                            Indoor alternative: {alternative}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.alertSafeCard}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
                    <Text style={styles.alertSafeText}>No weather disruptions detected for the current forecast window.</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Highlights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Highlights</Text>
          <View style={styles.highlightsGrid}>
            {highlights.map((highlight, index) => (
              <View key={index} style={styles.highlightItem}>
                <Ionicons name="sparkles" size={16} color={Colors.primary} style={styles.highlightIcon} />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Day-wise Itinerary */}
        {dayPlans.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Day-wise Plan</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayTabs}
          >
            {dayPlans.map((plan, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayTab,
                  selectedDay === index && styles.dayTabActive,
                ]}
                onPress={() => setSelectedDay(index)}
              >
                <Text
                  style={[
                    styles.dayTabText,
                    selectedDay === index && styles.dayTabTextActive,
                  ]}
                >
                  Day {plan.day || plan.dayNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.dayPlanCard}>
            <Text style={styles.dayPlanTitle}>{selectedPlan.title}</Text>
            {selectedPlan?.forecast ? (
              <View style={styles.dayWeatherBanner}>
                <View style={styles.dayWeatherLeft}>
                  <Ionicons name={selectedPlan.forecast.icon} size={18} color={Colors.primary} />
                  <Text style={styles.dayWeatherTitle}>{selectedPlan.forecast.summary}</Text>
                </View>
                <Text style={styles.dayWeatherMeta}>
                  {Math.round(selectedPlan.forecast.temperatureMax)}° / {Math.round(selectedPlan.forecast.temperatureMin)}°
                </Text>
              </View>
            ) : null}
            {selectedPlan?.weatherAlert ? (
              <View style={styles.dayAlertBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.secondary} style={styles.dayAlertIcon} />
                <Text style={styles.dayAlertText}>{selectedPlan.weatherAlert}</Text>
              </View>
            ) : null}
            {(selectedPlan.activities || []).map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <Ionicons name={activity.icon || 'ellipse-outline'} size={18} color={Colors.primary} style={styles.activityIcon} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                  <Text style={styles.activityText}>{activity.activity}</Text>
                  {selectedPlan.flaggedActivities?.find((item) => item.title === activity.activity) ? (
                    <View style={styles.activityWeatherNote}>
                      <Text style={styles.activityWeatherFlag}>Outdoor risk flagged</Text>
                      <Text style={styles.activityWeatherAlt}>
                        {selectedPlan.flaggedActivities.find((item) => item.title === activity.activity)?.alternative}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
        )}

        {/* Inclusions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Included</Text>
          <View style={styles.inclusionsList}>
            {inclusions.map((item, index) => (
              <View key={index} style={styles.inclusionItem}>
                <Text style={styles.checkIcon}>✓</Text>
                <Text style={styles.inclusionText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Exclusions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Not Included</Text>
          <View style={styles.exclusionsList}>
            {exclusions.map((item, index) => (
              <View key={index} style={styles.exclusionItem}>
                <Text style={styles.crossIcon}>✗</Text>
                <Text style={styles.exclusionText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 200 }} />
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.customizeButton}
          onPress={handleCustomize}
        >
          <Ionicons name="create-outline" size={20} color={Colors.primary} style={styles.customizeIcon} />
          <Text style={styles.customizeButtonText}>Customize</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.agentButton}
          onPress={handleTalkToAgent}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.primary} style={styles.agentIcon} />
          <Text style={styles.agentButtonText}>Talk to Agent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addToCartButton}
          onPress={handleAddToCart}
        >
          <Ionicons name="cart-outline" size={20} color={Colors.secondary} style={styles.addToCartIcon} />
          <Text style={styles.addToCartButtonText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
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
  backButton: {
    fontSize: 28,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  cartIcon: {
    fontSize: 24,
  },
  heroSection: {
    backgroundColor: Colors.primaryLight,
    padding: 30,
    alignItems: 'center',
    position: 'relative',
  },
  heroImage: {
    fontSize: 80,
    marginBottom: 15,
  },
  heroOverlay: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.secondary,
    textAlign: 'center',
    marginBottom: 5,
  },
  heroDuration: {
    fontSize: 16,
    color: Colors.secondary,
    opacity: 0.9,
    marginBottom: 10,
  },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    marginRight: 5,
    marginLeft: 4,
  },
  reviewText: {
    fontSize: 14,
    color: Colors.secondary,
    opacity: 0.8,
  },
  priceSection: {
    padding: 20,
  },
  priceCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 5,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  pricePerPerson: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  totalPrice: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    backgroundColor: Colors.background,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  groupPlanSection: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  groupPlanCard: {
    backgroundColor: '#FFF1E8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0D4C1',
  },
  groupPlanCopy: {
    marginBottom: 14,
  },
  groupPlanTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  groupPlanText: {
    fontSize: 14,
    color: Colors.textLight,
    lineHeight: 20,
    marginTop: 6,
  },
  groupPlanButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  groupPlanButtonIcon: {
    marginRight: 8,
  },
  groupPlanButtonText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '700',
  },
  weatherSection: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  weatherCard: {
    backgroundColor: '#FFF4EC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0D6C7',
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  weatherSub: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 4,
  },
  weatherHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherLoadingText: {
    marginTop: 14,
    color: Colors.textLight,
    lineHeight: 20,
  },
  weatherErrorText: {
    marginTop: 14,
    color: Colors.error,
    lineHeight: 20,
  },
  weatherStrip: {
    marginTop: 16,
  },
  weatherDayCard: {
    width: 112,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weatherDayLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  weatherDayIcon: {
    marginTop: 10,
  },
  weatherDaySummary: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '700',
    marginTop: 10,
  },
  weatherDayTemp: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 8,
  },
  weatherDayRain: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
  },
  alertPanel: {
    marginTop: 16,
  },
  alertPanelTitle: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: 10,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F4D8CA',
    padding: 14,
    marginBottom: 10,
  },
  alertTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertDay: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  alertSummary: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  alertTitle: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '700',
    marginTop: 8,
  },
  alertText: {
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 19,
    marginTop: 6,
  },
  alertAlternative: {
    fontSize: 13,
    color: Colors.primaryDark,
    lineHeight: 19,
    marginTop: 8,
    fontWeight: '600',
  },
  alertSafeCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D6EFD8',
  },
  alertSafeText: {
    flex: 1,
    marginLeft: 10,
    color: Colors.textLight,
    lineHeight: 19,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  highlightText: {
    fontSize: 14,
    color: Colors.text,
  },
  dayTabs: {
    marginBottom: 15,
  },
  dayTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.card,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  dayTabTextActive: {
    color: Colors.secondary,
  },
  dayPlanCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dayPlanTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  dayWeatherBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  dayWeatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayWeatherTitle: {
    marginLeft: 8,
    color: Colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  dayWeatherMeta: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  dayAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  dayAlertIcon: {
    marginRight: 8,
  },
  dayAlertText: {
    flex: 1,
    color: Colors.secondary,
    lineHeight: 18,
    fontSize: 12,
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 15,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityText: {
    fontSize: 16,
    color: Colors.text,
  },
  activityWeatherNote: {
    marginTop: 8,
    backgroundColor: '#FFF3EA',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1D5C4',
  },
  activityWeatherFlag: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  activityWeatherAlt: {
    color: Colors.textLight,
    lineHeight: 18,
    marginTop: 4,
    fontSize: 12,
  },
  inclusionsList: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 15,
  },
  inclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  checkIcon: {
    fontSize: 18,
    color: Colors.success,
    fontWeight: 'bold',
    marginRight: 12,
    width: 25,
  },
  inclusionText: {
    fontSize: 16,
    color: Colors.text,
  },
  exclusionsList: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 15,
  },
  exclusionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  crossIcon: {
    fontSize: 18,
    color: Colors.error,
    fontWeight: 'bold',
    marginRight: 12,
    width: 25,
  },
  exclusionText: {
    fontSize: 16,
    color: Colors.text,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    padding: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  customizeButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  customizeIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  customizeButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  agentButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  agentIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  agentButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  addToCartButton: {
    flex: 1.5,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  addToCartIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  addToCartButtonText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
});

export default ItineraryDetailScreen;
