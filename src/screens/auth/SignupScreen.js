import React, { useState, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const WHEELA_LOGO = require('../../../assets/logo3.png');
const { width, height } = Dimensions.get('window');

const BASE_URL = "https://wheels-backend-7ydc.onrender.com";

export default function SignupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const role = route.params?.role || 'passenger';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+234');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(
    route.params?.referralCode || ''
  );
  const [referralValid, setReferralValid] = useState(null);
  const [referralChecking, setReferralChecking] = useState(false);
  const [referralName, setReferralName] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // ── Phone formatting ────────────────────────────────────────────────────

  const formatPhone = (input) => {
    if (!input) return '+234';
    let digitsOnly = input.replace(/\D/g, '');
    if (digitsOnly.startsWith('234')) return '+' + digitsOnly;
    if (digitsOnly.startsWith('0'))   return '+234' + digitsOnly.slice(1);
    if (digitsOnly.length === 10 && !digitsOnly.startsWith('234')) return '+234' + digitsOnly;
    if (!digitsOnly.startsWith('234')) digitsOnly = '234' + digitsOnly;
    return '+' + digitsOnly.slice(0, 15);
  };

  const handlePhoneChange = (text) => setPhone(formatPhone(text));

  // ── Referral code validation (on-blur) ──────────────────────────────────

  const handleReferralBlur = async () => {
    const code = referralCode.trim().toUpperCase();
    if (!code) {
      setReferralValid(null);
      setReferralName('');
      return;
    }

    setReferralChecking(true);
    try {
      console.log('[Referral] Validating code:', code);
      const res = await axios.post(`${BASE_URL}/referrals/validate`, { code });
      console.log('[Referral] Validate response:', JSON.stringify(res.data, null, 2));

      if (res.data.valid) {
        setReferralValid(true);
        setReferralName(res.data.referrerName || 'your friend');
      } else {
        setReferralValid(false);
        setReferralName('');
        triggerShake();
      }
    } catch (err) {
      console.error('[Referral] Validate error status:', err.response?.status);
      console.error('[Referral] Validate error data:', JSON.stringify(err.response?.data, null, 2));
      console.error('[Referral] Validate error message:', err.message);
      setReferralValid(false);
      setReferralName('');
      triggerShake();
    } finally {
      setReferralChecking(false);
    }
  };

  const handleReferralChange = (text) => {
    setReferralCode(text.toUpperCase());
    setReferralValid(null);
    setReferralName('');
  };

  // ── Signup ───────────────────────────────────────────────────────────────

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

    // If user typed a referral code but hasn't validated yet, validate now
    const code = referralCode.trim().toUpperCase();
    if (code && referralValid === null) {
      setReferralChecking(true);
      try {
        console.log('[Signup] Pre-validating referral code:', code);
        const res = await axios.post(`${BASE_URL}/referrals/validate`, { code });
        console.log('[Signup] Pre-validate response:', JSON.stringify(res.data, null, 2));
        setReferralValid(res.data.valid);
        if (!res.data.valid) {
          setReferralChecking(false);
          setErrorMessage('The referral code you entered is invalid. Remove it or enter a correct one.');
          setErrorModalVisible(true);
          return;
        }
        setReferralName(res.data.referrerName || '');
      } catch (err) {
        console.error('[Signup] Pre-validate error status:', err.response?.status);
        console.error('[Signup] Pre-validate error data:', JSON.stringify(err.response?.data, null, 2));
        console.error('[Signup] Pre-validate error message:', err.message);
        setReferralChecking(false);
        setErrorMessage('Could not verify referral code. Check your connection and try again.');
        setErrorModalVisible(true);
        return;
      } finally {
        setReferralChecking(false);
      }
    }

    // Block signup if user typed a code and it's explicitly invalid
    if (code && referralValid === false) {
      setErrorMessage('Please remove the invalid referral code or enter a correct one.');
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        password,
      };
      if (email.trim())      payload.email        = email.trim();
      if (role === 'driver') payload.role          = 'driver';
      if (code)              payload.referralCode  = code;

      console.log('[Signup] Sending payload:', JSON.stringify(payload, null, 2));

      const res = await axios.post(`${BASE_URL}/auth/signup`, payload);

      console.log('[Signup] Success response status:', res.status);
      console.log('[Signup] Success response data:', JSON.stringify(res.data, null, 2));

      setSuccessModalVisible(true);
    } catch (err) {
      // ── Full error dump to console ──────────────────────────────────────
      console.error('======= SIGNUP ERROR =======');
      console.error('[Signup] HTTP status:', err.response?.status);
      console.error('[Signup] Response headers:', JSON.stringify(err.response?.headers, null, 2));
      console.error('[Signup] Response data:', JSON.stringify(err.response?.data, null, 2));
      console.error('[Signup] Request config url:', err.config?.url);
      console.error('[Signup] Request config data:', err.config?.data);
      console.error('[Signup] Error message:', err.message);
      console.error('[Signup] Full error:', err);
      console.error('============================');

      // ── User-facing error message ───────────────────────────────────────
      let errMsg = 'Signup failed. Please try again.';
      if (err.response?.data?.error?.message) {
        const msg = err.response.data.error.message;
        if (msg.includes('phone already in use'))       errMsg = 'This phone number is already registered.';
        else if (msg.includes('Invalid phone format'))  errMsg = 'Invalid phone format. Use +234 format.';
        else if (msg.includes('Invalid referral code')) errMsg = 'That referral code is not valid.';
        else errMsg = msg;
      } else if (err.response?.data?.message) {
        // Some servers return { message: '...' } instead of { error: { message: '...' } }
        errMsg = err.response.data.message;
      } else if (err.message === 'Network Error') {
        errMsg = 'Cannot connect to server. Check your internet.';
      } else if (err.response?.status === 500) {
        errMsg = 'Server error. Please try again in a moment.';
      } else if (err.response?.status === 422) {
        errMsg = 'Invalid data submitted. Please check your inputs.';
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

  // ── Referral input border colour ─────────────────────────────────────────

  const referralBorderColor =
    referralValid === true  ? '#22C55E' :
    referralValid === false ? '#EF4444' :
    '#E2E8F0';

  const referralHintColor =
    referralValid === true  ? '#22C55E' :
    referralValid === false ? '#EF4444' :
    '#94A3B8';

  const referralHint =
    referralChecking          ? 'Checking code…' :
    referralValid === true    ? `✓ Code accepted! You and ${referralName} both get rewards` :
    referralValid === false   ? '✕ Invalid referral code' :
    `${role === 'driver' ? 'Drivers' : 'Passengers'} who use a code get ₦300 off their first ride`;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              source={{ uri: 'https://i.pinimg.com/736x/dc/25/fc/dc25fcaa998cd6a7a4cc76e89e7ce944.jpg' }}
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
            <Text style={styles.subtitle}>Create your account to get started</Text>

            {/* Full Name */}
            <TextInput
              placeholder="Full Name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoCapitalize="words"
            />

            {/* Phone */}
            <TextInput
              placeholder="Phone Number (e.g. +2348012345678)"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={handlePhoneChange}
              style={styles.input}
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            {/* Email (optional) */}
            <TextInput
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password */}
            <View style={styles.passwordRow}>
              <TextInput
                placeholder="Password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                style={[styles.input, styles.passwordInput]}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setPasswordVisible(v => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeIcon}>{passwordVisible ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            {/* ── Referral Code ── */}
            <View style={styles.referralSection}>
              <Text style={styles.referralLabel}>
                🎁 Have a referral code?{' '}
                <Text style={styles.referralLabelOptional}>(Optional)</Text>
              </Text>

              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <View style={[styles.referralInputRow, { borderColor: referralBorderColor }]}>
                  <TextInput
                    placeholder="Enter code e.g. AHM9XK3P"
                    placeholderTextColor="#94A3B8"
                    value={referralCode}
                    onChangeText={handleReferralChange}
                    onBlur={handleReferralBlur}
                    style={styles.referralInput}
                    autoCapitalize="characters"
                    maxLength={8}
                    autoCorrect={false}
                  />
                  {referralChecking ? (
                    <ActivityIndicator size="small" color="#00B0F3" style={styles.referralIcon} />
                  ) : referralValid === true ? (
                    <Text style={[styles.referralIcon, { color: '#22C55E', fontSize: 18 }]}>✓</Text>
                  ) : referralValid === false ? (
                    <Text style={[styles.referralIcon, { color: '#EF4444', fontSize: 18 }]}>✕</Text>
                  ) : (
                    <Text style={[styles.referralIcon, { color: '#94A3B8', fontSize: 16 }]}>🎟️</Text>
                  )}
                </View>
              </Animated.View>

              <Text style={[styles.referralHint, { color: referralHintColor }]}>
                {referralHint}
              </Text>

              {referralValid === true && (
                <View style={styles.rewardBanner}>
                  <Text style={styles.rewardBannerText}>
                    🎉 You'll get <Text style={styles.rewardAmount}>₦300</Text> off your first ride!
                  </Text>
                </View>
              )}
            </View>

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
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Login Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginContainer}
              activeOpacity={0.7}
            >
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text style={styles.loginLink}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Logo overlapping the fold */}
          <View style={styles.logoContainer}>
            <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Success Modal ── */}
      <Modal
        animationType="fade"
        transparent
        visible={successModalVisible}
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Welcome!</Text>
            <Text style={styles.modalMessage}>
              Your account has been created successfully.
              {referralValid === true
                ? `\n\nYour ₦300 referral bonus will be applied to your first ride. 🎉`
                : ''}
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

      {/* ── Error Modal ── */}
      <Modal
        animationType="fade"
        transparent
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
    paddingBottom: 40,
  },
  illustrationContainer: {
    width,
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
    paddingBottom: 48,
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
    marginBottom: 14,
    color: '#0A2540',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  passwordRow: {
    position: 'relative',
    marginBottom: 14,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 52,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  eyeIcon: {
    fontSize: 18,
  },
  referralSection: {
    marginBottom: 24,
    marginTop: 4,
  },
  referralLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A2540',
    marginBottom: 10,
  },
  referralLabelOptional: {
    fontWeight: '400',
    color: '#94A3B8',
    fontSize: 13,
  },
  referralInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  referralInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    color: '#0A2540',
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  referralIcon: {
    marginLeft: 8,
    paddingVertical: 4,
  },
  referralHint: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  rewardBanner: {
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  rewardBannerText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
    textAlign: 'center',
  },
  rewardAmount: {
    fontWeight: '800',
    color: '#15803D',
  },
  button: {
    backgroundColor: '#00B0F3',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#94A3B8',
    fontSize: 14,
  },
  loginContainer: {
    alignItems: 'center',
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