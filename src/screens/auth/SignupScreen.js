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
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const WHEELA_LOGO = require('../../../assets/logo3.png');
const { width, height } = Dimensions.get('window');

// UPDATE THIS TO YOUR BACKEND URL
const BASE_URL = "https://wheels-backend.vercel.app";

export default function SignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const role = route.params?.role || 'passenger';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+234'); // Pre-filled with Nigeria country code
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Format and clean phone number, keeping +234 prefix
  const formatPhone = (input) => {
    if (!input) return '+234';
    // Remove all non-digits
    let digitsOnly = input.replace(/\D/g, '');
    // Ensure it starts with 234 (Nigeria)
    if (digitsOnly.startsWith('234')) {
      return '+' + digitsOnly;
    }
    // If user typed 0 at the beginning (common in Nigeria), remove it and add 234
    if (digitsOnly.startsWith('0')) {
      digitsOnly = '234' + digitsOnly.slice(1);
    } 
    // If it's a local Nigerian number without 0 or 234, assume it's after country code
    else if (digitsOnly.length === 10 && !digitsOnly.startsWith('234')) {
      digitsOnly = '234' + digitsOnly;
    }
    // Default: prepend 234 if missing
    else if (!digitsOnly.startsWith('234')) {
      digitsOnly = '234' + digitsOnly;
    }
    return '+' + digitsOnly.slice(0, 15); // E.164 max: + followed by 15 digits
  };

  const handlePhoneChange = (text) => {
    const formatted = formatPhone(text);
    setPhone(formatted);
  };

  const handleSignup = async () => {
    if (!name.trim()) {
      setErrorMessage('Please enter your full name');
      setErrorModalVisible(true);
      return;
    }
    if (!phone.trim() || phone === '+234') {
      setErrorMessage('Please enter a complete phone number');
      setErrorModalVisible(true);
      return;
    }
    if (phone.length < 12) {
      setErrorMessage('Please enter a valid Nigerian phone number (e.g. +2348012345678)');
      setErrorModalVisible(true);
      return;
    }
    if (!password) {
      setErrorMessage('Please enter a password');
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(), // Already in +234XXXXXXXXXX format
        password,
      };
      if (email.trim()) payload.email = email.trim();
      if (role === 'driver') payload.role = 'driver';

      await axios.post(`${BASE_URL}/auth/signup`, payload);
      setSuccessModalVisible(true);
    } catch (err) {
      let errMsg = 'Signup failed. Please try again.';
      if (err.response?.data?.error?.message) {
        const msg = err.response.data.error.message;
        if (msg.includes('phone already in use')) errMsg = 'This phone number is already registered.';
        else if (msg.includes('Invalid phone format')) errMsg = 'Invalid phone format. Use +234 format.';
        else errMsg = msg;
      } else if (err.message === 'Network Error') {
        errMsg = 'Cannot connect to server. Check your internet.';
      }
      setErrorMessage(errMsg);
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalVisible(false);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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
                uri: 'https://i.pinimg.com/736x/dc/25/fc/dc25fcaa998cd6a7a4cc76e89e7ce944.jpg',
              }}
              style={styles.illustration}
              resizeMode="cover"
            />
            <View style={styles.overlay} />
          </View>

          {/* White Content Card */}
          <View style={styles.contentCard}>
            <Text style={styles.title}>
              Sign Up as {role === 'driver' ? 'Driver' : 'Passenger'}
            </Text>
            <Text style={styles.subtitle}>
              Create your account to get started
            </Text>

            {/* Form Fields */}
            <TextInput
              placeholder="Full Name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoCapitalize="words"
            />

            <TextInput
              placeholder="Phone Number (e.g. +2348012345678)"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={handlePhoneChange}
              style={styles.input}
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <TextInput
              placeholder="Email (Optional)"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
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

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginContainer}
            >
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginLink}>Log in</Text>
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
            <Text style={styles.modalTitle}>Success!</Text>
            <Text style={styles.modalMessage}>
              Your account has been created successfully
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleSuccessClose}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Continue to Login</Text>
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
    height: height * 0.28,
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
    paddingBottom: 40,
    marginTop: -30,
    minHeight: height * 0.72,
  },
  logoContainer: {
    position: 'absolute',
    top: height * 0.28 - 60,
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
  loginContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 15,
    color: '#64748B',
  },
  loginLink: {
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