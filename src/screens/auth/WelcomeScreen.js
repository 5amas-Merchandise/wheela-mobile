// src/screens/WelcomeScreen.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const WHEELA_LOGO = require('../../../assets/logo3.png');
const { width, height } = Dimensions.get('window');
const ROLE_KEY = 'WHEELA_ROLE';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  // Subtle entrance animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const selectRole = async (role) => {
    try { await AsyncStorage.setItem(ROLE_KEY, role); } catch {}
    navigation.navigate('Signup', { role });
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── HERO IMAGE ── */}
      <View style={s.heroContainer}>
        <Image
          source={{ uri: 'https://i.pinimg.com/736x/12/67/4e/12674e8deaf74ca8da30065dbc5101fb.jpg' }}
          style={s.heroImage}
          resizeMode="cover"
        />
        {/* Gradient-like dark overlay */}
        
        {/* Tag line on image */}
       
      
      </View>

      {/* ── LOGO BADGE ── */}
      <View style={s.logoBadge}>
        <Image source={WHEELA_LOGO} style={s.logo} resizeMode="contain" />
      </View>

      {/* ── CONTENT CARD ── */}
      <Animated.View style={[s.contentCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        <Text style={s.title}>Get moving{'\n'}with Wheela</Text>
        <Text style={s.subtitle}>Choose how you want to use the app</Text>

        {/* Passenger button — solid dark */}
        <TouchableOpacity style={s.passengerBtn} onPress={() => selectRole('passenger')} activeOpacity={0.88}>
          <View style={s.btnIconWrap}>
            <Ionicons name="person" size={18} color="#1A1A1A" />
          </View>
          <Text style={s.passengerBtnText}>Ride as Passenger</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

        {/* Driver button — blue accent outline */}
        <TouchableOpacity style={s.driverBtn} onPress={() => selectRole('driver')} activeOpacity={0.88}>
          <View style={s.driverBtnIconWrap}>
            <Ionicons name="car-sport" size={18} color="#3B82F6" />
          </View>
          <Text style={s.driverBtnText}>Drive & Earn</Text>
          <Ionicons name="arrow-forward" size={18} color="#3B82F6" />
        </TouchableOpacity>

        {/* Login link */}
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginRow} activeOpacity={0.7}>
          <Text style={s.loginText}>Already have an account? </Text>
          <Text style={s.loginLink}>Log in</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },

  // ── Hero ──
  heroContainer: { width, height: height * 0.52, overflow: 'hidden' },
  heroImage:    { width: '100%', height: '100%' },
  heroOverlay:  {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroBlueTint: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  heroTagRow: {
    position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center',
  },
  heroTagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroTagDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3B82F6' },
  heroTagText: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  // ── Logo badge ──
  logoBadge: {
    position: 'absolute',
    top: height * 0.52 - 52,
    alignSelf: 'center',
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
    borderWidth: 3, borderColor: '#F5F5F0',
    zIndex:99,
  },
  logo: { width: 64, height: 64 },

  // ── Content card ──
  contentCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    marginTop: -30,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 8,
  },
  title: {
    fontSize: 30, fontWeight: '900', color: '#1A1A1A',
    letterSpacing: -0.8, marginBottom: 8, lineHeight: 36,
  },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 32, fontWeight: '500' },

  // ── Passenger button ──
  passengerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 18,
    paddingVertical: 17, paddingHorizontal: 20, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 7,
  },
  btnIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  passengerBtnText: { flex: 1, fontSize: 16, fontWeight: '800', color: '#fff' },

  // ── Driver button ──
  driverBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EFF6FF', borderRadius: 18,
    paddingVertical: 17, paddingHorizontal: 20, marginBottom: 32,
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  driverBtnIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center',
  },
  driverBtnText: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1D4ED8' },

  // ── Login row ──
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14, color: '#aaa' },
  loginLink: { fontSize: 14, color: '#3B82F6', fontWeight: '800' },
});