import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SplashScreen = ({ navigation, route }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const planeFlyAnim = useRef(new Animated.Value(0)).current;
  const textExitAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Entrance: fade + scale in, same as before.
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]),
      // Hold so the logo is actually seen before it leaves.
      Animated.delay(1500),
      // Exit: the plane flies off to the right as the text fades with it.
      Animated.parallel([
        Animated.timing(planeFlyAnim, {
          toValue: SCREEN_WIDTH,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textExitAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      const nextScreen = route?.params?.nextScreen || 'Home';
      navigation.replace(nextScreen);
    });
  }, [navigation, route]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ translateX: planeFlyAnim }] }}>
          <Ionicons name="airplane" size={72} color={Colors.secondary} style={styles.logo} />
        </Animated.View>
        <Animated.Text style={[styles.appName, { opacity: textExitAnim }]}>Itinera</Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: textExitAnim }]}>Your Journey, Our Passion</Animated.Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    marginBottom: 20,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.secondary,
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 16,
    color: Colors.secondary,
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default SplashScreen;
