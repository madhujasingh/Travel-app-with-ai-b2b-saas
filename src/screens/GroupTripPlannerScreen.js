import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const categoryMeta = {
  RESTAURANT: { title: 'Restaurants', icon: 'restaurant-outline' },
  ACTIVITY: { title: 'Activities', icon: 'bicycle-outline' },
  LODGING: { title: 'Stays', icon: 'bed-outline' },
};

const GroupTripPlannerScreen = ({ navigation }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [joiningTrip, setJoiningTrip] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripDetail, setTripDetail] = useState(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    destination: '',
    description: '',
  });
  const [joinCode, setJoinCode] = useState('');
  const [optionForm, setOptionForm] = useState({
    category: 'RESTAURANT',
    title: '',
    description: '',
    location: '',
  });

  const activeTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0] || null,
    [selectedTripId, trips]
  );

  const loadTrips = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load group trips');
      }

      setTrips(Array.isArray(data) ? data : []);
      if ((Array.isArray(data) ? data : []).length > 0) {
        const defaultTripId = selectedTripId || data[0].id;
        setSelectedTripId(defaultTripId);
      } else {
        setTripDetail(null);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load group planner');
    } finally {
      setLoading(false);
    }
  }, [selectedTripId, token]);

  const loadTripDetail = useCallback(async (tripId) => {
    if (!token || !tripId) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load trip');
      }
      setTripDetail(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load group trip details');
    }
  }, [token]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (activeTrip?.id) {
      loadTripDetail(activeTrip.id);
    }
  }, [activeTrip?.id, loadTripDetail]);

  const createTrip = async () => {
    if (!createForm.title.trim() || !createForm.destination.trim()) {
      Alert.alert('Missing details', 'Please enter a trip title and destination.');
      return;
    }

    setCreatingTrip(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to create trip');
      }

      setCreateForm({ title: '', destination: '', description: '' });
      await loadTrips();
      setSelectedTripId(data.id);
      setTripDetail(data);
      Alert.alert('Group trip created', 'Invite friends and start voting on options.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to create group trip');
    } finally {
      setCreatingTrip(false);
    }
  };

  const joinTrip = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Missing invite code', 'Enter the invite code to join a group trip.');
      return;
    }

    setJoiningTrip(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to join trip');
      }

      setJoinCode('');
      await loadTrips();
      setSelectedTripId(data.id);
      setTripDetail(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to join trip');
    } finally {
      setJoiningTrip(false);
    }
  };

  const addOption = async () => {
    if (!tripDetail?.id) {
      return;
    }
    if (!optionForm.title.trim()) {
      Alert.alert('Missing title', 'Add a title for this option.');
      return;
    }

    setAddingOption(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips/${tripDetail.id}/options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(optionForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to add option');
      }

      setOptionForm({
        category: optionForm.category,
        title: '',
        description: '',
        location: '',
      });
      await loadTripDetail(tripDetail.id);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to add option');
    } finally {
      setAddingOption(false);
    }
  };

  const voteOnOption = async (optionId, voteValue) => {
    if (!tripDetail?.id) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips/${tripDetail.id}/options/${optionId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voteValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to vote');
      }
      await loadTripDetail(tripDetail.id);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to save vote');
    }
  };

  const lockWinner = async (optionId) => {
    if (!tripDetail?.id) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips/${tripDetail.id}/options/${optionId}/lock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to lock winner');
      }
      setTripDetail(data);
      await loadTrips();
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to lock winner');
    }
  };

  const renderOptionCard = (option) => (
    <View key={option.id} style={styles.optionCard}>
      <View style={styles.optionHeader}>
        <View style={styles.optionTitleBlock}>
          <Text style={styles.optionTitle}>{option.title}</Text>
          {!!option.location && <Text style={styles.optionMeta}>{option.location}</Text>}
          {!!option.description && <Text style={styles.optionDescription}>{option.description}</Text>}
          <Text style={styles.optionByline}>Added by {option.addedByName}</Text>
        </View>
        <View style={[styles.scorePill, option.lockedWinner && styles.scorePillActive]}>
          <Text style={styles.scoreLabel}>{option.lockedWinner ? 'Winner' : 'Score'}</Text>
          <Text style={styles.scoreValue}>{option.score}</Text>
        </View>
      </View>

      <View style={styles.voteRow}>
        <TouchableOpacity
          style={[styles.voteButton, option.currentUserVote === 1 && styles.voteButtonPositive]}
          onPress={() => voteOnOption(option.id, 1)}
        >
          <Ionicons name="thumbs-up-outline" size={16} color={option.currentUserVote === 1 ? Colors.secondary : Colors.primary} />
          <Text style={[styles.voteButtonText, option.currentUserVote === 1 && styles.voteButtonTextActive]}>
            {option.upvotes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteButton, option.currentUserVote === -1 && styles.voteButtonNegative]}
          onPress={() => voteOnOption(option.id, -1)}
        >
          <Ionicons name="thumbs-down-outline" size={16} color={option.currentUserVote === -1 ? Colors.secondary : Colors.textLight} />
          <Text style={[styles.voteButtonText, option.currentUserVote === -1 && styles.voteButtonTextActive]}>
            {option.downvotes}
          </Text>
        </TouchableOpacity>
        {tripDetail?.organizer ? (
          <TouchableOpacity style={styles.lockButton} onPress={() => lockWinner(option.id)}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.secondary} />
            <Text style={styles.lockButtonText}>{option.lockedWinner ? 'Locked' : 'Lock Winner'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>Group Planner</Text>
        <TouchableOpacity onPress={loadTrips}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Test the concept live</Text>
          <Text style={styles.heroTitle}>Plan together, vote together.</Text>
          <Text style={styles.heroText}>
            Create a trip, invite your group, collect votes on restaurants, stays, and activities, then lock the winners.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Start a new group trip</Text>
          <TextInput
            style={styles.input}
            placeholder="Trip title"
            value={createForm.title}
            onChangeText={(value) => setCreateForm((prev) => ({ ...prev, title: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Destination"
            value={createForm.destination}
            onChangeText={(value) => setCreateForm((prev) => ({ ...prev, destination: value }))}
          />
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Optional vibe or notes"
            multiline
            value={createForm.description}
            onChangeText={(value) => setCreateForm((prev) => ({ ...prev, description: value }))}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={createTrip} disabled={creatingTrip}>
            <Text style={styles.primaryButtonText}>{creatingTrip ? 'Creating...' : 'Create Group Trip'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Join with invite code</Text>
          <View style={styles.joinRow}>
            <TextInput
              style={[styles.input, styles.joinInput]}
              placeholder="e.g. A1B2C3"
              autoCapitalize="characters"
              value={joinCode}
              onChangeText={setJoinCode}
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={joinTrip} disabled={joiningTrip}>
              <Text style={styles.secondaryButtonText}>{joiningTrip ? 'Joining...' : 'Join'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Your group trips</Text>
          {trips.length === 0 ? (
            <Text style={styles.emptyText}>No group trips yet. Create one above to start testing the feature.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {trips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={[styles.tripChip, selectedTripId === trip.id && styles.tripChipActive]}
                  onPress={() => setSelectedTripId(trip.id)}
                >
                  <Text style={[styles.tripChipTitle, selectedTripId === trip.id && styles.tripChipTitleActive]}>
                    {trip.title}
                  </Text>
                  <Text style={[styles.tripChipMeta, selectedTripId === trip.id && styles.tripChipMetaActive]}>
                    {trip.memberCount} members
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {tripDetail ? (
          <>
            <View style={styles.tripSummaryCard}>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={styles.summaryTitle}>{tripDetail.title}</Text>
                  <Text style={styles.summarySubtitle}>{tripDetail.destination}</Text>
                </View>
                <View style={styles.inviteBadge}>
                  <Text style={styles.inviteLabel}>Invite</Text>
                  <Text style={styles.inviteCode}>{tripDetail.inviteCode}</Text>
                </View>
              </View>
              {!!tripDetail.description && <Text style={styles.summaryDescription}>{tripDetail.description}</Text>}
              <Text style={styles.memberLine}>
                {tripDetail.members.length} members: {tripDetail.members.map((member) => member.userName).join(', ')}
              </Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Winning picks right now</Text>
              {tripDetail.winners.length === 0 ? (
                <Text style={styles.emptyText}>Once your group starts voting, the top picks will show up here.</Text>
              ) : (
                tripDetail.winners.map((winner) => (
                  <View key={winner.id} style={styles.winnerCard}>
                    <Text style={styles.winnerCategory}>{winner.category}</Text>
                    <Text style={styles.winnerTitle}>{winner.title}</Text>
                    <Text style={styles.winnerMeta}>Score {winner.score}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Add a group option</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                {Object.keys(categoryMeta).map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, optionForm.category === category && styles.categoryChipActive]}
                    onPress={() => setOptionForm((prev) => ({ ...prev, category }))}
                  >
                    <Ionicons
                      name={categoryMeta[category].icon}
                      size={16}
                      color={optionForm.category === category ? Colors.secondary : Colors.primary}
                    />
                    <Text style={[styles.categoryChipText, optionForm.category === category && styles.categoryChipTextActive]}>
                      {categoryMeta[category].title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={styles.input}
                placeholder="Option title"
                value={optionForm.title}
                onChangeText={(value) => setOptionForm((prev) => ({ ...prev, title: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={optionForm.location}
                onChangeText={(value) => setOptionForm((prev) => ({ ...prev, location: value }))}
              />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Why should the group choose this?"
                multiline
                value={optionForm.description}
                onChangeText={(value) => setOptionForm((prev) => ({ ...prev, description: value }))}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={addOption} disabled={addingOption}>
                <Text style={styles.primaryButtonText}>{addingOption ? 'Adding...' : 'Add Option'}</Text>
              </TouchableOpacity>
            </View>

            {Object.keys(categoryMeta).map((category) => (
              <View key={category} style={styles.panel}>
                <View style={styles.optionSectionHeader}>
                  <View style={styles.optionSectionTitleWrap}>
                    <Ionicons name={categoryMeta[category].icon} size={18} color={Colors.primary} />
                    <Text style={styles.panelTitleInline}>{categoryMeta[category].title}</Text>
                  </View>
                </View>
                {(tripDetail.optionsByCategory?.[category] || []).length === 0 ? (
                  <Text style={styles.emptyText}>No options yet for this category.</Text>
                ) : (
                  tripDetail.optionsByCategory[category].map(renderOptionCard)
                )}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: Colors.secondary, fontSize: 20, fontWeight: '700' },
  refreshText: { color: Colors.secondary, fontWeight: '600' },
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
    shadowRadius: 14,
    elevation: 4,
  },
  panelTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  panelTitleInline: { color: Colors.text, fontSize: 18, fontWeight: '700', marginLeft: 8 },
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
  multilineInput: { minHeight: 92, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: { color: Colors.secondary, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: { color: Colors.primary, fontWeight: '700' },
  joinRow: { flexDirection: 'row', alignItems: 'center' },
  joinInput: { flex: 1, marginBottom: 0, marginRight: 10 },
  emptyText: { color: Colors.textLight, lineHeight: 20 },
  tripChip: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
    minWidth: 150,
  },
  tripChipActive: { backgroundColor: Colors.primary },
  tripChipTitle: { color: Colors.primary, fontWeight: '700' },
  tripChipTitleActive: { color: Colors.secondary },
  tripChipMeta: { color: Colors.textLight, marginTop: 4, fontSize: 12 },
  tripChipMetaActive: { color: 'rgba(255,255,255,0.85)' },
  tripSummaryCard: {
    backgroundColor: '#FFF1E8',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryTitle: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  summarySubtitle: { color: Colors.primary, marginTop: 4, fontWeight: '600' },
  summaryDescription: { color: Colors.textLight, marginTop: 10, lineHeight: 20 },
  memberLine: { color: Colors.text, marginTop: 12, fontWeight: '500' },
  inviteBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  inviteLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  inviteCode: { color: Colors.primary, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  winnerCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  winnerCategory: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  winnerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  winnerMeta: { color: Colors.textLight, marginTop: 4 },
  categorySelector: { marginBottom: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
  },
  categoryChipActive: { backgroundColor: Colors.primary },
  categoryChipText: { color: Colors.primary, fontWeight: '700', marginLeft: 6 },
  categoryChipTextActive: { color: Colors.secondary },
  optionSectionHeader: { marginBottom: 8 },
  optionSectionTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  optionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  optionTitleBlock: { flex: 1, paddingRight: 12 },
  optionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  optionMeta: { color: Colors.primary, marginTop: 4, fontWeight: '600' },
  optionDescription: { color: Colors.textLight, marginTop: 6, lineHeight: 19 },
  optionByline: { color: Colors.textMuted, marginTop: 8, fontSize: 12 },
  scorePill: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  scorePillActive: { backgroundColor: Colors.primary },
  scoreLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  scoreValue: { color: Colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  voteRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 10,
  },
  voteButtonPositive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  voteButtonNegative: { backgroundColor: Colors.textLight, borderColor: Colors.textLight },
  voteButtonText: { color: Colors.text, fontWeight: '700', marginLeft: 6 },
  voteButtonTextActive: { color: Colors.secondary },
  lockButton: {
    marginLeft: 'auto',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockButtonText: { color: Colors.secondary, fontWeight: '700', marginLeft: 6 },
});

export default GroupTripPlannerScreen;
