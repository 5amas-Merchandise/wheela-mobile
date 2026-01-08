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
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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
      Alert.alert('Error', 'Please enter your phone number or email');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
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
        Alert.alert('Error', 'Invalid response from server');
        return;
      }

      const isDriver = user.roles?.isDriver === true;

      await AsyncStorage.multiSet([
        [TOKEN_KEY, token],
        [USER_KEY, JSON.stringify(user)],
        [ROLE_KEY, isDriver ? 'driver' : 'passenger'],
      ]);

      Alert.alert('Success! 🎉', `Welcome back, ${user.name || 'Rider'}!`, [
        {
          text: 'OK',
          onPress: () => {
            if (isDriver) {
              navigation.replace('DriverHomeOffline');
            } else {
              // THIS IS THE FIX
              navigation.replace('PassengerMain'); // Matches App.js wrapper
            }
          },
        },
      ]);
    } catch (err) {
      let message = 'Invalid credentials. Please try again.';
      if (err.response?.data?.error?.message) {
        message = err.response.data.error.message;
      } else if (err.message.includes('Network')) {
        message = 'No internet connection. Check your network.';
      } else if (err.code === 'ECONNABORTED') {
        message = 'Request timeout. Try again.';
      }
      Alert.alert('Login Failed', message);
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
        <View style={styles.logoContainer}>
          <Image source={require('../../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.logoText}>WHEELA</Text>
        </View>

        <Text style={styles.subtitle}>Log in to continue your journey</Text>

        <TextInput
          placeholder="Phone Number or Email"
          placeholderTextColor="#AAAAAA"
          value={identifier}
          onChangeText={handleIdentifierChange}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#AAAAAA"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#010C44" size="small" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.signupLink}>
          <Text style={styles.signupText}>
            Don't have an account? <Text style={{ fontWeight: '800' }}>Sign Up</Text>
          </Text>
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
  subtitle: {
    color: '#FFFFFFAA',
    fontSize: 16,
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
    opacity: 0.7,
  },
  buttonText: {
    color: '#010C44',
    fontSize: 18,
    fontWeight: '800',
  },
  signupLink: {
    marginTop: 24,
  },
  signupText: {
    color: '#FFFFFFAA',
    fontSize: 15,
    textAlign: 'center',
  },
});