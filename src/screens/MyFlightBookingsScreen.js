import React, { useCallback, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/Colors';

const HOLDS_STORAGE_KEY = 'itinera.flightHolds';

const MyFlightBookingsScreen = ({ navigation }) => {
  const [holds, setHolds] = useState([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const raw = await AsyncStorage.getItem(HOLDS_STORAGE_KEY);
        setHolds(raw ? JSON.parse(raw) : []);
      })();
    }, [])
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('FlightBooking', { bookingId: item.bookingId })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.summary}</Text>
        <Text style={[styles.statusBadge, item.status === 'SUCCESS' ? styles.statusSuccess : styles.statusHold]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.cardMeta}>Booking ID: {item.bookingId}</Text>
      <Text style={styles.cardMeta}>₹{Math.round(item.totalFare || 0).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Sandbox Bookings</Text>
        <View style={{ width: 30 }} />
      </View>

      <FlatList
        data={holds}
        keyExtractor={(item) => item.bookingId}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No held or booked fares yet. Review a fare and tap "Hold This Fare" to start one.
          </Text>
        }
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: Colors.secondary,
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusHold: {
    backgroundColor: '#FFF3D6',
    color: '#8A6100',
  },
  statusSuccess: {
    backgroundColor: '#E3F5E5',
    color: Colors.success,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default MyFlightBookingsScreen;
