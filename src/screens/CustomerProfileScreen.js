import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  Pressable,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';
import { phoneDigits } from '../utils/inputSanitizers';

const BOOKING_TABS = new Set(['bookings', 'transactions']);

const CustomerProfileScreen = ({ navigation }) => {
  const { user, token, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('preferences');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [groupTrips, setGroupTrips] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);

  const [flightBookings, setFlightBookings] = useState([]);
  const [flightBookingsLoading, setFlightBookingsLoading] = useState(false);
  const [flightBookingsLoaded, setFlightBookingsLoaded] = useState(false);

  const [activityBookings, setActivityBookings] = useState([]);
  const [activityBookingsLoading, setActivityBookingsLoading] = useState(false);
  const [activityBookingsLoaded, setActivityBookingsLoaded] = useState(false);

  const [cabBookings, setCabBookings] = useState([]);
  const [cabBookingsLoading, setCabBookingsLoading] = useState(false);
  const [cabBookingsLoaded, setCabBookingsLoaded] = useState(false);

  const [tripsafeBookings, setTripsafeBookings] = useState([]);
  const [tripsafeBookingsLoading, setTripsafeBookingsLoading] = useState(false);
  const [tripsafeBookingsLoaded, setTripsafeBookingsLoaded] = useState(false);

  // This screen stays mounted across navigations (pushed on top of
  // CustomerTabs), so the "loaded once" flags below would otherwise cache a
  // stale/empty result forever - e.g. visiting Bookings before making a
  // booking, then never seeing it after. Reset on focus so the tab effects
  // below actually refetch next time they're viewed.
  useFocusEffect(
    useCallback(() => {
      setBookingsLoaded(false);
      setFlightBookingsLoaded(false);
      setActivityBookingsLoaded(false);
      setCabBookingsLoaded(false);
      setTripsafeBookingsLoaded(false);
    }, [])
  );

  useEffect(() => {
    if (activeTab !== 'groups' || !token) {
      return;
    }

    let active = true;

    const loadGroupTrips = async () => {
      setGroupsLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'Unable to load group trips');
        }
        if (active) {
          setGroupTrips(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (active) {
          setGroupTrips([]);
        }
      } finally {
        if (active) {
          setGroupsLoading(false);
        }
      }
    };

    loadGroupTrips();
    return () => {
      active = false;
    };
  }, [activeTab, token]);

  useEffect(() => {
    if (!BOOKING_TABS.has(activeTab) || !token || !user?.id || bookingsLoaded) {
      return;
    }

    let active = true;

    const loadBookings = async () => {
      setBookingsLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/bookings/user/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Unable to load bookings');
        }
        if (active) {
          setBookings(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (active) {
          setBookings([]);
        }
      } finally {
        if (active) {
          setBookingsLoading(false);
          setBookingsLoaded(true);
        }
      }
    };

    loadBookings();
    return () => {
      active = false;
    };
  }, [activeTab, token, user?.id, bookingsLoaded]);

  // Flight bookings live in their own table (see FlightBooking backend
  // entity) since TripJack's status vocabulary and lack of an Itinerary
  // don't fit the package-booking model - only merged into the "bookings"
  // tab, not "transactions" (flights have no paymentStatus equivalent).
  useEffect(() => {
    if (activeTab !== 'bookings' || !token || flightBookingsLoaded) {
      return;
    }

    let active = true;

    const loadFlightBookings = async () => {
      setFlightBookingsLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/flight-bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Unable to load flight bookings');
        }
        if (active) {
          setFlightBookings(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (active) {
          setFlightBookings([]);
        }
      } finally {
        if (active) {
          setFlightBookingsLoading(false);
          setFlightBookingsLoaded(true);
        }
      }
    };

    loadFlightBookings();
    return () => {
      active = false;
    };
  }, [activeTab, token, flightBookingsLoaded]);

  useEffect(() => {
    if (activeTab !== 'bookings' || !token || activityBookingsLoaded) {
      return;
    }

    let active = true;

    const loadActivityBookings = async () => {
      setActivityBookingsLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/activity-bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Unable to load activity bookings');
        }
        if (active) {
          setActivityBookings(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (active) {
          setActivityBookings([]);
        }
      } finally {
        if (active) {
          setActivityBookingsLoading(false);
          setActivityBookingsLoaded(true);
        }
      }
    };

    loadActivityBookings();
    return () => {
      active = false;
    };
  }, [activeTab, token, activityBookingsLoaded]);

  useEffect(() => {
    if (activeTab !== 'bookings' || !token || cabBookingsLoaded) {
      return;
    }

    let active = true;

    const loadCabBookings = async () => {
      setCabBookingsLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/cab-bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Unable to load cab bookings');
        }
        if (active) {
          setCabBookings(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (active) {
          setCabBookings([]);
        }
      } finally {
        if (active) {
          setCabBookingsLoading(false);
          setCabBookingsLoaded(true);
        }
      }
    };

    loadCabBookings();
    return () => {
      active = false;
    };
  }, [activeTab, token, cabBookingsLoaded]);

  useEffect(() => {
    if (activeTab !== 'bookings' || !token || tripsafeBookingsLoaded) {
      return;
    }

    let active = true;

    const loadTripsafeBookings = async () => {
      setTripsafeBookingsLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/tripsafe-bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Unable to load travel insurance bookings');
        }
        if (active) {
          setTripsafeBookings(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (active) {
          setTripsafeBookings([]);
        }
      } finally {
        if (active) {
          setTripsafeBookingsLoading(false);
          setTripsafeBookingsLoaded(true);
        }
      }
    };

    loadTripsafeBookings();
    return () => {
      active = false;
    };
  }, [activeTab, token, tripsafeBookingsLoaded]);

  const getStatusColor = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'COMPLETED': return '#4CAF50';
      case 'CONFIRMED': return '#4CAF50';
      case 'SUCCESS': return '#4CAF50';
      case 'UPCOMING': return '#2196F3';
      case 'CANCELLED': return '#F44336';
      case 'PAID': return '#4CAF50';
      case 'PENDING': return '#FF9800';
      case 'ON_HOLD': return '#FF9800';
      case 'REFUNDED': return '#9C27B0';
      case 'FAILED': return '#F44336';
      case 'ACTIVE': return '#4CAF50';
      case 'PLANNING': return '#2196F3';
      default: return '#757575';
    }
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const renderEmptyState = (icon, title, subtitle, actionLabel, onAction) => (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={36} color="#B0B0B0" />
      <Text style={styles.emptyStateTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptyStateSubtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.emptyStateAction} onPress={onAction}>
          <Text style={styles.emptyStateActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'preferences':
        return (
          <View style={styles.tabContent}>
            {renderEmptyState(
              'options-outline',
              'No travel preferences yet',
              "Preferences you set will show up here to personalize your recommendations."
            )}
          </View>
        );

      case 'insights':
        return (
          <View style={styles.tabContent}>
            {renderEmptyState(
              'bulb-outline',
              'No AI insights yet',
              'Get personalized destination picks based on your budget and mood.',
              'Open AI Picks',
              () => navigation.navigate('AITab')
            )}
          </View>
        );

      case 'bookings': {
        const combinedLoading = bookingsLoading || flightBookingsLoading || activityBookingsLoading || cabBookingsLoading || tripsafeBookingsLoading;
        const combinedBookings = [
          ...bookings.map((booking) => ({
            key: `itinerary-${booking.id}`,
            kind: 'itinerary',
            icon: 'briefcase-outline',
            title: booking.itinerary?.title || booking.itinerary?.destination || 'Trip',
            status: booking.status,
            date: booking.travelDate || booking.bookingDate,
            amount: booking.amount,
          })),
          ...activityBookings.map((activity) => ({
            key: `activity-${activity.id}`,
            kind: 'activity',
            icon: 'ticket-outline',
            title: activity.activityName || 'Activity',
            status: activity.status,
            date: activity.visitDateFrom || activity.createdAt,
            amount: activity.totalAmount,
            reference: activity.bookingReference,
          })),
          ...flightBookings.map((flight) => ({
            key: `flight-${flight.id}`,
            kind: 'flight',
            icon: 'airplane-outline',
            title: flight.routeSummary || 'Flight',
            status: flight.status,
            date: flight.createdAt,
            amount: flight.totalFare,
          })),
          ...cabBookings.map((cab) => ({
            key: `cab-${cab.id}`,
            kind: 'cab',
            icon: 'car-outline',
            title: cab.vehicleLabel ? `${cab.vehicleLabel} - ${cab.routeSummary || 'Cab'}` : (cab.routeSummary || 'Cab'),
            status: cab.status,
            date: cab.createdAt,
            amount: cab.totalFare,
          })),
          ...tripsafeBookings.map((policy) => ({
            key: `tripsafe-${policy.id}`,
            kind: 'tripsafe',
            icon: 'shield-checkmark-outline',
            title: policy.planName ? `${policy.planName}${policy.destinationSummary ? ` - ${policy.destinationSummary}` : ''}` : 'Travel Insurance',
            status: policy.status,
            date: policy.createdAt,
            amount: policy.amount,
          })),
        ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        return (
          <View style={styles.tabContent}>
            {combinedLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.tabLoader} />
            ) : combinedBookings.length === 0 ? (
              renderEmptyState('calendar-outline', 'No bookings yet', 'Trips you book will show up here.')
            ) : (
              combinedBookings.map((item) => {
                const isTappable = item.kind === 'flight' || item.kind === 'activity';
                const CardWrapper = isTappable ? TouchableOpacity : View;
                const wrapperProps = item.kind === 'flight'
                  ? { activeOpacity: 0.7, onPress: () => navigation.navigate('MyFlightBookings') }
                  : item.kind === 'activity'
                  ? { activeOpacity: 0.7, onPress: () => navigation.navigate('ActivityBooking', { bookingReference: item.reference }) }
                  : {};
                return (
                  <CardWrapper key={item.key} style={styles.bookingCard} {...wrapperProps}>
                    <View style={styles.bookingHeader}>
                      <View style={styles.bookingTitleRow}>
                        <Ionicons name={item.icon} size={14} color={Colors.primary} style={styles.bookingTitleIcon} />
                        <Text style={styles.bookingDestination}>{item.title}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                      </View>
                    </View>
                    <View style={styles.bookingDetails}>
                      <View style={styles.bookingDetailItem}>
                        <Ionicons name="calendar-outline" size={14} color="#666" />
                        <Text style={styles.bookingDetailText}>{formatDate(item.date)}</Text>
                      </View>
                      <View style={styles.bookingDetailItem}>
                        <Ionicons name="cash-outline" size={14} color="#666" />
                        <Text style={styles.bookingDetailText}>{formatCurrency(item.amount)}</Text>
                      </View>
                    </View>
                  </CardWrapper>
                );
              })
            )}
          </View>
        );
      }

      case 'saved':
        return (
          <View style={styles.tabContent}>
            {renderEmptyState('heart-outline', 'No saved trips yet', 'Tap the heart icon on a trip to save it here.')}
          </View>
        );

      case 'groups':
        return (
          <View style={styles.tabContent}>
            <TouchableOpacity
              style={styles.groupPlannerLaunchCard}
              onPress={() => navigation.navigate('GroupTripPlanner')}
            >
              <View style={styles.groupPlannerLaunchIcon}>
                <Ionicons name="people-outline" size={20} color={Colors.secondary} />
              </View>
              <View style={styles.groupPlannerLaunchCopy}>
                <Text style={styles.groupPlannerLaunchTitle}>Open Group Planner</Text>
                <Text style={styles.groupPlannerLaunchText}>Create trips, join with invite codes, and vote together.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>

            {groupsLoading ? (
              <View style={styles.groupsLoadingWrap}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.groupsLoadingText}>Loading your group trips...</Text>
              </View>
            ) : groupTrips.length === 0 ? (
              <View style={styles.groupTripEmptyCard}>
                <Text style={styles.groupTripEmptyText}>No group trips yet. Start one in the Group Planner.</Text>
              </View>
            ) : groupTrips.map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={styles.groupTripCard}
                onPress={() => navigation.navigate('GroupTripPlanner', { tripId: trip.id })}
              >
                <View style={styles.groupTripHeader}>
                  <Text style={styles.groupTripTitle}>{trip.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.finalizedItineraryId ? 'Completed' : 'Planning') + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(trip.finalizedItineraryId ? 'Completed' : 'Planning') }]}>
                      {trip.finalizedItineraryId ? 'Completed' : trip.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.groupTripDetails}>
                  <View style={styles.groupTripDetailItem}>
                    <Ionicons name="key-outline" size={14} color="#666" />
                    <Text style={styles.groupTripDetailText}>Code: {trip.inviteCode}</Text>
                  </View>
                  <View style={styles.groupTripDetailItem}>
                    <Ionicons name="people-outline" size={14} color="#666" />
                    <Text style={styles.groupTripDetailText}>{trip.memberCount} members</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'transactions':
        return (
          <View style={styles.tabContent}>
            {bookingsLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.tabLoader} />
            ) : bookings.length === 0 ? (
              renderEmptyState('card-outline', 'No payments yet', 'Payments for your bookings will show up here.')
            ) : (
              bookings.map((booking) => (
                <View key={booking.id} style={styles.transactionCard}>
                  <View style={styles.transactionHeader}>
                    <Text style={styles.transactionDescription}>
                      {booking.itinerary?.title || booking.itinerary?.destination || 'Trip'}
                    </Text>
                    <Text style={styles.transactionAmount}>{formatCurrency(booking.amount)}</Text>
                  </View>
                  <View style={styles.transactionDetails}>
                    <View style={styles.transactionDetailItem}>
                      <Ionicons name="calendar-outline" size={14} color="#666" />
                      <Text style={styles.transactionDetailText}>{formatDate(booking.bookingDate)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.paymentStatus) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(booking.paymentStatus) }]}>
                        {booking.paymentStatus}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        );

      case 'notifications':
        return (
          <View style={styles.tabContent}>
            {renderEmptyState('notifications-outline', 'No notifications yet', "You're all caught up.")}
          </View>
        );

      default:
        return null;
    }
  };

  const openEditProfile = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    if (!editPhone.trim()) {
      Alert.alert('Phone required', 'Please enter your phone number.');
      return;
    }

    try {
      setSavingProfile(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Unable to update profile');
      }

      login({ token, user: { ...user, ...data } });
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert('Profile', error.message || 'Unable to update profile right now.');
    } finally {
      setSavingProfile(false);
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
            <TouchableOpacity style={styles.editProfileButton} onPress={openEditProfile}>
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

      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={styles.modalFieldLabel}>Phone number</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Phone number"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
              value={editPhone}
              onChangeText={(value) => setEditPhone(phoneDigits(value))}
              maxLength={15}
            />

            <TouchableOpacity style={styles.modalSaveButton} onPress={saveProfile} disabled={savingProfile}>
              {savingProfile ? (
                <ActivityIndicator color={Colors.secondary} />
              ) : (
                <Text style={styles.modalSaveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  tabLoader: {
    marginVertical: 30,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyStateAction: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyStateActionText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 13,
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
  bookingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  bookingTitleIcon: {
    marginRight: 6,
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
  groupPlannerLaunchCard: {
    backgroundColor: '#FFF3EA',
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F2D4C2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupPlannerLaunchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupPlannerLaunchCopy: {
    flex: 1,
  },
  groupPlannerLaunchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  groupPlannerLaunchText: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  groupsLoadingWrap: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  groupsLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#666',
  },
  groupTripEmptyCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 16,
  },
  groupTripEmptyText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textLight,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default CustomerProfileScreen;
