import React, { useState } from 'react';
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

const ReportsScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');

  const periods = ['This Week', 'This Month', 'This Quarter', 'This Year'];

  const stats = [
    { id: 1, title: 'Total Revenue', value: '₹12,50,000', icon: 'cash-outline', color: '#4CAF50', change: '+15%' },
    { id: 2, title: 'Total Bookings', value: '156', icon: 'clipboard-outline', color: '#2196F3', change: '+8%' },
    { id: 3, title: 'Avg. Response Time', value: '2.5h', icon: 'time-outline', color: '#9C27B0', change: '-12%' },
    { id: 4, title: 'Conversion Rate', value: '68%', icon: 'trending-up-outline', color: '#FF9800', change: '+5%' },
  ];

  const topDestinations = [
    { id: 1, name: 'Goa', bookings: 45, revenue: '₹4,50,000' },
    { id: 2, name: 'Kerala', bookings: 38, revenue: '₹3,80,000' },
    { id: 3, name: 'Rajasthan', bookings: 32, revenue: '₹3,20,000' },
    { id: 4, name: 'Himachal', bookings: 28, revenue: '₹2,80,000' },
    { id: 5, name: 'Andaman', bookings: 13, revenue: '₹1,30,000' },
  ];

  const recentActivity = [
    { id: 1, action: 'New booking received', time: '2 hours ago', icon: 'checkmark-circle-outline', color: '#4CAF50' },
    { id: 2, action: 'Quote sent to customer', time: '4 hours ago', icon: 'paper-plane-outline', color: '#2196F3' },
    { id: 3, action: 'Payment received', time: '6 hours ago', icon: 'card-outline', color: '#FF9800' },
    { id: 4, action: 'New request received', time: '1 day ago', icon: 'notifications-outline', color: '#9C27B0' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <TouchableOpacity onPress={() => {}}>
          <Ionicons name="download-outline" size={24} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View style={styles.periodContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period}
                style={[styles.periodTab, selectedPeriod === period && styles.periodTabActive]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text style={[styles.periodText, selectedPeriod === period && styles.periodTextActive]}>
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.id} style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Ionicons name={stat.icon} size={24} color={stat.color} />
                  <Text style={[styles.statChange, { color: stat.change.startsWith('+') ? '#4CAF50' : '#F44336' }]}>
                    {stat.change}
                  </Text>
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statTitle}>{stat.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Destinations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Destinations</Text>
          <View style={styles.destinationsCard}>
            {topDestinations.map((dest, index) => (
              <View key={dest.id} style={styles.destinationRow}>
                <View style={styles.destinationRank}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.destinationInfo}>
                  <Text style={styles.destinationName}>{dest.name}</Text>
                  <Text style={styles.destinationBookings}>{dest.bookings} bookings</Text>
                </View>
                <Text style={styles.destinationRevenue}>{dest.revenue}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityCard}>
            {recentActivity.map((activity) => (
              <View key={activity.id} style={styles.activityRow}>
                <View style={[styles.activityIcon, { backgroundColor: activity.color + '20' }]}>
                  <Ionicons name={activity.icon} size={20} color={activity.color} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityAction}>{activity.action}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Export Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Reports</Text>
          <View style={styles.exportCard}>
            <TouchableOpacity style={styles.exportButton}>
              <Ionicons name="document-text-outline" size={24} color={Colors.primary} />
              <Text style={styles.exportText}>Export as PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton}>
              <Ionicons name="grid-outline" size={24} color={Colors.primary} />
              <Text style={styles.exportText}>Export as Excel</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  periodContainer: {
    backgroundColor: Colors.card,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 5,
  },
  periodTabActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: 14,
    color: Colors.textLight,
    fontWeight: '500',
  },
  periodTextActive: {
    color: Colors.secondary,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
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
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.textLight,
  },
  destinationsCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  destinationRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  destinationBookings: {
    fontSize: 12,
    color: Colors.textLight,
  },
  destinationRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  activityCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  exportCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportButton: {
    alignItems: 'center',
    padding: 15,
  },
  exportText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
});

export default ReportsScreen;
