// The "why book with us" strip that closes a product page on desktop.
//
// Cabs, Activities and Insurance had nothing under their search panel, so the
// page ended in a band of flat background. This gives every product page the
// same closing section, on a soft gradient so the hero doesn't butt straight
// into empty white.
//
// Copy only - no data, no counts. Anything claiming inventory or pricing would
// need to come from the API.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CONTENT_MAX_WIDTH } from '../../hooks/useResponsive';

export const DEFAULT_VALUE_PROPS = [
  {
    icon: 'pricetag-outline',
    title: 'Best Price Guarantee',
    body: 'Get the lowest prices, always.',
    tint: Colors.accentBlueSoft,
  },
  {
    icon: 'headset-outline',
    title: '24/7 Customer Support',
    body: "We're here whenever you need us.",
    tint: Colors.primarySoft,
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Secure & Flexible Booking',
    body: 'Your plans, your way.',
    tint: Colors.accentBlueSoft,
  },
  {
    icon: 'star-outline',
    title: 'Wide Selection',
    body: 'Options for every budget and style.',
    tint: Colors.primarySoft,
  },
];

const WebValueProps = ({
  heading = 'Why book with MyItineri?',
  items = DEFAULT_VALUE_PROPS,
}) => (
  <LinearGradient
    colors={[Colors.backgroundAlt, Colors.background, Colors.background]}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
    style={styles.band}
  >
    <View style={styles.inner}>
      <Text style={styles.heading}>{heading}</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <View key={item.title} style={[styles.card, { backgroundColor: item.tint }]}>
            <View style={styles.icon}>
              <Ionicons name={item.icon} size={20} color={Colors.primary} />
            </View>
            <View style={styles.text}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  </LinearGradient>
);

const styles = StyleSheet.create({
  band: {
    width: '100%',
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 24,
    marginTop: 30,
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: 20,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.accentBlueDark,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    borderRadius: 12,
    padding: 18,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accentBlueDark,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textLight,
  },
});

export default WebValueProps;
