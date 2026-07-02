import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';
import usePolling from '../hooks/usePolling';

const INCOMING_REQUESTS_POLL_INTERVAL_MS = 20000;

const timeAgo = (isoDate) => {
  if (!isoDate) return '';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const B2BDashboard = ({ navigation }) => {
  const { user, token, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const adminStats = [
    { id: 1, title: 'Total Bookings', value: '156', icon: 'clipboard-outline', color: '#FF6B35' },
    { id: 2, title: 'Revenue', value: '₹12.5L', icon: 'cash-outline', color: '#4CAF50' },
    { id: 3, title: 'Active Clients', value: '89', icon: 'people-outline', color: '#2196F3' },
    { id: 4, title: 'Pending Queries', value: '23', icon: 'help-circle-outline', color: '#FF9800' },
  ];

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const hasLoadedRequestsOnceRef = useRef(false);

  const loadIncomingRequests = useCallback(async () => {
    if (isAdmin || !token) {
      return;
    }

    if (!hasLoadedRequestsOnceRef.current) {
      setLoadingRequests(true);
    }
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/messages/conversations/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load requests');
      }
      setIncomingRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      // silent on background polls; the list simply keeps its last known state
    } finally {
      hasLoadedRequestsOnceRef.current = true;
      setLoadingRequests(false);
    }
  }, [isAdmin, token]);

  usePolling(loadIncomingRequests, INCOMING_REQUESTS_POLL_INTERVAL_MS);

  const recentBookings = [
    {
      id: 1,
      client: 'Rahul Sharma',
      destination: 'Goa',
      amount: '₹45,000',
      status: 'Confirmed',
      date: '25 Mar 2026',
    },
    {
      id: 2,
      client: 'Priya Patel',
      destination: 'Kerala',
      amount: '₹62,000',
      status: 'Pending',
      date: '24 Mar 2026',
    },
    {
      id: 3,
      client: 'Amit Kumar',
      destination: 'Jaipur',
      amount: '₹38,000',
      status: 'Confirmed',
      date: '23 Mar 2026',
    },
  ];

  const adminFeatures = [
    {
      id: 1,
      title: 'Client Management',
      description: 'Manage your client database',
      icon: 'people-outline',
      screen: 'ClientManagement',
    },
    {
      id: 2,
      title: 'Supplier Network',
      description: 'Connect with suppliers',
      icon: 'git-network-outline',
      screen: 'SupplierNetwork',
    },
    {
      id: 3,
      title: 'Booking Management',
      description: 'Track all bookings',
      icon: 'clipboard-outline',
      screen: 'BookingManagement',
    },
    {
      id: 4,
      title: 'Analytics',
      description: 'Business insights',
      icon: 'bar-chart-outline',
      screen: 'Analytics',
    },
    {
      id: 5,
      title: 'Commission Tracking',
      description: 'Track your earnings',
      icon: 'cash-outline',
      screen: 'CommissionTracking',
    },
    {
      id: 6,
      title: 'Marketing Tools',
      description: 'Promote your business',
      icon: 'megaphone-outline',
      screen: 'MarketingTools',
    },
  ];

  const renderStatCard = (stat) => (
    <View key={stat.id} style={[styles.statCard, { backgroundColor: stat.color }]}>
      <Ionicons name={stat.icon} size={28} color={Colors.secondary} style={styles.statIcon} />
      <Text style={styles.statValue}>{stat.value}</Text>
      <Text style={styles.statTitle}>{stat.title}</Text>
    </View>
  );

  const renderBooking = ({ item }) => (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.clientName}>{item.client}</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'Confirmed' ? Colors.success : Colors.warning,
            },
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.destinationRow}>
        <Ionicons name="location-outline" size={14} color={Colors.textLight} />
        <Text style={styles.destination}>{item.destination}</Text>
      </View>
      <View style={styles.bookingFooter}>
        <Text style={styles.amount}>{item.amount}</Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>
    </View>
  );

  const renderSupplierRequest = ({ item }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => navigation.navigate('ChatScreen', { conversation: item })}
      activeOpacity={0.8}
    >
      <View style={styles.requestHeader}>
        <View style={styles.requestTitleRow}>
          <Ionicons name="location-outline" size={18} color={Colors.primary} />
          <Text style={styles.requestDestination}>{item.destination || 'General request'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#E3F2FD' }]}>
          <Text style={[styles.statusText, { color: '#1976D2' }]}>New</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        {item.numberOfPeople ? (
          <View style={styles.requestDetailRow}>
            <Ionicons name="people-outline" size={14} color={Colors.textLight} />
            <Text style={styles.requestDetailText}>{item.numberOfPeople} Travelers</Text>
          </View>
        ) : null}
        {item.budget ? (
          <View style={styles.requestDetailRow}>
            <Ionicons name="cash-outline" size={14} color={Colors.textLight} />
            <Text style={styles.requestDetailText}>Budget: {item.budget}</Text>
          </View>
        ) : null}
        {item.summary ? (
          <View style={styles.requestDetailRow}>
            <Ionicons name="document-text-outline" size={14} color={Colors.textLight} />
            <Text style={styles.requestDetailText} numberOfLines={1}>
              {item.summary}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.requestFooter}>
        <View style={styles.deadlineRow}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.deadlineText}>Received {timeAgo(item.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );

  const renderFeature = (feature) => (
    <TouchableOpacity
      key={feature.id}
      style={styles.featureCard}
      activeOpacity={0.8}
      onPress={() => feature.screen && navigation.navigate(feature.screen)}
    >
      <Ionicons name={feature.icon} size={26} color={Colors.primary} style={styles.featureIcon} />
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>{feature.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
    </TouchableOpacity>
  );

  const renderAdminQuickActions = () => (
    <View style={styles.quickActions}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <TouchableOpacity
        style={styles.adminUploadCard}
        onPress={() => navigation.navigate('AdminItineraryUpload')}
        activeOpacity={0.9}
      >
        <View style={styles.adminUploadCopy}>
          <Text style={styles.adminUploadEyebrow}>Admin only</Text>
          <Text style={styles.adminUploadTitle}>Upload a new itinerary</Text>
          <Text style={styles.adminUploadText}>
            Publish destination packages directly from the app with highlights, inclusions, and day-wise plans.
          </Text>
        </View>
        <View style={styles.adminUploadIconWrap}>
          <Ionicons name="cloud-upload-outline" size={28} color={Colors.secondary} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.posterStudioCard}
        onPress={() => navigation.navigate('AdminPosterStudio')}
        activeOpacity={0.9}
      >
        <View style={styles.posterStudioCopy}>
          <Text style={styles.posterStudioEyebrow}>Marketing studio</Text>
          <Text style={styles.posterStudioTitle}>Auto-create flyers and posters</Text>
          <Text style={styles.posterStudioText}>
            Pick an itinerary, apply a saved campaign template, and generate polished promo drafts inside the dashboard.
          </Text>
        </View>
        <View style={styles.posterStudioIconWrap}>
          <Ionicons name="image-outline" size={28} color={Colors.primary} />
        </View>
      </TouchableOpacity>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('ChatInbox')}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} style={styles.actionIcon} />
          <Text style={styles.actionText}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="add-circle-outline" size={22} color={Colors.primary} style={styles.actionIcon} />
          <Text style={styles.actionText}>New Booking</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="paper-plane-outline" size={22} color={Colors.primary} style={styles.actionIcon} />
          <Text style={styles.actionText}>Send Quote</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="bar-chart-outline" size={22} color={Colors.primary} style={styles.actionIcon} />
          <Text style={styles.actionText}>Reports</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isAdmin ? 'Admin AI SaaS' : 'Supplier AI SaaS'}</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => navigation.navigate('ChatInbox')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.secondary} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.businessName}>{user?.name || 'Travel Agency Pro'}</Text>
          <Text style={styles.planBadge}>{isAdmin ? 'Admin Access' : 'Supplier Access'}</Text>
        </View>

        {/* Stats Section - Admin only */}
        {isAdmin && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsGrid}>{adminStats.map(renderStatCard)}</View>
          </View>
        )}

        {/* Quick Actions - Admin only */}
        {isAdmin && renderAdminQuickActions()}

        {/* Incoming Requests - Supplier only */}
        {!isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Incoming Requests</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ChatInbox')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {loadingRequests ? (
              <ActivityIndicator size="small" color={Colors.primary} style={styles.requestsLoader} />
            ) : incomingRequests.length === 0 ? (
              <View style={styles.emptyRequests}>
                <Ionicons name="mail-open-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.emptyRequestsText}>
                  No requests yet. New customer requests forwarded by admin will show up here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={incomingRequests}
                renderItem={renderSupplierRequest}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {/* Recent Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={recentBookings}
            renderItem={renderBooking}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* Features - Admin only */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featuresGrid}>{adminFeatures.map(renderFeature)}</View>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: {
    color: Colors.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  messageButton: {
    position: 'relative',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: Colors.card,
  },
  welcomeText: {
    fontSize: 16,
    color: Colors.textLight,
  },
  businessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 5,
  },
  planBadge: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 5,
    backgroundColor: Colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  statIcon: {
    fontSize: 30,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  statTitle: {
    fontSize: 14,
    color: Colors.secondary,
    opacity: 0.9,
    marginTop: 5,
  },
  quickActions: {
    padding: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adminUploadCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  adminUploadCopy: {
    flex: 1,
    paddingRight: 12,
  },
  adminUploadEyebrow: {
    color: Colors.secondary,
    opacity: 0.8,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  adminUploadTitle: {
    color: Colors.secondary,
    fontSize: 20,
    fontWeight: '800',
  },
  adminUploadText: {
    color: Colors.secondary,
    opacity: 0.92,
    marginTop: 6,
    lineHeight: 19,
  },
  adminUploadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  posterStudioCard: {
    backgroundColor: '#FFF4EC',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFDCC8',
  },
  posterStudioCopy: {
    flex: 1,
    paddingRight: 12,
  },
  posterStudioEyebrow: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  posterStudioTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  posterStudioText: {
    color: Colors.textLight,
    marginTop: 6,
    lineHeight: 19,
  },
  posterStudioIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  viewAll: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  bookingCard: {
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
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  destination: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 8,
    marginLeft: 4,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestDestination: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  requestDetails: {
    marginBottom: 12,
  },
  requestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestDetailText: {
    fontSize: 13,
    color: Colors.textLight,
    marginLeft: 8,
    flexShrink: 1,
  },
  requestsLoader: {
    marginVertical: 20,
  },
  emptyRequests: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 12,
  },
  emptyRequestsText: {
    marginTop: 10,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  featuresGrid: {
    marginTop: 10,
  },
  featureCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 2,
  },

});

export default B2BDashboard;
