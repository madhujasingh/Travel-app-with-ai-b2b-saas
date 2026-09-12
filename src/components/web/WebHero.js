// Desktop hero: a full-bleed photo with the page title over it, the product
// tiles, and the search panel overlapping its lower edge - the shape used by
// most travel booking sites.
//
// Screens render this only on desktop and keep their existing compact mobile
// hero below the breakpoint, so nothing about the phone layout changes.
import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CONTENT_MAX_WIDTH } from '../../hooks/useResponsive';
import WebProductTiles from './WebProductTiles';
import WebHeroTopBar from './WebHeroTopBar';

// `compact` is for pages that aren't products - cart, profile, deals, messages.
// They still need the tiles so they read as part of the site, but a full-height
// photo hero over a shopping cart looks like a mistake.
const WebHero = ({
  image,
  title,
  subtitle,
  activeProduct,
  compact = false,
  // Left-aligned variant with a small eyebrow and trust badges, for product
  // pages whose hero photo has usable empty space on one side.
  align = 'center',
  eyebrow,
  badges,
  // Dark text reads better than white over a pale photo.
  tone = 'light',
  children,
}) => {
  const isLeft = align === 'left';
  const dark = tone === 'dark';
  const body = (
    <>
      {/* Scrim - the titles are white and the photos are bright, so they need a
          darkened backing to stay readable. */}
      {!!image && (
        isLeft ? (
          <LinearGradient
            colors={['rgba(10, 14, 24, 0.72)', 'rgba(10, 14, 24, 0.35)', 'rgba(10, 14, 24, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.scrim}
          />
        ) : (
          <View style={styles.scrim} />
        )
      )}

      {/* Account actions stay visible at the top of every hero - the tiles below
          only cover products, and the sticky site header is hidden until you
          scroll, so this is the only route to Cart/Deals/AI Picks/Profile from
          the top of the page. */}
      <View style={styles.topBar}>
        <WebHeroTopBar />
      </View>

      <View
        style={[
          styles.content,
          compact && styles.contentCompact,
          isLeft && styles.contentLeft,
        ]}
      >
        {!!eyebrow && (
          <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>{eyebrow}</Text>
        )}

        <Text
          style={[
            styles.title,
            compact && styles.titleCompact,
            isLeft && styles.titleLeft,
            dark && styles.titleDark,
          ]}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={[
              styles.subtitle,
              compact && styles.subtitleCompact,
              isLeft && styles.subtitleLeft,
              dark && styles.subtitleDark,
            ]}
          >
            {subtitle}
          </Text>
        )}

        {!!badges?.length && (
          <View style={styles.badges}>
            {badges.map((badge) => (
              <View key={badge.label} style={styles.badge}>
                <View style={styles.badgeIcon}>
                  <Ionicons name={badge.icon} size={16} color={Colors.primary} />
                </View>
                <Text style={[styles.badgeText, dark && styles.badgeTextDark]}>{badge.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.tiles, isLeft && styles.tilesLeft]}>
          <WebProductTiles active={activeProduct} />
        </View>

        {children}
      </View>
    </>
  );

  // Products without a hero photo yet (cabs, activities, packages, insurance)
  // fall back to a brand gradient rather than shipping a broken image slot.
  if (!image) {
    return (
      <LinearGradient
        colors={[Colors.primaryLight, Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, compact && styles.heroCompact]}
      >
        {body}
      </LinearGradient>
    );
  }

  return (
    <ImageBackground
      source={image}
      style={[styles.hero, compact && styles.heroCompact]}
      imageStyle={styles.heroImage}
    >
      {body}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    paddingTop: 18,
    paddingBottom: 36,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    // The hero titles and tile labels are white, and several of these photos are
    // bright sunsets and blue skies - 0.34 left the text washed out on them.
    backgroundColor: 'rgba(12, 10, 9, 0.42)',
  },
  topBar: {
    width: '100%',
    marginBottom: 26,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 26,
  },
  title: {
    fontSize: 52,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  subtitle: {
    fontSize: 17.5,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.94)',
    textAlign: 'center',
    maxWidth: 720,
    marginTop: -14,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  tiles: {
    marginTop: 4,
  },
  tilesLeft: {
    alignSelf: 'stretch',
  },

  contentLeft: {
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: 'rgba(255, 255, 255, 0.95)',
    textTransform: 'uppercase',
  },
  eyebrowDark: {
    color: Colors.accentBlueDark,
  },
  titleLeft: {
    textAlign: 'left',
    fontSize: 58,
  },
  titleDark: {
    color: Colors.accentBlueDark,
    textShadowColor: 'transparent',
  },
  subtitleLeft: {
    textAlign: 'left',
    maxWidth: 560,
  },
  subtitleDark: {
    color: Colors.text,
    textShadowColor: 'transparent',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 26,
    marginTop: -6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  badgeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
    color: '#FFFFFF',
    maxWidth: 120,
  },
  badgeTextDark: {
    color: Colors.accentBlueDark,
  },

  heroCompact: {
    paddingTop: 18,
    paddingBottom: 24,
  },
  contentCompact: {
    gap: 18,
  },
  titleCompact: {
    fontSize: 34,
  },
  subtitleCompact: {
    fontSize: 15.5,
    marginTop: -8,
  },
});

export default WebHero;
