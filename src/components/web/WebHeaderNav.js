// Desktop top navigation, used in place of the floating bottom tab bar once the
// viewport is wide enough. A five-icon bar centred in a 1440px window reads as
// a phone app someone forgot to lay out, so this is shaped like a travel site
// header instead: brand on the left, the products across the middle, account
// actions on the right.
//
// Used in two places, which is why it takes its navigation from context rather
// than props: AppTabBar renders it as the tab navigator's `tabBar` on desktop,
// and the stack navigator renders it as the `header` for customer screens like
// HotelDetail that sit outside the tab navigator. Without the second case, every
// pushed screen would lose the site header - fine on a phone, wrong on the web.
//
// Tab routes are reached with navigate('CustomerTabs', { screen }) so the call
// works from inside the tabs (bubbles up to the stack, then back down) and from
// a sibling stack screen alike. Plain stack routes just navigate() directly.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CONTENT_MAX_WIDTH } from '../../hooks/useResponsive';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

const PRODUCTS = [
  { label: 'Home', route: 'HomeTab', icon: 'home-outline', isTab: true },
  { label: 'Flights', route: 'Flights', icon: 'airplane-outline' },
  { label: 'Hotels', route: 'Hotels', icon: 'bed-outline' },
  { label: 'Activities', route: 'Activities', icon: 'ticket-outline' },
  { label: 'Cabs', route: 'Cabs', icon: 'car-outline' },
  { label: 'Packages', route: 'LandPackage', icon: 'map-outline' },
  { label: 'Group Trips', route: 'GroupTripPlanner', icon: 'people-outline' },
];

const NavLink = ({ label, icon, isActive, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ hovered }) => [
      styles.navLink,
      hovered && styles.navLinkHovered,
      isActive && styles.navLinkActive,
    ]}
  >
    <Ionicons
      name={icon}
      size={17}
      color={isActive ? Colors.primaryDark : Colors.textLight}
    />
    <Text style={[styles.navLinkText, isActive && styles.navLinkTextActive]}>{label}</Text>
  </Pressable>
);

const WebHeaderNav = ({ state, showBack = false }) => {
  const navigation = useNavigation();
  const { getCartItemCount } = useCart();
  const { user } = useAuth();
  const cartCount = getCartItemCount();

  // `state` is only supplied in the tab-bar case; as a stack header there is no
  // active tab to highlight.
  const activeTab = state ? state.routes[state.index]?.name : null;

  // Which stack screen is on top - without this the header highlights nothing
  // while you're on Flights or Hotels, so it reads as unrelated to the page.
  const activeRoute = useNavigationState((navState) => {
    if (!navState) return null;
    let route = navState.routes[navState.index];
    while (route?.state) {
      route = route.state.routes[route.state.index];
    }
    return route?.name ?? null;
  });

  const goToTab = (routeName) =>
    navigation.navigate('CustomerTabs', { screen: routeName });
  const goToScreen = (routeName) => navigation.navigate(routeName);

  const firstName = (user?.fullName || user?.name || '').trim().split(' ')[0];
  // Staff browsing the storefront need a route back to their dashboard.
  const isStaff = !!user?.role && user.role !== 'CUSTOMER';

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        {showBack && navigation.canGoBack() && (
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ hovered }) => [styles.backButton, hovered && styles.navLinkHovered]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={19} color={Colors.textLight} />
          </Pressable>
        )}

        <Pressable onPress={() => goToTab('HomeTab')} style={styles.brand}>
          <Text style={styles.brandText}>MyItineri</Text>
        </Pressable>

        <View style={styles.products}>
          {PRODUCTS.map((product) => (
            <NavLink
              key={product.route}
              label={product.label}
              icon={product.icon}
              isActive={
                product.isTab
                  ? activeTab === product.route || activeRoute === product.route
                  : activeRoute === product.route
              }
              onPress={() => (product.isTab ? goToTab(product.route) : goToScreen(product.route))}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <NavLink
            label="AI Picks"
            icon="sparkles-outline"
            isActive={activeTab === 'AITab'}
            onPress={() => goToTab('AITab')}
          />
          <NavLink
            label="Deals"
            icon="pricetags-outline"
            isActive={activeTab === 'PromotionsTab'}
            onPress={() => goToTab('PromotionsTab')}
          />

          <Pressable
            onPress={() => goToTab('CartTab')}
            style={({ hovered }) => [
              styles.navLink,
              hovered && styles.navLinkHovered,
              activeTab === 'CartTab' && styles.navLinkActive,
            ]}
          >
            <View>
              <Ionicons
                name="cart-outline"
                size={18}
                color={activeTab === 'CartTab' ? Colors.primaryDark : Colors.textLight}
              />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.navLinkText,
                activeTab === 'CartTab' && styles.navLinkTextActive,
              ]}
            >
              Cart
            </Text>
          </Pressable>

          {isStaff && (
            <Pressable
              onPress={() => navigation.navigate('B2BDashboard')}
              style={({ hovered }) => [styles.link, hovered && styles.linkHovered]}
            >
              <Ionicons name="grid-outline" size={17} color={Colors.textLight} />
              <Text style={styles.linkText}>Dashboard</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => goToTab('ProfileTab')}
            style={({ hovered }) => [styles.account, hovered && styles.accountHovered]}
          >
            <Ionicons name="person-circle-outline" size={20} color={Colors.primaryDark} />
            <Text style={styles.accountText} numberOfLines={1}>
              {firstName || 'Account'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    zIndex: 20,
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    padding: 7,
    marginRight: 2,
    borderRadius: 9,
  },
  brand: {
    paddingRight: 12,
  },
  brandText: {
    fontSize: 21,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.4,
  },
  products: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 2,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
  },
  navLinkHovered: {
    backgroundColor: Colors.backgroundAlt,
  },
  navLinkActive: {
    backgroundColor: Colors.primarySoft,
  },
  navLinkText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textLight,
  },
  navLinkTextActive: {
    color: Colors.primaryDark,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.secondary,
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    maxWidth: 160,
  },
  accountHovered: {
    backgroundColor: Colors.primarySurface,
  },
  accountText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
});

export default WebHeaderNav;
