import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const RequestDetailScreen = ({ route, navigation }) => {
  const { request } = route.params;

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return { bg: '#E3F2FD', text: '#1976D2' };
      case 'In Progress':
        return { bg: '#FFF3E0', text: '#F57C00' };
      case 'Awaiting Quote':
        return { bg: '#E8F5E9', text: '#388E3C' };
      default:
        return { bg: '#F5F5F5', text: '#757575' };
    }
  };

  const statusColors = getStatusColor(request.status);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Destination Card */}
        <View style={styles.destinationCard}>
          <View style={styles.destinationHeader}>
            <Ionicons name="location-outline" size={24} color={Colors.primary} />
            <Text style={styles.destinationTitle}>{request.destination}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {request.status}
            </Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Customer Type</Text>
                <Text style={styles.infoValue}>{request.customerType}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Number of Travelers</Text>
                <Text style={styles.infoValue}>{request.travelers} people</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Budget</Text>
                <Text style={styles.infoValue}>{request.budget}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Preferences</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="heart-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Travel Style</Text>
                <Text style={styles.infoValue}>{request.preferences}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="sunny-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Preferred Weather</Text>
                <Text style={styles.infoValue}>Any</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="restaurant-outline" size={20} color={Colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Dietary Requirements</Text>
                <Text style={styles.infoValue}>None specified</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Required Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Services</Text>
          <View style={styles.servicesGrid}>
            <View style={styles.serviceItem}>
              <Ionicons name="bed-outline" size={24} color={Colors.primary} />
              <Text style={styles.serviceText}>Hotels</Text>
            </View>
            <View style={styles.serviceItem}>
              <Ionicons name="airplane-outline" size={24} color={Colors.primary} />
              <Text style={styles.serviceText}>Flights</Text>
            </View>
            <View style={styles.serviceItem}>
              <Ionicons name="car-outline" size={24} color={Colors.primary} />
              <Text style={styles.serviceText}>Transport</Text>
            </View>
            <View style={styles.serviceItem}>
              <Ionicons name="bicycle-outline" size={24} color={Colors.primary} />
              <Text style={styles.serviceText}>Activities</Text>
            </View>
          </View>
        </View>

        {/* Special Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Notes</Text>
          <View style={styles.notesCard}>
            <Ionicons name="document-text-outline" size={20} color={Colors.textLight} />
            <Text style={styles.notesText}>
              Customer prefers luxury accommodations with scenic views. Interested in local cultural experiences and adventure activities.
            </Text>
          </View>
        </View>

        {/* Deadline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deadline</Text>
          <View style={styles.deadlineCard}>
            <Ionicons name="time-outline" size={24} color={Colors.error} />
            <View style={styles.deadlineContent}>
              <Text style={styles.deadlineLabel}>Quote Due By</Text>
              <Text style={styles.deadlineValue}>{request.deadline}</Text>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CreatePackage', { request })}
        >
          <Ionicons name="create-outline" size={20} color={Colors.secondary} />
          <Text style={styles.primaryButtonText}>Create Package / Send Quote</Text>
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
  destinationCard: {
    backgroundColor: Colors.card,
    margin: 20,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  destinationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 12,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoContent: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceItem: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
  },
  notesCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.textLight,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  deadlineCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  deadlineContent: {
    marginLeft: 15,
  },
  deadlineLabel: {
    fontSize: 12,
    color: Colors.error,
    marginBottom: 4,
  },
  deadlineValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.error,
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

export default RequestDetailScreen;
