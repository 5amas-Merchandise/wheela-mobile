// src/screens/SplashScreen.js
import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, StatusBar, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getAuthToken, getUserRole } from '../utils/auth'; // Import from your auth utils

// Replace with your actual Wheela logo asset
const WHEELA_LOGO = require('../../assets/logo.jpg');

export default function SplashScreen() {
  const navigation = useNavigation();
  
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    // Premium logo animation
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
    
    const checkAuthAndNavigate = async () => {
      if (!mounted) return;
      
      try {
        // Check if user has valid token
        const token = await getAuthToken();
        const role = await getUserRole();
        
        if (token) {
          // User is authenticated, navigate based on role
          if (role === 'driver') {
            // Driver goes to offline screen
            navigation.reset({
              index: 0,
              routes: [{ name: 'DriverHomeOffline' }],
            });
          } else {
            // Passenger goes to passenger online screen
            navigation.reset({
              index: 0,
              routes: [{ name: 'PassengerMain' }],
            });
          }
        } else {
          // No token, go to welcome screen
          navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          });
        }
      } catch (err) {
        console.error('Auth check error:', err);
        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }
    };

    // Delay navigation to allow animation to complete
    const timer = setTimeout(() => {
      checkAuthAndNavigate();
    }, 2800);

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 160,
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
    color: '#00B0F3',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },
});