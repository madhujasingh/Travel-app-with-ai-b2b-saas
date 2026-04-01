import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [budget, setBudget] = useState('');
  const [destination, setDestination] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [tripStep, setTripStep] = useState(1);
  const progressPercent = `${(tripStep / 5) * 100}%`;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const stepMeta = [
    { step: 1, title: 'Budget', subtitle: 'Set your trip budget in INR' },
    { step: 2, title: 'Destination', subtitle: 'Choose where you want to travel' },
    { step: 3, title: 'Adults', subtitle: 'How many adults are traveling?' },
    { step: 4, title: 'Children', subtitle: 'Optional: add children travelers' },
    { step: 5, title: 'Review', subtitle: 'Confirm details and search' },
  ];

  useEffect(() => {
    stepSlide.setValue(16);
    Animated.timing(stepSlide, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [tripStep, stepSlide]);

  const services = [
    {
      id: 1,
      title: 'Land Package',
      icon: 'island',
      screen: 'LandPackage',
      color: '#FF8C5A',
    },
    {
      id: 2,
      title: 'Hotels',
      icon: 'bed',
      screen: 'Hotels',
      color: '#F66A2A',
    },
    {
      id: 3,
      title: 'Flights',
      icon: 'airplane',
      screen: 'Flights',
      color: '#D64E13',
    },
    {
      id: 4,
      title: 'Group Planner',
      icon: 'account-group',
      screen: 'GroupTripPlanner',
      color: '#C95A24',
    },
  ];

  const handleSearch = () => {
    if (!budget || !destination || !adults) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const adultsCount = parseInt(adults, 10) || 0;
    const childrenCount = parseInt(children || '0', 10) || 0;
    const totalPeople = adultsCount + childrenCount;

    if (adultsCount < 1) {
      Alert.alert('Invalid adults', 'At least 1 adult is required.');
      return;
    }

    navigation.navigate('ItineraryList', {
      budget,
      destination,
      people: String(totalPeople),
      adults: String(adultsCount),
      children: String(childrenCount),
      type: 'general',
    });
  };

  const goNextStep = () => {
    if (tripStep === 1 && !budget.trim()) {
      Alert.alert('Missing budget', 'Please enter your budget to continue.');
      return;
    }
    if (tripStep === 2 && !destination.trim()) {
      Alert.alert('Missing destination', 'Please enter destination to continue.');
      return;
    }
    if (tripStep === 3 && !adults.trim()) {
      Alert.alert('Missing adults', 'Please enter number of adults to continue.');
      return;
    }
    if (tripStep === 3 && (parseInt(adults, 10) || 0) < 1) {
      Alert.alert('Invalid adults', 'At least 1 adult is required.');
      return;
    }
    setTripStep((prev) => Math.min(prev + 1, 5));
  };

  const goBackStep = () => {
    setTripStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.heroGlow} />
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Welcome to</Text>
              <Text style={styles.appName}>Itinera</Text>
              <Text style={styles.subtitle}>Plan your perfect trip</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => navigation.navigate('ChatInbox')}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.roleBadge}>Signed in as: {user?.role || 'CUSTOMER'}</Text>
        </View>

        {/* Services Section */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Our Services</Text>
          <View style={styles.servicesContainer}>
            {services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceCard, { backgroundColor: service.color }]}
                onPress={() => navigation.navigate(service.screen)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name={service.icon} size={32} color={Colors.secondary} style={styles.serviceIcon} />
                <Text style={styles.serviceTitle}>{service.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Search Form */}
        <View style={styles.searchSection}>
          <Text style={styles.searchSectionTitle}>Find Your Trip</Text>
          <View style={styles.formContainer}>
            <View style={styles.stepHeaderRow}>
              <View>
                <Text style={styles.stepTitle}>{stepMeta[tripStep - 1].title}</Text>
                <Text style={styles.stepSubtitle}>{stepMeta[tripStep - 1].subtitle}</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: progressPercent }]} />
            </View>

            <View style={styles.stepDots}>
              {stepMeta.map((item) => (
                <View
                  key={item.step}
                  style={[
                    styles.stepDot,
                    tripStep >= item.step && styles.stepDotActive,
                  ]}
                />
              ))}
            </View>

            {tripStep === 1 && (
              <Animated.View
                style={[
                  styles.questionPanel,
                  { transform: [{ translateX: stepSlide }] },
                ]}
              >
                <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Trip Budget (INR)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Example: 25000"
                  placeholderTextColor={Colors.textMuted}
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="numeric"
                />
              </View>
              </Animated.View>
            )}

            {tripStep === 2 && (
              <Animated.View
                style={[
                  styles.questionPanel,
                  { transform: [{ translateX: stepSlide }] },
                ]}
              >
                <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Destination</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Example: Goa, Bali, Jaipur"
                  placeholderTextColor={Colors.textMuted}
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
              </Animated.View>
            )}

            {tripStep === 3 && (
              <Animated.View
                style={[
                  styles.questionPanel,
                  { transform: [{ translateX: stepSlide }] },
                ]}
              >
                <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Number of Adults</Text>
                <TextInput
                  style={styles.input}
                  placeholder="At least 1"
                  placeholderTextColor={Colors.textMuted}
                  value={adults}
                  onChangeText={setAdults}
                  keyboardType="numeric"
                />
              </View>
              </Animated.View>
            )}

            {tripStep === 4 && (
              <Animated.View
                style={[
                  styles.questionPanel,
                  { transform: [{ translateX: stepSlide }] },
                ]}
              >
                <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Number of Children (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  value={children}
                  onChangeText={setChildren}
                  keyboardType="numeric"
                />
              </View>
              </Animated.View>
            )}

            {tripStep === 5 && (
              <Animated.View
                style={[
                  styles.questionPanel,
                  styles.reviewCard,
                  { transform: [{ translateX: stepSlide }] },
                ]}
              >
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Budget</Text>
                  <Text style={styles.reviewValue}>{budget || '-'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Destination</Text>
                  <Text style={styles.reviewValue}>{destination || '-'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Adults</Text>
                  <Text style={styles.reviewValue}>{adults || '0'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Children</Text>
                  <Text style={styles.reviewValue}>{children || '0'}</Text>
                </View>
              </Animated.View>
            )}

            {tripStep < 5 ? (
              <View style={styles.stepActions}>
                {tripStep > 1 && (
                  <TouchableOpacity
                    style={styles.backStepButton}
                    onPress={goBackStep}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.backStepText}>Back</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.nextStepButton}
                  onPress={goNextStep}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nextStepText}>Next</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.stepActions}>
                <TouchableOpacity
                  style={styles.backStepButton}
                  onPress={goBackStep}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backStepText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={handleSearch}
                  activeOpacity={0.8}
                >
                  <Text style={styles.searchButtonText}>Search Itineraries</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

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
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.16)',
    top: -120,
    right: -60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 15,
    color: Colors.secondary,
    opacity: 0.85,
  },
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.secondary,
    marginTop: 5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.secondary,
    opacity: 0.9,
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  messageButton: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutText: {
    color: Colors.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  roleBadge: {
    marginTop: 12,
    color: Colors.secondary,
    opacity: 0.95,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.14)',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  servicesSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  servicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  serviceCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 7,
    marginBottom: 12,
  },
  serviceIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.secondary,
    textAlign: 'center',
  },
  searchSection: {
    paddingHorizontal: 20,
    marginTop: 16,
    paddingBottom: 100,
  },
  searchSectionTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 14,
    letterSpacing: -0.6,
    lineHeight: 44,
    textAlign: 'left',
  },
  formContainer: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  stepSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.textLight,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.backgroundAlt,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  inputContainer: {
    marginBottom: 14,
  },
  questionPanel: {
    minHeight: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFDFC',
    padding: 14,
    justifyContent: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFCFA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewCard: {
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F6DDD0',
  },
  reviewLabel: {
    flex: 1,
    color: Colors.textLight,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewValue: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    flex: 1,
  },
  searchButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  backStepButton: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backStepText: {
    color: Colors.text,
    fontWeight: '700',
  },
  nextStepButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flex: 1,
  },
  nextStepText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
