import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const WHEELA_LOGO = require('../../../assets/logo3.png');
const { width, height } = Dimensions.get('window');

const BASE_URL = 'https://wheels-backend.vercel.app';

export const TOKEN_KEY = 'WHEELA_TOKEN';
export const USER_KEY = 'WHEELA_USER';
export const ROLE_KEY = 'WHEELA_ROLE';

export const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const getStoredUser = async () => {
  try {
    const userJson = await AsyncStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('+234');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [welcomeName, setWelcomeName] = useState('');
  const [userRole, setUserRole] = useState('passenger');

  const formatIdentifier = (text) => {
    if (!text) return '+234';
    if (/\d/.test(text)) {
      let digits = text.replace(/\D/g, '');
      if (digits.startsWith('234')) {
        // Already international
      } else if (digits.startsWith('0') && digits.length >= 11) {
        digits = '234' + digits.slice(1);
      } else if (digits.length === 10) {
        digits = '234' + digits;
      } else if (digits.length > 10 && !digits.startsWith('234')) {
        digits = '234' + digits.slice(-10);
      }
      return '+' + digits.slice(0, 13);
    }
    return text.trim().toLowerCase();
  };

  const handleIdentifierChange = (text) => {
    const formatted = formatIdentifier(text);
    setIdentifier(formatted);
  };

  const handleLogin = async () => {
    if (!identifier.trim() || identifier === '+234') {
      setErrorMessage('Please enter your phone number or email');
      setErrorModalVisible(true);
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        identifier: identifier.trim(),
        password,
      });

      const { token, user } = response.data;
      if (!token || !user) {
        setErrorMessage('Invalid response from server');
        setErrorModalVisible(true);
        return;
      }

      const isDriver = user.roles?.isDriver === true;

      await AsyncStorage.multiSet([
        [TOKEN_KEY, token],
        [USER_KEY, JSON.stringify(user)],
        [ROLE_KEY, isDriver ? 'driver' : 'passenger'],
      ]);

      setWelcomeName(user.name || 'Rider');
      setUserRole(isDriver ? 'driver' : 'passenger');
      setSuccessModalVisible(true);
    } catch (err) {
      let message = 'Invalid credentials. Please try again.';
      if (err.response?.data?.error?.message) {
        message = err.response.data.error.message;
      } else if (err.message.includes('Network')) {
        message = 'No internet connection. Check your network.';
      } else if (err.code === 'ECONNABORTED') {
        message = 'Request timeout. Try again.';
      }
      setErrorMessage(message);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalVisible(false);
    if (userRole === 'driver') {
      navigation.replace('DriverHomeOffline');
    } else {
      navigation.replace('PassengerMain');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Illustration */}
          <View style={styles.illustrationContainer}>
            <Image
              source={{
                uri: 'https://i.pinimg.com/736x/cb/1a/dc/cb1adcef16f08dec5eae14bf38b4b65e.jpg',
              }}
              style={styles.illustration}
              resizeMode="cover"
            />
            <View style={styles.overlay} />
          </View>

          {/* White Content Card */}
          <View style={styles.contentCard}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Log in to continue your journey
            </Text>

            {/* Form Fields */}
            <TextInput
              placeholder="Phone Number or Email"
              placeholderTextColor="#94A3B8"
              value={identifier}
              onChangeText={handleIdentifierChange}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Log In</Text>
              )}
            </TouchableOpacity>

            {/* Signup Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              style={styles.signupContainer}
            >
              <Text style={styles.signupText}>
                Don't have an account? <Text style={styles.signupLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Logo - Overlapping between sections */}
          <View style={styles.logoContainer}>
            <Image
              source={WHEELA_LOGO}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Welcome Back!</Text>
            <Text style={styles.modalMessage}>
              Hi {welcomeName}, great to see you again
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleSuccessClose}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModalVisible}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.errorIconContainer}>
              <Text style={styles.errorIcon}>✕</Text>
            </View>
            <Text style={styles.modalTitle}>Oops!</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setErrorModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 20,
  },
  illustrationContainer: {
    width: width,
    height: height * 0.38,
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 32,
    paddingTop: 70,
    paddingBottom: 30,
    marginTop: -30,
  },
  logoContainer: {
    position: 'absolute',
    top: height * 0.38 - 60,
    alignSelf: 'center',
    width: 100,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logo: {
    width: 65,
    height: 65,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0A2540',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
    color: '#0A2540',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  button: {
    backgroundColor: '#00B0F3',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#64B5F6',
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  signupContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  signupText: {
    fontSize: 15,
    color: '#64748B',
  },
  signupLink: {
    color: '#00B0F3',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: width * 0.85,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F8F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 48,
    color: '#00B0F3',
    fontWeight: '700',
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 48,
    color: '#EF4444',
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: '#00B0F3',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});