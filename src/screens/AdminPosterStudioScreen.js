import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import API_CONFIG from '../config/api';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

const templates = [
  {
    id: 'launch',
    title: 'Launch Drop',
    eyebrow: 'Fresh package alert',
    backgroundTop: '#742F16',
    backgroundBottom: '#F66A2A',
    accent: '#FFD7C2',
  },
  {
    id: 'luxury',
    title: 'Premium Escape',
    eyebrow: 'Curated luxury edition',
    backgroundTop: '#3C2118',
    backgroundBottom: '#D56B3F',
    accent: '#FFE6C9',
  },
  {
    id: 'flash',
    title: 'Flash Push',
    eyebrow: 'Limited-time momentum',
    backgroundTop: '#A53A12',
    backgroundBottom: '#FF9A63',
    accent: '#FFF1E7',
  },
];

const reasons = [
  { id: 'launch', label: 'Launch', badge: 'Just added' },
  { id: 'seasonal', label: 'Seasonal', badge: 'Trending now' },
  { id: 'offer', label: 'Offer Push', badge: 'Early access' },
];

const formatPrice = (price) => {
  const value = Number(price || 0);
  return Number.isFinite(value) ? `₹${value.toLocaleString()}` : 'Price on request';
};

const AdminPosterStudioScreen = ({ navigation }) => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [itineraries, setItineraries] = useState([]);
  const [selectedItineraryId, setSelectedItineraryId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('launch');
  const [selectedReasonId, setSelectedReasonId] = useState('launch');
  const [copy, setCopy] = useState({
    badge: '',
    headline: '',
    subheadline: '',
    priceLine: '',
    callToAction: '',
    footerNote: '',
  });

  const isAdmin = user?.role === 'ADMIN';
  const selectedItinerary =
    itineraries.find((item) => item.id === selectedItineraryId) || itineraries[0] || null;
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) || templates[0];
  const selectedReason =
    reasons.find((reason) => reason.id === selectedReasonId) || reasons[0];

  const marketingCaption = useMemo(() => {
    if (!selectedItinerary) {
      return '';
    }

    return `${copy.badge} | ${copy.headline}\n${copy.subheadline}\n${copy.priceLine}\n${copy.callToAction}\n${copy.footerNote}`;
  }, [copy, selectedItinerary]);

  useEffect(() => {
    if (!token || !isAdmin) {
      setLoading(false);
      return;
    }

    const loadItineraries = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/itineraries`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'Unable to load itineraries');
        }

        const items = Array.isArray(data) ? data : [];
        setItineraries(items);
        if (items.length > 0) {
          setSelectedItineraryId(items[0].id);
        }
      } catch (error) {
        Alert.alert('Error', error.message || 'Unable to load poster data');
      } finally {
        setLoading(false);
      }
    };

    loadItineraries();
  }, [isAdmin, token]);

  useEffect(() => {
    if (!selectedItinerary) {
      return;
    }

    setCopy({
      badge: selectedReason.badge,
      headline: selectedItinerary.title,
      subheadline: `${selectedItinerary.duration} • ${selectedItinerary.destination}`,
      priceLine: `Starting from ${formatPrice(selectedItinerary.price)} per person`,
      callToAction: 'DM us to reserve your preferred dates',
      footerNote: `${selectedItinerary.category || 'TRAVEL'} • ${selectedItinerary.type || 'CURATED'} • AI-assisted itinerary design`,
    });
  }, [selectedItinerary, selectedReason]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Poster Studio</Text>
        <TouchableOpacity>
          <Ionicons name="color-wand-outline" size={22} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Admin marketing tool</Text>
          <Text style={styles.heroTitle}>Auto-create poster drafts in seconds.</Text>
          <Text style={styles.heroText}>
            Pick an itinerary, switch the campaign intent, and generate polished flyer layouts using saved templates.
          </Text>
        </View>

        {!isAdmin ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Admin access required</Text>
            <Text style={styles.emptyText}>Only admins can generate posters from this studio.</Text>
          </View>
        ) : (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Choose source itinerary</Text>
              {itineraries.length === 0 ? (
                <Text style={styles.emptyText}>Upload at least one itinerary first to generate a poster.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {itineraries.map((itinerary) => (
                    <TouchableOpacity
                      key={itinerary.id}
                      style={[
                        styles.selectionChip,
                        selectedItineraryId === itinerary.id && styles.selectionChipActive,
                      ]}
                      onPress={() => setSelectedItineraryId(itinerary.id)}
                    >
                      <Text
                        style={[
                          styles.selectionChipTitle,
                          selectedItineraryId === itinerary.id && styles.selectionChipTitleActive,
                        ]}
                      >
                        {itinerary.title}
                      </Text>
                      <Text
                        style={[
                          styles.selectionChipMeta,
                          selectedItineraryId === itinerary.id && styles.selectionChipMetaActive,
                        ]}
                      >
                        {itinerary.destination}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Campaign reason</Text>
              <View style={styles.optionRow}>
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.id}
                    style={[
                      styles.pill,
                      selectedReasonId === reason.id && styles.pillActive,
                    ]}
                    onPress={() => setSelectedReasonId(reason.id)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedReasonId === reason.id && styles.pillTextActive,
                      ]}
                    >
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.panelTitle, styles.panelTitleSpacing]}>Saved templates</Text>
              <View style={styles.optionRow}>
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateChoice,
                      selectedTemplateId === template.id && styles.templateChoiceActive,
                    ]}
                    onPress={() => setSelectedTemplateId(template.id)}
                  >
                    <Text
                      style={[
                        styles.templateChoiceTitle,
                        selectedTemplateId === template.id && styles.templateChoiceTitleActive,
                      ]}
                    >
                      {template.title}
                    </Text>
                    <Text
                      style={[
                        styles.templateChoiceMeta,
                        selectedTemplateId === template.id && styles.templateChoiceMetaActive,
                      ]}
                    >
                      {template.eyebrow}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Poster copy</Text>
              <TextInput
                style={styles.input}
                placeholder="Badge"
                value={copy.badge}
                onChangeText={(value) => setCopy((prev) => ({ ...prev, badge: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Headline"
                value={copy.headline}
                onChangeText={(value) => setCopy((prev) => ({ ...prev, headline: value }))}
              />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Subheadline"
                multiline
                value={copy.subheadline}
                onChangeText={(value) => setCopy((prev) => ({ ...prev, subheadline: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Price line"
                value={copy.priceLine}
                onChangeText={(value) => setCopy((prev) => ({ ...prev, priceLine: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Call to action"
                value={copy.callToAction}
                onChangeText={(value) => setCopy((prev) => ({ ...prev, callToAction: value }))}
              />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Footer note"
                multiline
                value={copy.footerNote}
                onChangeText={(value) => setCopy((prev) => ({ ...prev, footerNote: value }))}
              />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Live poster preview</Text>
              <View
                style={[
                  styles.posterCard,
                  {
                    backgroundColor: selectedTemplate.backgroundBottom,
                  },
                ]}
              >
                <View
                  style={[
                    styles.posterOverlay,
                    {
                      backgroundColor: selectedTemplate.backgroundTop,
                    },
                  ]}
                />
                <View style={styles.posterGlow} />
                <View style={styles.posterBadge}>
                  <Text style={styles.posterBadgeText}>{copy.badge}</Text>
                </View>
                <Text style={styles.posterHeadline}>{copy.headline || 'Your package headline'}</Text>
                <Text style={styles.posterSubheadline}>{copy.subheadline || 'Poster subheadline goes here'}</Text>

                <View style={styles.posterPriceRow}>
                  <View style={[styles.posterPriceGlass, { borderColor: selectedTemplate.accent }]}>
                    <Text style={styles.posterPriceLabel}>Offer</Text>
                    <Text style={styles.posterPriceText}>{copy.priceLine || 'Starting from ₹0'}</Text>
                  </View>
                  <View style={[styles.posterIconWrap, { backgroundColor: selectedTemplate.accent }]}>
                    <Ionicons name="sparkles-outline" size={26} color={selectedTemplate.backgroundTop} />
                  </View>
                </View>

                <View style={styles.posterBottom}>
                  <Text style={styles.posterCTA}>{copy.callToAction || 'Book now'}</Text>
                  <Text style={styles.posterFooter}>{copy.footerNote || 'Admin marketing draft'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Caption draft</Text>
              <Text style={styles.captionBox}>{marketingCaption || 'Select an itinerary to auto-generate copy.'}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: Colors.secondary, fontSize: 20, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: Colors.secondary,
    opacity: 0.84,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: { color: Colors.secondary, fontSize: 28, fontWeight: '800', marginTop: 6 },
  heroText: { color: Colors.secondary, opacity: 0.92, marginTop: 8, lineHeight: 20 },
  panel: {
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
  panelTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  panelTitleSpacing: { marginTop: 6 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap' },
  selectionChip: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    minWidth: 170,
  },
  selectionChipActive: { backgroundColor: Colors.primary },
  selectionChipTitle: { color: Colors.primary, fontWeight: '700' },
  selectionChipTitleActive: { color: Colors.secondary },
  selectionChipMeta: { color: Colors.textLight, marginTop: 4, fontSize: 12 },
  selectionChipMetaActive: { color: 'rgba(255,255,255,0.86)' },
  pill: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  pillActive: { backgroundColor: Colors.primary },
  pillText: { color: Colors.primary, fontWeight: '700' },
  pillTextActive: { color: Colors.secondary },
  templateChoice: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 150,
  },
  templateChoiceActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  templateChoiceTitle: { color: Colors.text, fontWeight: '700' },
  templateChoiceTitleActive: { color: Colors.secondary },
  templateChoiceMeta: { color: Colors.textLight, marginTop: 4, fontSize: 12 },
  templateChoiceMetaActive: { color: 'rgba(255,255,255,0.86)' },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    marginBottom: 12,
  },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  posterCard: {
    borderRadius: 28,
    padding: 20,
    minHeight: 360,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  posterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    opacity: 0.65,
  },
  posterGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.14)',
    top: -30,
    right: -40,
  },
  posterBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  posterBadgeText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 },
  posterHeadline: {
    color: Colors.secondary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    marginTop: 14,
  },
  posterSubheadline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: '88%',
  },
  posterPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  posterPriceGlass: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    marginRight: 12,
  },
  posterPriceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  posterPriceText: { color: Colors.secondary, fontSize: 16, fontWeight: '800', marginTop: 4 },
  posterIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterBottom: { marginTop: 24 },
  posterCTA: { color: Colors.secondary, fontSize: 18, fontWeight: '800' },
  posterFooter: { color: 'rgba(255,255,255,0.8)', marginTop: 8, lineHeight: 20 },
  captionBox: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    lineHeight: 21,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  emptyText: { color: Colors.textLight, marginTop: 8, lineHeight: 20 },
});

export default AdminPosterStudioScreen;
