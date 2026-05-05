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
import { getDestinationActivities } from '../data/destinationActivities';
import { useCart } from '../context/CartContext';

const CustomizationScreen = ({ route, navigation }) => {
  const { itinerary, destination, people } = route.params;
  const { addItemToCart } = useCart();

  const [customizedDays, setCustomizedDays] = useState({});
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showActivitySelector, setShowActivitySelector] = useState(false);
  const [selectedDayForAdding, setSelectedDayForAdding] = useState(null);
  const [availableActivities, setAvailableActivities] = useState([]);

  // Initialize customized days with the itinerary's day plans
  React.useEffect(() => {
    if (itinerary?.dayPlans) {
      const initialCustomizedDays = {};
      itinerary.dayPlans.forEach((dayPlan) => {
        initialCustomizedDays[dayPlan.dayNumber] = {
          title: dayPlan.title,
          activities: dayPlan.activities.map(activity => ({
            ...activity,
            selected: activity.customizable !== false // Default to selected for customizable activities
          }))
        };
      });
      setCustomizedDays(initialCustomizedDays);
    }
  }, [itinerary]);

  // Load available activities for the destination
  React.useEffect(() => {
    const activities = getDestinationActivities(destination);
    setAvailableActivities(activities);
  }, [destination]);

  const toggleActivity = (dayNumber, activityId) => {
    setCustomizedDays(prev => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: prev[dayNumber].activities.map(activity =>
          activity.id === activityId
            ? { ...activity, selected: !activity.selected }
            : activity
        )
      }
    }));
  };

  const addActivityToDay = (activity, dayNumber) => {
    // Check if activity already exists in this day
    const dayActivities = customizedDays[dayNumber]?.activities || [];
    const activityExists = dayActivities.some(existing => existing.id === activity.id);

    if (activityExists) {
      Alert.alert(
        'Activity Already Added',
        `"${activity.name}" is already included in Day ${dayNumber}. Would you like to add it again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            onPress: () => {
              const newActivity = {
                ...activity,
                selected: true,
                time: activity.time,
                activity: activity.name,
                icon: activity.icon,
                id: `${activity.id}-duplicate-${Date.now()}`, // Make ID unique
              };

              setCustomizedDays(prev => ({
                ...prev,
                [dayNumber]: {
                  ...prev[dayNumber],
                  activities: [...prev[dayNumber].activities, newActivity]
                }
              }));
            }
          }
        ]
      );
    } else {
      const newActivity = {
        ...activity,
        selected: true,
        time: activity.time,
        activity: activity.name,
        icon: activity.icon,
      };

      setCustomizedDays(prev => ({
        ...prev,
        [dayNumber]: {
          ...prev[dayNumber],
          activities: [...prev[dayNumber].activities, newActivity]
        }
      }));
    }
  };

  const openActivitySelector = (dayNumber) => {
    setSelectedDayForAdding(dayNumber);
    setShowActivitySelector(true);
  };





  const handleSubmit = () => {
    // Check if at least some activities are selected
    const hasSelectedActivities = Object.values(customizedDays).some(day =>
      day.activities.some(activity => activity.selected)
    );

    if (!hasSelectedActivities) {
      Alert.alert('Error', 'Please keep at least one activity selected for your trip');
      return;
    }

    const customization = {
      itinerary,
      destination,
      people,
      customizedDays,
      additionalNotes,
    };

    Alert.alert(
      'Customization Saved!',
      'Your day-wise customized itinerary has been saved. A travel agent will contact you shortly.',
      [
        {
          text: 'Talk to Agent',
          onPress: () =>
            navigation.navigate('TalkToAgent', { customization }),
        },
        {
          text: 'Add to Cart',
          onPress: () => {
            // Create cart item from customization
            const cartItem = {
              id: itinerary.id || `customized-${Date.now()}`,
              title: `${itinerary.title} (Customized)`,
              destination: destination,
              duration: itinerary.duration,
              price: itinerary.price,
              people: people || 1,
              adults: people || 0,
              children: 0,
              image: itinerary.image,
              addedAt: new Date().toISOString(),
              customization: {
                customizedDays,
                additionalNotes,
                originalItinerary: itinerary
              },
              isCustomized: true
            };

            addItemToCart(cartItem);

            Alert.alert(
              'Added to Cart!',
              'Your customized itinerary has been added to cart.',
              [
                {
                  text: 'View Cart',
                  onPress: () => navigation.navigate('CustomerTabs', { screen: 'CartTab' }),
                },
                {
                  text: 'Continue',
                  style: 'cancel',
                },
              ]
            );
          },
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
        <TouchableOpacity onPress={() => navigation.navigate('CustomerTabs', { screen: 'CartTab' })}>
          <Ionicons name="cart" size={24} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Trip Info */}
        <View style={styles.tripInfo}>
          <Text style={styles.tripTitle}>{itinerary.title}</Text>
          <Text style={styles.tripDetails}>
            {destination} • {itinerary.duration} • {people || 1} people
          </Text>
        </View>

        {/* Day-wise Customization */}
        {Object.entries(customizedDays).map(([dayNumber, dayData]) => (
          <View key={dayNumber} style={styles.daySection}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>Day {dayNumber}: {dayData.title}</Text>
              <Text style={styles.dayActivityCount}>
                {dayData.activities.filter(a => a.selected).length} of {dayData.activities.length} activities
              </Text>
            </View>

            <View style={styles.activitiesList}>
              {dayData.activities.map((activity) => (
                <TouchableOpacity
                  key={activity.id}
                  style={[
                    styles.activityItem,
                    activity.selected && styles.activityItemSelected,
                    !activity.customizable && styles.activityItemFixed,
                  ]}
                  onPress={() => activity.customizable !== false && toggleActivity(dayNumber, activity.id)}
                  disabled={activity.customizable === false}
                >
                  <View style={styles.activityLeft}>
                    <Ionicons
                      name={activity.icon}
                      size={20}
                      color={activity.selected ? Colors.secondary : Colors.primary}
                      style={styles.activityIcon}
                    />
                    <View style={styles.activityTextContainer}>
                      <Text style={[styles.activityTime, activity.selected && styles.activityTimeSelected]}>
                        {activity.time}
                      </Text>
                      <Text style={[styles.activityName, activity.selected && styles.activityNameSelected]}>
                        {activity.activity}
                      </Text>
                    </View>
                  </View>

                  {activity.customizable !== false && (
                    <View style={[styles.checkbox, activity.selected && styles.checkboxSelected]}>
                      {activity.selected && (
                        <Ionicons name="checkmark" size={16} color={Colors.secondary} />
                      )}
                    </View>
                  )}

                  {activity.customizable === false && (
                    <View style={styles.fixedBadge}>
                      <Text style={styles.fixedText}>Required</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Add Activity Button */}
              <TouchableOpacity
                style={styles.addActivityButton}
                onPress={() => openActivitySelector(dayNumber)}
              >
                <Ionicons name="add-circle-outline" size={20} color={Colors.primary} style={styles.addIcon} />
                <Text style={styles.addActivityText}>Add Activity to Day {dayNumber}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

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
            {Object.entries(customizedDays).map(([dayNumber, dayData]) => (
              <View key={dayNumber} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Day {dayNumber}:</Text>
                <Text style={styles.summaryValue}>
                  {dayData.activities.filter(a => a.selected).length} activities selected
                </Text>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Selected:</Text>
              <Text style={styles.summaryValue}>
                {Object.values(customizedDays).reduce((total, day) =>
                  total + day.activities.filter(a => a.selected).length, 0
                )} activities
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Activity Selector Modal - Outside ScrollView for proper positioning */}
      {showActivitySelector && selectedDayForAdding && (
        <View style={styles.activitySelectorOverlay}>
          <View style={styles.activitySelectorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Activity to Day {selectedDayForAdding}</Text>
              <TouchableOpacity
                onPress={() => setShowActivitySelector(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {availableActivities.map((activity) => (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.availableActivityItem}
                  onPress={() => {
                    addActivityToDay(activity, selectedDayForAdding);
                    setShowActivitySelector(false);
                  }}
                >
                  <View style={styles.availableActivityLeft}>
                    <Ionicons name={activity.icon} size={20} color={Colors.primary} style={styles.availableActivityIcon} />
                    <View style={styles.availableActivityText}>
                      <Text style={styles.availableActivityName}>{activity.name}</Text>
                      <Text style={styles.availableActivityDetails}>
                        {activity.time} • {activity.category}
                      </Text>
                      <Text style={styles.availableActivityDescription} numberOfLines={2}>
                        {activity.description}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="add" size={20} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

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
  daySection: {
    backgroundColor: Colors.card,
    margin: 15,
    marginTop: 0,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dayHeader: {
    backgroundColor: Colors.primary,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
    flex: 1,
  },
  dayActivityCount: {
    fontSize: 12,
    color: Colors.secondary,
    opacity: 0.8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activitiesList: {
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityItemSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  activityItemFixed: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    opacity: 0.8,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityIcon: {
    marginRight: 12,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityTimeSelected: {
    color: Colors.secondary,
  },
  activityName: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  activityNameSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  fixedBadge: {
    backgroundColor: Colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fixedText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: '600',
  },
  addActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
  },
  addIcon: {
    marginRight: 8,
  },
  addActivityText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  activitySelectorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  activitySelectorModal: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  availableActivityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  availableActivityLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  availableActivityIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  availableActivityText: {
    flex: 1,
  },
  availableActivityName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  availableActivityDetails: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  availableActivityDescription: {
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 18,
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
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
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
