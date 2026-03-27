import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const CustomizationScreen = ({ route, navigation }) => {
  const { itinerary, destination, people } = route.params;

  const [selectedPlaces, setSelectedPlaces] = useState([]);
  const [excludedPlaces, setExcludedPlaces] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [selectedActivities, setSelectedActivities] = useState([]);

  const popularPlaces = [
    { id: 1, name: 'Historical Fort', icon: 'business-outline' },
    { id: 2, name: 'Beach Resort', icon: 'sunny-outline' },
    { id: 3, name: 'Mountain Trek', icon: 'trail-sign-outline' },
    { id: 4, name: 'Local Market', icon: 'cart-outline' },
    { id: 5, name: 'Temple Visit', icon: 'flower-outline' },
    { id: 6, name: 'Wildlife Safari', icon: 'paw-outline' },
    { id: 7, name: 'Boat Ride', icon: 'boat-outline' },
    { id: 8, name: 'Museum Tour', icon: 'library-outline' },
  ];

  const activities = [
    { id: 1, name: 'Photography', icon: 'camera-outline' },
    { id: 2, name: 'Food Tasting', icon: 'restaurant-outline' },
    { id: 3, name: 'Shopping', icon: 'cart-outline' },
    { id: 4, name: 'Adventure Sports', icon: 'bicycle-outline' },
    { id: 5, name: 'Spa & Wellness', icon: 'fitness-outline' },
    { id: 6, name: 'Nightlife', icon: 'moon-outline' },
    { id: 7, name: 'Cultural Shows', icon: 'musical-notes-outline' },
    { id: 8, name: 'Yoga & Meditation', icon: 'body-outline' },
  ];

  const togglePlace = (placeId) => {
    if (selectedPlaces.includes(placeId)) {
      setSelectedPlaces(selectedPlaces.filter((id) => id !== placeId));
    } else if (!excludedPlaces.includes(placeId)) {
      setSelectedPlaces([...selectedPlaces, placeId]);
    }
  };

  const toggleExclude = (placeId) => {
    if (excludedPlaces.includes(placeId)) {
      setExcludedPlaces(excludedPlaces.filter((id) => id !== placeId));
    } else if (!selectedPlaces.includes(placeId)) {
      setExcludedPlaces([...excludedPlaces, placeId]);
    }
  };

  const toggleActivity = (activityId) => {
    if (selectedActivities.includes(activityId)) {
      setSelectedActivities(selectedActivities.filter((id) => id !== activityId));
    } else {
      setSelectedActivities([...selectedActivities, activityId]);
    }
  };

  const handleSubmit = () => {
    if (selectedPlaces.length === 0 && selectedActivities.length === 0) {
      Alert.alert('Error', 'Please select at least one place or activity');
      return;
    }

    const customization = {
      itinerary,
      destination,
      people,
      selectedPlaces: popularPlaces.filter((p) => selectedPlaces.includes(p.id)),
      excludedPlaces: popularPlaces.filter((p) => excludedPlaces.includes(p.id)),
      selectedActivities: activities.filter((a) => selectedActivities.includes(a.id)),
      additionalNotes,
    };

    Alert.alert(
      'Customization Saved!',
      'Your customized itinerary has been saved. A travel agent will contact you shortly.',
      [
        {
          text: 'Talk to Agent',
          onPress: () =>
            navigation.navigate('TalkToAgent', { customization }),
        },
        {
          text: 'Add to Cart',
          onPress: () =>
            navigation.navigate('Cart', { customization }),
        },
        {
          text: 'OK',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customize Trip</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Trip Info */}
        <View style={styles.tripInfo}>
          <Text style={styles.tripTitle}>{itinerary.title}</Text>
          <Text style={styles.tripDetails}>
            {destination} • {itinerary.duration} • {people || 1} people
          </Text>
        </View>

        {/* Select Places */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Places to Visit</Text>
          <Text style={styles.sectionSubtitle}>
            Tap to add to your itinerary
          </Text>
          <View style={styles.placesGrid}>
            {popularPlaces.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.placeCard,
                  selectedPlaces.includes(place.id) && styles.placeCardSelected,
                  excludedPlaces.includes(place.id) && styles.placeCardExcluded,
                ]}
                onPress={() => togglePlace(place.id)}
                disabled={excludedPlaces.includes(place.id)}
              >
                <Ionicons name={place.icon} size={20} color={Colors.primary} style={styles.placeIcon} />
                <Text
                  style={[
                    styles.placeName,
                    selectedPlaces.includes(place.id) && styles.placeNameSelected,
                  ]}
                >
                  {place.name}
                </Text>
                {selectedPlaces.includes(place.id) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exclude Places */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Places to Exclude</Text>
          <Text style={styles.sectionSubtitle}>
            Tap to remove from your itinerary
          </Text>
          <View style={styles.placesGrid}>
            {popularPlaces.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={[
                  styles.placeCard,
                  excludedPlaces.includes(place.id) && styles.placeCardExcluded,
                  selectedPlaces.includes(place.id) && styles.placeCardSelected,
                ]}
                onPress={() => toggleExclude(place.id)}
                disabled={selectedPlaces.includes(place.id)}
              >
                <Ionicons name={place.icon} size={20} color={Colors.primary} style={styles.placeIcon} />
                <Text
                  style={[
                    styles.placeName,
                    excludedPlaces.includes(place.id) && styles.placeNameExcluded,
                  ]}
                >
                  {place.name}
                </Text>
                {excludedPlaces.includes(place.id) && (
                  <Text style={styles.crossmark}>✗</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Activities</Text>
          <Text style={styles.sectionSubtitle}>
            Select activities you'd like to include
          </Text>
          <View style={styles.activitiesGrid}>
            {activities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={[
                  styles.activityCard,
                  selectedActivities.includes(activity.id) &&
                    styles.activityCardSelected,
                ]}
                onPress={() => toggleActivity(activity.id)}
              >
                <Ionicons name={activity.icon} size={20} color={Colors.primary} style={styles.activityIcon} />
                <Text
                  style={[
                    styles.activityName,
                    selectedActivities.includes(activity.id) &&
                      styles.activityNameSelected,
                  ]}
                >
                  {activity.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any special requests or preferences..."
            placeholderTextColor={Colors.textMuted}
            value={additionalNotes}
            onChangeText={setAdditionalNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Your Customization Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Places Added:</Text>
              <Text style={styles.summaryValue}>{selectedPlaces.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Places Excluded:</Text>
              <Text style={styles.summaryValue}>{excludedPlaces.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Activities:</Text>
              <Text style={styles.summaryValue}>
                {selectedActivities.length}
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.agentButton}
          onPress={() =>
            navigation.navigate('TalkToAgent', {
              itinerary,
              destination,
              people,
              customization: {
                selectedPlaces,
                excludedPlaces,
                selectedActivities,
                additionalNotes,
              },
            })
          }
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.secondary} style={styles.agentIcon} />
          <Text style={styles.agentButtonText}>Talk to Agent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
        >
          <Text style={styles.submitIcon}>✓</Text>
          <Text style={styles.submitButtonText}>Save Customization</Text>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  tripInfo: {
    backgroundColor: Colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  tripDetails: {
    fontSize: 14,
    color: Colors.textLight,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 15,
  },
  placesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  placeCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginRight: '2%',
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  placeCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  placeCardExcluded: {
    borderColor: Colors.error,
    backgroundColor: '#FFE0E0',
    opacity: 0.6,
  },
  placeIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  placeNameSelected: {
    color: Colors.secondary,
  },
  placeNameExcluded: {
    color: Colors.error,
    textDecorationLine: 'line-through',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 18,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  crossmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 18,
    color: Colors.error,
    fontWeight: 'bold',
  },
  activitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activityCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginRight: '2%',
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  activityCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  activityIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  activityNameSelected: {
    color: Colors.secondary,
  },
  notesInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
  },
  summarySection: {
    padding: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.textLight,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
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
  agentButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  agentIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  agentButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1.5,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitIcon: {
    fontSize: 20,
    color: Colors.secondary,
    fontWeight: 'bold',
    marginRight: 8,
  },
  submitButtonText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
});

export default CustomizationScreen;
