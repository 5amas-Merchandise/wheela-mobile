// src/screens/auth/SignupScreen.js
import React, { useState, useRef, useEffect } from 'react';
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
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const WHEELA_LOGO = require('../../../assets/logo3.png');
const { width, height } = Dimensions.get('window');
const BASE_URL = 'https://wheels-backend-7ydc.onrender.com';

export default function SignupScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const role       = route.params?.role || 'passenger';

  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('+234');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [referralCode, setReferralCode]   = useState(route.params?.referralCode || '');
  const [referralValid, setReferralValid] = useState(null);
  const [referralChecking, setReferralChecking] = useState(false);
  const [referralName,    setReferralName]      = useState('');
  const [loading, setLoading]         = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorModal,   setErrorModal]   = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

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
    let d = input.replace(/\D/g, '');
    if (d.startsWith('234')) return '+' + d;
    if (d.startsWith('0'))   return '+234' + d.slice(1);
    if (d.length === 10 && !d.startsWith('234')) return '+234' + d;
    if (!d.startsWith('234')) d = '234' + d;
    return '+' + d.slice(0, 15);
  };

  // ── Referral validation ─────────────────────────────────────────────────
  const handleReferralBlur = async () => {
    const code = referralCode.trim().toUpperCase();
    if (!code) { setReferralValid(null); setReferralName(''); return; }
    setReferralChecking(true);
    try {
      const res = await axios.post(`${BASE_URL}/referrals/validate`, { code });
      if (res.data.valid) { setReferralValid(true); setReferralName(res.data.referrerName || 'your friend'); }
      else { setReferralValid(false); setReferralName(''); triggerShake(); }
    } catch { setReferralValid(false); setReferralName(''); triggerShake(); }
    finally  { setReferralChecking(false); }
  };

  const handleReferralChange = (t) => {
    setReferralCode(t.toUpperCase());
    setReferralValid(null); setReferralName('');
  };

  // ── Signup ───────────────────────────────────────────────────────────────
  const showError = (msg) => { setErrorMessage(msg); setErrorModal(true); };

  const handleSignup = async () => {
    if (!name.trim())                         return showError('Please enter your full name.');
    if (!phone.trim() || phone === '+234')    return showError('Please enter a complete phone number.');
    if (phone.length < 12)                    return showError('Enter a valid Nigerian phone number (e.g. +2348012345678).');
    if (!password)                            return showError('Please enter a password.');

    const code = referralCode.trim().toUpperCase();
    if (code && referralValid === null) {
      setReferralChecking(true);
      try {
        const res = await axios.post(`${BASE_URL}/referrals/validate`, { code });
        setReferralValid(res.data.valid);
        if (!res.data.valid) { setReferralChecking(false); return showError('The referral code is invalid. Remove it or enter a correct one.'); }
        setReferralName(res.data.referrerName || '');
      } catch { setReferralChecking(false); return showError('Could not verify referral code. Check your connection.'); }
      finally  { setReferralChecking(false); }
    }
    if (code && referralValid === false) return showError('Please remove the invalid referral code or enter a correct one.');

    setLoading(true);
    try {
      const payload = { name: name.trim(), phone: phone.trim(), password };
      if (email.trim())      payload.email       = email.trim();
      if (role === 'driver') payload.role         = 'driver';
      if (code)              payload.referralCode = code;
      await axios.post(`${BASE_URL}/auth/signup`, payload);
      setSuccessModal(true);
    } catch (err) {
      let msg = 'Signup failed. Please try again.';
      const d = err.response?.data;
      if (d?.error?.message) {
        const m = d.error.message;
        if (m.includes('phone already in use'))      msg = 'This phone number is already registered.';
        else if (m.includes('Invalid phone format')) msg = 'Invalid phone format. Use +234 format.';
        else if (m.includes('Invalid referral'))     msg = 'That referral code is not valid.';
        else msg = m;
      } else if (d?.message) {
        msg = d.message;
      } else if (err.message === 'Network Error') {
        msg = 'Cannot connect to server. Check your internet.';
      }
      showError(msg);
    } finally { setLoading(false); }
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  // ── Referral UI helpers ──────────────────────────────────────────────────
  const refBorderColor = referralValid === true ? '#10B981' : referralValid === false ? '#EF4444' : '#EBEBEB';
  const refHintColor   = referralValid === true ? '#10B981' : referralValid === false ? '#EF4444' : '#aaa';
  const refHint =
    referralChecking        ? 'Checking code…' :
    referralValid === true  ? `✓ Code accepted! You and ${referralName} both get rewards` :
    referralValid === false ? '✕ Invalid referral code' :
    `${role === 'driver' ? 'Drivers' : 'Passengers'} who use a code get ₦300 off their first ride`;

  const isDriver = role === 'driver';

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">

          {/* ── HERO ── */}
          <View style={s.heroContainer}>
            <Image
              source={{ uri: 'https://i.pinimg.com/736x/dc/25/fc/dc25fcaa998cd6a7a4cc76e89e7ce944.jpg' }}
              style={s.heroImage}
              resizeMode="cover"
            />


            {/* Role badge on image */}
        
          </View>

          {/* ── LOGO BADGE ── */}
          <View style={s.logoBadge}>
            <Image source={WHEELA_LOGO} style={s.logo} resizeMode="contain" />
          </View>

          {/* ── CONTENT CARD ── */}
          <Animated.View style={[s.contentCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

             <Text style={[s.heroBadgeText, isDriver && s.heroBadgeTextDriver]}>
                  {isDriver ? 'Driver Account' : 'Passenger Account'}
                </Text>

            <Text style={s.title}>Create{'\n'}Account</Text>
            <Text style={s.subtitle}>Sign up to start your journey</Text>
            

            {/* Full Name */}
            <InputField
              label="FULL NAME"
              icon="person-outline"
              placeholder="e.g. Amaka Obi"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            {/* Phone */}
            <InputField
              label="PHONE NUMBER"
              icon="call-outline"
              placeholder="+2348012345678"
              value={phone}
              onChangeText={(t) => setPhone(formatPhone(t))}
              keyboardType="phone-pad"
            />

            {/* Email */}
            <InputField
              label="EMAIL (OPTIONAL)"
              icon="mail-outline"
              placeholder="you@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>PASSWORD</Text>
              <View style={s.inputWrap}>
                <View style={s.inputIcon}>
                  <Ionicons name="lock-closed-outline" size={16} color="#1A1A1A" />
                </View>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#bbb"
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#aaa" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Referral Code ── */}
            <View style={s.referralSection}>
              <View style={s.referralLabelRow}>
                <Text style={s.inputLabel}>REFERRAL CODE</Text>
                <View style={s.optionalPill}><Text style={s.optionalPillText}>Optional</Text></View>
              </View>

              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <View style={[s.referralWrap, { borderColor: refBorderColor }]}>
                  <View style={s.inputIcon}>
                    <Ionicons name="ticket-outline" size={16} color="#1A1A1A" />
                  </View>
                  <TextInput
                    style={[s.input, { flex: 1, letterSpacing: 2, fontWeight: '800' }]}
                    value={referralCode}
                    onChangeText={handleReferralChange}
                    onBlur={handleReferralBlur}
                    placeholder="e.g. AHM9XK3P"
                    placeholderTextColor="#bbb"
                    autoCapitalize="characters"
                    maxLength={8}
                    autoCorrect={false}
                  />
                  {referralChecking
                    ? <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 4 }} />
                    : referralValid === true
                      ? <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 4 }} />
                      : referralValid === false
                        ? <Ionicons name="close-circle" size={20} color="#EF4444" style={{ marginRight: 4 }} />
                        : null
                  }
                </View>
              </Animated.View>

              <Text style={[s.referralHint, { color: refHintColor }]}>{refHint}</Text>

              {referralValid === true && (
                <View style={s.rewardBanner}>
                  <Ionicons name="gift-outline" size={16} color="#065F46" />
                  <Text style={s.rewardBannerText}>
                    You'll get <Text style={{ fontWeight: '900', color: '#065F46' }}>₦300</Text> off your first ride!
                  </Text>
                </View>
              )}
            </View>

            {/* Sign Up button */}
            <TouchableOpacity
              style={[s.signupBtn, loading && { opacity: 0.6 }]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={s.signupBtnText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Log in link */}
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginRow} activeOpacity={0.7}>
              <Text style={s.loginText}>Already have an account? </Text>
              <Text style={s.loginLink}>Log in</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── SUCCESS MODAL ── */}
      <Modal animationType="fade" transparent visible={successModal} onRequestClose={handleSuccessClose}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalIconWrap, s.modalIconSuccess]}>
              <Ionicons name="checkmark" size={36} color="#10B981" />
            </View>
            <Text style={s.modalTitle}>Welcome!</Text>
            <Text style={s.modalMsg}>
              Your account has been created.
              {referralValid === true ? '\n\nYour ₦300 referral bonus will be applied to your first ride. 🎉' : ''}
            </Text>
            <TouchableOpacity style={s.modalBtn} onPress={handleSuccessClose} activeOpacity={0.88}>
              <Text style={s.modalBtnText}>Continue to Login</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── ERROR MODAL ── */}
      <Modal animationType="fade" transparent visible={errorModal} onRequestClose={() => setErrorModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalIconWrap, s.modalIconError]}>
              <Ionicons name="close" size={36} color="#EF4444" />
            </View>
            <Text style={s.modalTitle}>Oops!</Text>
            <Text style={s.modalMsg}>{errorMessage}</Text>
            <TouchableOpacity style={[s.modalBtn, s.modalBtnError]} onPress={() => setErrorModal(false)} activeOpacity={0.88}>
              <Text style={s.modalBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Reusable input field ───────────────────────────────────────────────────
function InputField({ label, icon, value, onChangeText, placeholder, keyboardType, autoCapitalize, autoCorrect }) {
  return (
    <View style={s.inputGroup}>
      <Text style={s.inputLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <View style={s.inputIcon}>
          <Ionicons name={icon} size={16} color="#1A1A1A" />
        </View>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#bbb"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },

  // ── Hero ──
  heroContainer: { width, height: height * 0.28, overflow: 'hidden' },
  heroImage:     { width: '100%', height: '100%' },
  heroOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  heroBlueTint:  {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  heroBadgeRow: {
    position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroBadgeDriver: {},
  heroBadgeText:       { fontSize: 18, fontWeight: '700', color: '#1b1b1bff' },
  heroBadgeTextDriver: { color: '#424141ff' },

  // ── Logo badge ──
  logoBadge: {
    position: 'absolute',
    top: height * 0.28 - 48,
    alignSelf: 'center',
    width: 88, height: 88, borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14, shadowRadius: 18, elevation: 12,
    borderWidth: 3, borderColor: '#F5F5F0',
     zIndex:99,
  },
  logo: { width: 58, height: 58 },

  // ── Content card ──
  contentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    marginTop: -28, paddingHorizontal: 28,
    paddingTop: 64, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
  title: {
    fontSize: 32, fontWeight: '900', color: '#1A1A1A',
    letterSpacing: -1, lineHeight: 38, marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 24, fontWeight: '500' },

  // ── Input group ──
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 10, fontWeight: '800', color: '#aaa',
    letterSpacing: 0.8, marginBottom: 7, marginLeft: 2,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F0', borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#EBEBEB',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A',
    paddingVertical: 14,
  },
  eyeBtn: { padding: 4 },

  // ── Referral ──
  referralSection: { marginBottom: 22, marginTop: 4 },
  referralLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  optionalPill: {
    backgroundColor: '#F5F5F0', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  optionalPillText: { fontSize: 9, fontWeight: '800', color: '#aaa' },
  referralWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F0', borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: '#EBEBEB',
  },
  referralHint: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  rewardBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ECFDF5', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, marginTop: 10,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  rewardBannerText: { fontSize: 13, color: '#065F46', lineHeight: 18 },

  // ── Sign up button ──
  signupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1A1A1A', borderRadius: 18,
    paddingVertical: 17, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 7,
  },
  signupBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // ── Divider ──
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#F0F0F0' },
  dividerText: { fontSize: 12, color: '#ccc', marginHorizontal: 12, fontWeight: '600' },

  // ── Login link ──
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14, color: '#aaa' },
  loginLink: { fontSize: 14, color: '#3B82F6', fontWeight: '800' },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 26,
    padding: 32, width: width * 0.85, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 16,
  },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  modalIconSuccess: { backgroundColor: '#ECFDF5' },
  modalIconError:   { backgroundColor: '#FEF2F2' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', marginBottom: 10, letterSpacing: -0.5 },
  modalMsg:   { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  modalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1A1A1A', borderRadius: 14,
    paddingVertical: 15, width: '100%',
  },
  modalBtnError: { backgroundColor: '#EF4444' },
  modalBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});