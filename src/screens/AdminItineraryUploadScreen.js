import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import { useAuth } from '../context/AuthContext';

const itineraryTypes = ['BUDGET', 'PREMIUM', 'ADVENTURE', 'FAMILY', 'ROMANTIC'];
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

const AdminItineraryUploadScreen = ({ navigation }) => {
  const { token, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    destination: '',
    duration: '',
    price: '',
    description: '',
    imageUrl: '',
    type: 'PREMIUM',
    category: 'INTERNATIONAL',
    highlights: '',
    inclusions: '',
    exclusions: '',
  });
  const [dayPlans, setDayPlans] = useState([createEmptyDay(1)]);

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

  const submitItinerary = async () => {
    if (!isAdmin) {
      Alert.alert('Access denied', 'Only admins can upload itineraries.');
      return;
    }

    if (!canSubmit || !token) {
      Alert.alert('Missing details', 'Please complete the required package fields and each day plan.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        destination: form.destination.trim(),
        duration: form.duration.trim(),
        price: Number(form.price),
        rating: 5,
        reviewCount: 0,
        description: form.description.trim() || `${form.destination.trim()} itinerary created by admin`,
        imageUrl: form.imageUrl.trim() || 'briefcase-outline',
        type: form.type,
        category: form.category,
        isActive: true,
        highlights: splitLines(form.highlights),
        inclusions: splitLines(form.inclusions),
        exclusions: splitLines(form.exclusions),
        dayPlans: dayPlans.map((day) => ({
          dayNumber: day.dayNumber,
          title: day.title.trim(),
          activities: splitLines(day.activitiesText).map(parseActivityLine),
        })),
      };

      const response = await fetch(`${API_CONFIG.BASE_URL}/itineraries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to create itinerary');
      }

      Alert.alert('Itinerary uploaded', 'Your itinerary is now live in the app.', [
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
              highlights: '',
              inclusions: '',
              exclusions: '',
            });
            setDayPlans([createEmptyDay(1)]);
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Upload failed', error.message || 'Unable to upload itinerary.');
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
        <Text style={styles.headerTitle}>Upload Itinerary</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Admin Publishing Studio</Text>
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
              onChangeText={(value) => updateForm('price', value)}
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
            placeholder="Icon name (optional, e.g. airplane-outline)"
            value={form.imageUrl}
            onChangeText={(value) => updateForm('imageUrl', value)}
          />
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
          <Text style={styles.submitText}>{submitting ? 'Publishing...' : 'Publish Itinerary'}</Text>
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
