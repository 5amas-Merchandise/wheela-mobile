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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

// UPDATE THIS TO YOUR BACKEND URL
const BASE_URL = "https://wheels-backend.vercel.app";;

export default function SignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const role = route.params?.role || 'passenger';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+234'); // Pre-filled with Nigeria country code
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!name.trim()) return Alert.alert('Validation', 'Please enter your full name');
    if (!phone.trim() || phone === '+234') return Alert.alert('Validation', 'Please enter a complete phone number');
    if (phone.length < 12) return Alert.alert('Validation', 'Please enter a valid Nigerian phone number (e.g. +2348012345678)');
    if (!password) return Alert.alert('Validation', 'Please enter a password');

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

      Alert.alert('Success! 🎉', 'Your account has been created successfully!', [
        { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
      ]);
    } catch (err) {
      let errorMessage = 'Signup failed. Please try again.';
      if (err.response?.data?.error?.message) {
        const msg = err.response.data.error.message;
        if (msg.includes('phone already in use')) errorMessage = 'This phone number is already registered.';
        else if (msg.includes('Invalid phone format')) errorMessage = 'Invalid phone format. Use +234 format.';
        else errorMessage = msg;
      } else if (err.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Check your internet.';
      }
      Alert.alert('Signup Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Logo at top */}
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.logoText}>WHEELA</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Sign Up as {role === 'driver' ? 'Driver' : 'Passenger'}
        </Text>

        {/* Form Fields */}
        <TextInput
          placeholder="Full Name "
          placeholderTextColor="#AAAAAA"
          value={name}
          onChangeText={setName}
          style={styles.input}
          autoCapitalize="words"
        />

        <TextInput
          placeholder="Phone Number (e.g. +2348012345678) "
          placeholderTextColor="#AAAAAA"
          value={phone}
          onChangeText={handlePhoneChange}
          style={styles.input}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        

        <TextInput
          placeholder="Email"
          placeholderTextColor="#AAAAAA"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          placeholder="Password "
          placeholderTextColor="#AAAAAA"
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
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#010C44" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#010C44',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 48,
  },
  input: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    fontSize: 17,
    marginBottom: 16,
    color: '#010C44',
  },
  hint: {
    color: '#00B0F3',
    fontSize: 14,
    marginLeft: 4,
    marginBottom: 20,
    opacity: 0.9,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00B0F3',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  buttonDisabled: {
    backgroundColor: '#0088c0',
    opacity: 0.7,
  },
  buttonText: {
    color: '#010C44',
    fontSize: 18,
    fontWeight: '800',
  },
});