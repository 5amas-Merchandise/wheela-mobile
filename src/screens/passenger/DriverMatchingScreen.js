// src/screens/passenger/DriverMatchingScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken, getStoredUser } from '../../utils/auth';
import {
  initWebSocket,
  sendWS,
  addListener,
  removeListener,
  isWebSocketConnected,
} from '../../utils/socket';

const { width, height } = Dimensions.get('window');
const baseUrl = 'https://wheels-backend-7ydc.onrender.com';

// Maps service type to a readable label and icon
const SERVICE_META = {
  CITY_RIDE:      { label: 'City Ride',   icon: 'car-sport',  color: '#1A1A1A' },
  DELIVERY_BIKE:  { label: 'Bike',         icon: 'bicycle',    color: '#059669' },
  KEKE:           { label: 'Keke',         icon: 'triangle',   color: '#D97706' },
  LUXURY_RENTAL:  { label: 'Luxury',       icon: 'diamond',    color: '#7C3AED' },
};

export default function DriverMatchingScreen() {
  const navigation = useNavigation();
  const route      = useRoute();

  // ── Route params ────────────────────────────────────────────────────────────
  const {
    pickup, dropoff,
    pickupAddress, dropoffAddress,
    serviceType, estimatedFare, distance, duration,
  } = route.params || {};

  // ── State ───────────────────────────────────────────────────────────────────
  const [isMatching,      setIsMatching]      = useState(true);
  const [timer,           setTimer]           = useState(0);
  const [requestId,       setRequestId]       = useState(null);
  const [assignedDriver,  setAssignedDriver]  = useState(null);
  const [error,           setError]           = useState(null);
  const [wsConnected,     setWsConnected]     = useState(false);
  const [isTripAccepted,  setIsTripAccepted]  = useState(false);
  const [searchDots,      setSearchDots]      = useState('');

  // ── Refs (stale closure guards) ─────────────────────────────────────────────
  const isTripAcceptedRef    = useRef(false);
  const requestIdRef         = useRef(null);
  const timerIntervalRef     = useRef(null);
  const pollingIntervalRef   = useRef(null);

  // ── Animations ──────────────────────────────────────────────────────────────
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(40)).current;

  // Page entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  // Pulse ring animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.55, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Animated dots ("Searching.")
  useEffect(() => {
    if (!isMatching || error || isTripAccepted) return;
    const iv = setInterval(() => {
      setSearchDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(iv);
  }, [isMatching, error, isTripAccepted]);

  // ── Sync refs ───────────────────────────────────────────────────────────────
  useEffect(() => { isTripAcceptedRef.current = isTripAccepted; }, [isTripAccepted]);
  useEffect(() => { requestIdRef.current = requestId; }, [requestId]);

  // ── Main lifecycle ──────────────────────────────────────────────────────────
  useEffect(() => {
    startTimer();
    createTripRequest();
    initWebSocketAndListen();

    return () => {
      if (timerIntervalRef.current)   clearInterval(timerIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      removeListener('connect',       handleConnect);
      removeListener('disconnect',    handleDisconnect);
      removeListener('trip_accepted', handleTripAccepted);
      removeListener('notification',  handleNotification);
    };
  }, []);

  useEffect(() => {
    if (isTripAccepted) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopPolling();
    }
  }, [isTripAccepted]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => setTimer(p => p + 1), 1000);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── WebSocket ───────────────────────────────────────────────────────────────
  const initWebSocketAndListen = async () => {
    try {
      await initWebSocket();
      addListener('connect',       handleConnect);
      addListener('disconnect',    handleDisconnect);
      addListener('trip_accepted', handleTripAccepted);
      addListener('notification',  handleNotification);
      setWsConnected(isWebSocketConnected());
    } catch {
      setWsConnected(false);
      if (requestIdRef.current) startPollingForUpdates();
    }
  };

  const handleConnect    = () => { setWsConnected(true); };
  const handleDisconnect = () => {
    setWsConnected(false);
    if (requestIdRef.current && !isTripAcceptedRef.current) startPollingForUpdates();
  };

  const handleTripAccepted = useCallback((data) => {
    if (isTripAcceptedRef.current) return;
    isTripAcceptedRef.current = true;
    setIsTripAccepted(true);
    setAssignedDriver({ driverId: data.driverId, name: data.driverName || 'Driver' });
    stopPolling();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Success animation
    Animated.spring(successAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }).start();

    setTimeout(() => {
      if (navigation.isFocused()) {
        navigation.replace('TripTracking', {
          tripId:             data.tripId,
          requestId:          data.requestId || requestIdRef.current,
          pickup,
          destination:        dropoff,
          pickupAddress:      pickupAddress    || 'Pickup location',
          destinationAddress: dropoffAddress   || 'Destination',
          driverId:           data.driverId,
          driverName:         data.driverName  || 'Driver',
          serviceType,
          estimatedFare:      estimatedFare    || 0,
          fare:               estimatedFare    || 0,
          distance:           distance         || 0,
          duration:           duration         || 0,
          paymentMethod:      'cash',
        });
      }
    }, 2000);
  }, [pickup, dropoff, pickupAddress, dropoffAddress, serviceType, estimatedFare, distance, duration, navigation]);

  const handleNotification = useCallback((payload) => {
    const { type, data } = payload;
    const notifRequestId = data?.requestId || payload.requestId;
    if (notifRequestId && notifRequestId !== requestIdRef.current) return;

    if (type === 'trip_accepted' || type === 'trip:accepted') {
      handleTripAccepted({
        driverId:   data?.driverId   || payload.driverId,
        driverName: data?.driverName || payload.driverName,
        tripId:     data?.tripId     || payload.tripId,
        requestId:  notifRequestId,
      });
    } else if (type === 'no_driver_found') {
      if (!isTripAcceptedRef.current) handleNoDriversFound();
    }
  }, [handleTripAccepted]);

  // ── Polling fallback ────────────────────────────────────────────────────────
  const startPollingForUpdates = () => {
    if (pollingIntervalRef.current || isTripAcceptedRef.current) return;
    pollingIntervalRef.current = setInterval(async () => {
      if (!requestIdRef.current || isTripAcceptedRef.current) { stopPolling(); return; }
      await checkTripStatus();
    }, 7000);
  };

  const checkTripStatus = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res    = await fetch(`${baseUrl}/trips/request/${requestIdRef.current}`, {
        headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const result = await res.json();
      const trip   = result.trip;

      if (trip?.status === 'assigned' && trip.assignedDriverId) {
        handleTripAccepted({
          driverId:   trip.assignedDriverId._id || trip.assignedDriverId,
          driverName: trip.assignedDriverId?.name,
          tripId:     trip._id,
          requestId:  requestIdRef.current,
        });
        stopPolling();
      } else if (trip?.status === 'no_drivers') {
        if (!isTripAcceptedRef.current) { handleNoDriversFound(); stopPolling(); }
      } else if (trip?.status === 'cancelled') {
        if (!isTripAcceptedRef.current) {
          setError('Ride request was cancelled.');
          stopPolling();
          setTimeout(() => navigation.goBack(), 2800);
        }
      }
    } catch {}
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // ── Create trip request ─────────────────────────────────────────────────────
  const createTripRequest = async () => {
    try {
      const token = await getAuthToken();
      if (!token) { navigation.replace('Login'); return; }

      const payload = {
        pickup:   { type: 'Point', coordinates: [pickup.longitude, pickup.latitude] },
        dropoff:  dropoff ? { type: 'Point', coordinates: [dropoff.longitude, dropoff.latitude] } : undefined,
        serviceType,
        paymentMethod: 'cash',
        estimatedFare: estimatedFare || 0,
        distance:      distance      || 0,
        duration:      duration      || 0,
        pickupAddress:  pickupAddress  || '',
        dropoffAddress: dropoffAddress || '',
      };

      const res = await fetch(`${baseUrl}/trips/request`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to create ride request');

      const result = await res.json();
      setRequestId(result.requestId);
      requestIdRef.current = result.requestId;

      if (result.message?.toLowerCase().includes('no drivers')) handleNoDriversFound();
      else startPollingForUpdates();
    } catch {
      setError('Could not request ride. Please try again.');
      setIsMatching(false);
    }
  };

  const handleNoDriversFound = () => {
    setIsMatching(false);
    setError('No drivers available right now.\nPlease try again later.');
    stopPolling();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeout(() => { if (navigation.isFocused()) navigation.goBack(); }, 3400);
  };

  // ── Cancel ──────────────────────────────────────────────────────────────────
  const cancelMatching = async () => {
    stopPolling();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (requestId && !isTripAccepted) {
      try {
        const token = await getAuthToken();
        if (token) {
          await fetch(`${baseUrl}/trips/${requestId}/cancel`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ reason: 'Cancelled by passenger', cancelledBy: 'passenger' }),
          });
        }
      } catch {}
    }
    navigation.goBack();
  };

  const meta = SERVICE_META[serviceType] || SERVICE_META.CITY_RIDE;

  // Interpolations
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [1, 1.55], outputRange: [0.4, 0] });
  const successScale = successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={cancelMatching} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {error ? 'Request Failed' : isTripAccepted ? 'Driver Found!' : 'Finding your ride'}
          </Text>
        </View>

        <View style={s.timerBadge}>
          <Text style={s.timerText}>{formatTime(timer)}</Text>
        </View>
      </View>

      {/* ── Animation area ── */}
      <Animated.View style={[s.animArea, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* State: matching */}
        {!isTripAccepted && !error && (
          <View style={s.iconWrap}>
            {/* Outer pulse ring */}
            <Animated.View style={[
              s.pulseRing, s.pulseRingOuter,
              { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
            ]} />
            {/* Inner pulse ring */}
            <Animated.View style={[
              s.pulseRing, s.pulseRingInner,
              {
                transform: [{ scale: pulseAnim.interpolate({ inputRange: [1, 1.55], outputRange: [1, 1.25] }) }],
                opacity:   pulseAnim.interpolate({ inputRange: [1, 1.55], outputRange: [0.25, 0] }),
              },
            ]} />
            {/* Icon circle */}
            <View style={[s.iconCircle, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={46} color="#fff" />
            </View>
          </View>
        )}

        {/* State: success */}
        {isTripAccepted && (
          <Animated.View style={[s.successCircle, { transform: [{ scale: successScale }], opacity: successAnim }]}>
            <Ionicons name="checkmark" size={52} color="#fff" />
          </Animated.View>
        )}

        {/* State: error */}
        {error && !isTripAccepted && (
          <View style={s.errorCircle}>
            <Ionicons name="alert" size={46} color="#fff" />
          </View>
        )}

        {/* Status text */}
        <Text style={[
          s.statusTitle,
          isTripAccepted && { color: '#10B981' },
          error && { color: '#EF4444' },
        ]}>
          {error
            ? 'No ride found'
            : isTripAccepted
            ? `${assignedDriver?.name || 'Driver'} is on the way`
            : `Searching${searchDots}`}
        </Text>

        <Text style={s.statusSub}>
          {error
            ? error
            : isTripAccepted
            ? 'Preparing your navigation…'
            : 'We\'re finding the nearest available driver'}
        </Text>

        {/* Preparing spinner */}
        {isTripAccepted && (
          <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 16 }} />
        )}

        {/* Connection pill */}
        {!isTripAccepted && !error && (
          <View style={[s.connPill, { backgroundColor: wsConnected ? '#F0FDF4' : '#FFFBEB' }]}>
            <View style={[s.connDot, { backgroundColor: wsConnected ? '#10B981' : '#F59E0B' }]} />
            <Text style={[s.connText, { color: wsConnected ? '#059669' : '#B45309' }]}>
              {wsConnected ? 'Live updates active' : 'Checking for drivers…'}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* ── Trip summary card ── */}
      <Animated.View style={[s.summaryCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Route */}
        <View style={s.routeRow}>
          <View style={s.routeTrack}>
            <View style={s.trackDotGreen} />
            <View style={s.trackLine} />
            <View style={s.trackDotBlack} />
          </View>
          <View style={s.routeAddresses}>
            <View style={s.addressBlock}>
              <Text style={s.addressLabel}>PICKUP</Text>
              <Text style={s.addressText} numberOfLines={1}>{pickupAddress || 'Current location'}</Text>
            </View>
            <View style={s.addressBlock}>
              <Text style={s.addressLabel}>DROP-OFF</Text>
              <Text style={s.addressText} numberOfLines={1}>{dropoffAddress || 'Destination'}</Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={s.cardDivider} />

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>₦{estimatedFare?.toLocaleString() || '—'}</Text>
            <Text style={s.statLabel}>Fare</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>{distance?.toFixed(1) || '—'} km</Text>
            <Text style={s.statLabel}>Distance</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <View style={[s.rideTypePill, { backgroundColor: `${meta.color}15` }]}>
              <Ionicons name={meta.icon} size={13} color={meta.color} />
              <Text style={[s.rideTypePillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={s.statLabel}>Type</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Cancel / Error actions ── */}
      <View style={s.bottomArea}>
        {isMatching && !error && !isTripAccepted && (
          <TouchableOpacity style={s.cancelBtn} onPress={cancelMatching} activeOpacity={0.85}>
            <Text style={s.cancelBtnText}>Cancel Request</Text>
          </TouchableOpacity>
        )}

        {error && !isTripAccepted && (
          <TouchableOpacity style={s.retryBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={s.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F0',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  timerBadge: {
    backgroundColor: '#F5F5F0', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
    minWidth: 56, alignItems: 'center',
  },
  timerText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', fontVariant: ['tabular-nums'] },

  // ── Animation area ──
  animArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },

  // Pulse rings
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  pulseRing: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#1A1A1A',
  },
  pulseRingOuter: { width: 160, height: 160 },
  pulseRingInner: { width: 120, height: 120 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
  },

  // Success / error circles
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#10B981',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  errorCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },

  // Status text
  statusTitle: {
    fontSize: 24, fontWeight: '800', color: '#1A1A1A',
    textAlign: 'center', marginBottom: 10, letterSpacing: -0.3,
  },
  statusSub: {
    fontSize: 15, color: '#888',
    textAlign: 'center', lineHeight: 22, maxWidth: 280,
  },

  // Connection pill
  connPill: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 28, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  connDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  connText: { fontSize: 13, fontWeight: '600' },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20, marginBottom: 16,
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 5,
  },
  routeRow: { flexDirection: 'row', alignItems: 'stretch' },
  routeTrack: { width: 24, alignItems: 'center', marginRight: 14, paddingTop: 4 },
  trackDotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981' },
  trackLine: { flex: 1, width: 2, backgroundColor: '#E5E5E5', marginVertical: 6 },
  trackDotBlack: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1A1A1A' },
  routeAddresses: { flex: 1 },
  addressBlock: { paddingVertical: 8 },
  addressLabel: { fontSize: 10, fontWeight: '700', color: '#BABABA', letterSpacing: 0.8, marginBottom: 3 },
  addressText: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },

  cardDivider: { height: 1, backgroundColor: '#F5F5F0', marginVertical: 16 },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#BABABA', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 36, backgroundColor: '#F0F0F0' },
  rideTypePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, gap: 5, marginBottom: 4,
  },
  rideTypePillText: { fontSize: 13, fontWeight: '700' },

  // ── Bottom actions ──
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  cancelBtn: {
    borderWidth: 1.5, borderColor: '#E5E5E5',
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', backgroundColor: '#fff',
  },
  cancelBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  retryBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});