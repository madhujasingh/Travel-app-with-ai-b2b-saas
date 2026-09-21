import React, { useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { digitsOnly } from '../utils/inputSanitizers';
import PromoBannerCarousel from '../components/PromoBannerCarousel';
import PageSection from '../components/web/PageSection';
import useResponsive from '../hooks/useResponsive';
import useHeroHeader from '../hooks/useHeroHeader';
import WebStickyHeader from '../components/web/WebStickyHeader';
import WebHero from '../components/web/WebHero';
import WebSearchPanel from '../components/web/WebSearchPanel';
import WebField from '../components/web/WebField';
import { useAuth } from '../context/AuthContext';

const SERVICE_IMAGES = {
  landPackage: require('../../assets/services/land-package.png'),
  flights: require('../../assets/services/flights.png'),
  hotels: require('../../assets/services/hotels.png'),
  groupPlanner: require('../../assets/services/group-planner.png'),
  activities: require('../../assets/services/activities.png'),
  cabs: require('../../assets/services/cabs.png'),
  tripsafe: require('../../assets/services/tripsafe.png'),
};

const HERO_IMAGE = require('../../assets/home/hero-sunset.jpg');

const HomeScreen = ({ navigation }) => {
  const { requireAuth } = useAuth();
  const { isDesktop } = useResponsive();
  const { scrolled, scrollProps } = useHeroHeader();
  const [budget, setBudget] = useState('');
  const [destination, setDestination] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [tripStep, setTripStep] = useState(1);
  const progressPercent = `${(tripStep / 5) * 100}%`;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const stepMeta = [
    { step: 1, title: 'Budget', subtitle: 'Optional: set your trip budget in INR', icon: 'wallet-outline' },
    { step: 2, title: 'Destination', subtitle: 'Optional: choose where you want to travel', icon: 'location-outline' },
    { step: 3, title: 'Adults', subtitle: 'How many adults are traveling?', icon: 'people-outline' },
    { step: 4, title: 'Children', subtitle: 'Optional: add children travelers', icon: 'happy-outline' },
    { step: 5, title: 'Review', subtitle: 'Confirm details and search', icon: 'checkmark-circle-outline' },
  ];
  const stepHints = [
    "Skip this if you'd rather browse a destination at any price.",
    "Leave this blank and we'll show you everything your budget covers.",
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
      title: 'Activities',
      subtitle: 'Book unique experiences & tours',
      image: SERVICE_IMAGES.activities,
      screen: 'Activities',
    },
    {
      id: 5,
      title: 'Cabs',
      subtitle: 'Airport, outstation & local rides',
      image: SERVICE_IMAGES.cabs,
      screen: 'Cabs',
    },
    {
      id: 6,
      title: 'Travel Insurance',
      subtitle: 'Cover your trip against the unexpected',
      image: SERVICE_IMAGES.tripsafe,
      screen: 'TripSafe',
    },
  ];

  const handleSearch = () => {
    // Budget and destination are each optional, because either one on its own
    // is a real question - "anywhere for 40k" and "Goa at any price" both are.
    // With neither there is nothing to search on, so one of the two is
    // required; ItineraryListScreen branches on which arrived.
    const trimmedBudget = budget.trim();
    const trimmedDestination = destination.trim();

    if (!trimmedBudget && !trimmedDestination) {
      appAlert(
        'Add a budget or a destination',
        'Tell us your budget, where you want to go, or both - either one is enough to search.'
      );
      return;
    }

    const adultsCount = parseInt(adults, 10) || 0;
    const childrenCount = parseInt(children || '0', 10) || 0;
    const totalPeople = adultsCount + childrenCount;

    if (adultsCount < 1) {
      appAlert('Invalid adults', 'At least 1 adult is required.');
      return;
    }

    navigation.navigate('ItineraryList', {
      budget: trimmedBudget,
      destination: trimmedDestination,
      people: String(totalPeople),
      adults: String(adultsCount),
      children: String(childrenCount),
      type: 'general',
    });
  };

  const goNextStep = () => {
    // Budget (step 1) and destination (step 2) are individually skippable, so
    // the "at least one of them" check lands on the way out of step 2 - the
    // first point where the traveller has seen both fields.
    if (tripStep === 2 && !budget.trim() && !destination.trim()) {
      appAlert(
        'Add a budget or a destination',
        'Fill in at least one of budget or destination to continue - both is fine too.'
      );
      return;
    }
    if (tripStep === 3 && (parseInt(adults, 10) || 0) < 1) {
      appAlert('Invalid adults', 'At least 1 adult is required.');
      return;
    }
    setTripStep((prev) => Math.min(prev + 1, 5));
  };

  const goBackStep = () => {
    setTripStep((prev) => Math.max(prev - 1, 1));
  };

  const currentStep = stepMeta[tripStep - 1];

  return (
    <SafeAreaView style={[styles.container, isDesktop && styles.containerDesktop]}>
      <StatusBar backgroundColor={Colors.primaryDark} barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} {...scrollProps}>
        {/* Desktop uses the same hero shell as every product page, so Home reads
            as part of the site rather than a differently-designed landing page.
            The trip search moves into the hero panel alongside it. */}
        {isDesktop ? (
          <WebHero
            title="Make My Itinerary"
            subtitle="Tell us your budget, where you're headed, or both - we'll build the itinerary around it."
            activeProduct="home"
            image={HERO_IMAGE}
          >
            <WebSearchPanel onSearch={handleSearch}>
              <WebField
                label="Trip Budget (INR) (Optional)"
                icon="wallet-outline"
                value={budget}
                onChangeText={(value) => setBudget(digitsOnly(value))}
                placeholder="Example: 25000"
                keyboardType="numeric"
                maxLength={9}
              />
              <WebField
                label="Destination (Optional)"
                icon="location-outline"
                flex={1.6}
                minWidth={220}
                value={destination}
                onChangeText={setDestination}
                placeholder="Goa, Bali, Jaipur..."
              />
              <WebField
                label="Adults"
                icon="people-outline"
                minWidth={110}
                flex={0.6}
                value={adults}
                onChangeText={(value) => setAdults(digitsOnly(value))}
                placeholder="2"
                keyboardType="numeric"
                maxLength={2}
              />
              <WebField
                label="Children"
                icon="happy-outline"
                minWidth={110}
                flex={0.6}
                value={children}
                onChangeText={(value) => setChildren(digitsOnly(value))}
                placeholder="0"
                keyboardType="numeric"
                maxLength={2}
              />
            </WebSearchPanel>
          </WebHero>
        ) : (
        <ImageBackground
          source={HERO_IMAGE}
          style={[styles.header, isDesktop && styles.headerDesktop]}
          imageStyle={styles.headerImage}
        >
          {/* The photo is a bright sky and sunset, and the titles are white -
              without this they wash out completely. Darkest at the bottom,
              where the wordmark and tagline sit. */}
          <LinearGradient
            colors={['rgba(12,10,9,0.18)', 'rgba(12,10,9,0.34)', 'rgba(12,10,9,0.62)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => requireAuth(() => navigation.navigate('ChatInbox'), 'Sign in to view your messages.')}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.greeting}>Welcome to</Text>
          <Text style={styles.appName}>MyItineri</Text>
          <Text style={styles.subtitle}>Make My Itinerary</Text>
        </ImageBackground>
        )}

        {/* Content sheet - overlaps the header's rounded bottom edge. PageSection
            caps it to a readable column on desktop and is a no-op on phones. */}
        <PageSection style={[styles.contentSheet, isDesktop && styles.contentSheetDesktop]} gutter={false}>
          <PromoBannerCarousel placement="HOME" />

          {/* Services Section - Activities is deliberately just a 5th item
              in this same grid/style (not a separate banner), so it reads
              as part of the group rather than a bolted-on extra. */}
          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>Our Services</Text>
            <View style={[styles.servicesContainer, isDesktop && styles.servicesContainerDesktop]}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceCard, isDesktop && styles.serviceCardDesktop]}
                  onPress={() => navigation.navigate(service.screen)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[Colors.primarySoft, Colors.accentBlueSoft]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.serviceCardGradient}
                  >
                    {service.image ? (
                      <View style={styles.serviceImageWrap}>
                        <Image source={service.image} style={styles.serviceImage} resizeMode="cover" />
                      </View>
                    ) : (
                      <View style={[styles.serviceImageWrap, styles.serviceIconFallback]}>
                        <Ionicons name={service.icon} size={22} color={Colors.primaryDark} />
                      </View>
                    )}
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

          {/* Search Form - desktop runs this from the hero panel instead. */}
          {!isDesktop && <View style={styles.searchSection}>
            <View style={styles.searchHeaderRow}>
              <Text style={styles.searchSectionTitle}>Find Your Trip</Text>
              <Ionicons name="airplane-outline" size={26} color={Colors.primary} style={styles.searchHeaderIcon} />
            </View>
            <Text style={styles.searchSectionSubtitle}>Plan smart. Travel better.</Text>

            <View style={[styles.formContainer, isDesktop && styles.formContainerDesktop]}>
              {/* Wizard furniture - step header, progress bar and dots. There
                  are no steps to track on desktop, where every field shows at
                  once, so all three come out. */}
              {!isDesktop && (
                <>
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
                </>
              )}

              {(isDesktop || tripStep === 1) && (
                <Animated.View
                  style={[
                    styles.questionPanel,
                    isDesktop && styles.questionPanelDesktop,
                    // The slide animation is a step transition; there are no
                    // steps on desktop, so it would just offset the field.
                    !isDesktop && { transform: [{ translateX: stepSlide }] },
                  ]}
                >
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Trip Budget (INR) (Optional)</Text>
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

              {(isDesktop || tripStep === 2) && (
                <Animated.View
                  style={[
                    styles.questionPanel,
                    isDesktop && styles.questionPanelDesktop,
                    // The slide animation is a step transition; there are no
                    // steps on desktop, so it would just offset the field.
                    !isDesktop && { transform: [{ translateX: stepSlide }] },
                  ]}
                >
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Destination (Optional)</Text>
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

              {(isDesktop || tripStep === 3) && (
                <Animated.View
                  style={[
                    styles.questionPanel,
                    isDesktop && styles.questionPanelDesktop,
                    // The slide animation is a step transition; there are no
                    // steps on desktop, so it would just offset the field.
                    !isDesktop && { transform: [{ translateX: stepSlide }] },
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

              {(isDesktop || tripStep === 4) && (
                <Animated.View
                  style={[
                    styles.questionPanel,
                    isDesktop && styles.questionPanelDesktop,
                    // The slide animation is a step transition; there are no
                    // steps on desktop, so it would just offset the field.
                    !isDesktop && { transform: [{ translateX: stepSlide }] },
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

              {!isDesktop && tripStep === 5 && (
                <Animated.View
                  style={[
                    styles.questionPanel,
                    styles.reviewCard,
                    { transform: [{ translateX: stepSlide }] },
                  ]}
                >
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Budget</Text>
                    <Text style={styles.reviewValue}>{budget || 'Any'}</Text>
                  </View>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Destination</Text>
                    <Text style={styles.reviewValue}>{destination || 'Anywhere'}</Text>
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

              {!isDesktop && (
                <View style={styles.hintBox}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={Colors.accentBlue} />
                  <Text style={styles.hintText}>{stepHints[tripStep - 1]}</Text>
                </View>
              )}

              {isDesktop ? (
                // One row of fields means one action: search. Back/Next only
                // make sense when the form is paged.
                <TouchableOpacity
                  onPress={handleSearch}
                  activeOpacity={0.85}
                  style={styles.desktopSearchAction}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextStepButton}
                  >
                    <Ionicons name="search" size={17} color={Colors.secondary} style={{ marginRight: 8 }} />
                    <Text style={styles.nextStepText}>Search Itineraries</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : tripStep < 5 ? (
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
          </View>}

          {/* Clears the floating bottom tab bar; desktop has a top header
              instead, so it only needs ordinary breathing room. */}
          <View style={{ height: isDesktop ? 48 : 90 }} />
        </PageSection>
      </ScrollView>

      {/* Rendered after the ScrollView (not before it) so it stays tappable
          while floating over scrollable content - see commit e0d64b8. */}
      <TouchableOpacity
        style={styles.talkFloatingButton}
        onPress={() => requireAuth(() => navigation.navigate('TalkToAgent'), 'Sign in to chat with a travel expert.')}
        activeOpacity={0.85}
      >
        <Ionicons name="headset" size={20} color={Colors.primary} />
      </TouchableOpacity>
      {isDesktop && <WebStickyHeader visible={scrolled} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // The hero keeps its rounded bottom corners, so the photo has to be clipped
  // to the same radius or it squares them off.
  headerImage: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  // The orange root is only ever seen on a phone, where the content sheet fills
  // the width. On desktop the sheet is capped to a centred column, so the orange
  // would show as two stripes down the sides of the page.
  containerDesktop: {
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
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
  contentSheet: {
    backgroundColor: Colors.background,
    marginTop: -36,
    // Overridden on desktop - see contentSheetDesktop.
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },

  // Desktop only - the hero's phone padding leaves the greeting hard against
  // the left edge of a wide window, and 60px of bottom padding is a lot of
  // empty gradient when the viewport is short and wide rather than tall.
  headerDesktop: {
    paddingHorizontal: 48,
    paddingTop: 28,
    paddingBottom: 72,
  },

  // WebHero has square edges and no rounded lip to tuck under, so the phone
  // layout's negative overlap would just clip the hero.
  contentSheetDesktop: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 36,
  },

  // Five services in one row reads as a website nav strip; the 2-up phone grid
  // stretches each card to ~580px on a 1200px column and looks broken.
  servicesContainerDesktop: {
    flexWrap: 'nowrap',
    gap: 14,
  },

  serviceCardDesktop: {
    width: 'auto',
    flex: 1,
    marginBottom: 0,
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
    // Overridden to flex: 1 inside servicesContainerDesktop's nowrap row.
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
  serviceIconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
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

  // Desktop: the four fields sit on one row like a real booking search bar,
  // with the Search button below spanning the card.
  formContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 16,
  },
  questionPanelDesktop: {
    flex: 1,
    minWidth: 180,
    marginBottom: 0,
  },

  // Breaks onto its own line under the field row rather than becoming a fifth
  // column in it.
  desktopSearchAction: {
    width: '100%',
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
