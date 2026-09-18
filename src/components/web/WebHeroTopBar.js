// Account actions across the top of a hero, over the photo.
//
// The hero's product tiles only cover products, and the sticky site header is
// hidden until you scroll - so without this there is no way to reach Cart, Deals,
// AI Picks or your profile from the top of a landing page. The reference sites
// all park these in the hero's top-right for the same reason.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CONTENT_MAX_WIDTH } from '../../hooks/useResponsive';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

const ACTIONS = [
  { key: 'AITab', label: 'AI Picks', icon: 'sparkles-outline' },
  { key: 'PromotionsTab', label: 'Deals', icon: 'pricetags-outline' },
];

const WebHeroTopBar = () => {
  const navigation = useNavigation();
  const { getCartItemCount } = useCart();
  const { user } = useAuth();
  const cartCount = getCartItemCount();
  const firstName = (user?.fullName || user?.name || '').trim().split(' ')[0];
  // Staff browsing the storefront need a route back to their dashboard.
  const isStaff = !!user?.role && user.role !== 'CUSTOMER';

  const goToTab = (routeName) => navigation.navigate('CustomerTabs', { screen: routeName });

  return (
    <View style={styles.bar}>
      <Pressable onPress={() => goToTab('HomeTab')}>
        <Text style={styles.brand}>MyItineri</Text>
      </Pressable>

      <View style={styles.actions}>
        {ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => goToTab(action.key)}
            style={({ hovered }) => [styles.link, hovered && styles.linkHovered]}
          >
            <Ionicons name={action.icon} size={17} color="#FFFFFF" />
            <Text style={styles.linkText}>{action.label}</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => requireAuth(() => navigation.navigate('ChatInbox'), 'Sign in to view your messages.')}
          style={({ hovered }) => [styles.link, hovered && styles.linkHovered]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FFFFFF" />
          <Text style={styles.linkText}>Messages</Text>
        </Pressable>

        <Pressable
          onPress={() => goToTab('CartTab')}
          style={({ hovered }) => [styles.link, hovered && styles.linkHovered]}
        >
          <View>
            <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.linkText}>Cart</Text>
        </Pressable>

        {isStaff && (
          <Pressable
            onPress={() => navigation.navigate('B2BDashboard')}
            style={({ hovered }) => [styles.link, hovered && styles.linkHovered]}
          >
            <Ionicons name="grid-outline" size={17} color="#FFFFFF" />
            <Text style={styles.linkText}>Dashboard</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => goToTab('ProfileTab')}
          style={({ hovered }) => [styles.account, hovered && styles.accountHovered]}
        >
          <Ionicons name="person-circle-outline" size={20} color={Colors.primaryDark} />
          <Text style={styles.accountText} numberOfLines={1}>{firstName || 'Account'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    transitionDuration: '150ms',
    transitionProperty: 'background-color',
  },
  linkHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    maxWidth: 170,
  },
  accountHovered: {
    backgroundColor: Colors.primarySoft,
  },
  accountText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});

export default WebHeroTopBar;
