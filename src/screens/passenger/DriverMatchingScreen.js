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
const baseUrl = 'https://wheels-backend.vercel.app';

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
  const [userData, setUserData] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [isPollingActive, setIsPollingActive] = useState(false);
  const [isTripAccepted, setIsTripAccepted] = useState(false);
  const [tripAcceptedData, setTripAcceptedData] = useState(null);

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

  // Use refs for values that need latest state in callbacks
  const isTripAcceptedRef = useRef(isTripAccepted);
  const assignedDriverRef = useRef(assignedDriver);
  const requestIdRef = useRef(requestId);
  const timerIntervalRef = useRef(timerInterval);
  const pollingIntervalRef = useRef(pollingInterval);

  // Update refs when state changes
  useEffect(() => {
    isTripAcceptedRef.current = isTripAccepted;
    assignedDriverRef.current = assignedDriver;
    requestIdRef.current = requestId;
    timerIntervalRef.current = timerInterval;
    pollingIntervalRef.current = pollingInterval;
  }, [isTripAccepted, assignedDriver, requestId, timerInterval, pollingInterval]);

  // ────────────────────────────────────────────────
  //  LIFECYCLE & CLEANUP
  // ────────────────────────────────────────────────

  useEffect(() => {
    loadUserData();
    startMatchingAnimation();
    startTimer();
    createTripRequest();
    initWebSocketAndListen();

    return () => {
      // Cleanup
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

      // Remove WebSocket listeners
      removeListener('trip_accepted', handleTripAcceptedListener);
      removeListener('notification', handleNotificationListener);
      removeListener('connect', handleConnect);
      removeListener('disconnect', handleDisconnect);
      removeListener('trip:accepted', handleTripAcceptedListener);
    };
  }, []);

  // ✅ FIX: Clear timers when trip is accepted
  useEffect(() => {
    if (isTripAccepted) {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      stopPolling();
    }
  }, [isTripAccepted]);

  const loadUserData = async () => {
    try {
      const user = await getStoredUser();
      setUserData(user);
      console.log('👤 User data loaded:', user?._id);
    } catch (err) {
      console.error('Error loading user:', err);
    }
  };

  const startMatchingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(matchProgress, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(matchProgress, {
          toValue: 0,
          duration: 2000,
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
  //  WEBSOCKET SETUP
  // ────────────────────────────────────────────────

  const initWebSocketAndListen = async () => {
    try {
      console.log('🔌 Initializing WebSocket for matching screen...');
      await initWebSocket();

      // Connection listeners
      addListener('connect', handleConnect);
      addListener('disconnect', handleDisconnect);

      // Business listeners
      addListener('trip_accepted', handleTripAcceptedListener);
      addListener('notification', handleNotificationListener);
      addListener('trip:accepted', handleTripAcceptedListener);

      setWsConnected(isWebSocketConnected());
    } catch (err) {
      console.error('WebSocket init failed:', err);
      setDebugInfo('WebSocket failed — using polling');
      if (requestId) startPollingForUpdates();
    }
  };

  const handleConnect = () => {
    console.log('✅ WebSocket connected in DriverMatchingScreen');
    setDebugInfo('WebSocket connected');
    setWsConnected(true);

    if (requestId && !isTripAcceptedRef.current) {
      sendWS({ 
        type: 'passenger:request_trip', 
        requestId: requestIdRef.current,
        userId: userData?._id 
      });
    }
  };

  const handleDisconnect = (data) => {
    console.log('❌ WebSocket disconnected:', data?.reason || 'unknown');
    setDebugInfo(`Disconnected: ${data?.reason || 'unknown'}`);
    setWsConnected(false);

    if (requestIdRef.current && !isPollingActive && !isTripAcceptedRef.current) {
      startPollingForUpdates();
    }
  };

  const handleTripAcceptedListener = useCallback((data) => {
    console.log('🎯 Received trip_accepted event:', data);
    
    // Use ref to check current state to prevent stale closure
    const currentlyAccepted = isTripAcceptedRef.current;
    
    if (currentlyAccepted) {
      console.log('⚠️ Trip already accepted, ignoring duplicate');
      return;
    }
    
    console.log('✅ Processing trip acceptance');
    setDebugInfo(`Trip accepted by driver ${data?.driverId}`);
    
    // Set flag immediately to block other events
    setIsTripAccepted(true);
    
    // Store data for processing
    setTripAcceptedData(data);
    
    // Stop all timers/polling immediately
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      setTimerInterval(null);
    }
    stopPolling();
    
    // Process the acceptance
    handleTripAccepted(data);
  }, []);

  const handleNotificationListener = useCallback((data) => {
    console.log('📢 Notification received:', {
      type: data.notificationType || data.type,
      data: data
    });

    const type = data.notificationType || data.type;
    const notifRequestId = data.data?.requestId || data.requestId;
    const currentRequestId = requestIdRef.current;

    // Ignore notifications for other requests
    if (notifRequestId && notifRequestId !== currentRequestId) {
      console.log('ℹ️ Notification for different request, ignoring');
      return;
    }

    // Process trip_accepted notifications
    if (type === 'trip_accepted' || type === 'trip:accepted') {
      console.log('📢 Processing trip_accepted notification');
      
      const currentlyAccepted = isTripAcceptedRef.current;
      if (currentlyAccepted) {
        console.log('⚠️ Trip already accepted, ignoring');
        return;
      }
      
      const acceptanceData = {
        requestId: notifRequestId,
        driverId: data.data?.driverId || data.driverId,
        tripId: data.data?.tripId || data.tripId,
        driverName: data.data?.driverName || data.driverName,
      };
      
      console.log('✅ Calling handleTripAcceptedListener with:', acceptanceData);
      handleTripAcceptedListener(acceptanceData);
    }
    // Only process no_drivers if not already accepted
    else if (type === 'no_driver_found') {
      console.log('📢 Processing no_driver_found notification');
      
      const currentlyAccepted = isTripAcceptedRef.current;
      const hasAssignedDriver = assignedDriverRef.current;
      
      if (currentlyAccepted || hasAssignedDriver) {
        console.log('⚠️ Trip already accepted, ignoring no_drivers');
        return;
      }
      
      handleNoDriversFound(data);
    }
    else {
      console.log('ℹ️ Ignoring notification type:', type);
    }
  }, []);

  // ────────────────────────────────────────────────
  //  POLLING FALLBACK
  // ────────────────────────────────────────────────

  const startPollingForUpdates = () => {
    if (isPollingActive || isTripAcceptedRef.current) return;
    console.log('🔄 Starting polling fallback');
    setIsPollingActive(true);

    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    const interval = setInterval(async () => {
      if (requestIdRef.current && !isTripAcceptedRef.current) {
        await checkTripStatus();
      } else {
        stopPolling();
      }
    }, 7000);

    setPollingInterval(interval);
    pollingIntervalRef.current = interval;
  };

  const checkTripStatus = async () => {
    const currentRequestId = requestIdRef.current;
    const currentlyAccepted = isTripAcceptedRef.current;
    const hasAssignedDriver = assignedDriverRef.current;
    
    if (currentlyAccepted || !currentRequestId) {
      console.log('⚠️ Trip already accepted or no request ID, skipping poll');
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) return;

      console.log(`🔄 Polling trip status for ${currentRequestId}`);
      const res = await fetch(`${baseUrl}/trips/request/${currentRequestId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (!res.ok) {
        console.log(`❌ Polling failed: HTTP ${res.status}`);
        return;
      }

      const data = await res.json();
      console.log('📊 Polling response:', {
        status: data.trip?.status,
        hasDriver: !!data.trip?.assignedDriverId
      });

      // Check assigned status with driver ID
      if (data.trip?.status === 'assigned' && data.trip.assignedDriverId) {
        console.log('✅ Trip assigned via polling');
        
        // Double-check not already accepted using ref
        if (!isTripAcceptedRef.current) {
          handleTripAcceptedListener({
            requestId: currentRequestId,
            driverId: data.trip.assignedDriverId._id || data.trip.assignedDriverId,
            tripId: data.trip._id,
            driverName: data.trip.assignedDriverId?.name,
          });
        }
        stopPolling();
      } 
      // Handle no_drivers only if not accepted
      else if (data.trip?.status === 'no_drivers') {
        if (!isTripAcceptedRef.current && !hasAssignedDriver) {
          console.log('❌ No drivers found via polling');
          handleNoDriversFound();
          stopPolling();
        }
      }
      // Handle cancelled
      else if (data.trip?.status === 'cancelled') {
        if (!isTripAcceptedRef.current) {
          console.log('❌ Trip cancelled via polling');
          setError('Trip was cancelled');
          stopPolling();
          
          setTimeout(() => {
            if (navigation.isFocused()) navigation.goBack();
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      setPollingInterval(null);
      pollingIntervalRef.current = null;
      setIsPollingActive(false);
      console.log('🛑 Polling stopped');
    }
  };

  // ────────────────────────────────────────────────
  //  CREATE TRIP REQUEST
  // ────────────────────────────────────────────────

  const createTripRequest = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Session Expired', 'Please login again.');
        navigation.replace('Login');
        return;
      }

      console.log('📤 Creating trip request...');
      console.log('Token being sent (first 20 chars):', token.substring(0, 20) + '...');

      // Prepare request data
      const requestData = {
        pickup: {
          type: 'Point',
          coordinates: [pickup.longitude, pickup.latitude],
        },
        dropoff: dropoff ? {
          type: 'Point',
          coordinates: [dropoff.longitude, dropoff.latitude],
        } : undefined,
        serviceType,
        paymentMethod: 'wallet',
        estimatedFare: estimatedFare || 0,
        distance: distance || 0,
        duration: duration || 0,
        pickupAddress: pickupAddress || '',
        dropoffAddress: dropoffAddress || '',
      };

      console.log('Sending request to:', `${baseUrl}/trips/request`);
      console.log('Payload:', JSON.stringify(requestData, null, 2));

      const res = await fetch(`${baseUrl}/trips/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const text = await res.text();
        console.log('Raw error response (first 500 chars):', text.substring(0, 500));
        throw new Error(`Server responded with ${res.status} - ${text.substring(0, 150)}...`);
      }

      const result = await res.json();
      console.log('✅ Success response:', result);

      setRequestId(result.requestId);
      requestIdRef.current = result.requestId;
      setDebugInfo(`Request created: ${result.requestId}`);

      if (result.message?.toLowerCase().includes('no drivers')) {
        console.log('❌ No drivers available initially');
        handleNoDriversFound();
      } else {
        console.log('🔄 Starting polling for updates');
        startPollingForUpdates();
      }
    } catch (err) {
      console.error('❌ Create request error:', err);
      setError(err.message || 'Failed to request ride. Please try again.');
      setIsMatching(false);
    }
  };

  // ────────────────────────────────────────────────
  //  EVENT HANDLERS
  // ────────────────────────────────────────────────

  const handleTripAccepted = useCallback(async (data) => {
    console.log('🚗 Processing trip acceptance:', data);
    
    setIsMatching(false);
    setAssignedDriver({ 
      driverId: data.driverId,
      name: data.driverName || 'Your Driver'
    });

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      // Fetch driver details with timeout
      let driverData = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`${baseUrl}/users/${data.driverId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          driverData = await res.json();
          console.log('👨‍✈️ Driver data fetched:', driverData?.name);
        }
      } catch (driverErr) {
        console.warn('Failed to load driver info:', driverErr.message);
        // Continue anyway with basic data
      }

      // ✅ FIX: Prepare navigation data with correct field names for TripTrackingScreen
      const navigationData = {
        tripId: data.tripId,
        requestId: data.requestId || requestIdRef.current,
        
        // ✅ Use 'pickup' for pickup location (TripTracking expects 'pickup')
        pickup: pickup,
        
        // ✅ Use 'destination' for dropoff location (TripTracking expects 'destination')
        destination: dropoff,
        
        // ✅ Use correct address field names
        pickupAddress: pickupAddress || 'Pickup location',
        destinationAddress: dropoffAddress || 'Destination',
        
        // Driver information
        driverId: data.driverId,
        driverName: data.driverName || driverData?.name || 'Your Driver',
        driverPhone: driverData?.phone || '',
        driverPhoto: driverData?.profilePhoto || null,
        driverRating: driverData?.driverProfile?.rating?.toString() || '4.8',
        
        // Vehicle information
        vehicleModel: driverData?.driverProfile?.vehicleModel || 'Vehicle',
        vehicleColor: driverData?.driverProfile?.vehicleColor || '',
        vehiclePlate: driverData?.driverProfile?.vehiclePlate || '',
        
        // Trip details
        serviceType: serviceType,
        estimatedFare: estimatedFare || 0,
        fare: estimatedFare || 0, // TripTracking uses 'fare'
        distance: distance || 0,
        duration: duration || 0,
        paymentMethod: 'wallet',
      };

      console.log('📍 Navigation data prepared:', {
        tripId: navigationData.tripId,
        requestId: navigationData.requestId,
        driverId: navigationData.driverId,
        hasPickup: !!navigationData.pickup,
        hasDestination: !!navigationData.destination,
        pickupAddress: navigationData.pickupAddress,
        destinationAddress: navigationData.destinationAddress
      });

      // Delay for UX, then navigate with reset
      setTimeout(() => {
        if (navigation.isFocused()) {
          console.log('🧭 Navigating to TripTracking with data:', navigationData);
          navigation.replace('TripTracking', navigationData);
        } else {
          console.warn('⚠️ Navigation not focused, cannot navigate');
        }
      }, 1500);

    } catch (err) {
      console.error('❌ Error in handleTripAccepted:', err);
      
      // Navigate anyway with basic data after error
      setTimeout(() => {
        if (navigation.isFocused()) {
          console.log('🧭 Navigating with basic data after error');
          navigation.replace('TripTracking', {
            tripId: data.tripId,
            requestId: data.requestId || requestIdRef.current,
            pickup: pickup,
            destination: dropoff, // ✅ Use 'destination' not 'dropoff'
            pickupAddress: pickupAddress || 'Pickup location',
            destinationAddress: dropoffAddress || 'Destination', // ✅ Use 'destinationAddress'
            driverId: data.driverId,
            driverName: data.driverName || 'Your Driver',
            driverRating: '4.8',
            vehicleModel: 'Vehicle',
            vehiclePlate: '',
            fare: estimatedFare || 0, // ✅ Use 'fare' not 'estimatedFare'
            serviceType: serviceType,
            distance: distance || 0,
            duration: duration || 0,
            paymentMethod: 'wallet',
          });
        }
      }, 1500);
    }
  }, [pickup, dropoff, pickupAddress, dropoffAddress, serviceType, estimatedFare, distance, duration]);

  const handleNoDriversFound = useCallback((data) => {
    console.log('🚫 Handling no drivers found');
    
    // Safety check: Don't show no_drivers if we already have a driver
    const currentlyAccepted = isTripAcceptedRef.current;
    const hasAssignedDriver = assignedDriverRef.current;
    
    if (currentlyAccepted || hasAssignedDriver) {
      console.log('⚠️ Ignoring no_drivers - trip already accepted or driver assigned');
      return;
    }
    
    setIsMatching(false);
    setError('No drivers available right now. Please try again later.');
    stopPolling();
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      setTimerInterval(null);
    }

    // Wait 3 seconds then go back
    setTimeout(() => {
      if (navigation.isFocused()) {
        console.log('↩️ Going back to ride request screen');
        navigation.goBack();
      }
    }, 3000);
  }, []);

  const cancelMatching = async () => {
    console.log('❌ Cancelling matching...');
    
    stopPolling();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      setTimerInterval(null);
    }

    const currentRequestId = requestIdRef.current;
    const currentlyAccepted = isTripAcceptedRef.current;
    
    if (currentRequestId && !currentlyAccepted) {
      try {
        const token = await getAuthToken();
        if (token) {
          await fetch(`${baseUrl}/trips/${currentRequestId}/cancel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ 
              reason: 'Cancelled by passenger',
              cancelledBy: 'passenger' 
            }),
          });
          console.log('✅ Trip cancelled on server');
        }
      } catch (err) {
        console.error('Cancel failed:', err);
      }
    }

    // Go back immediately
    navigation.goBack();
  };

  const retryRequest = async () => {
    console.log('🔄 Retrying request...');
    
    setError(null);
    setIsMatching(true);
    setTimer(0);
    setIsTripAccepted(false);
    setAssignedDriver(null);
    setDebugInfo('Retrying...');
    
    stopPolling();
    startTimer();
    startMatchingAnimation();
    
    await createTripRequest();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const circleScale = matchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  const circleOpacity = matchProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0],
  });

  const DebugOverlay = () => (
    __DEV__ && debugInfo ? (
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>Debug: {debugInfo}</Text>
        <Text style={styles.debugText}>Request: {requestId || '—'}</Text>
        <Text style={styles.debugText}>
          Polling: {isPollingActive ? 'Active' : 'Off'}
        </Text>
        <Text style={styles.debugText}>
          WS: {wsConnected ? 'Connected' : 'Disconnected'}
        </Text>
        <Text style={styles.debugText}>
          Trip Accepted: {isTripAccepted ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.debugText}>
          Assigned Driver: {assignedDriver ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.debugText}>
          Time: {formatTime(timer)}
        </Text>
      </View>
    ) : null
  );

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

      {/* Matching Animation */}
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
            size={80}
            color="#00B0F3"
          />
        </View>

        <Text style={styles.matchingText}>
          {isTripAccepted || assignedDriver 
            ? 'Driver found!' 
            : isMatching 
              ? 'Searching for nearby drivers...' 
              : 'No drivers available'}
        </Text>

        {isTripAccepted || assignedDriver ? (
          <View style={styles.driverFoundContainer}>
            <Text style={styles.driverFoundText}>
              {assignedDriver?.name || 'Driver'} is on the way!
            </Text>
            <View style={styles.vehicleInfo}>
              <Ionicons name="car" size={20} color="#666" />
              <Text style={styles.vehicleText}>
                {assignedDriver?.vehicleModel || 'Car'} • {assignedDriver?.vehicleColor || ''}
              </Text>
            </View>
            <ActivityIndicator size="small" color="#00B0F3" style={styles.navIndicator} />
            <Text style={styles.navText}>Preparing navigation...</Text>
          </View>
        ) : isMatching ? (
          <Text style={styles.subText}>We're finding the best driver for you</Text>
        ) : null}

        {/* Connection status indicator */}
        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.statusDot,
              { 
                backgroundColor: isTripAccepted 
                  ? '#4ADE80' 
                  : wsConnected 
                    ? '#4ADE80' 
                    : isPollingActive 
                      ? '#F59E0B' 
                      : '#F43F5E' 
              },
            ]}
          />
          <Text style={styles.connectionText}>
            {isTripAccepted 
              ? 'Driver Assigned' 
              : wsConnected 
                ? 'Live updates' 
                : isPollingActive 
                  ? 'Polling' 
                  : 'No connection'}
          </Text>
        </View>
      </View>

      {/* Trip details card */}
      <View style={styles.tripDetailsCard}>
        <View style={styles.routeInfo}>
          <View style={styles.routePoint}>
            <View style={styles.pickupDot} />
            <View style={styles.verticalLine} />
          </View>
          <View style={styles.routeAddresses}>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>Pickup</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {pickupAddress || 'Current location'}
              </Text>
            </View>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>Dropoff</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {dropoffAddress || 'Destination'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.tripStats}>
          <View style={styles.statItem}>
            <Ionicons name="cash-outline" size={20} color="#666" />
            <Text style={styles.statValue}>₦{estimatedFare?.toLocaleString() || '0'}</Text>
            <Text style={styles.statLabel}>Fare</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.statValue}>{distance?.toFixed(1) || '0.0'} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="car-outline" size={20} color="#666" />
            <Text style={styles.statValue}>
              {serviceType === 'CITY_RIDE'
                ? 'City Ride'
                : serviceType === 'DELIVERY_BIKE'
                ? 'Bike'
                : serviceType === 'LUXURY_RENTAL'
                ? 'Luxury'
                : 'Keke'}
            </Text>
            <Text style={styles.statLabel}>Service</Text>
          </View>
        </View>
      </View>

      {/* Error */}
      {error && !isTripAccepted && !assignedDriver && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={24} color="#FF4444" />
          <View style={styles.errorContent}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={retryRequest} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cancel button */}
      {isMatching && !isTripAccepted && !assignedDriver && (
        <View style={styles.cancelContainer}>
          <TouchableOpacity style={styles.cancelButton} onPress={cancelMatching}>
            <Text style={styles.cancelButtonText}>Cancel Request</Text>
          </TouchableOpacity>
        </View>
      )}

      <DebugOverlay />
    </View>
  );
}

// ────────────────────────────────────────────────
//  Styles
// ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  carContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  pulseCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#00B0F3',
  },
  matchingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  subText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  driverFoundContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  driverFoundText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4ADE80',
    marginBottom: 8,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  navIndicator: {
    marginTop: 8,
  },
  navText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 12,
    color: '#666',
  },
  tripDetailsCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  routeInfo: {
    flexDirection: 'row',
  },
  routePoint: {
    alignItems: 'center',
    marginRight: 16,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00B0F3',
  },
  verticalLine: {
    width: 2,
    height: 40,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  routeAddresses: {
    flex: 1,
  },
  addressRow: {
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorContent: {
    flex: 1,
    marginLeft: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#FF4444',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  cancelButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#FF4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '700',
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 8,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
});