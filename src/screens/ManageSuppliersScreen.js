import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
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
import { phoneDigits } from '../utils/inputSanitizers';

const SUPPLIER_TYPES = ['HOTEL', 'TOUR_OPERATOR', 'TRANSPORT', 'ACTIVITY', 'OTHER'];

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  company: '',
  type: 'HOTEL',
  description: '',
};

const ManageSuppliersScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busySupplierId, setBusySupplierId] = useState(null);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const loadSuppliers = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to load suppliers');
      }
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load suppliers right now.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submitNewSupplier = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.company.trim()) {
      Alert.alert('Missing fields', 'Name, email, phone, and company are required.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_CONFIG.BASE_URL}/suppliers`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          type: form.type,
          description: form.description.trim(),
          // isVerified/isActive intentionally omitted - new suppliers start
          // unverified until reviewed below.
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to add supplier');
      }

      setForm(EMPTY_FORM);
      setAddModalVisible(false);
      setSuppliers((current) => [data, ...current]);
      Alert.alert(
        'Supplier added',
        `${data.name} has been added as unverified. Verify them once you've confirmed the partnership, then they can sign up in the app using ${data.email}.`
      );
    } catch (err) {
      Alert.alert('Add Supplier', err.message || 'Failed to add supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifySupplier = async (supplier) => {
    try {
      setBusySupplierId(supplier.id);
      const response = await fetch(`${API_CONFIG.BASE_URL}/suppliers/${supplier.id}/verify`, {
        method: 'PUT',
        headers: authHeaders,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to verify supplier');
      }
      setSuppliers((current) => current.map((s) => (s.id === supplier.id ? data : s)));
      Alert.alert(
        'Supplier verified',
        `${data.name} can now sign up in the app as a Supplier using ${data.email}.`
      );
    } catch (err) {
      Alert.alert('Verify Supplier', err.message || 'Failed to verify supplier.');
    } finally {
      setBusySupplierId(null);
    }
  };

  const removeSupplier = (supplier) => {
    Alert.alert(
      'Remove supplier',
      `Remove ${supplier.name}? This does not delete any account they've already created - only the supplier record used to approve future signups.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusySupplierId(supplier.id);
              const response = await fetch(`${API_CONFIG.BASE_URL}/suppliers/${supplier.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.message || data?.error || 'Failed to remove supplier');
              }
              setSuppliers((current) => current.filter((s) => s.id !== supplier.id));
            } catch (err) {
              Alert.alert('Remove Supplier', err.message || 'Failed to remove supplier.');
            } finally {
              setBusySupplierId(null);
            }
          },
        },
      ]
    );
  };

  const renderSupplier = ({ item }) => {
    const isBusy = busySupplierId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardCompany}>{item.company}</Text>
          </View>
          <View style={[styles.badge, item.isVerified ? styles.badgeVerified : styles.badgePending]}>
            <Text style={[styles.badgeText, item.isVerified ? styles.badgeTextVerified : styles.badgeTextPending]}>
              {item.isVerified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.cardRow}>
          <Ionicons name="mail-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.cardRowText}>{item.email}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="call-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.cardRowText}>{item.phone}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="pricetag-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.cardRowText}>{item.type}</Text>
        </View>
        {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}

        <View style={styles.cardActions}>
          {!item.isVerified && (
            <TouchableOpacity
              style={[styles.actionButton, styles.verifyButton]}
              onPress={() => verifySupplier(item)}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator color={Colors.secondary} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color={Colors.secondary} />
                  <Text style={styles.verifyButtonText}>Verify</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => removeSupplier(item)}
            disabled={isBusy}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Suppliers</Text>
        <TouchableOpacity onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSuppliers}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSupplier}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No suppliers yet. Tap + to add one.</Text>
            </View>
          }
        />
      )}

      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add supplier</Text>
                <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                  <Ionicons name="close" size={20} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalHint}>
                This creates an unverified supplier record. They can't sign up in the app until you verify them.
              </Text>

              <Text style={styles.fieldLabel}>Contact name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => updateField('name', v)}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Email (they'll sign up with this)</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                placeholder="supplier@company.com"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => updateField('phone', phoneDigits(v))}
                placeholder="Phone number"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={15}
              />

              <Text style={styles.fieldLabel}>Company</Text>
              <TextInput
                style={styles.input}
                value={form.company}
                onChangeText={(v) => updateField('company', v)}
                placeholder="Business name"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeRow}>
                {SUPPLIER_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, form.type === type && styles.typeChipActive]}
                    onPress={() => updateField('type', type)}
                  >
                    <Text style={[styles.typeChipText, form.type === type && styles.typeChipTextActive]}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={form.description}
                onChangeText={(v) => updateField('description', v)}
                placeholder="Any internal notes about this supplier"
                placeholderTextColor={Colors.textMuted}
                multiline
              />

              <TouchableOpacity style={styles.submitButton} onPress={submitNewSupplier} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={Colors.secondary} />
                ) : (
                  <Text style={styles.submitButtonText}>Add Supplier</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  errorText: {
    marginTop: 10,
    color: Colors.textLight,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  emptyText: {
    marginTop: 10,
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  cardCompany: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 2,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeVerified: {
    backgroundColor: '#E3F6E8',
  },
  badgePending: {
    backgroundColor: '#FFF3D9',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextVerified: {
    color: Colors.success,
  },
  badgeTextPending: {
    color: '#B8860B',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardRowText: {
    fontSize: 13,
    color: Colors.textLight,
  },
  cardDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  verifyButton: {
    backgroundColor: Colors.success,
  },
  verifyButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  removeButton: {
    borderWidth: 1,
    borderColor: Colors.error,
  },
  removeButtonText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: 12,
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
    padding: 18,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  typeChipTextActive: {
    color: Colors.secondary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  submitButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default ManageSuppliersScreen;
