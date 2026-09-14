import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  ImageBackground,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import useResponsive, { CONTENT_MAX_WIDTH } from '../hooks/useResponsive';
import WebHero from '../components/web/WebHero';
import WebField from '../components/web/WebField';
import DatePickerModal from '../components/DatePickerModal';
import useHeroHeader from '../hooks/useHeroHeader';
import WebStickyHeader from '../components/web/WebStickyHeader';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const CATEGORY_ART = {
  international:
    'https://images.unsplash.com/photo-1431274172761-fca41d930114?auto=format&fit=crop&w=1200&q=80',
  india:
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
};

const GLOW_COLORS = {
  international: '#FF9E5C',
  india: '#FFC36B',
};

const categoryCards = [
  {
    id: 'international',
    title: 'International',
    eyebrow: 'Global escapes',
    description: 'From iconic skylines to island hideaways, discover curated journeys beyond borders.',
    icon: 'earth-outline',
    image: CATEGORY_ART.international,
    accent: '#FFB06C',
    chip: 'AI trend radar',
  },
  {
    id: 'india',
    title: 'India',
    eyebrow: 'Domestic stories',
    description: 'Culture, coastlines, mountains and heritage circuits designed for smart modern travellers.',
    icon: 'compass-outline',
    image: CATEGORY_ART.india,
    accent: '#FFD08A',
    chip: 'Top local picks',
  },
];

// Themes the chip row filters by. Tagged against the destinations we already
// list, so a chip narrows a real set rather than being decoration.
const THEMES = [
  { id: 'all', label: 'All Packages', icon: 'triangle-outline' },
  { id: 'beach', label: 'Beach', icon: 'umbrella-outline' },
  { id: 'city', label: 'City Breaks', icon: 'business-outline' },
  { id: 'hills', label: 'Hills & Nature', icon: 'trail-sign-outline' },
  { id: 'adventure', label: 'Adventure', icon: 'compass-outline' },
  { id: 'spiritual', label: 'Spiritual', icon: 'flower-outline' },
  { id: 'family', label: 'Family', icon: 'people-outline' },
  { id: 'honeymoon', label: 'Honeymoon', icon: 'heart-outline' },
  { id: 'international', label: 'International', icon: 'earth-outline' },
];

const internationalDestinations = [
  { id: 1, name: 'Paris', country: 'France', image: 'business-outline', popular: true, themes: ['city', 'honeymoon'] },
  { id: 2, name: 'Tokyo', country: 'Japan', image: 'navigate-outline', popular: true, themes: ['city', 'family'] },
  { id: 3, name: 'Dubai', country: 'UAE', image: 'business', popular: true, themes: ['city', 'family', 'adventure'] },
  { id: 4, name: 'Bali', country: 'Indonesia', image: 'sunny', popular: true, themes: ['beach', 'honeymoon'] },
  { id: 5, name: 'Maldives', country: 'Maldives', image: 'water-outline', popular: true, themes: ['beach', 'honeymoon'] },
  { id: 6, name: 'Singapore', country: 'Singapore', image: 'leaf-outline', popular: false, themes: ['city', 'family'] },
  { id: 7, name: 'Thailand', country: 'Thailand', image: 'flower-outline', popular: false, themes: ['beach', 'adventure'] },
  { id: 8, name: 'Switzerland', country: 'Switzerland', image: 'trail-sign', popular: false, themes: ['hills', 'honeymoon'] },
];

const indianDestinations = [
  { id: 1, name: 'Jaipur', state: 'Rajasthan', image: 'business', popular: true, themes: ['city', 'family'] },
  { id: 2, name: 'Goa', state: 'Goa', image: 'sunny', popular: true, themes: ['beach', 'honeymoon'] },
  { id: 3, name: 'Kerala', state: 'Kerala', image: 'leaf', popular: true, themes: ['hills', 'honeymoon', 'family'] },
  { id: 4, name: 'Manali', state: 'Himachal Pradesh', image: 'trail-sign', popular: true, themes: ['hills', 'adventure'] },
  { id: 5, name: 'Varanasi', state: 'Uttar Pradesh', image: 'flower', popular: true, themes: ['spiritual'] },
  { id: 6, name: 'Udaipur', state: 'Rajasthan', image: 'business-outline', popular: false, themes: ['city', 'honeymoon'] },
  { id: 7, name: 'Shimla', state: 'Himachal Pradesh', image: 'trail-sign-outline', popular: false, themes: ['hills', 'family'] },
  { id: 8, name: 'Agra', state: 'Uttar Pradesh', image: 'location', popular: false, themes: ['spiritual', 'city'] },
];

const LandPackageScreen = ({ navigation }) => {
  const { centeredContent, isDesktop } = useResponsive();
  const { scrolled, scrollProps } = useHeroHeader();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTheme, setActiveTheme] = useState('all');
  const [travelDates, setTravelDates] = useState({ from: '', to: '' });
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [travellers, setTravellers] = useState({ adults: 2, children: 0 });

  // Everything we list, so the desktop landing page can show destinations and
  // themes before a market has been picked.
  const allDestinations = useMemo(
    () => [
      ...indianDestinations.map((d) => ({ ...d, market: 'india' })),
      ...internationalDestinations.map((d) => ({ ...d, market: 'international' })),
    ],
    [],
  );

  const themedDestinations = useMemo(() => {
    let list = allDestinations;
    if (activeTheme === 'international') {
      list = list.filter((d) => d.market === 'international');
    } else if (activeTheme !== 'all') {
      list = list.filter((d) => (d.themes || []).includes(activeTheme));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.country || '').toLowerCase().includes(q) ||
          (d.state || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [allDestinations, activeTheme, searchQuery]);

  const travellerLabel = `${travellers.adults} Adult${travellers.adults === 1 ? '' : 's'}, ${travellers.children} Child${travellers.children === 1 ? '' : 'ren'}`;
  const dateLabel =
    travelDates.from && travelDates.to ? `${travelDates.from} → ${travelDates.to}` : '';

  const openDestination = (destination) =>
    navigation.navigate('ItineraryList', {
      type: destination.market,
      destination: destination.name,
      travelDates,
      travellers,
    });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const ctaScale = useRef(new Animated.Value(1)).current;

  const destinations = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    const source =
      selectedCategory === 'international'
        ? internationalDestinations
        : indianDestinations;

    if (!searchQuery.trim()) {
      return source;
    }

    return source.filter(
      (dest) =>
        dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dest.country && dest.country.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dest.state && dest.state.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, selectedCategory]);

  const selectedCategoryMeta = categoryCards.find((category) => category.id === selectedCategory);

  const handleDestinationPress = (destination) => {
    navigation.navigate('ItineraryList', {
      destination: destination.name,
      type: selectedCategory,
      budget: '',
      people: '',
    });
  };

  const handleExplorePressIn = () => {
    Animated.spring(ctaScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handleExplorePressOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };


  // Desktop landing: theme chips, the two market cards, then destinations.
  // The phone keeps its two-step picker, which suits a narrow screen better.
  const renderWebLanding = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.webScroll}
      {...scrollProps}
    >
      <View style={styles.webBody}>
        <View style={styles.themeRow}>
          {THEMES.map((theme) => {
            const active = activeTheme === theme.id;
            return (
              <TouchableOpacity
                key={theme.id}
                style={[styles.themeChip, active && styles.themeChipActive]}
                onPress={() => setActiveTheme(theme.id)}
              >
                <View style={[styles.themeIcon, active && styles.themeIconActive]}>
                  <Ionicons
                    name={theme.icon}
                    size={18}
                    color={active ? Colors.primary : Colors.accentBlue}
                  />
                </View>
                <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>
                  {theme.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.marketRow}>
          {categoryCards.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.marketCard}
              activeOpacity={0.9}
              onPress={() => {
                setSelectedCategory(category.id);
                navigation.navigate('ItineraryList', {
                  type: category.id,
                  travelDates,
                  travellers,
                });
              }}
            >
              <ImageBackground
                source={{ uri: category.image }}
                style={styles.marketImage}
                imageStyle={styles.marketImageInner}
              >
                <LinearGradient
                  colors={['rgba(10,20,40,0.85)', 'rgba(10,20,40,0.25)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.marketScrim}
                />
                <View style={styles.marketCopy}>
                  <Text style={styles.marketEyebrow}>{category.eyebrow.toUpperCase()}</Text>
                  <Text style={styles.marketTitle}>{category.title}</Text>
                  <Text style={styles.marketText}>{category.description}</Text>
                  <View style={styles.marketButton}>
                    <Text style={styles.marketButtonText}>Explore Packages</Text>
                    <Ionicons name="arrow-forward" size={15} color={Colors.secondary} />
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.destSection}>
          <View style={styles.destHeader}>
            <Text style={styles.destHeading}>Popular Destinations</Text>
            <Text style={styles.destCount}>
              {themedDestinations.length} destination{themedDestinations.length === 1 ? '' : 's'}
            </Text>
          </View>

          {themedDestinations.length === 0 ? (
            <Text style={styles.destEmpty}>
              Nothing matches that theme yet — try another one.
            </Text>
          ) : (
            <View style={styles.destGrid}>
              {themedDestinations.map((destination) => (
                <TouchableOpacity
                  key={`${destination.market}-${destination.id}`}
                  style={styles.destCard}
                  activeOpacity={0.88}
                  onPress={() => openDestination(destination)}
                >
                  {/* No destination photography yet, so the card leads with the
                      brand gradient and its icon rather than a broken image. */}
                  <LinearGradient
                    colors={[Colors.accentBlue, Colors.accentBlueDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.destImage}
                  >
                    <Ionicons name={destination.image} size={26} color="rgba(255,255,255,0.75)" />
                  </LinearGradient>
                  <View style={styles.destCopy}>
                    <Text style={styles.destName}>{destination.name}</Text>
                    <Text style={styles.destMeta}>
                      {destination.country || destination.state}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const renderCategorySelection = () => (
    <ScrollView contentContainerStyle={[styles.selectionContent, centeredContent]} showsVerticalScrollIndicator={false} {...scrollProps}>
      <View style={styles.heroPanel}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles-outline" size={14} color={Colors.secondary} />
          <Text style={styles.heroBadgeText}>Smart recommendations powered by AI</Text>
        </View>
        <Text style={styles.heroTitle}>Where do you want to go?</Text>
        <Text style={styles.heroSubtitle}>
          Pick the lane that fits your next story. We&apos;ll shape package discovery around your travel style,
          market demand, and destination momentum.
        </Text>
      </View>

      <View style={styles.categoryStack}>
        {categoryCards.map((category) => {
          const isActive = selectedCategory === category.id;

          return (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={({ pressed }) => [
                styles.categoryShell,
                isActive && styles.categoryShellActive,
                pressed && styles.categoryShellPressed,
              ]}
            >
              <ImageBackground source={{ uri: category.image }} style={styles.categoryImage} imageStyle={styles.categoryImageInner}>
                <View style={[styles.categoryGlow, { backgroundColor: GLOW_COLORS[category.id] }]} />
                <View style={styles.categoryOverlay}>
                  <View style={styles.categoryTopRow}>
                    <View style={styles.categoryChip}>
                      <Text style={styles.categoryChipText}>{category.chip}</Text>
                    </View>
                    <View style={styles.iconGlass}>
                      <Ionicons name={category.icon} size={22} color={Colors.secondary} />
                    </View>
                  </View>

                  <View style={styles.categoryCopy}>
                    <Text style={styles.categoryEyebrow}>{category.eyebrow}</Text>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    <Text style={styles.categoryDescription}>{category.description}</Text>
                  </View>

                  <View style={styles.categoryFooter}>
                    <View style={styles.signalRow}>
                      <View style={[styles.signalDot, { backgroundColor: category.accent }]} />
                      <Text style={styles.signalText}>Live destination intelligence</Text>
                    </View>
                    <View style={styles.selectPill}>
                      <Text style={styles.selectPillText}>{isActive ? 'Selected' : 'Preview'}</Text>
                      <Ionicons name="arrow-forward" size={14} color={Colors.secondary} />
                    </View>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderDestination = ({ item }) => (
    <TouchableOpacity
      style={styles.destinationCard}
      onPress={() => handleDestinationPress(item)}
      activeOpacity={0.88}
    >
      <View style={styles.destinationIconWrap}>
        <Ionicons name={item.image} size={24} color={Colors.secondary} />
      </View>
      <View style={styles.destinationInfo}>
        <View style={styles.destinationTitleRow}>
          <Text style={styles.destinationName}>{item.name}</Text>
          {item.popular ? (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Hot</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.destinationLocation}>{item.country || item.state}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
    </TouchableOpacity>
  );

  const renderDestinationSelection = () => (
    <>
      <View style={styles.discoverPanel}>
        <View style={styles.discoverHeader}>
          <View>
            <Text style={styles.discoverEyebrow}>
              {selectedCategoryMeta?.title} discovery mode
            </Text>
            <Text style={styles.discoverTitle}>Explore Packages</Text>
          </View>
          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setSelectedCategory(null);
              setSearchQuery('');
            }}
          >
            <Ionicons name="swap-horizontal-outline" size={18} color={Colors.primary} />
            <Text style={styles.switchButtonText}>Switch</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.discoverDescription}>
          Search curated destinations and open a package stream tailored to your chosen market.
        </Text>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cities, countries or states"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={destinations}
        renderItem={renderDestination}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[styles.destinationsList, centeredContent]}
        {...scrollProps}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={42} color={Colors.primary} />
            <Text style={styles.emptyTitle}>No destination match yet</Text>
            <Text style={styles.emptyText}>Try a broader search or switch the discovery lane.</Text>
          </View>
        }
      />
    </>
  );

  return (
    <SafeAreaView style={[styles.container, isDesktop && styles.containerDesktop]}>
      <StatusBar backgroundColor="#5B2310" barStyle="light-content" />

      {!isDesktop && <View style={styles.backgroundLayer}>
        <View style={styles.topGradient} />
        <View style={styles.middleGradient} />
        <View style={styles.bottomGradient} />
        <View style={styles.blurOrbOne} />
        <View style={styles.blurOrbTwo} />
      </View>}

      {isDesktop ? (
        <WebHero
          image={require('../../assets/packages/hero-sunset.jpg')}
          align="left"
          eyebrow="Explore more together"
          title="Holiday Packages"
          subtitle="Curated trips by theme and destination, priced end to end."
          activeProduct="packages"
        >
          {/* Search bar sits on the hero, the way every package site opens. */}
          <View style={styles.webSearchBar}>
            <WebField
              tone="onLight"
              label="Destination"
              icon="location-outline"
              flex={2}
              minWidth={240}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Where do you want to go?"
            />
            <WebField
              tone="onLight"
              label="Travel Dates"
              icon="calendar-outline"
              flex={1.4}
              value={dateLabel}
              placeholder="Select dates"
              onPress={() => setDatePickerVisible(true)}
            />
            <WebField
              tone="onLight"
              label="Travellers"
              icon="people-outline"
              flex={1.3}
              value={travellerLabel}
              onPress={() =>
                setTravellers((current) => ({
                  ...current,
                  adults: current.adults >= 6 ? 1 : current.adults + 1,
                }))
              }
            />
            <TouchableOpacity
              style={styles.webSearchButton}
              onPress={() => {
                const match = themedDestinations[0];
                if (match) openDestination(match);
              }}
            >
              <Ionicons name="search" size={22} color={Colors.secondary} />
            </TouchableOpacity>
          </View>
        </WebHero>
      ) : (
      <View style={styles.header}>
        <TouchableOpacity style={styles.floatingButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Land Packages</Text>
        <TouchableOpacity style={styles.floatingButton}>
          <Ionicons name="person-circle-outline" size={22} color={Colors.secondary} />
        </TouchableOpacity>
      </View>
      )}

      {isDesktop
        ? renderWebLanding()
        : selectedCategory
          ? renderDestinationSelection()
          : renderCategorySelection()}

      <View style={styles.floatingCtaWrap}>
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity
            style={[styles.floatingCta, !selectedCategory && styles.floatingCtaDisabled]}
            activeOpacity={0.92}
            onPress={() => selectedCategory && setSearchQuery('')}
            onPressIn={handleExplorePressIn}
            onPressOut={handleExplorePressOut}
            disabled={!selectedCategory}
          >
            <View>
              <Text style={styles.floatingCtaLabel}>Next step</Text>
              <Text style={styles.floatingCtaTitle}>
                {selectedCategory ? `${selectedCategoryMeta?.title} packages ready` : 'Explore Packages'}
              </Text>
            </View>
            <View style={styles.floatingArrow}>
              <Ionicons name={selectedCategory ? 'sparkles-outline' : 'arrow-forward'} size={18} color={Colors.secondary} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
      <DatePickerModal
        visible={datePickerVisible}
        rangeMode
        minDate={new Date()}
        onSelectRange={(from, to) => {
          const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
          setTravelDates({ from: fmt(from), to: fmt(to) });
          setDatePickerVisible(false);
        }}
        onClose={() => setDatePickerVisible(false)}
      />

      {isDesktop && <WebStickyHeader visible={scrolled} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // --- Desktop packages landing --------------------------------------------
  webSearchBar: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
  },
  webSearchButton: {
    width: 60,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  webScroll: { paddingBottom: 48 },
  webBody: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    gap: 34,
  },

  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 28,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  themeChip: {
    alignItems: 'center',
    gap: 7,
    flexGrow: 1,
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  themeChipActive: { backgroundColor: Colors.primarySoft },
  themeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIconActive: { backgroundColor: Colors.primarySurface },
  themeLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textLight },
  themeLabelActive: { color: Colors.primaryDark },

  marketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  marketCard: {
    flex: 1,
    minWidth: 320,
    height: 270,
    borderRadius: 16,
    overflow: 'hidden',
  },
  marketImage: { flex: 1, justifyContent: 'flex-end' },
  marketImageInner: { resizeMode: 'cover' },
  marketScrim: { ...StyleSheet.absoluteFillObject },
  marketCopy: { padding: 22, gap: 7, maxWidth: 380 },
  marketEyebrow: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.3,
    color: Colors.primaryLight,
  },
  marketTitle: { fontSize: 30, fontWeight: '800', color: '#FFFFFF' },
  marketText: { fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.88)' },
  marketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.primary,
  },
  marketButtonText: { fontSize: 13.5, fontWeight: '800', color: Colors.secondary },

  destSection: { gap: 16 },
  destHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  destHeading: { fontSize: 26, fontWeight: '800', color: Colors.accentBlueDark },
  destCount: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  destEmpty: { fontSize: 13.5, color: Colors.textMuted, paddingVertical: 20 },
  destGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  destCard: {
    flexGrow: 1,
    minWidth: 160,
    maxWidth: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  destImage: { height: 120, alignItems: 'center', justifyContent: 'center' },
  destCopy: { padding: 13, gap: 3 },
  destName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  destMeta: { fontSize: 12, color: Colors.textMuted },

  container: {
    flex: 1,
    backgroundColor: '#5B2310',
  },

  // The dark brown root and its decorative gradient layer are designed to fill a
  // phone screen edge to edge. Behind a centred desktop column they just bleed
  // down both sides of the page.
  containerDesktop: {
    backgroundColor: Colors.background,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
    backgroundColor: '#6B2A14',
  },
  middleGradient: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: '#A9461D',
    opacity: 0.84,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: '#E6792F',
  },
  blurOrbOne: {
    position: 'absolute',
    top: 90,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,205,120,0.28)',
  },
  blurOrbTwo: {
    position: 'absolute',
    bottom: 120,
    left: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,154,92,0.24)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    color: Colors.secondary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  floatingButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,244,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
  },
  selectionContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 150,
  },
  heroPanel: {
    marginTop: 8,
    marginBottom: 22,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,244,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  heroBadgeText: {
    color: Colors.secondary,
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: Colors.secondary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  heroSubtitle: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    lineHeight: 23,
    maxWidth: '92%',
  },
  categoryStack: {
    gap: 18,
  },
  categoryShell: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,248,244,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
  categoryShellActive: {
    borderColor: 'rgba(255,232,214,0.55)',
    shadowOpacity: 0.26,
  },
  categoryShellPressed: {
    transform: [{ scale: 0.985 }],
  },
  categoryImage: {
    minHeight: 240,
    justifyContent: 'flex-end',
  },
  categoryImageInner: {
    borderRadius: 28,
  },
  categoryGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  categoryOverlay: {
    minHeight: 240,
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(58, 24, 10, 0.42)',
  },
  categoryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: 'rgba(255,248,244,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryChipText: {
    color: Colors.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  iconGlass: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,244,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  categoryCopy: {
    marginTop: 34,
  },
  categoryEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  categoryTitle: {
    marginTop: 8,
    color: Colors.secondary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  categoryDescription: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: '90%',
  },
  categoryFooter: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  signalText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  selectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectPillText: {
    color: Colors.secondary,
    fontWeight: '700',
    marginRight: 6,
    fontSize: 12,
  },
  discoverPanel: {
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 10,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,248,244,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  discoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discoverEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  discoverTitle: {
    marginTop: 4,
    color: Colors.secondary,
    fontSize: 28,
    fontWeight: '800',
  },
  discoverDescription: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    marginLeft: 6,
  },
  searchBar: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 10,
  },
  destinationsList: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 140,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255,250,246,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,240,230,0.95)',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  destinationIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginRight: 14,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  destinationName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  destinationLocation: {
    marginTop: 4,
    color: Colors.textLight,
    fontSize: 13,
    fontWeight: '500',
  },
  popularBadge: {
    marginLeft: 8,
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  popularText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 70,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 14,
    color: Colors.secondary,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: 21,
  },
  floatingCtaWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  floatingCta: {
    backgroundColor: 'rgba(255,248,244,0.2)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  floatingCtaDisabled: {
    opacity: 0.75,
  },
  floatingCtaLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  floatingCtaTitle: {
    color: Colors.secondary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  floatingArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,248,244,0.16)',
  },
});

export default LandPackageScreen;
