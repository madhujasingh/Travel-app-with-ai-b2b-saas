import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
  Animated,
  Image,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { digitsOnly } from '../utils/inputSanitizers';
import PromoBannerCarousel from '../components/PromoBannerCarousel';

const SERVICE_IMAGES = {
  landPackage: require('../../assets/services/land-package.png'),
  flights: require('../../assets/services/flights.png'),
  hotels: require('../../assets/services/hotels.png'),
  groupPlanner: require('../../assets/services/group-planner.png'),
  activities: require('../../assets/services/activities.png'),
};

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [budget, setBudget] = useState('');
  const [destination, setDestination] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [tripStep, setTripStep] = useState(1);
  const progressPercent = `${(tripStep / 5) * 100}%`;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const stepMeta = [
    { step: 1, title: 'Budget', subtitle: 'Set your trip budget in INR', icon: 'wallet-outline' },
    { step: 2, title: 'Destination', subtitle: 'Choose where you want to travel', icon: 'location-outline' },
    { step: 3, title: 'Adults', subtitle: 'How many adults are traveling?', icon: 'people-outline' },
    { step: 4, title: 'Children', subtitle: 'Optional: add children travelers', icon: 'happy-outline' },
    { step: 5, title: 'Review', subtitle: 'Confirm details and search', icon: 'checkmark-circle-outline' },
  ];
  const stepHints = [
    "We'll help you find the best options within your budget.",
    "Not sure where to go? Try 'Goa', 'Bali' or 'Jaipur' for inspiration.",
    'Include yourself and anyone 12 or older.',
    'Traveling with kids under 12? Add them here.',
    "Double-check everything - we'll search the moment you tap Search.",
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
      subtitle: 'Hassle-free holidays',
      image: SERVICE_IMAGES.landPackage,
      screen: 'LandPackage',
    },
    {
      id: 2,
      title: 'Hotels',
      subtitle: 'Comfortable stays',
      image: SERVICE_IMAGES.hotels,
      screen: 'Hotels',
    },
    {
      id: 3,
      title: 'Flights',
      subtitle: 'Domestic & International',
      image: SERVICE_IMAGES.flights,
      screen: 'Flights',
    },
    {
      id: 4,
      title: 'Group Planner',
      subtitle: 'Plan together, travel better',
      image: SERVICE_IMAGES.groupPlanner,
      screen: 'GroupTripPlanner',
    },
    {
      id: 5,
      title: 'Activities',
      subtitle: 'Book unique experiences & tours',
      image: SERVICE_IMAGES.activities,
      screen: 'Activities',
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

  const currentStep = stepMeta[tripStep - 1];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primaryDark} barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Header */}
        <LinearGradient
          colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.heroGlowLarge} />
          <View style={styles.heroGlowSmall} />
          <MaterialCommunityIcons
            name="palm-tree"
            size={140}
            color="rgba(255,255,255,0.12)"
            style={styles.heroPalm}
          />
          <Ionicons name="airplane" size={64} color="rgba(255,255,255,0.16)" style={styles.heroPlane} />

          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('ChatInbox')}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.greeting}>Welcome to</Text>
          <Text style={styles.appName}>MyItineri</Text>
          <Text style={styles.subtitle}>Plan your perfect trip</Text>
          <Text style={styles.roleBadge}>Signed in as: {user?.role || 'CUSTOMER'}</Text>
        </LinearGradient>

        {/* Content sheet - overlaps the header's rounded bottom edge */}
        <View style={styles.contentSheet}>
          <PromoBannerCarousel placement="HOME" />

          {/* Services Section - Activities is deliberately just a 5th item
              in this same grid/style (not a separate banner), so it reads
              as part of the group rather than a bolted-on extra. */}
          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>Our Services</Text>
            <View style={styles.servicesContainer}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  onPress={() => navigation.navigate(service.screen)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.primarySoft, Colors.accentBlueSoft]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.serviceCardGradient}
                  >
                    <View style={styles.serviceImageWrap}>
                      <Image source={service.image} style={styles.serviceImage} resizeMode="cover" />
                    </View>
                    <View style={styles.serviceTextWrap}>
                      <Text style={styles.serviceTitle}>{service.title}</Text>
                      <Text style={styles.serviceSubtitle} numberOfLines={2}>
                        {service.subtitle}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Deals banner */}
          <TouchableOpacity
            style={styles.dealsBanner}
            onPress={() => navigation.navigate('PromotionsTab')}
            activeOpacity={0.88}
          >
            <View style={styles.dealsTextWrap}>
              <Text style={styles.dealsTitle}>Plan more, save more!</Text>
              <Text style={styles.dealsSubtitle}>Exclusive deals & offers just for you</Text>
              <View style={styles.dealsButton}>
                <Text style={styles.dealsButtonText}>Explore Deals</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.secondary} />
              </View>
            </View>
            <View style={styles.dealsIconWrap}>
              <Ionicons name="gift" size={40} color={Colors.primary} />
            </View>
          </TouchableOpacity>

          {/* Search Form */}
          <View style={styles.searchSection}>
            <View style={styles.searchHeaderRow}>
              <Text style={styles.searchSectionTitle}>Find Your Trip</Text>
              <Ionicons name="airplane-outline" size={26} color={Colors.primary} style={styles.searchHeaderIcon} />
            </View>
            <Text style={styles.searchSectionSubtitle}>Plan smart. Travel better.</Text>

            <View style={styles.formContainer}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={currentStep.icon} size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{currentStep.title}</Text>
                  <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={[Colors.primaryLight, Colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: progressPercent }]}
                />
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
                    <View style={styles.inputRow}>
                      <View style={styles.inputPrefixBox}>
                        <Text style={styles.inputPrefixText}>₹</Text>
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Example: 25000"
                        placeholderTextColor={Colors.textMuted}
                        value={budget}
                        onChangeText={(value) => setBudget(digitsOnly(value))}
                        keyboardType="numeric"
                        maxLength={9}
                      />
                    </View>
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
                    <View style={styles.inputRow}>
                      <View style={styles.inputPrefixBox}>
                        <Ionicons name="location-outline" size={16} color={Colors.primaryDark} />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Example: Goa, Bali, Jaipur"
                        placeholderTextColor={Colors.textMuted}
                        value={destination}
                        onChangeText={setDestination}
                      />
                    </View>
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
                    <View style={styles.inputRow}>
                      <View style={styles.inputPrefixBox}>
                        <Ionicons name="person-outline" size={16} color={Colors.primaryDark} />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="At least 1"
                        placeholderTextColor={Colors.textMuted}
                        value={adults}
                        onChangeText={(value) => setAdults(digitsOnly(value))}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
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
                    <View style={styles.inputRow}>
                      <View style={styles.inputPrefixBox}>
                        <Ionicons name="happy-outline" size={16} color={Colors.primaryDark} />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                        value={children}
                        onChangeText={(value) => setChildren(digitsOnly(value))}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
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
                  <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.reviewLabel}>Children</Text>
                    <Text style={styles.reviewValue}>{children || '0'}</Text>
                  </View>
                </Animated.View>
              )}

              <View style={styles.hintBox}>
                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.accentBlue} />
                <Text style={styles.hintText}>{stepHints[tripStep - 1]}</Text>
              </View>

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
                  <TouchableOpacity onPress={goNextStep} activeOpacity={0.85} style={{ flex: 1 }}>
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextStepButton}
                    >
                      <Text style={styles.nextStepText}>Next</Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
                    </LinearGradient>
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
                  <TouchableOpacity onPress={handleSearch} activeOpacity={0.85} style={{ flex: 1 }}>
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextStepButton}
                    >
                      <Text style={styles.nextStepText}>Search Itineraries</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 90 }} />
        </View>
      </ScrollView>

      {/* Rendered after the ScrollView (not before it) so it stays tappable
          while floating over scrollable content - see commit e0d64b8. */}
      <TouchableOpacity
        style={styles.talkFloatingButton}
        onPress={() => navigation.navigate('TalkToAgent')}
        activeOpacity={0.85}
      >
        <Ionicons name="headset" size={20} color={Colors.primary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -110,
    right: -50,
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -30,
    left: -30,
  },
  heroPalm: {
    position: 'absolute',
    right: -10,
    bottom: 10,
  },
  heroPlane: {
    position: 'absolute',
    left: -8,
    top: 70,
    transform: [{ rotate: '35deg' }],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  talkFloatingButton: {
    // Stacked directly below the message icon (same corner, same width) -
    // top = message icon's top (16) + its height (38) + a 10px gap.
    position: 'absolute',
    top: 64,
    right: 22,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    marginTop: 18,
    fontSize: 15,
    color: Colors.secondary,
    opacity: 0.9,
  },
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: Colors.secondary,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.secondary,
    opacity: 0.92,
    marginTop: 6,
  },
  roleBadge: {
    marginTop: 14,
    color: Colors.secondary,
    opacity: 0.95,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  contentSheet: {
    backgroundColor: Colors.background,
    marginTop: -36,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },
  servicesSection: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 6,
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
  // White bg matches the source illustrations' own backdrop exactly, so the
  // image blends into the card with no visible seam at its edges.
  // Shadow lives on the outer (non-clipping) touchable; the gradient below
  // owns the border/radius/overflow-hidden clip, since a shadow and
  // overflow:hidden don't play well on the same element.
  serviceCard: {
    width: '48%',
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceCardGradient: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    overflow: 'hidden',
  },
  // A small icon-sized crop of the illustration, not a hero image - fixed
  // 44x44 pixels (not aspectRatio/percentage) so it stays tiny regardless
  // of card width. White bg matches the source PNGs' own backdrop, so the
  // icon still reads cleanly against the new gradient card behind it.
  serviceImageWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    marginBottom: 10,
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceTextWrap: {},
  serviceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  serviceSubtitle: {
    fontSize: 11.5,
    color: Colors.textLight,
    lineHeight: 15,
  },
  dealsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: Colors.primarySurface,
    borderRadius: 18,
    padding: 18,
  },
  dealsTextWrap: {
    flex: 1,
  },
  dealsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  dealsSubtitle: {
    fontSize: 12.5,
    color: Colors.textLight,
    marginTop: 4,
    marginBottom: 12,
  },
  dealsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 4,
  },
  dealsButtonText: {
    color: Colors.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  dealsIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginTop: 26,
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchSectionTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  searchHeaderIcon: {
    transform: [{ rotate: '30deg' }],
  },
  searchSectionSubtitle: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 2,
    marginBottom: 16,
  },
  formContainer: {
    backgroundColor: Colors.card,
    borderRadius: 20,
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  stepSubtitle: {
    marginTop: 2,
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
    marginBottom: 4,
  },
  questionPanel: {
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFDFC',
    padding: 14,
    justifyContent: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingRight: 10,
  },
  inputPrefixBox: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  inputPrefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.accentBlueSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: Colors.accentBlueDark,
    lineHeight: 16,
  },
  reviewCard: {
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
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
  stepActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  nextStepText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
