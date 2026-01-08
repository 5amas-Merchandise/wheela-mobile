import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Animated, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

// Replace this with your actual Wheela logo asset
// For example: require('./assets/wheela-logo.png')
const WHEELA_LOGO = require('../../../assets/logo.jpg'); // <-- Add your logo file here

const ROLE_KEY = 'WHEELA_ROLE';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  const logoOpacity = new Animated.Value(0);
  const logoScale = new Animated.Value(0.95);
  const contentOpacity = new Animated.Value(0);
  const contentTranslateY = new Animated.Value(40);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.stagger(200, [
        Animated.timing(contentOpacity, { toValue: 1, duration: 800, delay: 400, useNativeDriver: true }),
        Animated.spring(contentTranslateY, { toValue: 0, friction: 9, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const selectRole = async (role) => {
    try {
      await AsyncStorage.setItem(ROLE_KEY, role);
    } catch (e) {}
    navigation.navigate('Signup', { role });
  };

  return (
    <View style={styles.container}>
      {/* Centered Logo at top third */}
      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      {/* Centered content in the lower half */}
      <Animated.View style={[styles.content, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}>

        <TouchableOpacity style={styles.passengerButton} onPress={() => selectRole('passenger')} activeOpacity={0.9}>
          <Text style={styles.buttonText}>Ride as Passenger</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.driverButton} onPress={() => selectRole('driver')} activeOpacity={0.9}>
          <Text style={styles.driverButtonText}>Drive & Earn</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginText}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44',
    alignItems: 'center',        // Perfect horizontal centering
    justifyContent: 'center',   // Vertical centering of children
  },
  logoContainer: {
    position: 'absolute',
    top: '18%',                 // Positions logo in upper part, perfectly centered
    alignItems: 'center',
  },
  logo: {
    width: 200,                 // Adjust based on your logo's aspect ratio
    height: 200,
  },
  content: {
    width: '100%',
    paddingHorizontal: 40,
    alignItems: 'center',       // Ensures all content is centered
  },
  title: {
    color: '#57da23dd',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 0,
    marginTop: 350,
  },
  passengerButton: {
    backgroundColor: '#00B0F3',
    width: '100%',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 500,
    marginBottom: 20,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  driverButton: {
    backgroundColor: 'transparent',
    width: '100%',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00B0F3',
    alignItems: 'center',
    marginBottom: 48,
  },
  buttonText: {
    color: '#010C44',
    fontSize: 18,
    fontWeight: '700',
  },
  driverButtonText: {
    color: '#00B0F3',
    fontSize: 18,
    fontWeight: '700',
  },
  loginLink: {
    alignItems: 'center',
  },
  loginText: {
    color: '#FFFFFFAA',
    fontSize: 16,
  },
});