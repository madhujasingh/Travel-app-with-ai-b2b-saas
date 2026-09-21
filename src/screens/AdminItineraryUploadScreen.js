import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';
import { parseFlyerText } from '../utils/flyerTextParser';
import { decimalOnly } from '../utils/inputSanitizers';

const itineraryTypes = ['BUDGET', 'PREMIUM', 'ADVENTURE', 'FAMILY', 'ROMANTIC'];
const ratingOptions = [1, 2, 3, 4, 5];

// expo-image-picker hands back a file:// uri on native and a blob:/data: one
// on web. React Native's FormData takes the {uri, name, type} shape; the
// browser's needs a real Blob, so the picked asset is normalised here rather
// than at each call site.
const appendImageTo = async (formData, asset) => {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    formData.append('image', blob, asset.fileName || 'cover.jpg');
    return;
  }
  formData.append('image', {
    uri: asset.uri,
    name: asset.fileName || 'cover.jpg',
    type: asset.mimeType || 'image/jpeg',
  });
};
const itineraryCategories = ['INDIA', 'INTERNATIONAL'];

const createEmptyDay = (dayNumber) => ({
  dayNumber,
  title: '',
  activitiesText: '',
});

const splitLines = (value) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const inferIcon = (activityText) => {
  const text = activityText.toLowerCase();

  if (text.includes('flight') || text.includes('airport') || text.includes('departure')) {
    return 'airplane-outline';
  }
  if (text.includes('transfer') || text.includes('pickup') || text.includes('drop')) {
    return 'car-outline';
  }
  if (text.includes('breakfast') || text.includes('lunch') || text.includes('dinner') || text.includes('meal')) {
    return 'restaurant-outline';
  }
  if (text.includes('beach') || text.includes('island') || text.includes('boat')) {
    return 'boat-outline';
  }
  if (text.includes('hotel') || text.includes('check-in') || text.includes('check out')) {
    return 'bed-outline';
  }
  if (text.includes('market') || text.includes('shopping')) {
    return 'cart-outline';
  }
  if (text.includes('temple') || text.includes('museum') || text.includes('sightseeing') || text.includes('tour')) {
    return 'business-outline';
  }
  if (text.includes('sunset') || text.includes('sunrise')) {
    return 'sunny-outline';
  }

  return 'ellipse-outline';
};

const parseActivityLine = (line) => {
  const [timePart, ...rest] = line.split(' - ');
  if (rest.length === 0) {
    return {
      time: 'Flexible',
      activity: line.trim(),
      icon: inferIcon(line),
    };
  }

  const activityText = rest.join(' - ').trim();
  return {
    time: timePart.trim(),
    activity: activityText,
    icon: inferIcon(activityText),
  };
};

const AdminItineraryUploadScreen = ({ navigation, route }) => {
  const { token, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Opened from the manage-packages list with a package to edit, or from the
  // dashboard tile with nothing, in which case this creates a new one.
  const editing = route?.params?.itinerary || null;

  const [form, setForm] = useState({
    title: editing?.title || '',
    destination: editing?.destination || '',
    duration: editing?.duration || '',
    price: editing?.price != null ? String(editing.price) : '',
    description: editing?.description || '',
    imageUrl: editing?.imageUrl || '',
    type: editing?.type || 'PREMIUM',
    category: editing?.category || 'INTERNATIONAL',
    rating: editing?.rating != null ? Number(editing.rating) : 5,
    isActive: editing?.isActive !== false,
    highlights: (editing?.highlights || []).join('\n'),
    inclusions: (editing?.inclusions || []).join('\n'),
    exclusions: (editing?.exclusions || []).join('\n'),
  });
  const [dayPlans, setDayPlans] = useState(
    editing?.dayPlans?.length
      ? editing.dayPlans.map((day) => ({
          dayNumber: day.dayNumber,
          title: day.title || '',
          activitiesText: (day.activities || [])
            .map((a) => `${a.time ? `${a.time} - ` : ''}${a.activity || ''}`)
            .join('\n'),
        }))
      : [createEmptyDay(1)]
  );
  const [pasteText, setPasteText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const isAdmin = user?.role === 'ADMIN';
  const canSubmit = useMemo(
    () =>
      form.title.trim() &&
      form.destination.trim() &&
      form.duration.trim() &&
      form.price.trim() &&
      dayPlans.every((day) => day.title.trim() && day.activitiesText.trim()),
    [form, dayPlans]
  );

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDayPlan = (index, field, value) => {
    setDayPlans((prev) =>
      prev.map((day, currentIndex) =>
        currentIndex === index ? { ...day, [field]: value } : day
      )
    );
  };

  const addDayPlan = () => {
    setDayPlans((prev) => [...prev, createEmptyDay(prev.length + 1)]);
  };

  const removeDayPlan = (index) => {
    setDayPlans((prev) =>
      prev
        .filter((_, currentIndex) => currentIndex !== index)
        .map((day, currentIndex) => ({ ...day, dayNumber: currentIndex + 1 }))
    );
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      appAlert('Nothing to parse', 'Paste the package details first.');
      return;
    }

    const parsed = parseFlyerText(pasteText);
    const matchedAny = Object.values(parsed).some((value) => value !== undefined);
    if (!matchedAny) {
      appAlert(
        'Could not parse',
        'Didn’t recognize any fields. Try formatting with labels like "Destination:", "Price: ₹...", "Highlights:", and "Day 1: ..." on their own lines.'
      );
      return;
    }

    setForm((prev) => ({
      ...prev,
      ...(parsed.title !== undefined && { title: parsed.title }),
      ...(parsed.destination !== undefined && { destination: parsed.destination }),
      ...(parsed.duration !== undefined && { duration: parsed.duration }),
      ...(parsed.price !== undefined && { price: parsed.price }),
      ...(parsed.highlights !== undefined && { highlights: parsed.highlights }),
      ...(parsed.inclusions !== undefined && { inclusions: parsed.inclusions }),
      ...(parsed.exclusions !== undefined && { exclusions: parsed.exclusions }),
    }));
    if (parsed.dayPlans) {
      setDayPlans(parsed.dayPlans);
    }

    appAlert('Parsed', 'Fields below have been filled in — review and edit before publishing.');
  };

  const pickImage = async () => {
    // The web picker needs no OS permission, and asking for one there returns
    // denied, which would block the picker that actually works.
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        appAlert('Permission needed', 'Please allow photo library access to pick a cover photo.');
        return;
      }
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

  // The photo goes up separately from the package body: the bytes are
  // @JsonIgnore on the server, so they can't ride along in the JSON, and
  // keeping them apart means the cover can be swapped later without
  // resending the whole package.
  const uploadCoverPhoto = async (itineraryId) => {
    if (!selectedImage) {
      return true;
    }
    const formData = new FormData();
    await appendImageTo(formData, selectedImage);
    const response = await fetch(`${API_CONFIG.BASE_URL}/itineraries/${itineraryId}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return response.ok;
  };

  const submitItinerary = async () => {
    if (!isAdmin) {
      appAlert('Access denied', 'Only admins can upload itineraries.');
      return;
    }

    if (!canSubmit || !token) {
      appAlert('Missing details', 'Please complete the required package fields and each day plan.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        destination: form.destination.trim(),
        duration: form.duration.trim(),
        price: Number(form.price),
        rating: Number(form.rating) || 5,
        reviewCount: editing?.reviewCount ?? 0,
        description: form.description.trim() || `${form.destination.trim()} itinerary created by admin`,
        imageUrl: form.imageUrl.trim() || 'briefcase-outline',
        type: form.type,
        category: form.category,
        isActive: form.isActive,
        highlights: splitLines(form.highlights),
        inclusions: splitLines(form.inclusions),
        exclusions: splitLines(form.exclusions),
        dayPlans: dayPlans.map((day) => ({
          dayNumber: day.dayNumber,
          title: day.title.trim(),
          activities: splitLines(day.activitiesText).map(parseActivityLine),
        })),
      };

      const response = await fetch(
        editing
          ? `${API_CONFIG.BASE_URL}/itineraries/${editing.id}`
          : `${API_CONFIG.BASE_URL}/itineraries`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || `Failed to ${editing ? 'update' : 'create'} itinerary`
        );
      }

      // A failed photo must not read as a failed package - the package is
      // already saved by this point, and saying otherwise would send the
      // admin back to re-enter everything.
      const photoOk = await uploadCoverPhoto(data.id);
      if (!photoOk) {
        appAlert(
          'Package saved, photo failed',
          'The package was saved, but its cover photo could not be uploaded. Open it from Manage Packages to try the photo again.'
        );
      }

      if (editing) {
        appAlert('Package updated', 'Your changes are live.', [
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      appAlert('Itinerary uploaded', 'Your itinerary is now live in the app.', [
        {
          text: 'View Details',
          onPress: () => navigation.replace('ItineraryDetail', { itinerary: data }),
        },
        {
          text: 'Create Another',
          onPress: () => {
            setForm({
              title: '',
              destination: '',
              duration: '',
              price: '',
              description: '',
              imageUrl: '',
              type: 'PREMIUM',
              category: 'INTERNATIONAL',
              rating: 5,
              isActive: true,
              highlights: '',
              inclusions: '',
              exclusions: '',
            });
            setDayPlans([createEmptyDay(1)]);
            setSelectedImage(null);
          },
        },
      ]);
    } catch (error) {
      appAlert('Upload failed', error.message || 'Unable to upload itinerary.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Edit Package' : 'Upload Itinerary'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{editing ? `Editing: ${editing.title}` : 'Admin Publishing Studio'}</Text>
          <Text style={styles.heroText}>
            Create a destination package with the same day-wise format users already see in the app.
          </Text>
        </View>

        {!isAdmin ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Admin access required</Text>
            <Text style={styles.warningText}>Log in as an admin account to publish itineraries.</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paste Package Details</Text>
          <Text style={styles.helperText}>
            Paste the supplier's raw text (WhatsApp/email) here - lines like "Destination:", "Price: ₹...",
            "Highlights:", and "Day 1: ..." get split into the fields below automatically.
          </Text>
          <TextInput
            style={[styles.input, styles.textAreaLarge]}
            placeholder={'e.g.\nBali Bliss Getaway\nDestination: Bali, Indonesia\nDuration: 5 Days / 4 Nights\nPrice: ₹45,000\n\nHighlights:\n- Private villa stay\n- Sunset dinner cruise\n\nDay 1: Arrival\n14:00 - Airport pickup'}
            multiline
            value={pasteText}
            onChangeText={setPasteText}
          />
          <TouchableOpacity style={styles.parseButton} onPress={handleParsePaste}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.secondary} />
            <Text style={styles.parseButtonText}>Parse & Fill Fields</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Package Basics</Text>
          <TextInput style={styles.input} placeholder="Title" value={form.title} onChangeText={(value) => updateForm('title', value)} />
          <TextInput style={styles.input} placeholder="Destination" value={form.destination} onChangeText={(value) => updateForm('destination', value)} />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Duration"
              value={form.duration}
              onChangeText={(value) => updateForm('duration', value)}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Price"
              keyboardType="numeric"
              value={form.price}
              onChangeText={(value) => updateForm('price', decimalOnly(value))}
            />
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            multiline
            value={form.description}
            onChangeText={(value) => updateForm('description', value)}
          />
          <TextInput
            style={styles.input}
            placeholder="Fallback icon name (optional, e.g. airplane-outline)"
            value={form.imageUrl}
            onChangeText={(value) => updateForm('imageUrl', value)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cover Photo</Text>
          <Text style={styles.sectionHint}>
            Shown on the package card and detail screen. 16:9 works best.
          </Text>

          {selectedImage ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.coverPreview} />
          ) : editing?.hasImage ? (
            <Image
              source={{ uri: `${API_CONFIG.BASE_URL}/itineraries/${editing.id}/image` }}
              style={styles.coverPreview}
            />
          ) : (
            <View style={[styles.coverPreview, styles.coverEmpty]}>
              <Ionicons name="image-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.coverEmptyText}>No photo yet</Text>
            </View>
          )}

          <View style={styles.row}>
            <TouchableOpacity style={[styles.photoButton, styles.halfInput]} onPress={pickImage}>
              <Ionicons name="image-outline" size={18} color={Colors.primary} />
              <Text style={styles.photoButtonText}>
                {selectedImage || editing?.hasImage ? 'Change photo' : 'Choose photo'}
              </Text>
            </TouchableOpacity>
            {selectedImage ? (
              <TouchableOpacity
                style={[styles.photoButton, styles.halfInput]}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close-outline" size={18} color={Colors.textMuted} />
                <Text style={styles.photoButtonText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type</Text>
          <View style={styles.chipRow}>
            {itineraryTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, form.type === type && styles.chipActive]}
                onPress={() => updateForm('type', type)}
              >
                <Text style={[styles.chipText, form.type === type && styles.chipTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.sectionTitle, styles.sectionTitleCompact]}>Category</Text>
          <View style={styles.chipRow}>
            {itineraryCategories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.chip, form.category === category && styles.chipActive]}
                onPress={() => updateForm('category', category)}
              >
                <Text style={[styles.chipText, form.category === category && styles.chipTextActive]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, styles.sectionTitleCompact]}>Rating</Text>
          <View style={styles.chipRow}>
            {ratingOptions.map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, form.rating === value && styles.chipActive]}
                onPress={() => updateForm('rating', value)}
              >
                <Ionicons
                  name="star"
                  size={13}
                  color={form.rating === value ? Colors.secondary : Colors.textMuted}
                />
                <Text style={[styles.chipText, form.rating === value && styles.chipTextActive]}>
                  {' '}{value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Visible to customers</Text>
              <Text style={styles.sectionHint}>
                Turn this off to take the package off sale without deleting it.
              </Text>
            </View>
            <Switch
              value={form.isActive}
              onValueChange={(value) => updateForm('isActive', value)}
              trackColor={{ true: Colors.primary }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Highlights & Inclusions</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={'Highlights, one per line'}
            multiline
            value={form.highlights}
            onChangeText={(value) => updateForm('highlights', value)}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={'Inclusions, one per line'}
            multiline
            value={form.inclusions}
            onChangeText={(value) => updateForm('inclusions', value)}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={'Exclusions, one per line'}
            multiline
            value={form.exclusions}
            onChangeText={(value) => updateForm('exclusions', value)}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.dayHeader}>
            <Text style={styles.sectionTitle}>Day-wise Plan</Text>
            <TouchableOpacity style={styles.addDayButton} onPress={addDayPlan}>
              <Ionicons name="add" size={18} color={Colors.secondary} />
              <Text style={styles.addDayText}>Add Day</Text>
            </TouchableOpacity>
          </View>

          {dayPlans.map((day, index) => (
            <View key={day.dayNumber} style={styles.dayCard}>
              <View style={styles.dayCardHeader}>
                <Text style={styles.dayTitle}>Day {day.dayNumber}</Text>
                {dayPlans.length > 1 ? (
                  <TouchableOpacity onPress={() => removeDayPlan(index)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Day title"
                value={day.title}
                onChangeText={(value) => updateDayPlan(index, 'title', value)}
              />
              <TextInput
                style={[styles.input, styles.textAreaLarge]}
                placeholder={'Activities, one per line\nExample: Morning - Airport pickup\nExample: Evening - Sunset cruise'}
                multiline
                value={day.activitiesText}
                onChangeText={(value) => updateDayPlan(index, 'activitiesText', value)}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!canSubmit || submitting || !isAdmin) && styles.submitButtonDisabled]}
          onPress={submitItinerary}
          disabled={!canSubmit || submitting || !isAdmin}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.secondary} style={styles.submitIcon} />
          <Text style={styles.submitText}>
            {submitting
              ? (editing ? 'Saving...' : 'Publishing...')
              : (editing ? 'Save Changes' : 'Publish Itinerary')}
          </Text>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: Colors.secondary,
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroTitle: {
    color: Colors.secondary,
    fontSize: 24,
    fontWeight: '800',
  },
  heroText: {
    color: Colors.secondary,
    opacity: 0.9,
    marginTop: 8,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#FFF4E5',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  warningTitle: {
    color: '#A35A00',
    fontWeight: '700',
    fontSize: 16,
  },
  warningText: {
    color: '#A35A00',
    marginTop: 6,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  sectionTitleCompact: {
    marginTop: 6,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textMuted || '#777',
    marginBottom: 10,
  },
  coverPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#EFEFEF',
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CFCFCF',
  },
  coverEmptyText: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.textMuted || '#777',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FAFAFA',
  },
  photoButtonText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textDark || '#222',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textDark || '#222',
  },
  helperText: {
    fontSize: 13,
    color: Colors.textMuted || '#777',
    marginBottom: 12,
    lineHeight: 18,
  },
  parseButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parseButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
    marginLeft: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    color: Colors.text,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.secondary,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addDayText: {
    color: Colors.secondary,
    fontWeight: '700',
    marginLeft: 4,
  },
  dayCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayTitle: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitIcon: {
    marginRight: 8,
  },
  submitText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: '800',
  },
});

export default AdminItineraryUploadScreen;
