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

const plannerSections = [
  { key: 'NEW', label: 'New' },
  { key: 'CURRENT', label: 'Current' },
  { key: 'PREVIOUS', label: 'Previous' },
];

const getFriendlyErrorMessage = (error, fallback) => {
  if (error?.message?.includes('Network request failed')) {
    return 'Cannot reach the backend right now. Make sure your phone and computer are on the same Wi-Fi and the backend is running.';
  }

  if (error?.message?.includes('Unexpected token')) {
    return 'The server returned an invalid response. Please restart the backend and try again.';
  }

  return error?.message || fallback;
};

const uniqueTexts = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const normalized = (item || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
};

const buildSeedOptionsFromItinerary = (itinerary) => {
  if (!itinerary) {
    return [];
  }

  const inclusions = itinerary.inclusions || [];
  const highlights = itinerary.highlights || [];
  const activities = (itinerary.dayPlans || [])
    .flatMap((dayPlan) => dayPlan.activities || [])
    .map((activity) => activity.activity);

  const lodgingSource =
    inclusions.find((item) => /(hotel|stay|resort|villa|accommodation)/i.test(item)) ||
    `${itinerary.destination} stay from ${itinerary.title}`;

  const diningSource =
    uniqueTexts([
      ...activities.filter((item) => /(breakfast|lunch|dinner|restaurant|cafe|food|meal)/i.test(item)),
      ...inclusions.filter((item) => /(breakfast|lunch|dinner|restaurant|cafe|food|meal)/i.test(item)),
    ])[0] || `Shared dinner experience in ${itinerary.destination}`;

  const experienceSources = uniqueTexts([
    ...highlights,
    ...activities,
  ]).slice(0, 3);

  const seededOptions = [
    {
      category: 'LODGING',
      title: lodgingSource,
      description: `Imported from ${itinerary.title} as the stay baseline for the group.`,
      location: itinerary.destination,
    },
    {
      category: 'RESTAURANT',
      title: diningSource,
      description: `Dining idea inspired by ${itinerary.title}.`,
      location: itinerary.destination,
    },
    ...experienceSources.map((item) => ({
      category: 'ACTIVITY',
      title: item,
      description: `Imported from ${itinerary.title} so the group can vote on this package experience.`,
      location: itinerary.destination,
    })),
  ];

  return seededOptions.slice(0, 5);
};

const GroupTripPlannerScreen = ({ navigation, route }) => {
  const { token } = useAuth();
  const seedItinerary = route?.params?.seedItinerary || null;
  const [activeSection, setActiveSection] = useState(seedItinerary ? 'NEW' : 'CURRENT');
  const [loading, setLoading] = useState(true);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [joiningTrip, setJoiningTrip] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
  const [finalizingTrip, setFinalizingTrip] = useState(false);
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

  useEffect(() => {
    if (!seedItinerary) {
      return;
    }

    setCreateForm((prev) => {
      if (prev.title || prev.destination || prev.description) {
        return prev;
      }

      return {
        title: `${seedItinerary.title} Crew Plan`,
        destination: seedItinerary.destination || '',
        description: seedItinerary.description || 'Start from this selected package and let the group vote on the best version of it.',
      };
    });
  }, [seedItinerary]);

  const activeTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) || trips[0] || null,
    [selectedTripId, trips]
  );

  const currentTrips = useMemo(
    () => trips.filter((trip) => !trip.finalizedItineraryId),
    [trips]
  );

  const previousTrips = useMemo(
    () => trips.filter((trip) => Boolean(trip.finalizedItineraryId)),
    [trips]
  );

  const visibleTrips = useMemo(() => {
    if (activeSection === 'PREVIOUS') {
      return previousTrips;
    }
    if (activeSection === 'CURRENT') {
      return currentTrips;
    }
    return [];
  }, [activeSection, currentTrips, previousTrips]);

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
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to load group planner'));
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
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to load group trip details'));
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

  useEffect(() => {
    if (activeSection === 'NEW') {
      setTripDetail(null);
      return;
    }

    if (!visibleTrips.length) {
      setSelectedTripId(null);
      setTripDetail(null);
      return;
    }

    const hasSelectedTrip = visibleTrips.some((trip) => trip.id === selectedTripId);
    if (!hasSelectedTrip) {
      setSelectedTripId(visibleTrips[0].id);
    }
  }, [activeSection, selectedTripId, visibleTrips]);

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

      if (seedItinerary) {
        const seededOptions = buildSeedOptionsFromItinerary(seedItinerary);
        for (const option of seededOptions) {
          await fetch(`${API_CONFIG.BASE_URL}/group-trips/${data.id}/options`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(option),
          });
        }
      }

      setCreateForm({ title: '', destination: '', description: '' });
      await loadTrips();
      setSelectedTripId(data.id);
      await loadTripDetail(data.id);
      Alert.alert(
        'Group trip created',
        seedItinerary
          ? 'Your selected land package was imported as the starting point for group voting.'
          : 'Invite friends and start voting on options.'
      );
    } catch (error) {
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to create group trip'));
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
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to join trip'));
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
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to add option'));
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
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to save vote'));
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
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to lock winner'));
    }
  };

  const openGeneratedItinerary = async () => {
    if (!tripDetail?.finalizedItinerary?.id) {
      return;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/itineraries/${tripDetail.finalizedItinerary.id}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to open itinerary');
      }

      navigation.navigate('ItineraryDetail', {
        itinerary: data,
        destination: data.destination,
        people: String(tripDetail.members.length || 1),
      });
    } catch (error) {
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to open itinerary'));
    }
  };

  const finalizeTrip = async () => {
    if (!tripDetail?.id) {
      return;
    }

    setFinalizingTrip(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/group-trips/${tripDetail.id}/finalize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Unable to generate itinerary');
      }

      setTripDetail(data);
      await loadTrips();
      Alert.alert('Itinerary ready', 'Your group winners have been turned into a trip itinerary draft.');
    } catch (error) {
      Alert.alert('Group Planner', getFriendlyErrorMessage(error, 'Unable to generate itinerary'));
    } finally {
      setFinalizingTrip(false);
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
      <View style={styles.backdropGlowTop} />
      <View style={styles.backdropGlowMid} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Planner</Text>
        <TouchableOpacity onPress={loadTrips} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroOrbLarge} />
          <View style={styles.heroOrbSmall} />
          <Text style={styles.heroEyebrow}>Test the concept live</Text>
          <Text style={styles.heroTitle}>Plan together, vote together.</Text>
          <Text style={styles.heroText}>
            Create a trip, invite your group, collect votes on restaurants, stays, and activities, then lock the winners.
          </Text>
        </View>

        <View style={styles.sectionSwitcher}>
          {plannerSections.map((section) => (
            <TouchableOpacity
              key={section.key}
              style={[styles.sectionTab, activeSection === section.key && styles.sectionTabActive]}
              onPress={() => setActiveSection(section.key)}
            >
              <Text style={[styles.sectionTabText, activeSection === section.key && styles.sectionTabTextActive]}>
                {section.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeSection === 'NEW' && seedItinerary ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Starting from selected package</Text>
            <View style={styles.seedCard}>
              <View style={styles.seedHeader}>
                <View style={styles.seedIconWrap}>
                  <Ionicons name="sparkles-outline" size={18} color={Colors.secondary} />
                </View>
                <View style={styles.seedCopy}>
                  <Text style={styles.seedTitle}>{seedItinerary.title}</Text>
                  <Text style={styles.seedMeta}>{seedItinerary.destination} • {seedItinerary.duration}</Text>
                </View>
              </View>
              <Text style={styles.seedText}>
                We&apos;ll use this land package as the base plan, then import core stays, activities, and dining ideas for your group to vote on.
              </Text>
            </View>
          </View>
        ) : null}

        {activeSection === 'NEW' ? (
        <>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{seedItinerary ? 'Create a group plan from this package' : 'Start a new group trip'}</Text>
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
        </>
        ) : null}

        {activeSection !== 'NEW' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {activeSection === 'CURRENT' ? 'Current group trips' : 'Previous group trips'}
          </Text>
          <Text style={styles.panelSubtext}>
            {activeSection === 'CURRENT'
              ? 'Keep momentum high by jumping back into the trips that are still being decided.'
              : 'Revisit completed group plans and the itineraries they produced.'}
          </Text>
          {visibleTrips.length === 0 ? (
            <Text style={styles.emptyText}>
              {activeSection === 'CURRENT'
                ? 'No active group trips yet. Create one in the New section to start collaborating.'
                : 'No previous group trips yet. Finalized itineraries will appear here.'}
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {visibleTrips.map((trip) => (
                <TouchableOpacity
                  key={trip.id}
                  style={[styles.tripChip, selectedTripId === trip.id && styles.tripChipActive]}
                  onPress={() => setSelectedTripId(trip.id)}
                >
                  <View style={styles.tripChipAccent} />
                  <Text style={[styles.tripChipTitle, selectedTripId === trip.id && styles.tripChipTitleActive]}>
                    {trip.title}
                  </Text>
                  <Text style={[styles.tripChipMeta, selectedTripId === trip.id && styles.tripChipMetaActive]}>
                    {trip.memberCount} members
                  </Text>
                  <Text style={[styles.tripChipMeta, selectedTripId === trip.id && styles.tripChipMetaActive]}>
                    {trip.finalizedItineraryId ? 'Itinerary ready' : `${trip.winnerCount} winners locked`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        ) : null}

        {activeSection !== 'NEW' && tripDetail ? (
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
              <View style={styles.statusRow}>
                <View style={styles.statusBadge}>
                  <Ionicons name="layers-outline" size={14} color={Colors.primary} />
                  <Text style={styles.statusBadgeText}>{tripDetail.status}</Text>
                </View>
                {tripDetail.finalizedItinerary ? (
                  <View style={styles.statusBadge}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={Colors.primary} />
                    <Text style={styles.statusBadgeText}>Itinerary Ready</Text>
                  </View>
                ) : null}
              </View>
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
              {tripDetail.organizer ? (
                <TouchableOpacity
                  style={[styles.primaryButton, styles.finalizeButton]}
                  onPress={finalizeTrip}
                  disabled={finalizingTrip}
                >
                  <Ionicons name="sparkles-outline" size={16} color={Colors.secondary} style={styles.finalizeIcon} />
                  <Text style={styles.primaryButtonText}>
                    {finalizingTrip ? 'Generating itinerary...' : 'Turn Winners Into Itinerary'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {tripDetail.finalizedItinerary ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Generated itinerary</Text>
                <View style={styles.generatedCard}>
                  <View style={styles.generatedCopy}>
                    <Text style={styles.generatedTitle}>{tripDetail.finalizedItinerary.title}</Text>
                    <Text style={styles.generatedMeta}>{tripDetail.finalizedItinerary.destination}</Text>
                    <Text style={styles.generatedText}>
                      Built from your group&apos;s leading picks and ready to review in the itinerary flow.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.generatedButton}
                    onPress={openGeneratedItinerary}
                  >
                    <Text style={styles.generatedButtonText}>Open Itinerary</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>How this works</Text>
              <Text style={styles.emptyText}>
                Add options, let everyone vote, lock the strongest picks, then generate a draft itinerary the group can review together.
              </Text>
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
  backdropGlowTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(246,106,42,0.14)',
  },
  backdropGlowMid: {
    position: 'absolute',
    top: 180,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(255,155,106,0.12)',
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: Colors.secondary, fontSize: 20, fontWeight: '700' },
  refreshButton: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshText: { color: Colors.secondary, fontWeight: '700', fontSize: 12 },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  heroOrbLarge: {
    position: 'absolute',
    top: -30,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroOrbSmall: {
    position: 'absolute',
    bottom: -20,
    right: 60,
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
  sectionSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 18,
    padding: 6,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3D6C6',
  },
  sectionTab: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionTabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
  },
  sectionTabText: {
    color: Colors.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTabTextActive: {
    color: Colors.secondary,
  },
  seedCard: {
    backgroundColor: '#FFF2E8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1D2BF',
    padding: 14,
  },
  seedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  seedCopy: { flex: 1 },
  seedTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  seedMeta: { color: Colors.primary, marginTop: 4, fontWeight: '600' },
  seedText: { color: Colors.textLight, marginTop: 12, lineHeight: 20 },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F4D8CA',
  },
  panelTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  panelSubtext: { color: Colors.textLight, lineHeight: 20, marginTop: -4, marginBottom: 12 },
  panelTitleInline: { color: Colors.text, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  input: {
    backgroundColor: '#FFFDFB',
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
    backgroundColor: '#FFF4ED',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginRight: 10,
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#F5D7C8',
    overflow: 'hidden',
  },
  tripChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  tripChipAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 60,
    height: 60,
    borderBottomLeftRadius: 22,
    backgroundColor: 'rgba(246,106,42,0.08)',
  },
  tripChipTitle: { color: Colors.primary, fontWeight: '800' },
  tripChipTitleActive: { color: Colors.secondary },
  tripChipMeta: { color: Colors.textLight, marginTop: 4, fontSize: 12 },
  tripChipMetaActive: { color: 'rgba(255,255,255,0.85)' },
  tripSummaryCard: {
    backgroundColor: '#FFF2E8',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F2D5C6',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryTitle: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  summarySubtitle: { color: Colors.primary, marginTop: 4, fontWeight: '600' },
  summaryDescription: { color: Colors.textLight, marginTop: 10, lineHeight: 20 },
  memberLine: { color: Colors.text, marginTop: 12, fontWeight: '500' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginLeft: 6 },
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
    backgroundColor: '#FFF3EA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1D2BF',
  },
  winnerCategory: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  winnerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  winnerMeta: { color: Colors.textLight, marginTop: 4 },
  finalizeButton: { marginTop: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  finalizeIcon: { marginRight: 8 },
  generatedCard: {
    backgroundColor: '#FFF2E8',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0D4C1',
  },
  generatedCopy: { marginBottom: 14 },
  generatedTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  generatedMeta: { color: Colors.primary, marginTop: 4, fontWeight: '700' },
  generatedText: { color: Colors.textLight, marginTop: 8, lineHeight: 20 },
  generatedButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13,
  },
  generatedButtonText: { color: Colors.secondary, fontWeight: '700' },
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
    borderColor: '#F1D8CB',
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#FFFCFA',
  },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  optionTitleBlock: { flex: 1, paddingRight: 12 },
  optionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  optionMeta: { color: Colors.primary, marginTop: 4, fontWeight: '600' },
  optionDescription: { color: Colors.textLight, marginTop: 6, lineHeight: 19 },
  optionByline: { color: Colors.textMuted, marginTop: 8, fontSize: 12 },
  scorePill: {
    backgroundColor: Colors.backgroundAlt,
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
