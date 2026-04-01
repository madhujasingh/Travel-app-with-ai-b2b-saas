import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

const CustomerProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('preferences');

  // Mock data for demonstration
  const travelPreferences = {
    style: 'Adventure',
    weather: 'Warm',
    favoriteDestinations: ['Goa', 'Bali', 'Maldives'],
    frequency: 'Monthly',
  };

  const aiInsights = [
    { id: 1, text: 'You prefer beach destinations', icon: 'water-outline' },
    { id: 2, text: 'Recommended: Goa, Bali, Phuket', icon: 'location-outline' },
    { id: 3, text: 'Best time to travel: Oct-Mar', icon: 'calendar-outline' },
  ];

  const bookingHistory = [
    { id: 1, destination: 'Goa Beach Package', date: '15 Mar 2026', price: '₹45,000', status: 'Completed' },
    { id: 2, destination: 'Kerala Backwaters', date: '20 Apr 2026', price: '₹62,000', status: 'Upcoming' },
    { id: 3, destination: 'Rajasthan Heritage', date: '10 Feb 2026', price: '₹38,000', status: 'Completed' },
  ];

  const savedTrips = [
    { id: 1, destination: 'Maldives Paradise', price: '₹1,20,000', image: '🏝️' },
    { id: 2, destination: 'Swiss Alps', price: '₹2,50,000', image: '🏔️' },
    { id: 3, destination: 'Tokyo Adventure', price: '₹1,80,000', image: '🗼' },
  ];

  const groupTrips = [
    { id: 1, title: 'College Friends Goa Trip', inviteCode: 'ABC123', members: 8, status: 'Active' },
    { id: 2, title: 'Family Kerala Tour', inviteCode: 'XYZ789', members: 5, status: 'Planning' },
  ];

  const transactions = [
    { id: 1, description: 'Goa Beach Package', amount: '₹45,000', date: '15 Mar 2026', status: 'Paid' },
    { id: 2, description: 'Kerala Backwaters', amount: '₹62,000', date: '20 Mar 2026', status: 'Pending' },
    { id: 3, description: 'Refund - Cancelled Trip', amount: '₹15,000', date: '10 Mar 2026', status: 'Refunded' },
  ];

  const notifications = [
    { id: 1, title: 'Booking Confirmed', message: 'Your Kerala trip is confirmed!', time: '2h ago', read: false },
    { id: 2, title: 'Group Trip Update', message: 'New member joined your Goa trip', time: '5h ago', read: true },
    { id: 3, title: 'Price Drop Alert', message: 'Maldives package now 20% off!', time: '1d ago', read: true },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return '#4CAF50';
      case 'Upcoming': return '#2196F3';
      case 'Cancelled': return '#F44336';
      case 'Paid': return '#4CAF50';
      case 'Pending': return '#FF9800';
      case 'Refunded': return '#9C27B0';
      case 'Active': return '#4CAF50';
      case 'Planning': return '#2196F3';
      default: return '#757575';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'preferences':
        return (
          <View style={styles.tabContent}>
            <View style={styles.preferenceCard}>
              <Text style={styles.preferenceTitle}>Travel Style</Text>
              <View style={styles.preferenceItem}>
                <Ionicons name="compass-outline" size={20} color={Colors.primary} />
                <Text style={styles.preferenceText}>{travelPreferences.style}</Text>
              </View>
            </View>
            <View style={styles.preferenceCard}>
              <Text style={styles.preferenceTitle}>Preferred Weather</Text>
              <View style={styles.preferenceItem}>
                <Ionicons name="sunny-outline" size={20} color={Colors.primary} />
                <Text style={styles.preferenceText}>{travelPreferences.weather}</Text>
              </View>
            </View>
            <View style={styles.preferenceCard}>
              <Text style={styles.preferenceTitle}>Favorite Destinations</Text>
              <View style={styles.destinationsList}>
                {travelPreferences.favoriteDestinations.map((dest, index) => (
                  <View key={index} style={styles.destinationChip}>
                    <Text style={styles.destinationChipText}>{dest}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.preferenceCard}>
              <Text style={styles.preferenceTitle}>Travel Frequency</Text>
              <View style={styles.preferenceItem}>
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                <Text style={styles.preferenceText}>{travelPreferences.frequency}</Text>
              </View>
            </View>
          </View>
        );

      case 'insights':
        return (
          <View style={styles.tabContent}>
            {aiInsights.map((insight) => (
              <View key={insight.id} style={styles.insightCard}>
                <Ionicons name={insight.icon} size={24} color={Colors.primary} />
                <Text style={styles.insightText}>{insight.text}</Text>
              </View>
            ))}
          </View>
        );

      case 'bookings':
        return (
          <View style={styles.tabContent}>
            {bookingHistory.map((booking) => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.bookingDestination}>{booking.destination}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>{booking.status}</Text>
                  </View>
                </View>
                <View style={styles.bookingDetails}>
                  <View style={styles.bookingDetailItem}>
                    <Ionicons name="calendar-outline" size={14} color="#666" />
                    <Text style={styles.bookingDetailText}>{booking.date}</Text>
                  </View>
                  <View style={styles.bookingDetailItem}>
                    <Ionicons name="cash-outline" size={14} color="#666" />
                    <Text style={styles.bookingDetailText}>{booking.price}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        );

      case 'saved':
        return (
          <View style={styles.tabContent}>
            {savedTrips.map((trip) => (
              <TouchableOpacity key={trip.id} style={styles.savedTripCard}>
                <Text style={styles.savedTripImage}>{trip.image}</Text>
                <View style={styles.savedTripInfo}>
                  <Text style={styles.savedTripDestination}>{trip.destination}</Text>
                  <Text style={styles.savedTripPrice}>{trip.price}</Text>
                </View>
                <Ionicons name="heart" size={20} color="#F44336" />
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'groups':
        return (
          <View style={styles.tabContent}>
            {groupTrips.map((trip) => (
              <View key={trip.id} style={styles.groupTripCard}>
                <View style={styles.groupTripHeader}>
                  <Text style={styles.groupTripTitle}>{trip.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(trip.status) }]}>{trip.status}</Text>
                  </View>
                </View>
                <View style={styles.groupTripDetails}>
                  <View style={styles.groupTripDetailItem}>
                    <Ionicons name="key-outline" size={14} color="#666" />
                    <Text style={styles.groupTripDetailText}>Code: {trip.inviteCode}</Text>
                  </View>
                  <View style={styles.groupTripDetailItem}>
                    <Ionicons name="people-outline" size={14} color="#666" />
                    <Text style={styles.groupTripDetailText}>{trip.members} members</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        );

      case 'transactions':
        return (
          <View style={styles.tabContent}>
            {transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <Text style={[styles.transactionAmount, { color: transaction.status === 'Refunded' ? '#4CAF50' : '#333' }]}>
                    {transaction.amount}
                  </Text>
                </View>
                <View style={styles.transactionDetails}>
                  <View style={styles.transactionDetailItem}>
                    <Ionicons name="calendar-outline" size={14} color="#666" />
                    <Text style={styles.transactionDetailText}>{transaction.date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transaction.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(transaction.status) }]}>{transaction.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        );

      case 'notifications':
        return (
          <View style={styles.tabContent}>
            {notifications.map((notification) => (
              <View key={notification.id} style={[styles.notificationCard, !notification.read && styles.unreadNotification]}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationTime}>{notification.time}</Text>
                </View>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
              </View>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ChatInbox')}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImage}>
              <Ionicons name="person" size={40} color={Colors.secondary} />
            </View>
            <TouchableOpacity style={styles.editProfileButton}>
              <Ionicons name="pencil" size={16} color={Colors.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'John Doe'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'john.doe@example.com'}</Text>
          <Text style={styles.userPhone}>{user?.phone || '+91 98765 43210'}</Text>
        </View>

        {/* Tab Navigation */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer}>
          {[
            { key: 'preferences', label: 'Preferences', icon: 'settings-outline' },
            { key: 'insights', label: 'AI Insights', icon: 'bulb-outline' },
            { key: 'bookings', label: 'Bookings', icon: 'calendar-outline' },
            { key: 'saved', label: 'Saved', icon: 'heart-outline' },
            { key: 'groups', label: 'Groups', icon: 'people-outline' },
            { key: 'transactions', label: 'Payments', icon: 'card-outline' },
            { key: 'notifications', label: 'Alerts', icon: 'notifications-outline' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? Colors.secondary : '#666'} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#F44336" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  profileHeader: {
    backgroundColor: Colors.secondary,
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 5,
  },
  activeTabText: {
    color: Colors.secondary,
  },
  tabContent: {
    padding: 15,
  },
  preferenceCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  destinationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  destinationChip: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  destinationChipText: {
    fontSize: 14,
    color: Colors.primary,
  },
  insightCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  bookingCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bookingDestination: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    flexDirection: 'row',
  },
  bookingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  bookingDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  savedTripCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  savedTripImage: {
    fontSize: 30,
    marginRight: 15,
  },
  savedTripInfo: {
    flex: 1,
  },
  savedTripDestination: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  savedTripPrice: {
    fontSize: 14,
    color: '#666',
  },
  groupTripCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  groupTripTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  groupTripDetails: {
    flexDirection: 'row',
  },
  groupTripDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  groupTripDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  transactionCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  notificationCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadNotification: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    marginHorizontal: 15,
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginLeft: 10,
  },
});

export default CustomerProfileScreen;
