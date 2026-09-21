import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStorage from './src/utils/secureStorage';
import { AlertHost } from './src/utils/appAlert';
import LoginPrompt from './src/components/LoginPrompt';

// Import Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import LandPackageScreen from './src/screens/LandPackageScreen';
import ItineraryListScreen from './src/screens/ItineraryListScreen';
import ItineraryDetailScreen from './src/screens/ItineraryDetailScreen';
import CustomizationScreen from './src/screens/CustomizationScreen';
import CartScreen from './src/screens/CartScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import TalkToAgentScreen from './src/screens/TalkToAgentScreen';
import PromotionsScreen from './src/screens/PromotionsScreen';
import HotelsScreen from './src/screens/HotelsScreen';
import HotelSearchResultsScreen from './src/screens/HotelSearchResultsScreen';
import HotelDetailScreen from './src/screens/HotelDetailScreen';
import HotelBookingScreen from './src/screens/HotelBookingScreen';
import FlightsScreen from './src/screens/FlightsScreen';
import ActivitiesScreen from './src/screens/ActivitiesScreen';
import ActivityDetailScreen from './src/screens/ActivityDetailScreen';
import ActivityResultsScreen from './src/screens/ActivityResultsScreen';
import ActivityBookingScreen from './src/screens/ActivityBookingScreen';
import CabsScreen from './src/screens/CabsScreen';
import CabResultsScreen from './src/screens/CabResultsScreen';
import CabBookingScreen from './src/screens/CabBookingScreen';
import TripSafeScreen from './src/screens/TripSafeScreen';
import TripSafeResultsScreen from './src/screens/TripSafeResultsScreen';
import TripSafeBookingScreen from './src/screens/TripSafeBookingScreen';
import FlightBookingScreen from './src/screens/FlightBookingScreen';
import FlightReissueScreen from './src/screens/FlightReissueScreen';
import MyFlightBookingsScreen from './src/screens/MyFlightBookingsScreen';
import B2BDashboard from './src/screens/B2BDashboard';
import ChatInboxScreen from './src/screens/ChatInboxScreen';
import ChatScreen from './src/screens/ChatScreen';
import AdminItineraryUploadScreen from './src/screens/AdminItineraryUploadScreen';
import ManageSuppliersScreen from './src/screens/ManageSuppliersScreen';
import PromoBannersScreen from './src/screens/PromoBannersScreen';
import HotelCatalogAdminScreen from './src/screens/HotelCatalogAdminScreen';
import AdminPlatformSettingsScreen from './src/screens/AdminPlatformSettingsScreen';
import GroupTripPlannerScreen from './src/screens/GroupTripPlannerScreen';
import AdminPosterStudioScreen from './src/screens/AdminPosterStudioScreen';
import AdminCouponsScreen from './src/screens/AdminCouponsScreen';
import AdminMarkupScreen from './src/screens/AdminMarkupScreen';
import RequestDetailScreen from './src/screens/RequestDetailScreen';
import CreatePackageScreen from './src/screens/CreatePackageScreen';
import SupplierRequestsScreen from './src/screens/SupplierRequestsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';
import { AuthContext } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { MarkupProvider } from './src/context/MarkupContext';
import { Colors } from './src/constants/Colors';
import API_CONFIG from './src/config/api';
import AppTabBar from './src/components/AppTabBar';
import WebHeaderNav from './src/components/web/WebHeaderNav';
import useResponsive from './src/hooks/useResponsive';
import linking from './src/config/linking';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const AUTH_STORAGE_KEY = 'itinera.auth';

// Customer screens that are pushed on the stack rather than living in the tab
// navigator. On the web they still need the site header - a pushed screen with
// no nav is fine on a phone (there's a back gesture) but reads as a dead end in
// a browser. Login, Splash and every B2B screen are deliberately absent.
// Screens that render a WebHero. Their hero carries the product tiles, so they
// get no in-flow header - they render a WebStickyHeader that slides in once the
// hero has scrolled away instead.
const HERO_ROUTES = new Set([
  'Flights', 'Hotels', 'Activities', 'Cabs', 'TripSafe',
  'Cart', 'MyFlightBookings', 'ChatInbox', 'GroupTripPlanner',
  'LandPackage',
]);

const WEB_HEADER_ROUTES = new Set([
  'LandPackage', 'ItineraryList', 'ItineraryDetail', 'Customization',
  'Cart', 'Checkout', 'TalkToAgent', 'GroupTripPlanner',
  'Hotels', 'HotelSearchResults', 'HotelDetail', 'HotelBooking',
  'Flights', 'FlightBooking', 'FlightReissue', 'MyFlightBookings',
  'Activities', 'ActivityResults', 'ActivityDetail', 'ActivityBooking',
  'Cabs', 'CabResults', 'CabBooking',
  'TripSafe', 'TripSafeResults', 'TripSafeBooking',
  'ChatInbox', 'ChatScreen',
]);

function CustomerTabs() {
  // Desktop swaps the floating bottom bar for a top site header (see
  // AppTabBar), which has to be positioned above the screen rather than over it.
  const { isDesktop } = useResponsive();

  const tabIcon = (name, color, focused) => (
    <View
      style={{
        backgroundColor: focused ? Colors.primarySoft : 'transparent',
        borderRadius: 14,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Ionicons name={name} size={focused ? 20 : 18} color={color} />
    </View>
  );

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktop ? 'top' : 'bottom',
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#A2A8B3',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
          marginBottom: 2,
        },
        // The floating pill styling only applies to the phone bar; the desktop
        // header lays itself out and must not be given a fixed height or margins.
        tabBarStyle: isDesktop ? undefined : {
          backgroundColor: Colors.secondary,
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
          marginHorizontal: 12,
          marginBottom: 10,
          borderRadius: 22,
          position: 'absolute',
          shadowColor: Colors.shadow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 18,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => tabIcon('home', color, focused),
        }}
      />
      <Tab.Screen
        name="PromotionsTab"
        component={PromotionsScreen}
        options={{
          title: 'Deals',
          tabBarIcon: ({ color, focused }) => tabIcon('pricetags', color, focused),
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, focused }) => tabIcon('cart', color, focused),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={CustomerProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => tabIcon('person', color, focused),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  // Holds the action a signed-out traveller tried to take, so we can run it
  // for them once they've signed in instead of dumping them back at the top.
  const [authPrompt, setAuthPrompt] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const [authState, setAuthState] = useState({
    token: null,
    user: null,
  });
  const [isHydratingAuth, setIsHydratingAuth] = useState(true);
  const { isDesktop } = useResponsive();

  // Render's free tier spins the backend down when idle, so the first request
  // after a quiet spell waits ~50s for it to boot. Nudge it awake as soon as
  // the app opens: the wake-up then overlaps with the visitor reading the home
  // page instead of landing on them when they hit Search.
  //
  // No branch on "is it already running" - asking is the only way to find out,
  // and a warm backend answers this in milliseconds. Deliberately silent: it's
  // an optimisation, and nothing on screen depends on it.
  useEffect(() => {
    const controller = new AbortController();
    // Long enough to cover a cold boot; the request is abandoned after that
    // rather than left hanging for the life of the session.
    const timeout = setTimeout(() => controller.abort(), 70000);

    fetch(`${API_CONFIG.BASE_URL}/health`, { signal: controller.signal })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const restoreAuthState = async () => {
      try {
        const savedAuth = await SecureStorage.getItem(AUTH_STORAGE_KEY);
        if (!savedAuth) {
          return;
        }

        const parsedAuth = JSON.parse(savedAuth);
        if (parsedAuth?.token && parsedAuth?.user) {
          const response = await fetch(`${API_CONFIG.BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${parsedAuth.token}`,
            },
          });

          if (!response.ok) {
            await SecureStorage.deleteItem(AUTH_STORAGE_KEY);
            return;
          }

          const verifiedUser = await response.json();
          const nextAuthState = {
            token: parsedAuth.token,
            user: verifiedUser,
          };

          setAuthState(nextAuthState);
          await SecureStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuthState));
        } else {
          await SecureStorage.deleteItem(AUTH_STORAGE_KEY);
        }
      } catch (error) {
        await SecureStorage.deleteItem(AUTH_STORAGE_KEY);
      } finally {
        setIsHydratingAuth(false);
      }
    };

    restoreAuthState();
  }, []);

  const persistAuthState = async (nextAuthState) => {
    try {
      await SecureStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuthState));
    } catch (error) {
      console.warn('Unable to persist auth state', error);
    }
  };

  const clearPersistedAuthState = async () => {
    try {
      await SecureStorage.deleteItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to clear persisted auth state', error);
    }
  };

  const isAuthed = Boolean(authState.token && authState.user);
  useEffect(() => {
    if (!isAuthed || !pendingAction) return;
    // One frame after the authenticated screens mount, so navigate() can
    // resolve the booking route.
    const timer = setTimeout(() => {
      pendingAction();
      setPendingAction(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthed, pendingAction]);

  const authContextValue = useMemo(
    () => ({
      token: authState.token,
      user: authState.user,
      isAuthenticated: Boolean(authState.token && authState.user),
      login: ({ token, user }) => {
        const nextAuthState = { token, user };
        setAuthState(nextAuthState);
        void persistAuthState(nextAuthState);
      },
      logout: () => {
        setAuthState({ token: null, user: null });
        void clearPersistedAuthState();
      },
      // Gate for actions that genuinely need an account - booking, checkout,
      // saved trips. Browsing and searching deliberately don't call this.
      // Returns true when the caller may proceed immediately.
      requireAuth: (action, message) => {
        if (authState.token && authState.user) {
          action?.();
          return true;
        }
        setAuthPrompt({ action, message });
        return false;
      },
    }),
    [authState]
  );

  const isCustomer = authState.user?.role === 'CUSTOMER';

  if (isHydratingAuth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Ionicons name="airplane" size={68} color={Colors.secondary} />
        <Text
          style={{
            marginTop: 16,
            fontSize: 36,
            fontWeight: '800',
            color: Colors.secondary,
            letterSpacing: 2,
          }}
        >
          MyItineri
        </Text>
        <ActivityIndicator color={Colors.secondary} style={{ marginTop: 18 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <AuthContext.Provider value={authContextValue}>
      <MarkupProvider token={authState.token}>
      <CartProvider userId={authState.user?.id ?? null}>
        {/* Without an explicit flex here, react-native-web lets the whole tree
            grow to fit content instead of being capped at the viewport, so
            nothing anywhere ever scrolls - it just clips at body's edge. */}
        <NavigationContainer style={{ flex: 1 }} linking={linking}>
        <Stack.Navigator
          screenOptions={({ route }) => ({
            // Desktop keeps the site header on pushed customer screens; every
            // other case stays headerless exactly as before.
            headerShown:
              isDesktop &&
              WEB_HEADER_ROUTES.has(route.name) &&
              !HERO_ROUTES.has(route.name),
            header: () => <WebHeaderNav showBack />,
            // @react-navigation/stack positions each screen with
            // absolute-fill for card transitions; on web that box needs an
            // explicit flex: 1 or it never gets capped to the viewport,
            // which is what was letting the whole page grow unbounded.
            cardStyle: { flex: 1 },
          })}
        >
          {!authContextValue.isAuthenticated ? (
            <>
              {/* Signed-out visitors get the storefront, not a login wall.
                  Searching, prices and package pages are all public on the
                  backend already, and a wall here would also make the whole
                  site unindexable - crawlers can't sign in. Sign-in is asked
                  for at the point of booking instead, via requireAuth. */}
              <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
              <Stack.Screen name="LandPackage" component={LandPackageScreen} />
              <Stack.Screen name="ItineraryList" component={ItineraryListScreen} />
              <Stack.Screen name="ItineraryDetail" component={ItineraryDetailScreen} />
              <Stack.Screen name="Hotels" component={HotelsScreen} />
              <Stack.Screen name="HotelSearchResults" component={HotelSearchResultsScreen} />
              <Stack.Screen name="HotelDetail" component={HotelDetailScreen} />
              <Stack.Screen name="Flights" component={FlightsScreen} />
              <Stack.Screen name="Activities" component={ActivitiesScreen} />
              <Stack.Screen name="ActivityResults" component={ActivityResultsScreen} />
              <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
              <Stack.Screen name="Cabs" component={CabsScreen} />
              <Stack.Screen name="CabResults" component={CabResultsScreen} />
              <Stack.Screen name="TripSafe" component={TripSafeScreen} />
              <Stack.Screen name="TripSafeResults" component={TripSafeResultsScreen} />
              {/* Still reachable directly, for anyone who wants the full page
                  rather than the booking-time prompt. */}
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Splash" component={SplashScreen} initialParams={{ nextScreen: 'CustomerTabs' }} />
            </>
          ) : (
            <>
              {isCustomer ? (
                <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
              ) : (
                <>
                  {/* B2BDashboard stays first, so it remains the landing screen
                      for staff. CustomerTabs is registered too so admins and
                      suppliers can open the customer storefront - to check a
                      package they just published, or a price they changed -
                      without logging out and back in.

                      Deliberately NOT symmetric: a customer never gets
                      B2BDashboard registered, so /dashboard is unreachable for
                      them even by URL. */}
                  <Stack.Screen name="B2BDashboard" component={B2BDashboard} />
                  <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
                </>
              )}

              <Stack.Screen name="LandPackage" component={LandPackageScreen} />
              <Stack.Screen name="ItineraryList" component={ItineraryListScreen} />
              <Stack.Screen name="ItineraryDetail" component={ItineraryDetailScreen} />
              <Stack.Screen name="Customization" component={CustomizationScreen} />
              <Stack.Screen name="Cart" component={CartScreen} />
              <Stack.Screen name="Checkout" component={CheckoutScreen} />
              <Stack.Screen name="TalkToAgent" component={TalkToAgentScreen} />
              <Stack.Screen name="Hotels" component={HotelsScreen} />
              <Stack.Screen name="HotelSearchResults" component={HotelSearchResultsScreen} />
              <Stack.Screen name="HotelDetail" component={HotelDetailScreen} />
              <Stack.Screen name="HotelBooking" component={HotelBookingScreen} />
              <Stack.Screen name="Flights" component={FlightsScreen} />
              <Stack.Screen name="Activities" component={ActivitiesScreen} />
              <Stack.Screen name="ActivityResults" component={ActivityResultsScreen} />
              <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
              <Stack.Screen name="ActivityBooking" component={ActivityBookingScreen} />
              <Stack.Screen name="Cabs" component={CabsScreen} />
              <Stack.Screen name="CabResults" component={CabResultsScreen} />
              <Stack.Screen name="CabBooking" component={CabBookingScreen} />
              <Stack.Screen name="TripSafe" component={TripSafeScreen} />
              <Stack.Screen name="TripSafeResults" component={TripSafeResultsScreen} />
              <Stack.Screen name="TripSafeBooking" component={TripSafeBookingScreen} />
              <Stack.Screen name="FlightBooking" component={FlightBookingScreen} />
              <Stack.Screen name="FlightReissue" component={FlightReissueScreen} />
              <Stack.Screen name="MyFlightBookings" component={MyFlightBookingsScreen} />
              <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="AdminItineraryUpload" component={AdminItineraryUploadScreen} />
              <Stack.Screen name="SupplierNetwork" component={ManageSuppliersScreen} />
              <Stack.Screen name="PromoBanners" component={PromoBannersScreen} />
              <Stack.Screen name="HotelCatalogAdmin" component={HotelCatalogAdminScreen} />
              <Stack.Screen name="AdminPlatformSettings" component={AdminPlatformSettingsScreen} />
              <Stack.Screen name="AdminPosterStudio" component={AdminPosterStudioScreen} />
              <Stack.Screen name="AdminCoupons" component={AdminCouponsScreen} />
              <Stack.Screen name="AdminMarkup" component={AdminMarkupScreen} />
              <Stack.Screen name="GroupTripPlanner" component={GroupTripPlannerScreen} />
              <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
              <Stack.Screen name="CreatePackage" component={CreatePackageScreen} />
              <Stack.Screen name="SupplierRequests" component={SupplierRequestsScreen} />
              <Stack.Screen name="Reports" component={ReportsScreen} />
            </>
          )}
        </Stack.Navigator>
        </NavigationContainer>
        {/* Renders the in-app dialog that replaces Alert.alert on web; a no-op
            on native, where the OS draws the dialog itself. Mounted here, after
            the navigator, so it overlays every screen. */}
        <LoginPrompt
          visible={Boolean(authPrompt)}
          message={authPrompt?.message}
          onClose={() => setAuthPrompt(null)}
          onSuccess={() => {
            // Deferred rather than run here: the booking screens are only
            // registered on the authenticated branch of the navigator, so
            // navigating before that re-render lands on a screen that does
            // not exist yet. See the effect that drains this.
            setPendingAction(() => authPrompt?.action || null);
            setAuthPrompt(null);
          }}
        />
        <AlertHost />
      </CartProvider>
      </MarkupProvider>
    </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
