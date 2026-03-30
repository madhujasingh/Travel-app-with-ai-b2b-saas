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

const CreatePackageScreen = ({ route, navigation }) => {
  const { request } = route.params || {};
  const [packageName, setPackageName] = useState(request?.destination || '');
  const [description, setDescription] = useState('');
  const [pricePerPerson, setPricePerPerson] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [hotels, setHotels] = useState([]);
  const [activities, setActivities] = useState([]);
  const [itinerary, setItinerary] = useState([]);

  const addHotel = () => {
    setHotels([...hotels, { id: Date.now(), name: '', location: '', rating: '', price: '' }]);
  };

  const addActivity = () => {
    setActivities([...activities, { id: Date.now(), name: '', duration: '', price: '' }]);
  };

  const addDay = () => {
    setItinerary([...itinerary, { id: Date.now(), day: itinerary.length + 1, title: '', activities: '' }]);
  };

  const updateHotel = (id, field, value) => {
    setHotels(hotels.map(hotel => 
      hotel.id === id ? { ...hotel, [field]: value } : hotel
    ));
  };

  const updateActivity = (id, field, value) => {
    setActivities(activities.map(activity => 
      activity.id === id ? { ...activity, [field]: value } : activity
    ));
  };

  const updateItinerary = (id, field, value) => {
    setItinerary(itinerary.map(day => 
      day.id === id ? { ...day, [field]: value } : day
    ));
  };

  const removeHotel = (id) => {
    setHotels(hotels.filter(hotel => hotel.id !== id));
  };

  const removeActivity = (id) => {
    setActivities(activities.filter(activity => activity.id !== id));
  };

  const removeDay = (id) => {
    setItinerary(itinerary.filter(day => day.id !== id));
  };

  const handleSubmit = () => {
    if (!packageName.trim()) {
      Alert.alert('Error', 'Please enter a package name');
      return;
    }
    if (!pricePerPerson && !totalPrice) {
      Alert.alert('Error', 'Please enter pricing information');
      return;
    }

    Alert.alert(
      'Submit Package',
      'Are you sure you want to submit this package to admin?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () => {
            Alert.alert('Success', 'Package submitted successfully!');
            navigation.goBack();
          },
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
        <Text style={styles.headerTitle}>Create Package</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Request Info */}
        {request && (
          <View style={styles.requestInfo}>
            <View style={styles.requestInfoHeader}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.requestInfoTitle}>Request Details</Text>
            </View>
            <Text style={styles.requestInfoText}>
              {request.destination} • {request.customerType} • {request.travelers} travelers
            </Text>
            <Text style={styles.requestInfoBudget}>Budget: {request.budget}</Text>
          </View>
        )}

        {/* Package Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Package Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Package Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Rajasthan Heritage Tour"
              value={packageName}
              onChangeText={setPackageName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the package highlights..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.pricingRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.inputLabel}>Price Per Person</Text>
              <TextInput
                style={styles.input}
                placeholder="₹0"
                value={pricePerPerson}
                onChangeText={setPricePerPerson}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.inputLabel}>Total Price</Text>
              <TextInput
                style={styles.input}
                placeholder="₹0"
                value={totalPrice}
                onChangeText={setTotalPrice}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Hotels */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hotels</Text>
            <TouchableOpacity style={styles.addButton} onPress={addHotel}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addButtonText}>Add Hotel</Text>
            </TouchableOpacity>
          </View>
          {hotels.map((hotel) => (
            <View key={hotel.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Hotel {hotels.indexOf(hotel) + 1}</Text>
                <TouchableOpacity onPress={() => removeHotel(hotel.id)}>
                  <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Hotel Name"
                value={hotel.name}
                onChangeText={(value) => updateHotel(hotel.id, 'name', value)}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={hotel.location}
                onChangeText={(value) => updateHotel(hotel.id, 'location', value)}
              />
              <View style={styles.itemRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10 }]}
                  placeholder="Rating (e.g., 4.5)"
                  value={hotel.rating}
                  onChangeText={(value) => updateHotel(hotel.id, 'rating', value)}
                />
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 10 }]}
                  placeholder="Price per night"
                  value={hotel.price}
                  onChangeText={(value) => updateHotel(hotel.id, 'price', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ))}
        </View>

        {/* Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activities</Text>
            <TouchableOpacity style={styles.addButton} onPress={addActivity}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addButtonText}>Add Activity</Text>
            </TouchableOpacity>
          </View>
          {activities.map((activity) => (
            <View key={activity.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Activity {activities.indexOf(activity) + 1}</Text>
                <TouchableOpacity onPress={() => removeActivity(activity.id)}>
                  <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Activity Name"
                value={activity.name}
                onChangeText={(value) => updateActivity(activity.id, 'name', value)}
              />
              <View style={styles.itemRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 10 }]}
                  placeholder="Duration (e.g., 2 hours)"
                  value={activity.duration}
                  onChangeText={(value) => updateActivity(activity.id, 'duration', value)}
                />
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 10 }]}
                  placeholder="Price"
                  value={activity.price}
                  onChangeText={(value) => updateActivity(activity.id, 'price', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ))}
        </View>

        {/* Day-wise Itinerary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Day-wise Itinerary</Text>
            <TouchableOpacity style={styles.addButton} onPress={addDay}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.addButtonText}>Add Day</Text>
            </TouchableOpacity>
          </View>
          {itinerary.map((day) => (
            <View key={day.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Day {day.day}</Text>
                <TouchableOpacity onPress={() => removeDay(day.id)}>
                  <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Day Title (e.g., Arrival & City Tour)"
                value={day.title}
                onChangeText={(value) => updateItinerary(day.id, 'title', value)}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Activities for the day..."
                value={day.activities}
                onChangeText={(value) => updateItinerary(day.id, 'activities', value)}
                multiline
                numberOfLines={3}
              />
            </View>
          ))}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any special notes or terms..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Ionicons name="paper-plane-outline" size={20} color={Colors.secondary} />
          <Text style={styles.primaryButtonText}>Submit to Admin</Text>
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
  requestInfo: {
    backgroundColor: '#E3F2FD',
    margin: 20,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  requestInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
    marginLeft: 8,
  },
  requestInfoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  requestInfoBudget: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pricingRow: {
    flexDirection: 'row',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 4,
  },
  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  itemRow: {
    flexDirection: 'row',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default CreatePackageScreen;
