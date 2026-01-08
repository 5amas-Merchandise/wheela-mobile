// src/screens/WelcomeScreen.js
import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const WHEELA_LOGO = require('../../../assets/logo3.png');

const { width, height } = Dimensions.get('window');
const ROLE_KEY = 'WHEELA_ROLE';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  const selectRole = async (role) => {
    try {
      await AsyncStorage.setItem(ROLE_KEY, role);
    } catch (e) {
      console.error(e);
    }
    navigation.navigate('Signup', { role });
  };

  return (
    <View style={styles.container}>
      {/* Top Illustration */}
      <View style={styles.illustrationContainer}>
        <Image
          source={{
            uri: 'https://i.pinimg.com/736x/12/67/4e/12674e8deaf74ca8da30065dbc5101fb.jpg',
          }}
          style={styles.illustration}
          resizeMode="cover"
        />
        <View style={styles.overlay} />
      </View>

      {/* Bottom White Content Card */}
      <View style={styles.contentCard}>
        <Text style={styles.title}>Get moving with Wheela</Text>
        <Text style={styles.subtitle}>
          Choose how you want to use the app
        </Text>

        <TouchableOpacity
          style={styles.passengerButton}
          onPress={() => selectRole('passenger')}
        >
          <Text style={styles.passengerButtonText}>Ride as Passenger</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.driverButton}
          onPress={() => selectRole('driver')}
        >
          <Text style={styles.driverButtonText}>Drive & Earn</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.loginContainer}
        >
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logo Container - Positioned to overlap between illustration and content card */}
      <View style={styles.logoContainer}>
        <Image
          source={WHEELA_LOGO}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  illustrationContainer: {
    width: width,
    height: height * 0.5,
    overflow: 'hidden',
  },
  illustration: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 176, 243, 0.15)',
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 32,
    paddingTop: 80,
    alignItems: 'center',
    marginTop: -30,
  },
  logoContainer: {
    position: 'absolute',
    top: height * 0.5 - 70, // Centers the logo on the overlap between sections
    alignSelf: 'center',
    width: 120,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0A2540',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 40,
  },
  passengerButton: {
    backgroundColor: '#00B0F3',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  passengerButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  driverButton: {
    backgroundColor: 'transparent',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00B0F3',
    alignItems: 'center',
    marginBottom: 40,
  },
  driverButtonText: {
    color: '#00B0F3',
    fontSize: 18,
    fontWeight: '700',
  },
  loginContainer: {
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    color: '#64748B',
  },
  loginLink: {
    color: '#00B0F3',
    fontWeight: '600',
  },
});