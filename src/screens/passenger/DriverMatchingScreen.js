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

export default function DriverMatchingScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [isMatching, setIsMatching] = useState(true);
  const [matchProgress] = useState(new Animated.Value(0));
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [assignedDriver, setAssignedDriver] = useState(null);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [isTripAccepted, setIsTripAccepted] = useState(false);

  const {
    pickup,
    dropoff,
    pickupAddress,
    dropoffAddress,
    serviceType,
    estimatedFare,
    distance,
    duration,
  } = route.params || {};

  // Refs for avoiding stale closures
  const isTripAcceptedRef = useRef(isTripAccepted);
  const requestIdRef = useRef(requestId);
  const timerIntervalRef = useRef(timerInterval);
  const pollingIntervalRef = useRef(pollingInterval);

  useEffect(() => {
    isTripAcceptedRef.current = isTripAccepted;
    requestIdRef.current = requestId;
    timerIntervalRef.current = timerInterval;
    pollingIntervalRef.current = pollingInterval;
  }, [isTripAccepted, requestId, timerInterval, pollingInterval]);

  // ────────────────────────────────────────────────
  // LIFECYCLE
  // ────────────────────────────────────────────────
  useEffect(() => {
    loadUserData();
    startMatchingAnimation();
    startTimer();
    createTripRequest();
    initWebSocketAndListen();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      removeListener('connect', handleConnect);
      removeListener('disconnect', handleDisconnect);
      removeListener('trip_accepted', handleTripAccepted);
      removeListener('notification', handleNotification);
    };
  }, []);

  useEffect(() => {
    if (isTripAccepted) {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      stopPolling();
    }
  }, [isTripAccepted]);

  // ────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────
  const loadUserData = async () => {
    try {
      const user = await getStoredUser();
      // We might need user._id later for some messages
    } catch (err) {
      // silent fail in production
    }
  };

  const startMatchingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(matchProgress, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(matchProgress, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  // ────────────────────────────────────────────────
  // WEBSOCKET
  // ────────────────────────────────────────────────
  const initWebSocketAndListen = async () => {
    try {
      await initWebSocket();
      addListener('connect', handleConnect);
      addListener('disconnect', handleDisconnect);
      addListener('trip_accepted', handleTripAccepted);
      addListener('notification', handleNotification);
      setWsConnected(isWebSocketConnected());
    } catch (err) {
      setWsConnected(false);
      if (requestIdRef.current) startPollingForUpdates();
    }
  };

  const handleConnect = () => {
    setWsConnected(true);
  };

  const handleDisconnect = () => {
    setWsConnected(false);
    if (requestIdRef.current && !isTripAcceptedRef.current) {
      startPollingForUpdates();
    }
  };

  const handleTripAccepted = useCallback((data) => {
    if (isTripAcceptedRef.current) return;

    setIsTripAccepted(true);
    setAssignedDriver({
      driverId: data.driverId,
      name: data.driverName || 'Driver',
    });

    stopPolling();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      setTimerInterval(null);
    }

    setTimeout(() => {
      if (navigation.isFocused()) {
        navigation.replace('TripTracking', {
          tripId: data.tripId,
          requestId: data.requestId || requestIdRef.current,
          pickup,
          destination: dropoff,
          pickupAddress: pickupAddress || 'Pickup location',
          destinationAddress: dropoffAddress || 'Destination',
          driverId: data.driverId,
          driverName: data.driverName || 'Driver',
          serviceType,
          estimatedFare: estimatedFare || 0,
          fare: estimatedFare || 0,
          distance: distance || 0,
          duration: duration || 0,
          paymentMethod: 'wallet',
        });
      }
    }, 1800);
  }, [pickup, dropoff, pickupAddress, dropoffAddress, serviceType, estimatedFare, distance, duration, navigation]);

  const handleNotification = useCallback((payload) => {
    const { type, data } = payload;
    const notifRequestId = data?.requestId || payload.requestId;

    if (notifRequestId && notifRequestId !== requestIdRef.current) return;

    if (type === 'trip_accepted' || type === 'trip:accepted') {
      handleTripAccepted({
        driverId: data?.driverId || payload.driverId,
        driverName: data?.driverName || payload.driverName,
        tripId: data?.tripId || payload.tripId,
        requestId: notifRequestId,
      });
    } else if (type === 'no_driver_found') {
      if (!isTripAcceptedRef.current) {
        handleNoDriversFound();
      }
    }
  }, [handleTripAccepted]);

  // ────────────────────────────────────────────────
  // POLLING FALLBACK (VERY IMPORTANT)
  // ────────────────────────────────────────────────
  const startPollingForUpdates = () => {
    if (pollingIntervalRef.current || isTripAcceptedRef.current) return;

    const interval = setInterval(async () => {
      if (!requestIdRef.current || isTripAcceptedRef.current) {
        stopPolling();
        return;
      }
      await checkTripStatus();
    }, 7000);

    setPollingInterval(interval);
    pollingIntervalRef.current = interval;
  };

  const checkTripStatus = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(`${baseUrl}/trips/request/${requestIdRef.current}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!res.ok) return;

      const result = await res.json();
      const trip = result.trip;

      if (trip?.status === 'assigned' && trip.assignedDriverId) {
        handleTripAccepted({
          driverId: trip.assignedDriverId._id || trip.assignedDriverId,
          driverName: trip.assignedDriverId?.name,
          tripId: trip._id,
          requestId: requestIdRef.current,
        });
        stopPolling();
      } else if (trip?.status === 'no_drivers') {
        if (!isTripAcceptedRef.current) {
          handleNoDriversFound();
          stopPolling();
        }
      } else if (trip?.status === 'cancelled') {
        if (!isTripAcceptedRef.current) {
          setError('Ride request was cancelled.');
          stopPolling();
          setTimeout(() => navigation.goBack(), 2800);
        }
      }
    } catch (err) {
      // silent in production
    }
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      setPollingInterval(null);
      pollingIntervalRef.current = null;
    }
  };

  // ────────────────────────────────────────────────
  // CREATE REQUEST
  // ────────────────────────────────────────────────
  const createTripRequest = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const payload = {
        pickup: {
          type: 'Point',
          coordinates: [pickup.longitude, pickup.latitude],
        },
        dropoff: dropoff
          ? {
              type: 'Point',
              coordinates: [dropoff.longitude, dropoff.latitude],
            }
          : undefined,
        serviceType,
        paymentMethod: 'cash',
        estimatedFare: estimatedFare || 0,
        distance: distance || 0,
        duration: duration || 0,
        pickupAddress: pickupAddress || '',
        dropoffAddress: dropoffAddress || '',
      };

      const res = await fetch(`${baseUrl}/trips/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to create ride request');
      }

      const result = await res.json();
      setRequestId(result.requestId);
      requestIdRef.current = result.requestId;

      if (result.message?.toLowerCase().includes('no drivers')) {
        handleNoDriversFound();
      } else {
        startPollingForUpdates();
      }
    } catch (err) {
      setError('Could not request ride. Please try again.');
      setIsMatching(false);
    }
  };

  const handleNoDriversFound = () => {
    setIsMatching(false);
    setError('No drivers available right now. Please try again later.');
    stopPolling();
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setTimeout(() => {
      if (navigation.isFocused()) navigation.goBack();
    }, 3400);
  };

  const cancelMatching = async () => {
    stopPolling();
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    if (requestId && !isTripAccepted) {
      try {
        const token = await getAuthToken();
        if (token) {
          await fetch(`${baseUrl}/trips/${requestId}/cancel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              reason: 'Cancelled by passenger',
              cancelledBy: 'passenger',
            }),
          });
        }
      } catch (err) {
        // silent fail
      }
    }

    navigation.goBack();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const circleScale = matchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  const circleOpacity = matchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={cancelMatching} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Finding your ride</Text>
        <Text style={styles.timerText}>{formatTime(timer)}</Text>
      </View>

      {/* Main Content */}
      <View style={styles.animationContainer}>
        <View style={styles.carContainer}>
          <Animated.View
            style={[
              styles.pulseCircle,
              { transform: [{ scale: circleScale }], opacity: circleOpacity },
            ]}
          />
          <Ionicons
            name={
              serviceType === 'DELIVERY_BIKE'
                ? 'bicycle'
                : serviceType === 'KEKE'
                ? 'triangle'
                : 'car-sport'
            }
            size={88}
            color="#00B0F3"
          />
        </View>

        <Text style={styles.matchingText}>
          {error
            ? 'Ride request failed'
            : isTripAccepted || assignedDriver
            ? 'Driver found!'
            : 'Searching for nearby drivers...'}
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={32} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backHomeText}>Return to home</Text>
            </TouchableOpacity>
          </View>
        ) : isTripAccepted || assignedDriver ? (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>
              {assignedDriver?.name || 'A driver'} is on the way
            </Text>
            <ActivityIndicator size="small" color="#00B0F3" style={{ marginTop: 16 }} />
            <Text style={styles.preparingText}>Preparing navigation...</Text>
          </View>
        ) : (
          <Text style={styles.subText}>Finding the best match for you</Text>
        )}

        {/* Connection hint – subtle */}
        {!isTripAccepted && !error && (
          <View style={styles.connectionHint}>
            <View
              style={[
                styles.dot,
                { backgroundColor: wsConnected ? '#34C759' : '#FF9500' },
              ]}
            />
            <Text style={styles.hintText}>
              {wsConnected ? 'Live updates' : 'Checking drivers...'}
            </Text>
          </View>
        )}
      </View>

      {/* Trip Summary Card */}
      <View style={styles.tripCard}>
        <View style={styles.routeRow}>
          <View style={styles.routeDots}>
            <View style={styles.pickupDot} />
            <View style={styles.line} />
            <View style={styles.dropoffDot} />
          </View>
          <View style={styles.addresses}>
            <Text style={styles.address} numberOfLines={1}>
              {pickupAddress || 'Current location'}
            </Text>
            <Text style={styles.address} numberOfLines={1}>
              {dropoffAddress || 'Destination'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="cash-outline" size={18} color="#666" />
            <Text style={styles.statValue}>₦{estimatedFare?.toLocaleString() || '—'}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={18} color="#666" />
            <Text style={styles.statValue}>{distance?.toFixed(1) || '—'} km</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="car-outline" size={18} color="#666" />
            <Text style={styles.statValue}>
              {serviceType === 'CITY_RIDE'
                ? 'Ride'
                : serviceType === 'DELIVERY_BIKE'
                ? 'Bike'
                : serviceType === 'KEKE'
                ? 'Keke'
                : 'Luxury'}
            </Text>
          </View>
        </View>
      </View>

      {/* Cancel Button */}
      {isMatching && !error && !isTripAccepted && (
        <View style={styles.cancelArea}>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelMatching}>
            <Text style={styles.cancelText}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────
// Styles (cleaned up & modernized)
// ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00B0F3',
  },
  animationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  carContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  pulseCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#00B0F3',
  },
  matchingText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 12,
  },
  subText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  successText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#00C853',
  },
  preparingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#777',
  },
  connectionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F7FF',
    borderRadius: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#0066CC',
    fontWeight: '500',
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDots: {
    alignItems: 'center',
    marginRight: 16,
  },
  pickupDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00B0F3',
  },
  dropoffDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3B30',
  },
  line: {
    width: 2,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginVertical: 6,
  },
  addresses: {
    flex: 1,
  },
  address: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
    marginVertical: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 6,
  },
  errorBox: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  backHomeBtn: {
    backgroundColor: '#111',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  backHomeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelArea: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  cancelBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '700',
  },
});