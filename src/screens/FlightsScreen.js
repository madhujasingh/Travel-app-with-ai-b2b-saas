import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const FlightsScreen = ({ navigation }) => {
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [passengers, setPassengers] = useState('1');

  const flights = [
    {
      id: 1,
      airline: 'Air India',
      flightNo: 'AI-302',
      from: 'Delhi',
      to: 'Mumbai',
      departure: '06:00 AM',
      arrival: '08:15 AM',
      duration: '2h 15m',
      price: 4500,
      stops: 'Non-stop',
      image: 'airplane',
    },
    {
      id: 2,
      airline: 'IndiGo',
      flightNo: '6E-201',
      from: 'Delhi',
      to: 'Mumbai',
      departure: '09:30 AM',
      arrival: '11:45 AM',
      duration: '2h 15m',
      price: 3800,
      stops: 'Non-stop',
      image: 'airplane',
    },
    {
      id: 3,
      airline: 'Vistara',
      flightNo: 'UK-945',
      from: 'Delhi',
      to: 'Mumbai',
      departure: '02:00 PM',
      arrival: '04:20 PM',
      duration: '2h 20m',
      price: 5200,
      stops: 'Non-stop',
      image: 'airplane',
    },
    {
      id: 4,
      airline: 'SpiceJet',
      flightNo: 'SG-402',
      from: 'Delhi',
      to: 'Mumbai',
      departure: '06:45 PM',
      arrival: '09:00 PM',
      duration: '2h 15m',
      price: 3500,
      stops: 'Non-stop',
      image: 'airplane',
    },
  ];

  const renderFlight = ({ item }) => (
    <TouchableOpacity style={styles.flightCard} activeOpacity={0.8}>
      <View style={styles.flightHeader}>
        <View style={styles.airlineInfo}>
          <Ionicons name={item.image} size={26} color={Colors.primary} style={styles.flightImage} />
          <View>
            <Text style={styles.airlineName}>{item.airline}</Text>
            <Text style={styles.flightNo}>{item.flightNo}</Text>
          </View>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
          <Text style={styles.perPerson}>per person</Text>
        </View>
      </View>

      <View style={styles.flightDetails}>
        <View style={styles.timeContainer}>
          <Text style={styles.time}>{item.departure}</Text>
          <Text style={styles.city}>{item.from}</Text>
        </View>

        <View style={styles.durationContainer}>
          <Text style={styles.duration}>{item.duration}</Text>
          <View style={styles.durationLine}>
            <View style={styles.dot} />
            <View style={styles.line} />
            <Ionicons name="airplane" size={14} color={Colors.primary} style={styles.planeIcon} />
            <View style={styles.line} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.stops}>{item.stops}</Text>
        </View>

        <View style={styles.timeContainer}>
          <Text style={styles.time}>{item.arrival}</Text>
          <Text style={styles.city}>{item.to}</Text>
        </View>
      </View>

      <View style={styles.flightFooter}>
        <View style={styles.amenities}>
          <Text style={styles.amenity}>Baggage 15kg</Text>
          <Text style={styles.amenity}>Meal Included</Text>
          <Text style={styles.amenity}>Seat Selection</Text>
        </View>
        <TouchableOpacity style={styles.bookButton}>
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Flights</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Search Form */}
      <View style={styles.searchForm}>
        <View style={styles.inputRow}>
          <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.inputLabel}>From</Text>
            <TextInput
              style={styles.input}
              placeholder="Departure City"
              placeholderTextColor={Colors.textMuted}
              value={fromCity}
              onChangeText={setFromCity}
            />
          </View>
          <TouchableOpacity style={styles.swapButton}>
            <Text style={styles.swapIcon}>⇄</Text>
          </TouchableOpacity>
          <View style={[styles.inputContainer, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.inputLabel}>To</Text>
            <TextInput
              style={styles.input}
              placeholder="Arrival City"
              placeholderTextColor={Colors.textMuted}
              value={toCity}
              onChangeText={setToCity}
            />
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.inputLabel}>Departure</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={Colors.textMuted}
              value={departureDate}
              onChangeText={setDepartureDate}
            />
          </View>
          <View style={[styles.inputContainer, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.inputLabel}>Passengers</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor={Colors.textMuted}
              value={passengers}
              onChangeText={setPassengers}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search Flights</Text>
        </TouchableOpacity>
      </View>

      {/* Flights List */}
      <FlatList
        data={flights}
        renderItem={renderFlight}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
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
  searchForm: {
    backgroundColor: Colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swapButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  swapIcon: {
    fontSize: 20,
    color: Colors.secondary,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 15,
  },
  flightCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  flightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  airlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flightImage: {
    fontSize: 30,
    marginRight: 12,
  },
  airlineName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  flightNo: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  perPerson: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  flightDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  timeContainer: {
    alignItems: 'center',
  },
  time: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  city: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 4,
  },
  durationContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  duration: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 8,
  },
  durationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
  },
  planeIcon: {
    fontSize: 20,
    marginHorizontal: 5,
  },
  stops: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 8,
    fontWeight: '600',
  },
  flightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.background,
  },
  amenities: {
    flexDirection: 'row',
  },
  amenity: {
    fontSize: 12,
    color: Colors.textLight,
    marginRight: 15,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bookButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default FlightsScreen;
