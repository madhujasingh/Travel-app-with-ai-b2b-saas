import React, { useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Text, View } from 'react-native';
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
import HotelsScreen from './src/screens/HotelsScreen';
import FlightsScreen from './src/screens/FlightsScreen';
import B2BDashboard from './src/screens/B2BDashboard';
import AIRecommendationsScreen from './src/screens/AIRecommendationsScreen';
import AIPlaceInsightScreen from './src/screens/AIPlaceInsightScreen';
import ChatInboxScreen from './src/screens/ChatInboxScreen';
import ChatScreen from './src/screens/ChatScreen';
import AdminItineraryUploadScreen from './src/screens/AdminItineraryUploadScreen';
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
        name="TalkTab"
        component={TalkToAgentScreen}
        options={{
          title: 'Talk',
          tabBarIcon: ({ color, focused }) => tabIcon('headset', color, focused),
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
          Itinera
        </Text>
        <ActivityIndicator color={Colors.secondary} style={{ marginTop: 18 }} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <CartProvider>
        <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
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
              <Stack.Screen name="Flights" component={FlightsScreen} />
              <Stack.Screen name="AIRecommendations" component={AIRecommendationsScreen} />
              <Stack.Screen name="AIPlaceInsight" component={AIPlaceInsightScreen} />
              <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="AdminItineraryUpload" component={AdminItineraryUploadScreen} />
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
  );
}
