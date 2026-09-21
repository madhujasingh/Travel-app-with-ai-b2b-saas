// The list an admin manages their own packages from - the piece that was
// missing entirely, which is why an uploaded package could only be found by
// searching for it the way a customer would.
//
// It reads /itineraries/admin/all rather than the public listing, so packages
// that have been taken off sale still show up here: hiding them is exactly
// what would make them impossible to put back on sale.
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import { appAlert } from '../utils/appAlert';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Uploaded by us' },
  { key: 'ai', label: 'AI generated' },
  { key: 'hidden', label: 'Off sale' },
];

const AdminItinerariesScreen = ({ navigation }) => {
  const { token, user } = useAuth();
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/itineraries/admin/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Could not load packages');
      }
      setItineraries(await response.json());
    } catch (error) {
      appAlert('Could not load packages', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Coming back from the edit form should show the edit, so this reloads on
  // focus rather than only on mount.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = itineraries.filter((item) => {
    if (filter === 'mine') return !item.aiGenerated;
    if (filter === 'ai') return item.aiGenerated;
    if (filter === 'hidden') return item.isActive === false;
    return true;
  });

  const toggleActive = async (item) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/itineraries/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // The server carries the stored cover photo across an update, so it
        // does not need to be - and cannot be - sent back here.
        body: JSON.stringify({ ...item, isActive: !item.isActive }),
      });
      if (!response.ok) {
        throw new Error('Update failed');
      }
      load();
    } catch (error) {
      appAlert('Could not update', error.message);
    }
  };

  const confirmDelete = (item) => {
    appAlert(
      'Delete this package?',
      `"${item.title}" will be removed for everyone. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_CONFIG.BASE_URL}/itineraries/${item.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!response.ok) {
                throw new Error('Delete failed');
              }
              load();
            } catch (error) {
              appAlert('Could not delete', error.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, item.isActive === false && styles.cardInactive]}>
      <TouchableOpacity
        style={styles.cardMain}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AdminItineraryUpload', { itinerary: item })}
      >
        {item.hasImage ? (
          <Image
            source={{ uri: `${API_CONFIG.BASE_URL}/itineraries/${item.id}/image` }}
            style={styles.thumb}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name="image-outline" size={20} color={Colors.textMuted} />
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item.destination} • {item.duration} • ₹{Number(item.price || 0).toLocaleString()}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.type}</Text>
            </View>
            {item.aiGenerated ? (
              <View style={[styles.badge, styles.badgeAi]}>
                <Ionicons name="sparkles" size={10} color="#6B4CC4" />
                <Text style={[styles.badgeText, styles.badgeTextAi]}> AI</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeMine]}>
                <Text style={[styles.badgeText, styles.badgeTextMine]}>Ours</Text>
              </View>
            )}
            {item.isActive === false ? (
              <View style={[styles.badge, styles.badgeHidden]}>
                <Text style={[styles.badgeText, styles.badgeTextHidden]}>Off sale</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.action} onPress={() => toggleActive(item)}>
          <Ionicons
            name={item.isActive === false ? 'eye-outline' : 'eye-off-outline'}
            size={16}
            color={Colors.primary}
          />
          <Text style={styles.actionText}>
            {item.isActive === false ? 'Put on sale' : 'Take off sale'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => confirmDelete(item)}>
          <Ionicons name="trash-outline" size={16} color="#C0392B" />
          <Text style={[styles.actionText, styles.actionTextDanger]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Admins only</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primaryDark} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Packages</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminItineraryUpload')}>
          <Ionicons name="add" size={26} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.filterChip, filter === option.key && styles.filterChipActive]}
            onPress={() => setFilter(option.key)}
          >
            <Text
              style={[styles.filterText, filter === option.key && styles.filterTextActive]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="albums-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>
                {filter === 'all'
                  ? 'Upload your first package to see it listed here.'
                  : 'No packages match this filter.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.secondary },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted || '#777' },
  filterTextActive: { color: Colors.secondary },
  listContent: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardInactive: { opacity: 0.66 },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#EEE' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginHorizontal: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textDark || '#222' },
  cardMeta: { fontSize: 12, color: Colors.textMuted || '#777', marginTop: 3 },
  badgeRow: { flexDirection: 'row', marginTop: 7, gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#EFEFEF',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#666' },
  badgeAi: { backgroundColor: '#EFE8FF' },
  badgeTextAi: { color: '#6B4CC4' },
  badgeMine: { backgroundColor: '#E3F5E8' },
  badgeTextMine: { color: '#2E7D45' },
  badgeHidden: { backgroundColor: '#FDE8E8' },
  badgeTextHidden: { color: '#C0392B' },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  actionText: { marginLeft: 6, fontSize: 12, fontWeight: '600', color: Colors.primary },
  actionTextDanger: { color: '#C0392B' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark || '#222',
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textMuted || '#777',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default AdminItinerariesScreen;
