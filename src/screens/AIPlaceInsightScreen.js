import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const AIPlaceInsightScreen = ({ route, navigation }) => {
  const { recommendation } = route.params || {};
  const gallery = recommendation?.gallery || (recommendation?.imageUrl ? [recommendation.imageUrl] : []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={{ uri: gallery[0] }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroTopBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navButton}>
              <Ionicons name="chevron-back" size={22} color={Colors.secondary} />
            </TouchableOpacity>
            <View style={styles.navBadge}>
              <Ionicons name="sparkles-outline" size={14} color={Colors.secondary} />
              <Text style={styles.navBadgeText}>AI Place Story</Text>
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{recommendation?.destination}</Text>
            <Text style={styles.heroSub}>{recommendation?.quickFact}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{recommendation?.title}</Text>
            <Text style={styles.summaryBlurb}>{recommendation?.blurb}</Text>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{recommendation?.match_score}%</Text>
                <Text style={styles.metricLabel}>AI Match</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>₹{Number(recommendation?.price || 0).toLocaleString()}</Text>
                <Text style={styles.metricLabel}>Starting Price</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{recommendation?.duration}</Text>
                <Text style={styles.metricLabel}>Duration</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Travel Snapshot</Text>
            <View style={styles.snapshotGrid}>
              <View style={styles.snapshotCard}>
                <Text style={styles.snapshotLabel}>Best Time</Text>
                <Text style={styles.snapshotValue}>{recommendation?.bestTimeToVisit}</Text>
              </View>
              <View style={styles.snapshotCard}>
                <Text style={styles.snapshotLabel}>Vibe</Text>
                <Text style={styles.snapshotValue}>{recommendation?.vibe}</Text>
              </View>
              <View style={styles.snapshotCardWide}>
                <Text style={styles.snapshotLabel}>Ideal Traveler</Text>
                <Text style={styles.snapshotValue}>{recommendation?.idealTraveler}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visual Moodboard</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gallery.map((imageUrl, index) => (
                <Image key={`${imageUrl}-${index}`} source={{ uri: imageUrl }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why this place fits</Text>
            {(recommendation?.reasons || []).map((reason, index) => (
              <View key={`${reason}-${index}`} style={styles.reasonCard}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Highlights</Text>
            <View style={styles.highlightWrap}>
              {(recommendation?.highlights || []).map((item, index) => (
                <View key={`${item}-${index}`} style={styles.highlightChip}>
                  <Text style={styles.highlightChipText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Known For</Text>
            <View style={styles.knownForCard}>
              {(recommendation?.knownFor || []).map((item, index) => (
                <View key={`${item}-${index}`} style={styles.knownForRow}>
                  <Ionicons name="sparkles-outline" size={14} color={Colors.primary} />
                  <Text style={styles.knownForText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('ItineraryDetail', { itinerary: recommendation, destination: recommendation?.destination, people: '2' })}
          >
            <Ionicons name="navigate-outline" size={18} color={Colors.secondary} style={styles.primaryButtonIcon} />
            <Text style={styles.primaryButtonText}>Open Recommended Package</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { height: 360, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroTopBar: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  navBadgeText: { color: Colors.secondary, marginLeft: 6, fontWeight: '700', fontSize: 12 },
  heroCopy: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
  },
  heroTitle: { color: Colors.secondary, fontSize: 30, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', marginTop: 6, fontSize: 14, lineHeight: 20 },
  content: { padding: 16, paddingBottom: 36 },
  summaryCard: {
    marginTop: -34,
    backgroundColor: Colors.card,
    borderRadius: 22,
    padding: 18,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTitle: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  summaryBlurb: { color: Colors.textLight, lineHeight: 20, marginTop: 8 },
  metricRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    padding: 12,
  },
  metricValue: { color: Colors.primaryDark, fontWeight: '800', fontSize: 13 },
  metricLabel: { color: Colors.textLight, marginTop: 4, fontSize: 11, fontWeight: '600' },
  section: { marginTop: 18 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  snapshotCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  snapshotCardWide: {
    width: '100%',
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#F3D6C6',
    borderRadius: 16,
    padding: 14,
  },
  snapshotLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  snapshotValue: {
    color: Colors.text,
    marginTop: 8,
    lineHeight: 19,
    fontSize: 14,
    fontWeight: '600',
  },
  galleryImage: {
    width: 220,
    height: 150,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#F1D8CB',
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  reasonText: { flex: 1, marginLeft: 8, color: Colors.text, lineHeight: 19 },
  highlightWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  highlightChip: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  highlightChipText: { color: Colors.primaryDark, fontWeight: '700', fontSize: 12 },
  knownForCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  knownForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F6E6DB',
  },
  knownForText: {
    marginLeft: 8,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 22,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButtonIcon: { marginRight: 8 },
  primaryButtonText: { color: Colors.secondary, fontWeight: '800', fontSize: 15 },
});

export default AIPlaceInsightScreen;
