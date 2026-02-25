// src/screens/LoginScreen.js
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const WHEELA_LOGO = require('../../../assets/logo3.png');
const { width, height } = Dimensions.get('window');
const BASE_URL = 'https://wheels-backend-7ydc.onrender.com';

export const TOKEN_KEY = 'WHEELA_TOKEN';
export const USER_KEY  = 'WHEELA_USER';
export const ROLE_KEY  = 'WHEELA_ROLE';

export const getAuthToken = async () => {
  try   { return await AsyncStorage.getItem(TOKEN_KEY); }
  catch { return null; }
};
export const getStoredUser = async () => {
  try   { const j = await AsyncStorage.getItem(USER_KEY); return j ? JSON.parse(j) : null; }
  catch { return null; }
};

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('+234');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [errorModal,   setErrorModal]   = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [welcomeName,  setWelcomeName]  = useState('');
  const [userRole,     setUserRole]     = useState('passenger');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const formatIdentifier = (text) => {
    if (!text) return '+234';
    if (/\d/.test(text)) {
      let d = text.replace(/\D/g, '');
      if (d.startsWith('234')) {}
      else if (d.startsWith('0') && d.length >= 11) d = '234' + d.slice(1);
      else if (d.length === 10) d = '234' + d;
      else if (d.length > 10 && !d.startsWith('234')) d = '234' + d.slice(-10);
      return '+' + d.slice(0, 13);
    }
    return text.trim().toLowerCase();
  };

  const handleLogin = async () => {
    if (!identifier.trim() || identifier === '+234') {
      setErrorMessage('Please enter your phone number or email.');
      setErrorModal(true); return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      setErrorModal(true); return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, { identifier: identifier.trim(), password });
      const { token, user } = res.data;
      if (!token || !user) { setErrorMessage('Invalid response from server.'); setErrorModal(true); return; }
      const isDriver = user.roles?.isDriver === true;
      await AsyncStorage.multiSet([
        [TOKEN_KEY, token],
        [USER_KEY,  JSON.stringify(user)],
        [ROLE_KEY,  isDriver ? 'driver' : 'passenger'],
      ]);
      setWelcomeName(user.name || 'Rider');
      setUserRole(isDriver ? 'driver' : 'passenger');
      setSuccessModal(true);
    } catch (err) {
      let msg = 'Invalid credentials. Please try again.';
      if (err.response?.data?.error?.message)  msg = err.response.data.error.message;
      else if (err.message.includes('Network')) msg = 'No internet connection. Check your network.';
      setErrorMessage(msg);
      setErrorModal(true);
    } finally { setLoading(false); }
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    navigation.replace(userRole === 'driver' ? 'DriverHomeOffline' : 'PassengerMain');
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">

          {/* ── HERO IMAGE ── */}
          <View style={s.heroContainer}>
            <Image
              source={{ uri: 'https://i.pinimg.com/736x/cb/1a/dc/cb1adcef16f08dec5eae14bf38b4b65e.jpg' }}
              style={s.heroImage}
              resizeMode="cover"
            />
          </View>

          {/* ── LOGO BADGE ── */}
          <View style={s.logoBadge}>
            <Image source={WHEELA_LOGO} style={s.logo} resizeMode="contain" />
          </View>

          {/* ── CONTENT CARD ── */}
          <Animated.View style={[s.contentCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            <Text style={s.title}>Welcome{'\n'}Back</Text>
            <Text style={s.subtitle}>Log in to continue your journey</Text>

            {/* Phone / email input */}
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>PHONE OR EMAIL</Text>
              <View style={s.inputWrap}>
                <View style={s.inputIcon}>
                  <Ionicons name="call-outline" size={16} color="#1A1A1A" />
                </View>
                <TextInput
                  style={s.input}
                  value={identifier}
                  onChangeText={(t) => setIdentifier(formatIdentifier(t))}
                  placeholder="Phone or Email"
                  placeholderTextColor="#bbb"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password input */}
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
                  placeholder="Password"
                  placeholderTextColor="#bbb"
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn} activeOpacity={0.7}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color="#aaa" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot password */}
            <TouchableOpacity style={s.forgotRow} activeOpacity={0.7}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Log in button — dark */}
            <TouchableOpacity style={[s.loginBtn, loading && s.loginBtnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.88}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={s.loginBtnText}>Log In</Text>
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

            {/* Sign up button — blue accent */}
            <TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('Signup')} activeOpacity={0.85}>
              <Text style={s.signupBtnText}>Create an Account</Text>
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
            <Text style={s.modalTitle}>Welcome back!</Text>
            <Text style={s.modalMsg}>Hi {welcomeName}, great to see you again.</Text>
            <TouchableOpacity style={s.modalBtn} onPress={handleSuccessClose} activeOpacity={0.88}>
              <Text style={s.modalBtnText}>Continue</Text>
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

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },

  // ── Hero ──
  heroContainer: { width, height: height * 0.38, overflow: 'hidden' },
  heroImage:     { width: '100%', height: '100%' },
  heroOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  heroBlueTint:  {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
    backgroundColor: 'rgba(59,130,246,0.2)',
  },

  // ── Logo badge ──
  logoBadge: {
    position: 'absolute',
    top: height * 0.38 - 50,
    alignSelf: 'center',
    width: 90, height: 90, borderRadius: 26,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14, shadowRadius: 18, elevation: 12,
    borderWidth: 3, borderColor: '#F5F5F0',
     zIndex:99,
  },
  logo: { width: 60, height: 60 },

  // ── Content card ──
  contentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    marginTop: -30,
    paddingHorizontal: 28, paddingTop: 68, paddingBottom: 36,
    minHeight: height * 0.65,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
  title: {
    fontSize: 32, fontWeight: '900', color: '#1A1A1A',
    letterSpacing: -1, lineHeight: 38, marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 30, fontWeight: '500' },

  // ── Input group ──
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 10, fontWeight: '800', color: '#aaa',
    letterSpacing: 0.8, marginBottom: 8, marginLeft: 2,
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
    paddingVertical: 15,
  },
  eyeBtn: { padding: 4 },
  forgotRow: { alignItems: 'flex-end', marginBottom: 24, marginTop: -6 },
  forgotText: { fontSize: 12, fontWeight: '700', color: '#3B82F6' },

  // ── Login button ──
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#1A1A1A', borderRadius: 18,
    paddingVertical: 17, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 7,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // ── Divider ──
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#F0F0F0' },
  dividerText: { fontSize: 12, color: '#ccc', marginHorizontal: 12, fontWeight: '600' },

  // ── Sign up button ──
  signupBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 18,
    paddingVertical: 17, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  signupBtnText: { fontSize: 16, fontWeight: '800', color: '#1D4ED8' },

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