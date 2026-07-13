import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';

// TripJack's own "certified" sample hotel IDs (from their support reply) -
// a quick way to prove the sync works without hunting up real IDs first.
const SAMPLE_HOTEL_IDS = [
  '100000948899', '100000000036', '100000147089', '100000453252', '100000057602',
  '100000000195', '100000450980', '100000002840', '100000000038', '100000578177',
  '100000006097', '100000000361', '100000208035', '100000315563', '100000024899',
  '100000448008', '100000224831', '100000470754', '100000002784', '100000372208',
  '100000447053', '100000414855', '100000134456', '100000003248', '100000160185',
  '100000326932', '100000566653', '100000363323', '100000530922', '100000208246',
];

const HotelCatalogAdminScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hotelIdsInput, setHotelIdsInput] = useState('');
  const [countryInput, setCountryInput] = useState('');
  const [syncing, setSyncing] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/hotel-catalog`);
      const data = await response.json();
      setHotels(Array.isArray(data) ? data : []);
    } catch (error) {
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCatalog();
    }, [loadCatalog])
  );

  const countryCounts = hotels.reduce((acc, h) => {
    const key = h.countryName || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const runSync = async (hotelIds) => {
    if (!hotelIds.length) {
      Alert.alert('Sync Hotel Catalog', 'No hotel IDs to sync.');
      return;
    }
    if (hotelIds.length > 100) {
      Alert.alert('Sync Hotel Catalog', 'TripJack allows a maximum of 100 hotel IDs per sync call.');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/hotel-catalog/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hotelIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Sync failed');
      }
      Alert.alert('Sync Hotel Catalog', `Synced ${data.synced} hotel${data.synced === 1 ? '' : 's'}.`);
      loadCatalog();
    } catch (error) {
      Alert.alert('Sync Hotel Catalog', error.message || 'Unable to sync right now.');
    } finally {
      setSyncing(false);
    }
  };

  const syncFromIdsInput = () => {
    const ids = hotelIdsInput
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);
    runSync(ids);
  };

  const syncSampleIds = () => runSync(SAMPLE_HOTEL_IDS);

  // Full country sync (fetch-hotel-mapping -> batched fetch-hotel-content)
  // is not wired up here yet - a country can be thousands of hotels, and
  // that's a bigger operational decision (rate limits, run time) than a
  // button tap should trigger silently. This screen only does explicit,
  // bounded ID-based syncs for now.
  const syncCountryUnavailable = () => {
    Alert.alert(
      'Not Yet Available',
      `Full-country sync for "${countryInput.trim()}" needs a deliberate, rate-limited batch job (a country can be thousands of hotels) - not built yet. Use explicit hotel IDs above for now.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hotel Catalog</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={hotels}
        keyExtractor={(item) => item.tjHotelId}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sync by Hotel IDs</Text>
              <Text style={styles.cardSubtitle}>
                Comma-separated TripJack hotel IDs (tjHotelId), up to 100 per sync.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="100000000038, 100000224831, ..."
                placeholderTextColor={Colors.textMuted}
                value={hotelIdsInput}
                onChangeText={setHotelIdsInput}
                multiline
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={syncSampleIds} disabled={syncing}>
                  <Text style={styles.secondaryButtonText}>Use 30 Sample IDs</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={syncFromIdsInput} disabled={syncing}>
                  {syncing ? (
                    <ActivityIndicator size="small" color={Colors.secondary} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sync</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sync by Country</Text>
              <Text style={styles.cardSubtitle}>Not available yet - see note below.</Text>
              <TextInput
                style={styles.inputSingle}
                placeholder="e.g. INDIA"
                placeholderTextColor={Colors.textMuted}
                value={countryInput}
                onChangeText={setCountryInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.secondaryButtonFull} onPress={syncCountryUnavailable}>
                <Text style={styles.secondaryButtonText}>Sync Country</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{hotels.length} hotel{hotels.length === 1 ? '' : 's'} cached</Text>
              {Object.entries(countryCounts).map(([country, count]) => (
                <Text key={country} style={styles.summaryLine}>{country}: {count}</Text>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.hotelRow}>
            <View style={styles.hotelRowInfo}>
              <Text style={styles.hotelName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.hotelMeta}>
                {item.city}, {item.countryName} · {item.starRating ? `${item.starRating}★` : '—'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <Text style={styles.emptyText}>No hotels cached yet - sync some above.</Text>
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.secondary },
  listContent: { padding: 15 },
  card: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  cardSubtitle: { fontSize: 12, color: '#666', marginTop: 4, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    fontSize: 13,
    color: '#333',
    textAlignVertical: 'top',
  },
  inputSingle: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#333',
  },
  buttonRow: { flexDirection: 'row', marginTop: 10, gap: 10 },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: Colors.secondary, fontWeight: '700', fontSize: 13 },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonFull: {
    marginTop: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#333', fontWeight: '700', fontSize: 13 },
  summaryCard: {
    backgroundColor: '#FFF3EA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 6 },
  summaryLine: { fontSize: 12, color: '#666', marginTop: 2 },
  hotelRow: {
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  hotelRowInfo: {},
  hotelName: { fontSize: 14, fontWeight: '600', color: '#333' },
  hotelMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20, fontSize: 13 },
});

export default HotelCatalogAdminScreen;
