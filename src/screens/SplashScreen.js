import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const SplashScreen = ({ navigation, route }) => {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.5);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      const nextScreen = route?.params?.nextScreen || 'Home';
      navigation.replace(nextScreen);
    }, 3000);

    return () => clearTimeout(timer);
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
        <Ionicons name="airplane" size={72} color={Colors.secondary} style={styles.logo} />
        <Text style={styles.appName}>Itinera</Text>
        <Text style={styles.tagline}>Your Journey, Our Passion</Text>
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
