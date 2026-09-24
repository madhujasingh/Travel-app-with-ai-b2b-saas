import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';
import DatePickerModal from '../components/DatePickerModal';

// HotelBeds' own Booking List operation, queried directly against their
// system of record - a reconciliation tool for admins, not a replacement for
// the customer-facing "my bookings" screen (which reads our local
// ActivityBooking mirror, which is what customers actually need). Useful
// for spot-checking that our local record agrees with HotelBeds', or
// finding a booking that succeeded on their end but didn't save locally.
const FILTER_TYPES = [
  { label: 'Check-in date', value: 'CHECKIN' },
  { label: 'Creation date', value: 'CREATION' },
  { label: 'Cancellation date', value: 'CANCELLATION' },
];

const toDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

const STATUS_COLORS = {
  CONFIRMED: Colors.success,
  PRECONFIRMED: Colors.warning,
  CANCELLED: Colors.error,
};

const ActivityBookingListAdminScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [filterType, setFilterType] = useState('CHECKIN');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [includedCancelled, setIncludedCancelled] = useState(true);
  const [holder, setHolder] = useState('');
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const [bookings, setBookings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    if (!startDate || !endDate) {
      appAlert('Date range required', 'Pick a start and end date to search.');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        language: 'en',
        start: toDateString(startDate),
        end: toDateString(endDate),
        filterType,
        includedCancelled: String(includedCancelled),
        itemsPerPage: '20',
        page: '1',
      });
      if (holder.trim()) {
        params.append('holder', holder.trim());
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/activities/admin/bookings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || data?.errors) {
        throw new Error(data?.errors?.[0]?.text || data?.message || 'Unable to fetch bookings.');
      }
      setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
    } catch (error) {
      appAlert('HotelBeds Bookings', error.message || 'Unable to fetch bookings right now.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const renderBooking = ({ item }) => {
    const activity = item.activities?.[0];
    const statusColor = STATUS_COLORS[item.status] || Colors.textMuted;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.reference}>{item.reference}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        {!!activity?.name && <Text style={styles.activityName}>{activity.name}</Text>}

        <View style={styles.row}>
          <Text style={styles.label}>Holder</Text>
          <Text style={styles.value}>{item.holder?.name} {item.holder?.surname}</Text>
        </View>

        {!!activity?.dateFrom && (
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {activity.dateFrom === activity.dateTo ? activity.dateFrom : `${activity.dateFrom} - ${activity.dateTo}`}
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Created</Text>
          <Text style={styles.value}>{item.creationDate}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>{item.currency} {Number(item.total || 0).toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HotelBeds Bookings</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.fieldLabel}>Filter by</Text>
        <View style={styles.chipRow}>
          {FILTER_TYPES.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, filterType === option.value && styles.chipActive]}
              onPress={() => setFilterType(option.value)}
            >
              <Text style={[styles.chipText, filterType === option.value && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Date range</Text>
        <TouchableOpacity style={styles.dateField} onPress={() => setDatePickerVisible(true)}>
          <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
          <Text style={[styles.dateFieldText, !startDate && styles.dateFieldPlaceholder]}>
            {startDate && endDate
              ? `${formatDisplayDate(toDateString(startDate))} - ${formatDisplayDate(toDateString(endDate))}`
              : 'Select a date range'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.fieldLabel}>Holder name (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={holder}
          onChangeText={setHolder}
          placeholder="Search by traveller name"
          placeholderTextColor={Colors.textMuted}
        />

        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>Include cancelled bookings</Text>
          <Switch value={includedCancelled} onValueChange={setIncludedCancelled} />
        </View>

        <TouchableOpacity style={styles.searchButton} onPress={runSearch} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={Colors.secondary} />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={bookings || []}
        keyExtractor={(item) => item.reference}
        renderItem={renderBooking}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          searched && !loading ? (
            <Text style={styles.emptyText}>No bookings found for this range.</Text>
          ) : null
        }
      />

      <DatePickerModal
        visible={datePickerVisible}
        title="Booking date range"
        rangeMode
        initialDate={startDate}
        onSelectRange={(startStr, endStr, start, end) => {
          setStartDate(start);
          setEndDate(end);
          setDatePickerVisible(false);
        }}
        onClose={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: Colors.secondary, fontSize: 17, fontWeight: '700' },
  filterCard: {
    backgroundColor: Colors.card,
    margin: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, marginTop: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12.5, color: Colors.text },
  chipTextActive: { color: Colors.secondary, fontWeight: '700' },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateFieldText: { fontSize: 13.5, color: Colors.text },
  dateFieldPlaceholder: { color: Colors.textMuted },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: Colors.text,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  searchButtonText: { color: Colors.secondary, fontWeight: '700', fontSize: 14.5 },
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reference: { fontSize: 14, fontWeight: '700', color: Colors.text },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10.5, fontWeight: '700', color: Colors.secondary },
  activityName: { fontSize: 13, color: Colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 12, color: Colors.textMuted },
  value: { fontSize: 12, color: Colors.text, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: 40, fontSize: 13 },
});

export default ActivityBookingListAdminScreen;
