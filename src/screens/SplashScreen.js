import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, StatusBar, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

// Replace with your actual Wheela logo asset (transparent background recommended)
const WHEELA_LOGO = require('../../assets/logo.jpg'); // <-- Update this path

const JWT_KEY = 'WHEELA_JWT';

export default function SplashScreen() {
  const navigation = useNavigation();
  
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    // Premium logo animation: fade in + gentle spring scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    let mounted = true;
    const timer = setTimeout(async () => {
      if (!mounted) return;
      try {
        const token = await AsyncStorage.getItem(JWT_KEY);
        navigation.reset({
          index: 0,
          routes: [{ name: token ? 'RoleSwitch' : 'Welcome' }],
        });
      } catch (err) {
        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }
    }, 2800); // Extended slightly for luxurious feel

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010C44" />


      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Image source={WHEELA_LOGO} style={styles.logoImage} resizeMode="contain" />
        <Text style={styles.logoText}>WHEELA</Text>
        <Text style={styles.tagline}>Ride with Confidence</Text>
      </Animated.View>

      {/* Optional: Re-add ActivityIndicator if you want a loader at bottom */}
      {/* <ActivityIndicator size="large" color="#00B0F3" style={styles.loader} /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44', // Deep navy for premium sophistication
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 160,   // Adjust based on your logo's aspect ratio
    height: 160,
    marginBottom: 20,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: 6,
    marginBottom: 8,
  },
  tagline: {
    color: '#00B0F3', // Vibrant accent for energy
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },
  loader: {
    position: 'absolute',
    bottom: 80,
  },
});