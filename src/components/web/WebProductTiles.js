// The product selector that sits over the hero on desktop: one square tile per
// bookable product, the active one flipped to a white card with an orange label
// and underline. Doubles as navigation - tapping a tile goes to that product's
// screen - so it works as both "where am I" and "take me elsewhere".
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

export const PRODUCTS = [
  // Home is a tile rather than only the brand logo: the logo-as-home-button is a
  // convention people have to already know, and the tiles are where the eye is.
  { key: 'home', label: 'Home', route: 'HomeTab', icon: 'home-outline', isTab: true },
  { key: 'flights', label: 'Flights', route: 'Flights', icon: 'airplane-outline' },
  { key: 'hotels', label: 'Hotels', route: 'Hotels', icon: 'business-outline' },
  { key: 'activities', label: 'Activities', route: 'Activities', icon: 'umbrella-outline' },
  { key: 'cabs', label: 'Cabs', route: 'Cabs', icon: 'car-outline' },
  { key: 'packages', label: 'Packages', route: 'LandPackage', icon: 'map-outline' },
  { key: 'insurance', label: 'Insurance', route: 'TripSafe', icon: 'shield-checkmark-outline' },
];

const WebProductTiles = ({ active }) => {
  const navigation = useNavigation();

  return (
    <View style={styles.row}>
      {PRODUCTS.map((product) => {
        const isActive = product.key === active;
        return (
          <Pressable
            key={product.key}
            onPress={() => {
              if (isActive) return;
              // Home lives in the tab navigator; the products are stack screens.
              if (product.isTab) {
                navigation.navigate('CustomerTabs', { screen: product.route });
              } else {
                navigation.navigate(product.route);
              }
            }}
            style={({ hovered }) => [
              styles.tile,
              isActive && styles.tileActive,
              hovered && !isActive && styles.tileHovered,
            ]}
          >
            <Ionicons
              name={product.icon}
              size={26}
              color={isActive ? Colors.primary : '#FFFFFF'}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{product.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  tile: {
    width: 112,
    height: 108,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 17, 17, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    // Transitions are a web-only style; react-native-web passes them through and
    // native ignores this component entirely.
    transitionDuration: '160ms',
    transitionProperty: 'transform, background-color',
  },
  tileHovered: {
    backgroundColor: 'rgba(17, 17, 17, 1)',
    transform: [{ translateY: -3 }],
  },
  tileActive: {
    backgroundColor: Colors.card,
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default WebProductTiles;
