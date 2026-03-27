import React, { useState } from 'react';
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

const ItineraryDetailScreen = ({ route, navigation }) => {
  const { itinerary, destination, people, adults, children } = route.params;
  const [selectedDay, setSelectedDay] = useState(0);

  const dayPlans = [
    {
      day: 1,
      title: 'Arrival & City Exploration',
      activities: [
        { time: '09:00 AM', activity: 'Airport Pickup & Hotel Check-in', icon: 'car-outline' },
        { time: '12:00 PM', activity: 'Lunch at Local Restaurant', icon: 'restaurant-outline' },
        { time: '02:00 PM', activity: 'City Tour - Main Attractions', icon: 'business-outline' },
        { time: '06:00 PM', activity: 'Sunset View Point', icon: 'sunny-outline' },
        { time: '08:00 PM', activity: 'Welcome Dinner', icon: 'wine-outline' },
      ],
    },
    {
      day: 2,
      title: 'Cultural Heritage Day',
      activities: [
        { time: '08:00 AM', activity: 'Breakfast at Hotel', icon: 'cafe-outline' },
        { time: '10:00 AM', activity: 'Visit Historical Monuments', icon: 'library-outline' },
        { time: '01:00 PM', activity: 'Traditional Lunch', icon: 'restaurant' },
        { time: '03:00 PM', activity: 'Local Market Shopping', icon: 'cart-outline' },
        { time: '07:00 PM', activity: 'Cultural Performance', icon: 'musical-notes-outline' },
      ],
    },
    {
      day: 3,
      title: 'Adventure & Nature',
      activities: [
        { time: '06:00 AM', activity: 'Sunrise Trek', icon: 'sunny' },
        { time: '09:00 AM', activity: 'Breakfast', icon: 'cafe' },
        { time: '11:00 AM', activity: 'Adventure Activities', icon: 'bicycle-outline' },
        { time: '02:00 PM', activity: 'Picnic Lunch', icon: 'basket-outline' },
        { time: '05:00 PM', activity: 'Nature Walk', icon: 'leaf-outline' },
      ],
    },
  ];

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
          <Ionicons name={itinerary.image || 'briefcase-outline'} size={80} color={Colors.secondary} style={styles.heroImage} />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{itinerary.title}</Text>
            <Text style={styles.heroDuration}>{itinerary.duration}</Text>
            <View style={styles.heroRating}>
              <Ionicons name="star" size={16} color={Colors.warning} />
              <Text style={styles.ratingText}>{itinerary.rating}</Text>
              <Text style={styles.reviewText}>({itinerary.reviews} reviews)</Text>
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

        {/* Highlights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Highlights</Text>
          <View style={styles.highlightsGrid}>
            {itinerary.highlights.map((highlight, index) => (
              <View key={index} style={styles.highlightItem}>
                <Ionicons name="sparkles" size={16} color={Colors.primary} style={styles.highlightIcon} />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Day-wise Itinerary */}
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
                  Day {plan.day}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.dayPlanCard}>
            <Text style={styles.dayPlanTitle}>{dayPlans[selectedDay].title}</Text>
            {dayPlans[selectedDay].activities.map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <Ionicons name={activity.icon} size={18} color={Colors.primary} style={styles.activityIcon} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                  <Text style={styles.activityText}>{activity.activity}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Inclusions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's Included</Text>
          <View style={styles.inclusionsList}>
            {[
              'Accommodation',
              'Daily Breakfast',
              'Airport Transfers',
              'Sightseeing',
              'Professional Guide',
              'All Taxes',
            ].map((item, index) => (
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
            {[
              'Airfare',
              'Personal Expenses',
              'Travel Insurance',
              'Optional Activities',
            ].map((item, index) => (
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
