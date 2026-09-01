import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

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
import ActivityBookingScreen from './src/screens/ActivityBookingScreen';
import FlightBookingScreen from './src/screens/FlightBookingScreen';
import FlightReissueScreen from './src/screens/FlightReissueScreen';
import MyFlightBookingsScreen from './src/screens/MyFlightBookingsScreen';
import B2BDashboard from './src/screens/B2BDashboard';
import AIRecommendationsScreen from './src/screens/AIRecommendationsScreen';
import AIPlaceInsightScreen from './src/screens/AIPlaceInsightScreen';
import ChatInboxScreen from './src/screens/ChatInboxScreen';
import ChatScreen from './src/screens/ChatScreen';
import AdminItineraryUploadScreen from './src/screens/AdminItineraryUploadScreen';
import ManageSuppliersScreen from './src/screens/ManageSuppliersScreen';
import PromoBannersScreen from './src/screens/PromoBannersScreen';
import HotelCatalogAdminScreen from './src/screens/HotelCatalogAdminScreen';
import AdminPlatformSettingsScreen from './src/screens/AdminPlatformSettingsScreen';
import GroupTripPlannerScreen from './src/screens/GroupTripPlannerScreen';
import AdminPosterStudioScreen from './src/screens/AdminPosterStudioScreen';
import RequestDetailScreen from './src/screens/RequestDetailScreen';
import CreatePackageScreen from './src/screens/CreatePackageScreen';
import SupplierRequestsScreen from './src/screens/SupplierRequestsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';
import { AuthContext } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { Colors } from './src/constants/Colors';
import API_CONFIG from './src/config/api';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const AUTH_STORAGE_KEY = 'itinera.auth';

function CustomerTabs() {
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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#A2A8B3',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarStyle: {
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
        name="AITab"
        component={AIRecommendationsScreen}
        options={{
          title: 'AI Picks',
          tabBarIcon: ({ color, focused }) => tabIcon('sparkles', color, focused),
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
  const [authState, setAuthState] = useState({
    token: null,
    user: null,
  });
  const [isHydratingAuth, setIsHydratingAuth] = useState(true);

  useEffect(() => {
    const restoreAuthState = async () => {
      try {
        const savedAuth = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
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
            await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
            return;
          }

          const verifiedUser = await response.json();
          const nextAuthState = {
            token: parsedAuth.token,
            user: verifiedUser,
          };

          setAuthState(nextAuthState);
          await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(nextAuthState));
        } else {
          await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
        }
      } catch (error) {
        await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      } finally {
        setIsHydratingAuth(false);
      }
    };

    restoreAuthState();
  }, []);

  const persistAuthState = async (nextAuthState) => {
    try {
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(nextAuthState));
    } catch (error) {
      console.warn('Unable to persist auth state', error);
    }
  };

  const clearPersistedAuthState = async () => {
    try {
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
    } catch (error) {
      console.warn('Unable to clear persisted auth state', error);
    }
  };

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
      <CartProvider>
        {/* Without an explicit flex here, react-native-web lets the whole tree
            grow to fit content instead of being capped at the viewport, so
            nothing anywhere ever scrolls - it just clips at body's edge. */}
        <NavigationContainer style={{ flex: 1 }}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            // @react-navigation/stack positions each screen with
            // absolute-fill for card transitions; on web that box needs an
            // explicit flex: 1 or it never gets capped to the viewport,
            // which is what was letting the whole page grow unbounded.
            cardStyle: { flex: 1 },
          }}
        >
          {!authContextValue.isAuthenticated ? (
            <>
              <Stack.Screen
                name="Splash"
                component={SplashScreen}
                initialParams={{ nextScreen: 'Login' }}
              />
              <Stack.Screen name="Login" component={LoginScreen} />
            </>
          ) : (
            <>
              {isCustomer ? (
                <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
              ) : (
                <Stack.Screen name="B2BDashboard" component={B2BDashboard} />
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
              <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
              <Stack.Screen name="ActivityBooking" component={ActivityBookingScreen} />
              <Stack.Screen name="FlightBooking" component={FlightBookingScreen} />
              <Stack.Screen name="FlightReissue" component={FlightReissueScreen} />
              <Stack.Screen name="MyFlightBookings" component={MyFlightBookingsScreen} />
              <Stack.Screen name="AIRecommendations" component={AIRecommendationsScreen} />
              <Stack.Screen name="AIPlaceInsight" component={AIPlaceInsightScreen} />
              <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="AdminItineraryUpload" component={AdminItineraryUploadScreen} />
              <Stack.Screen name="SupplierNetwork" component={ManageSuppliersScreen} />
              <Stack.Screen name="PromoBanners" component={PromoBannersScreen} />
              <Stack.Screen name="HotelCatalogAdmin" component={HotelCatalogAdminScreen} />
              <Stack.Screen name="AdminPlatformSettings" component={AdminPlatformSettingsScreen} />
              <Stack.Screen name="AdminPosterStudio" component={AdminPosterStudioScreen} />
              <Stack.Screen name="GroupTripPlanner" component={GroupTripPlannerScreen} />
              <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
              <Stack.Screen name="CreatePackage" component={CreatePackageScreen} />
              <Stack.Screen name="SupplierRequests" component={SupplierRequestsScreen} />
              <Stack.Screen name="Reports" component={ReportsScreen} />
            </>
          )}
        </Stack.Navigator>
        </NavigationContainer>
      </CartProvider>
    </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
