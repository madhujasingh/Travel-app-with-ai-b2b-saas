import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const SupplierRequestsScreen = ({ navigation }) => {
  const [filter, setFilter] = useState('All');

  const supplierRequests = [
    {
      id: 1,
      destination: 'Rajasthan Heritage Tour',
      customerType: 'Group (10 pax)',
      budget: '₹1,50,000',
      travelers: 10,
      deadline: '26 Mar 2026',
      status: 'New',
      preferences: 'Adventure, Cultural',
      createdAt: '20 Mar 2026',
    },
    {
      id: 2,
      destination: 'Kerala Backwaters',
      customerType: 'Couple',
      budget: '₹80,000',
      travelers: 2,
      deadline: '25 Mar 2026',
      status: 'In Progress',
      preferences: 'Relaxation, Nature',
      createdAt: '19 Mar 2026',
    },
    {
      id: 3,
      destination: 'Goa Beach Package',
      customerType: 'Family (4 pax)',
      budget: '₹1,20,000',
      travelers: 4,
      deadline: '24 Mar 2026',
      status: 'Awaiting Quote',
      preferences: 'Beach, Nightlife',
      createdAt: '18 Mar 2026',
    },
    {
      id: 4,
      destination: 'Himachal Adventure',
      customerType: 'Group (8 pax)',
      budget: '₹2,00,000',
      travelers: 8,
      deadline: '28 Mar 2026',
      status: 'New',
      preferences: 'Trekking, Camping',
      createdAt: '21 Mar 2026',
    },
    {
      id: 5,
      destination: 'Andaman Islands',
      customerType: 'Couple',
      budget: '₹1,80,000',
      travelers: 2,
      deadline: '30 Mar 2026',
      status: 'Quote Sent',
      preferences: 'Scuba Diving, Beach',
      createdAt: '22 Mar 2026',
    },
  ];

  const filters = ['All', 'New', 'In Progress', 'Awaiting Quote', 'Quote Sent'];

  const filteredRequests = filter === 'All' 
    ? supplierRequests 
    : supplierRequests.filter(req => req.status === filter);

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return { bg: '#E3F2FD', text: '#1976D2' };
      case 'In Progress':
        return { bg: '#FFF3E0', text: '#F57C00' };
      case 'Awaiting Quote':
        return { bg: '#F3E5F5', text: '#7B1FA2' };
      case 'Quote Sent':
        return { bg: '#E8F5E9', text: '#388E3C' };
      default:
        return { bg: '#F5F5F5', text: '#757575' };
    }
  };

  const renderRequest = ({ item }) => {
    const statusColors = getStatusColor(item.status);
    return (
      <TouchableOpacity
        style={styles.requestCard}
        onPress={() => navigation.navigate('RequestDetail', { request: item })}
        activeOpacity={0.8}
      >
        <View style={styles.requestHeader}>
          <View style={styles.requestTitleRow}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.requestDestination}>{item.destination}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.requestDetails}>
          <View style={styles.requestDetailRow}>
            <Ionicons name="people-outline" size={14} color={Colors.textLight} />
            <Text style={styles.requestDetailText}>{item.customerType}</Text>
          </View>
          <View style={styles.requestDetailRow}>
            <Ionicons name="cash-outline" size={14} color={Colors.textLight} />
            <Text style={styles.requestDetailText}>Budget: {item.budget}</Text>
          </View>
          <View style={styles.requestDetailRow}>
            <Ionicons name="person-outline" size={14} color={Colors.textLight} />
            <Text style={styles.requestDetailText}>{item.travelers} Travelers</Text>
          </View>
          <View style={styles.requestDetailRow}>
            <Ionicons name="heart-outline" size={14} color={Colors.textLight} />
            <Text style={styles.requestDetailText}>{item.preferences}</Text>
          </View>
        </View>

        <View style={styles.requestFooter}>
          <View style={styles.deadlineRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.deadlineText}>Deadline: {item.deadline}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Supplier Requests</Text>
        <TouchableOpacity onPress={() => {}}>
          <Ionicons name="refresh" size={24} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>
          {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Requests List */}
      <FlatList
        data={filteredRequests}
        renderItem={renderRequest}
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
  filterContainer: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 5,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: Colors.textLight,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.secondary,
  },
  resultsHeader: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: Colors.card,
  },
  resultsText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  listContainer: {
    padding: 15,
  },
  requestCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 14,
    color: Colors.textLight,
    marginLeft: 8,
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
});

export default SupplierRequestsScreen;
