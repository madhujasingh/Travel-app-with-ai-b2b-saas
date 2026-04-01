import React, { useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
import ChatInboxScreen from './src/screens/ChatInboxScreen';
import ChatScreen from './src/screens/ChatScreen';
import AdminItineraryUploadScreen from './src/screens/AdminItineraryUploadScreen';
import GroupTripPlannerScreen from './src/screens/GroupTripPlannerScreen';
import RequestDetailScreen from './src/screens/RequestDetailScreen';
import CreatePackageScreen from './src/screens/CreatePackageScreen';
import SupplierRequestsScreen from './src/screens/SupplierRequestsScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import CustomerProfileScreen from './src/screens/CustomerProfileScreen';
import { AuthContext } from './src/context/AuthContext';
import { Colors } from './src/constants/Colors';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

  const authContextValue = useMemo(
    () => ({
      token: authState.token,
      user: authState.user,
      isAuthenticated: Boolean(authState.token && authState.user),
      login: ({ token, user }) => {
        setAuthState({ token, user });
      },
      logout: () => {
        setAuthState({ token: null, user: null });
      },
    }),
    [authState]
  );

  const isCustomer = authState.user?.role === 'CUSTOMER';

  return (
    <AuthContext.Provider value={authContextValue}>
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
              <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="AdminItineraryUpload" component={AdminItineraryUploadScreen} />
              <Stack.Screen name="GroupTripPlanner" component={GroupTripPlannerScreen} />
              <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
              <Stack.Screen name="CreatePackage" component={CreatePackageScreen} />
              <Stack.Screen name="SupplierRequests" component={SupplierRequestsScreen} />
              <Stack.Screen name="Reports" component={ReportsScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
