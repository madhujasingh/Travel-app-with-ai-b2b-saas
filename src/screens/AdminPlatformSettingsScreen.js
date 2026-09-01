import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

// Only the flight convenience fee today - see backend PlatformSettings for
// why this is a dedicated screen/entity rather than a generic key-value
// store (single tunable value, not worth the extra indirection yet).
const AdminPlatformSettingsScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentFee, setCurrentFee] = useState(null);
  const [feeInput, setFeeInput] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/platform-settings`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load platform settings.');
      }
      setCurrentFee(data.flightConvenienceFee);
      setFeeInput(String(data.flightConvenienceFee));
    } catch (error) {
      Alert.alert('Platform Settings', error.message || 'Unable to load platform settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    const parsed = Number(feeInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      Alert.alert('Invalid Fee', 'Enter a valid non-negative amount.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/platform-settings/flight-convenience-fee`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ flightConvenienceFee: parsed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to update the convenience fee.');
      }
      setCurrentFee(data.flightConvenienceFee);
      Alert.alert('Saved', `Flight convenience fee is now ₹${data.flightConvenienceFee.toLocaleString()}.`);
    } catch (error) {
      Alert.alert('Save Failed', error.message || 'Unable to update the convenience fee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform Settings</Text>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="pricetag-outline" size={18} color={Colors.primaryDark} />
                <Text style={styles.cardTitle}>Flight Convenience Fee</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                A flat fee added on top of the flight fare at checkout, charged separately from the
                supplier (TripJack) fare. Applies to every flight booking across the app.
              </Text>

              {currentFee != null ? (
                <Text style={styles.currentValue}>Current: ₹{currentFee.toLocaleString()}</Text>
              ) : null}

              <View style={styles.inputRow}>
                <Text style={styles.inputPrefix}>₹</Text>
                <TextInput
                  style={styles.input}
                  value={feeInput}
                  onChangeText={setFeeInput}
                  placeholder="300"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={Colors.secondary} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
  content: {
    padding: 15,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 14,
    lineHeight: 18,
  },
  currentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textLight,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 12,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: Colors.secondary,
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default AdminPlatformSettingsScreen;
