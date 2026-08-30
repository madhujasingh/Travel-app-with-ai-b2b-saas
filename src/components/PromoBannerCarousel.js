import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Dimensions, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';

const WINDOW_HEIGHT = Dimensions.get('window').height;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_SPACING = 12;
const CARD_HEIGHT = 172;

// Admin-managed deal/discount banners (see backend PromoBannerController) -
// renders nothing if the placement has no active banners, so screens can
// drop this in unconditionally without an empty-state gap.
const PromoBannerCarousel = ({ placement }) => {
  const navigation = useNavigation();
  const [banners, setBanners] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerBanner, setViewerBanner] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_CONFIG.BASE_URL}/promo-banners/${placement}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBanners(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Best-effort - a promo carousel failing to load shouldn't block the
        // rest of the screen from rendering.
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (banners.length === 0) return null;

  const handlePress = (banner) => {
    if (banner.linkType === 'SCREEN' && banner.linkTarget) {
      navigation.navigate(banner.linkTarget);
    } else if (banner.linkType === 'URL' && banner.linkTarget) {
      WebBrowser.openBrowserAsync(banner.linkTarget);
    } else if (banner.linkType === 'IMAGE') {
      setViewerBanner(banner);
    }
  };

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING));
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={banners}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => handlePress(item)}
          >
            <Image
              source={{ uri: `${API_CONFIG.BASE_URL}/promo-banners/${item.id}/image` }}
              style={styles.image}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.75)']}
              style={styles.gradient}
            >
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              {!!item.description && (
                <View style={styles.descriptionRow}>
                  <View style={styles.descriptionAccent} />
                  <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      />
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, index) => (
            <View key={index} style={[styles.dot, index === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      <Modal visible={!!viewerBanner} transparent animationType="fade" onRequestClose={() => setViewerBanner(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity
            style={styles.viewerCloseButton}
            onPress={() => setViewerBanner(null)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {viewerBanner && (
            <Image
              source={{ uri: `${API_CONFIG.BASE_URL}/promo-banners/${viewerBanner.id}/image` }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: CARD_SPACING,
    backgroundColor: Colors.backgroundAlt,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
    justifyContent: 'flex-end',
    padding: 14,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  descriptionAccent: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.primaryLight,
  },
  description: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 16,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 6,
  },
  viewerImage: {
    width: '100%',
    height: WINDOW_HEIGHT * 0.8,
  },
});

export default PromoBannerCarousel;
