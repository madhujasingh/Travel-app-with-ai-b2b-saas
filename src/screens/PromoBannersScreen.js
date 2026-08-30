import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import { digitsOnly } from '../utils/inputSanitizers';

const PLACEMENTS = ['HOME', 'HOTELS'];
const LINK_TYPES = ['NONE', 'SCREEN', 'URL'];

// Only customer-facing screens that work with no extra params - e.g.
// HotelDetail/ActivityDetail require a specific hotel/activity id and can't
// be a static banner target. Label is what the admin sees; value is the
// exact screen name registered in App.js's navigator.
const SCREEN_OPTIONS = [
  { label: 'Hotels', value: 'Hotels' },
  { label: 'Flights', value: 'Flights' },
  { label: 'Activities', value: 'Activities' },
  { label: 'Land Packages', value: 'LandPackage' },
  { label: 'Group Trip Planner', value: 'GroupTripPlanner' },
  { label: 'AI Picks', value: 'AIRecommendations' },
];

const EMPTY_FORM = {
  title: '',
  placement: 'HOME',
  linkType: 'NONE',
  linkTarget: '',
  displayOrder: '0',
};

const PromoBannersScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedImage, setSelectedImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyBannerId, setBusyBannerId] = useState(null);

  const authHeader = { Authorization: `Bearer ${token}` };

  const loadBanners = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${API_CONFIG.BASE_URL}/promo-banners/admin`, {
        headers: authHeader,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to load promo banners');
      }
      setBanners(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load promo banners right now.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to pick a banner image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      aspect: [16, 9],
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSelectedImage(null);
    setEditingBanner(null);
  };

  const openAddModal = () => {
    resetForm();
    setAddModalVisible(true);
  };

  const openEditModal = (banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title,
      placement: banner.placement,
      linkType: banner.linkType,
      linkTarget: banner.linkTarget || '',
      displayOrder: String(banner.displayOrder ?? 0),
    });
    setSelectedImage(null);
    setAddModalVisible(true);
  };

  const submitBanner = async () => {
    if (!form.title.trim()) {
      Alert.alert('Missing title', 'Please give this banner a title.');
      return;
    }
    if (!selectedImage && !editingBanner) {
      Alert.alert('Missing image', 'Please pick an image for this banner.');
      return;
    }
    if (form.linkType !== 'NONE' && !form.linkTarget.trim()) {
      Alert.alert(
        'Missing link target',
        form.linkType === 'SCREEN' ? 'Please pick which screen to navigate to.' : 'Please enter the URL to open.'
      );
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      if (selectedImage) {
        formData.append('image', {
          uri: selectedImage.uri,
          name: 'banner.jpg',
          type: 'image/jpeg',
        });
      }
      formData.append('title', form.title.trim());
      formData.append('placement', form.placement);
      formData.append('linkType', form.linkType);
      formData.append('linkTarget', form.linkTarget.trim());
      formData.append('displayOrder', form.displayOrder || '0');

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/promo-banners${editingBanner ? `/${editingBanner.id}` : ''}`,
        {
          method: editingBanner ? 'PUT' : 'POST',
          headers: authHeader,
          body: formData,
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to save banner');
      }
      setAddModalVisible(false);
      resetForm();
      loadBanners();
    } catch (err) {
      Alert.alert('Save Failed', err.message || 'Unable to save this banner.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (banner) => {
    try {
      setBusyBannerId(banner.id);
      const formData = new FormData();
      formData.append('active', String(!banner.active));
      const response = await fetch(`${API_CONFIG.BASE_URL}/promo-banners/${banner.id}`, {
        method: 'PUT',
        headers: authHeader,
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to update banner');
      }
      loadBanners();
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Unable to update this banner.');
    } finally {
      setBusyBannerId(null);
    }
  };

  const deleteBanner = (banner) => {
    Alert.alert('Delete banner', `Remove "${banner.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusyBannerId(banner.id);
            const response = await fetch(`${API_CONFIG.BASE_URL}/promo-banners/${banner.id}`, {
              method: 'DELETE',
              headers: authHeader,
            });
            if (!response.ok && response.status !== 204) {
              throw new Error('Failed to delete banner');
            }
            loadBanners();
          } catch (err) {
            Alert.alert('Delete Failed', err.message || 'Unable to delete this banner.');
          } finally {
            setBusyBannerId(null);
          }
        },
      },
    ]);
  };

  const renderBanner = ({ item }) => (
    <View style={styles.bannerCard}>
      <Image
        source={{ uri: `${API_CONFIG.BASE_URL}/promo-banners/${item.id}/image` }}
        style={styles.bannerThumb}
      />
      <View style={styles.bannerInfo}>
        <Text style={styles.bannerTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.bannerMeta}>
          {item.placement} · {item.linkType}
          {item.linkTarget ? ` → ${item.linkTarget}` : ''} · order {item.displayOrder}
        </Text>
        <View style={styles.bannerActions}>
          <View style={styles.activeRow}>
            <Text style={styles.activeLabel}>Active</Text>
            {busyBannerId === item.id ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Switch value={item.active} onValueChange={() => toggleActive(item)} />
            )}
          </View>
          <View style={styles.cardIconRow}>
            <TouchableOpacity onPress={() => openEditModal(item)} disabled={busyBannerId === item.id}>
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteBanner(item)} disabled={busyBannerId === item.id}>
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promo Banners</Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add-circle" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadBanners}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : banners.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>No promo banners yet. Tap + to add one.</Text>
        </View>
      ) : (
        <FlatList
          data={banners}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBanner}
          contentContainerStyle={styles.list}
        />
      )}

      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingBanner ? 'Edit Promo Banner' : 'New Promo Banner'}</Text>
                <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                  <Ionicons name="close" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {selectedImage ? (
                  <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                ) : editingBanner ? (
                  <Image
                    source={{ uri: `${API_CONFIG.BASE_URL}/promo-banners/${editingBanner.id}/image` }}
                    style={styles.imagePreview}
                  />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
                    <Text style={styles.imagePickerText}>Pick an image</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Flat 30% off Goa Hotels"
                placeholderTextColor={Colors.textMuted}
                value={form.title}
                onChangeText={(value) => updateField('title', value)}
              />

              <Text style={styles.fieldLabel}>Placement</Text>
              <View style={styles.chipRow}>
                {PLACEMENTS.map((placement) => (
                  <TouchableOpacity
                    key={placement}
                    style={[styles.chip, form.placement === placement && styles.chipSelected]}
                    onPress={() => updateField('placement', placement)}
                  >
                    <Text style={[styles.chipText, form.placement === placement && styles.chipTextSelected]}>
                      {placement}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Tap Action</Text>
              <View style={styles.chipRow}>
                {LINK_TYPES.map((linkType) => (
                  <TouchableOpacity
                    key={linkType}
                    style={[styles.chip, form.linkType === linkType && styles.chipSelected]}
                    onPress={() => {
                      updateField('linkType', linkType);
                      updateField('linkTarget', '');
                    }}
                  >
                    <Text style={[styles.chipText, form.linkType === linkType && styles.chipTextSelected]}>
                      {linkType}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.linkType === 'SCREEN' && (
                <>
                  <Text style={styles.fieldLabel}>Which screen?</Text>
                  <View style={styles.chipRow}>
                    {SCREEN_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.chip, form.linkTarget === option.value && styles.chipSelected]}
                        onPress={() => updateField('linkTarget', option.value)}
                      >
                        <Text style={[styles.chipText, form.linkTarget === option.value && styles.chipTextSelected]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {form.linkType === 'URL' && (
                <>
                  <Text style={styles.fieldLabel}>URL</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    placeholderTextColor={Colors.textMuted}
                    value={form.linkTarget}
                    onChangeText={(value) => updateField('linkTarget', value)}
                    autoCapitalize="none"
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>Display Order</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                value={form.displayOrder}
                onChangeText={(value) => updateField('displayOrder', digitsOnly(value))}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={submitBanner}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.secondary} />
                ) : (
                  <Text style={styles.submitButtonText}>{editingBanner ? 'Save Changes' : 'Add Banner'}</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: Colors.error, textAlign: 'center', marginBottom: 12 },
  retryButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: { color: Colors.primary, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  bannerCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bannerThumb: { width: 100, height: 100 },
  bannerInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  bannerMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  activeLabel: { fontSize: 12, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  imagePicker: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundAlt,
  },
  imagePickerText: { color: Colors.textMuted, marginTop: 6, fontSize: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  chipTextSelected: { color: Colors.secondary },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: Colors.secondary, fontWeight: '700', fontSize: 15 },
});

export default PromoBannersScreen;
