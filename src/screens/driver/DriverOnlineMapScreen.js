// src/screens/driver/DriverOnlineMapScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert, 
  Dimensions, 
  Platform, 
  Animated, 
  Modal 
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth';
import { 
  initWebSocket, 
  sendWS, 
  addListener, 
  removeListener, 
  isWebSocketConnected, 
  closeWebSocket 
} from '../../utils/socket';

const baseUrl = 'https://wheels-backend.vercel.app';
const { width, height } = Dimensions.get('window');
const LATITUDE_DELTA = 0.005;
const LONGITUDE_DELTA = LATITUDE_DELTA * (width / height);
const CAR_MARKER = require('../../../assets/car-marker.png');

export default function DriverOnlineMapScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const [token, setToken] = useState(null);
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [offerVisible, setOfferVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const [offerTimeout, setOfferTimeout] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [pickupAddress, setPickupAddress] = useState('Fetching pickup location...');
  const [destinationAddress, setDestinationAddress] = useState('Destination will be shared after acceptance');
  const [sound, setSound] = useState(null);
  const soundIntervalRef = useRef(null);
  const pollingRef = useRef(null);
  const [pollCount, setPollCount] = useState(0);

  // ────────────────────────────────────────────────
  // LOAD NOTIFICATION SOUND
  // ────────────────────────────────────────────────
  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound: notificationSound } = await Audio.Sound.createAsync(
          require('../../../assets/sound/sound1.mp3'),
          { shouldPlay: false, isLooping: false }
        );
        setSound(notificationSound);
        console.log('🔊 Sound loaded successfully');
      } catch (err) {
        console.warn('Sound load failed:', err);
      }
    };

    loadSound();

    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }
    };
  }, []);

  // ────────────────────────────────────────────────
  // WEBSOCKET CONNECTION & LISTENERS
  // ────────────────────────────────────────────────
  useEffect(() => {
    const setupWebSocket = async () => {
      try {
        await initWebSocket();
        addListener('connect', () => setWsStatus('connected'));
        addListener('disconnect', () => setWsStatus('disconnected'));
        addListener('error', () => setWsStatus('error'));
        addListener('trip_offered', handleIncomingOffer);
        addListener('notification', (data) => {
          if (data.type === 'trip_offered' || data.notificationType === 'trip_offered') {
            handleIncomingOffer(data.data || data);
          }
        });
      } catch (err) {
        console.error('WebSocket setup failed:', err);
      }
    };

    setupWebSocket();

    return () => {
      removeListener('connect');
      removeListener('disconnect');
      removeListener('error');
      removeListener('trip_offered');
      removeListener('notification');
    };
  }, []);

  // ────────────────────────────────────────────────
  // HANDLE INCOMING RIDE OFFER
  // ────────────────────────────────────────────────
  const handleIncomingOffer = useCallback(
    async (data) => {
      const requestId = data.requestId || data.tripId;

      if (!requestId || (incomingRequest?.requestId === requestId && offerVisible)) {
        console.log('🔄 Duplicate or invalid offer ignored');
        return;
      }

      console.log('📨 Incoming offer:', data);

      try {
        const details = await fetchOfferDetails(requestId);
        if (!details) return;

        const offer = {
          requestId: details.requestId,
          passengerName: details.passengerName || 'Unknown Passenger',
          passengerPhone: details.passengerPhone || '',
          serviceType: details.serviceType || 'CITY_RIDE',
          fare: details.estimatedFare || details.fare || 0,
          pickup: details.pickup,
          destination: details.dropoff || null,
          offeredAt: details.offeredAt || new Date().toISOString(),
          passengerId: details.passengerId,
          pickupAddress: details.pickupAddress || 'Fetching...',
          destinationAddress: details.dropoffAddress || 'Destination will be shared after acceptance',
        };

        setIncomingRequest(offer);

        // Reverse geocode pickup
        if (offer.pickup?.coordinates?.length === 2) {
          const [lng, lat] = offer.pickup.coordinates;
          try {
            const addresses = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (addresses?.[0]) {
              const addr = addresses[0];
              const formatted = [addr.name, addr.street, addr.city, addr.region].filter(Boolean).join(', ') || 'Pickup location in Abuja';
              setPickupAddress(formatted);
            }
          } catch (err) {
            console.warn('Pickup geocoding failed:', err);
            setPickupAddress(details.pickupAddress || 'Pickup nearby');
          }
        } else {
          setPickupAddress(details.pickupAddress || 'Pickup nearby');
        }

        // Destination address
        if (details.dropoffAddress) {
          setDestinationAddress(details.dropoffAddress);
        } else if (details.dropoff?.coordinates?.length === 2) {
          const [lng, lat] = details.dropoff.coordinates;
          try {
            const addresses = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (addresses?.[0]) {
              const addr = addresses[0];
              const formatted = [addr.name, addr.street, addr.city, addr.region].filter(Boolean).join(', ');
              setDestinationAddress(formatted);
            }
          } catch (err) {
            console.warn('Dropoff geocoding failed:', err);
            setDestinationAddress('Destination nearby');
          }
        } else {
          setDestinationAddress('Destination will be shared after acceptance');
        }

        showOfferCard();
        startOfferTimer();
        startSoundLoop();
      } catch (err) {
        console.error('Error processing incoming offer:', err);
      }
    },
    [incomingRequest, offerVisible]
  );

  // ────────────────────────────────────────────────
  // FETCH CURRENT OFFERED RIDE DETAILS
  // ────────────────────────────────────────────────
  const fetchOfferDetails = async (requestId) => {
    try {
      const authToken = token || (await getAuthToken());
      const response = await fetch(`${baseUrl}/drivers/offered-request`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        console.log(`Offer fetch failed: ${response.status}`);
        return null;
      }

      const json = await response.json();
      return json.request || null;
    } catch (err) {
      console.error('Fetch offer details error:', err);
      return null;
    }
  };

  const showOfferCard = () => {
    setOfferVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 9,
      useNativeDriver: true,
    }).start();
  };

  const startOfferTimer = () => {
    if (offerTimeout) clearTimeout(offerTimeout);
    setTimeLeft(20);

    const timeoutId = setTimeout(() => {
      console.log('Offer timed out → auto reject');
      rejectRide();
    }, 20000);

    setOfferTimeout(timeoutId);

    const countdown = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startSoundLoop = async () => {
    if (!sound) return;

    try {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }

      await sound.replayAsync();
      soundIntervalRef.current = setInterval(async () => {
        try {
          await sound.replayAsync();
        } catch (e) {
          console.warn('Sound replay failed:', e);
        }
      }, 3000);
    } catch (err) {
      console.warn('Cannot start sound loop:', err);
    }
  };

  const stopSoundLoop = async () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    if (sound) {
      try {
        await sound.stopAsync();
      } catch {}
    }
  };

  const hideOfferCard = (callback) => {
    stopSoundLoop();
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 320,
      useNativeDriver: true,
    }).start(() => {
      setOfferVisible(false);
      setIncomingRequest(null);
      if (offerTimeout) {
        clearTimeout(offerTimeout);
        setOfferTimeout(null);
      }
      if (callback) {
        setTimeout(callback, 100); // Small delay for safety
      }
    });
  };

const checkAndCleanupDriverState = async () => {
  try {
    const authToken = token || await getAuthToken();
    if (!authToken) {
      console.log('No auth token for cleanup check');
      return;
    }

    console.log('🔍 Checking driver state...');

    // ✅ FIXED: Use correct endpoint
    const stateResponse = await fetch(`${baseUrl}/drivers/current-state`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!stateResponse.ok) {
      console.log('Failed to get driver state');
      return;
    }

    const state = await stateResponse.json();
    console.log('Driver state:', state);

    // If cleanup is needed, perform it
    if (state.needsCleanup) {
      console.log('⚠️ Driver state needs cleanup - performing automatic cleanup...');

      Alert.alert(
        'Cleaning Up',
        'Your driver status is being refreshed...',
        [],
        { cancelable: false }
      );

      // ✅ FIXED: Use correct endpoint
      const cleanupResponse = await fetch(`${baseUrl}/drivers/cleanup-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });

      if (cleanupResponse.ok) {
        const result = await cleanupResponse.json();
        console.log('✅ Cleanup result:', result);

        Alert.alert(
          'Status Refreshed',
          'Your driver status has been cleaned up. You can now accept new rides.',
          [{ text: 'OK' }]
        );

        return true;
      } else {
        console.error('Cleanup failed');
        return false;
      }
    } else {
      console.log('✅ Driver state is clean - no cleanup needed');
      return false;
    }

  } catch (err) {
    console.error('State check/cleanup error:', err);
    return false;
  }
};

// ✅ UPDATED: Accept Ride with Pre-Check
// ✅ FIXED: Accept Ride with Pre-Check (no empty alert)
const acceptRide = async () => {
  console.log('=== ACCEPT RIDE CALLED ===');
  console.log('Incoming request:', incomingRequest);
  
  if (!incomingRequest?.requestId) {
    Alert.alert('Error', 'Invalid trip request');
    hideOfferCard();
    return;
  }

  if (offerVisible === false) {
    console.log('⚠️ Already processing, ignoring duplicate tap');
    return;
  }

  try {
    stopSoundLoop();
    if (offerTimeout) {
      clearTimeout(offerTimeout);
      setOfferTimeout(null);
    }

    // ✅ PRE-CHECK: Verify and cleanup driver state BEFORE accepting
    console.log('🔍 Pre-checking driver state before accept...');
    await checkAndCleanupDriverState();

    Alert.alert('Processing', 'Accepting ride request...', [], { cancelable: false });

    const authToken = token || await getAuthToken();
    if (!authToken) {
      Alert.alert(
        'Session Error',
        'Please go offline and online again to refresh your session.',
        [{ text: 'OK', onPress: () => navigation.replace('DriverHomeOffline') }]
      );
      return;
    }

    const idempotencyKey = `accept_${incomingRequest.requestId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    console.log('🚗 Sending accept request');
    console.log('Request ID:', incomingRequest.requestId);
    console.log('Idempotency Key:', idempotencyKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('⏰ Request aborted due to timeout');
    }, 30000);

    const response = await fetch(`${baseUrl}/trips/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ 
        requestId: incomingRequest.requestId,
        idempotencyKey: idempotencyKey
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      throw new Error('Invalid server response. Please try again.');
    }

    if (response.ok && data.success) {
      console.log('✅ Ride accepted successfully');
      console.log('Trip ID:', data.tripId);
      
      // ✅ FIXED: Show proper success alert
      Alert.alert(
        'Ride Accepted!',
        'Navigating to ride details...',
        [{ text: 'OK' }],
        { cancelable: false }
      );
      
      // ✅ FIXED: Remove the empty alert and improve navigation flow
      hideOfferCard(() => {
        // Clear any existing alerts
        setTimeout(() => {
          // Navigate directly without empty alert
          navigation.replace('RideRequest', {
            tripId: data.tripId,
            requestId: data.requestId || incomingRequest.requestId,
            passengerName: incomingRequest.passengerName || 'Passenger',
            passengerPhone: incomingRequest.passengerPhone || '',
            serviceType: incomingRequest.serviceType || 'CITY_RIDE',
            fare: incomingRequest.fare || 0,
            pickup: incomingRequest.pickup,
            destination: incomingRequest.destination,
            pickupAddress: pickupAddress || 'Pickup location',
            destinationAddress: destinationAddress || 'Destination',
            driverId: data.driverId,
          });
        }, 300); // Slightly longer delay for smoother transition
      });
      
    } else {
      const errorMsg = data?.error?.message || 'Could not accept ride';
      const errorCode = data?.error?.code;
      
      console.error('❌ Accept failed:', errorMsg, errorCode);
      
      let alertTitle = 'Accept Failed';
      let alertMessage = errorMsg;
      
      // ✅ SPECIAL HANDLING: If driver is on a trip, offer cleanup
      if (errorMsg.includes('already on') || errorCode === 'TRIP_UNAVAILABLE') {
        Alert.alert(
          'Status Issue Detected',
          'Your driver status needs to be refreshed. Would you like to fix this now?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => hideOfferCard()
            },
            {
              text: 'Fix Now',
              onPress: async () => {
                const cleaned = await checkAndCleanupDriverState();
                if (cleaned) {
                  // After cleanup, try accepting again automatically
                  setTimeout(() => acceptRide(), 500);
                } else {
                  hideOfferCard();
                }
              }
            }
          ]
        );
        return;
      }
      
      if (errorCode === 'TRIP_ALREADY_ASSIGNED') {
        alertMessage = 'This trip was already assigned to another driver.';
      } else if (errorCode === 'DUPLICATE_REQUEST') {
        alertMessage = 'This ride has already been processed.';
      }
      
      Alert.alert(alertTitle, alertMessage, [
        { text: 'OK', onPress: () => hideOfferCard() }
      ]);
    }

  } catch (error) {
    console.error('❌ Accept ride error:', error);
    
    let errorMessage = 'Failed to accept ride. Please check your connection and try again.';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out. The ride may have been assigned to another driver.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    Alert.alert('Error', errorMessage, [
      { text: 'OK', onPress: () => hideOfferCard() }
    ]);
  }
};


// Helper function to re-enable buttons
const enableButtons = () => {
  const declineButton = document.querySelector('[data-testid="decline-button"]');
  const acceptButton = document.querySelector('[data-testid="accept-button"]');
  if (declineButton) declineButton.disabled = false;
  if (acceptButton) acceptButton.disabled = false;
};


  const rejectRide = async () => {
    if (!incomingRequest?.requestId) {
      hideOfferCard();
      return;
    }

    // ✅ FIX: Get token dynamically for reject too
    const authToken = token || await getAuthToken();
    if (!authToken) {
      hideOfferCard();
      return;
    }

    stopSoundLoop();

    try {
      await fetch(`${baseUrl}/trips/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ requestId: incomingRequest.requestId }),
      });
    } catch (err) {
      console.error('Reject failed:', err);
    }

    hideOfferCard();
  };

  // ────────────────────────────────────────────────
  // POLLING FALLBACK (when WS is unreliable)
  // ────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      if (!token || !isOnline || offerVisible) return;

      try {
        const res = await fetch(`${baseUrl}/drivers/offered-request`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.request) {
            handleIncomingOffer({ requestId: json.request.requestId, offeredAt: json.request.offeredAt });
          }
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 5000);
  }, [token, isOnline, offerVisible, handleIncomingOffer]);

  useEffect(() => {
    if (isOnline && token && !offerVisible) {
      startPolling();
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isOnline, token, offerVisible, startPolling]);

  // ────────────────────────────────────────────────
  // INITIALIZATION + LOCATION TRACKING
  // ────────────────────────────────────────────────
  useEffect(() => {
    let subscription = null;
    let mounted = true;

    const initialize = async () => {
      try {
        console.log('🚗 Initializing DriverOnlineMapScreen...');
        const authToken = await getAuthToken();
        if (!authToken) {
          console.log('❌ No auth token found');
          navigation.replace('Login');
          return;
        }
        
        if (mounted) {
          setToken(authToken);
        }

        console.log('📍 Requesting location permission...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('❌ Location permission denied');
          Alert.alert(
            'Location Permission Required',
            'This app needs location access to show your position on the map and receive ride requests.',
            [{ text: 'OK', onPress: () => navigation.replace('DriverHomeOffline') }]
          );
          return;
        }

        console.log('📍 Getting current position...');
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading || 0,
        };

        if (mounted) {
          setLocation(coords);
          setHeading(coords.heading);
          setLoading(false);
        }

        console.log('✅ Going online...');
        await goOnline(coords, authToken);
        
        if (mounted) {
          setIsOnline(true);
        }

        console.log('📍 Starting location tracking...');
        subscription = await startLocationTracking(authToken);
        
        console.log('✅ DriverOnlineMapScreen initialized successfully');
      } catch (err) {
        console.error('❌ Initialization failed:', err);
        if (mounted) {
          Alert.alert(
            'Initialization Error',
            'Failed to initialize the map. Please try again.',
            [{ text: 'OK', onPress: () => navigation.replace('DriverHomeOffline') }]
          );
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      if (subscription) subscription.remove();
      if (pollingRef.current) clearInterval(pollingRef.current);
      stopSoundLoop();
    };
  }, []);

  const goOnline = async (coords, authToken) => {
    try {
      const res = await fetch(`${baseUrl}/drivers/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          isAvailable: true,
          location: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
        }),
      });

      if (res.ok) {
        console.log('✅ Driver is now online');
        return true;
      } else {
        console.error('❌ Failed to go online, status:', res.status);
        return false;
      }
    } catch (err) {
      console.error('❌ Failed to go online:', err);
      return false;
    }
  };

  const startLocationTracking = async (authToken) => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (position) => {
          if (!position) return;
          
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading ?? heading,
          };

          setLocation(newLocation);
          setHeading(newLocation.heading);

          // Send real-time location via WebSocket
          if (isWebSocketConnected()) {
            sendWS({
              type: 'driver:location',
              latitude: newLocation.latitude,
              longitude: newLocation.longitude,
              heading: newLocation.heading,
              timestamp: Date.now(),
            });
          }

          // Update server location
          try {
            await fetch(`${baseUrl}/drivers/availability`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                isAvailable: true,
                location: { type: 'Point', coordinates: [newLocation.longitude, newLocation.latitude] },
              }),
            });
          } catch (updateErr) {
            console.warn('Location update failed:', updateErr.message);
          }

          // Smooth map animation
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                ...newLocation,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
              },
              1000
            );
          }
        }
      );

      setLocationSubscription(subscription);
      return subscription;
    } catch (err) {
      console.error('❌ Failed to start location tracking:', err);
      return null;
    }
  };

  const goOffline = () => {
    Alert.alert('Go Offline?', 'You will stop receiving new ride requests.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Go Offline',
        style: 'destructive',
        onPress: async () => {
          try {
            const authToken = token || await getAuthToken();
            if (authToken) {
              await fetch(`${baseUrl}/drivers/availability`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ isAvailable: false }),
              });
            }
          } catch {}

          setIsOnline(false);
          locationSubscription?.remove();
          if (pollingRef.current) clearInterval(pollingRef.current);
          stopSoundLoop();
          closeWebSocket();
          navigation.replace('DriverHomeOffline');
        },
      },
    ]);
  };

  // Pulse animation when online
  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00B0F3" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location?.latitude || 9.0765,
          longitude: location?.longitude || 7.3986,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        showsTraffic={true}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {location && (
          <>
            <Circle 
              center={location} 
              radius={120} 
              strokeColor="rgba(0,176,243,0.4)" 
              fillColor="rgba(0,176,243,0.15)" 
            />
            <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.Image
                source={CAR_MARKER}
                style={[
                  styles.carMarker,
                  {
                    transform: [{ rotate: `${heading}deg` }, { scale: pulseAnim }],
                  },
                ]}
              />
            </Marker>
          </>
        )}
      </MapView>

      {/* Status indicators */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <View style={[styles.dot, { backgroundColor: isOnline ? '#34C759' : '#FF3B30' }]} />
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>

        <View style={styles.statusItem}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: wsStatus === 'connected' ? '#34C759' : wsStatus === 'connecting' ? '#FF9500' : '#FF3B30',
              },
            ]}
          />
          <Text style={styles.statusText}>
            {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Go Offline Button */}
      <TouchableOpacity style={styles.goOfflineBtn} onPress={goOffline}>
        <Ionicons name="power" size={22} color="white" />
        <Text style={styles.goOfflineText}>Go Offline</Text>
      </TouchableOpacity>

      {/* Incoming Ride Offer Modal */}
      <Modal transparent visible={offerVisible} animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.offerCard, { transform: [{ translateY: slideAnim }] }]}>
            <LinearGradient colors={['#007AFF', '#0051CC']} style={styles.headerGradient}>
              <Text style={styles.headerTitle}>New Ride Request</Text>
              <TouchableOpacity onPress={rejectRide}>
                <Ionicons name="close-circle" size={32} color="white" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.cardContent}>
              <View style={styles.passengerInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {incomingRequest?.passengerName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.passengerDetails}>
                  <Text style={styles.passengerName}>{incomingRequest?.passengerName}</Text>
                  {incomingRequest?.passengerPhone && (
                    <Text style={styles.passengerPhone}>{incomingRequest.passengerPhone}</Text>
                  )}
                </View>
              </View>

              <View style={styles.routeSection}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: '#34C759' }]} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {pickupAddress}
                  </Text>
                </View>

                <View style={styles.routeConnector}>
                  <View style={styles.connectorLine} />
                </View>

                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: '#FF3B30' }]} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {destinationAddress}
                  </Text>
                </View>
              </View>

              <View style={styles.fareBox}>
                <Text style={styles.fareLabel}>Estimated Fare</Text>
                <Text style={styles.fareAmount}>
                  {incomingRequest?.fare && incomingRequest.fare > 0
                    ? `₦${Number(incomingRequest.fare).toLocaleString()}`
                    : 'Calculating...'}
                </Text>
              </View>

              <View style={styles.timerBox}>
                <Ionicons name="time-outline" size={18} color="#333" />
                <Text style={styles.timerText}>Accept within {timeLeft} seconds</Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.declineButton} 
                onPress={rejectRide}
                activeOpacity={0.7}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.acceptButton} 
                onPress={acceptRide}
                activeOpacity={0.7}
              >
                <Text style={styles.acceptText}>Accept Ride</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0A1733' 
  },
  map: { 
    flex: 1 
  },
  loading: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#0A1733' 
  },
  loadingText: { 
    color: '#fff', 
    marginTop: 16, 
    fontSize: 16 
  },
  statusBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  statusItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5 
  },
  statusText: { 
    fontWeight: '700', 
    fontSize: 14 
  },
  goOfflineBtn: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,59,48,0.93)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  goOfflineText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.65)', 
    justifyContent: 'flex-end' 
  },
  offerCard: { 
    backgroundColor: 'white', 
    borderTopLeftRadius: 36, 
    borderTopRightRadius: 36, 
    overflow: 'hidden' 
  },
  headerGradient: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 20 
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: 'white' 
  },
  cardContent: { 
    padding: 24, 
    gap: 20 
  },
  passengerInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16 
  },
  avatar: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#007AFF', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarText: { 
    color: 'white', 
    fontSize: 28, 
    fontWeight: 'bold' 
  },
  passengerDetails: { 
    flex: 1 
  },
  passengerName: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#111' 
  },
  passengerPhone: { 
    fontSize: 15, 
    color: '#555', 
    marginTop: 3 
  },
  routeSection: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 20, 
    padding: 16, 
    gap: 12 
  },
  routePoint: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  routeDot: { 
    width: 14, 
    height: 14, 
    borderRadius: 7 
  },
  addressText: { 
    fontSize: 16, 
    color: '#222', 
    flex: 1, 
    lineHeight: 22 
  },
  routeConnector: { 
    alignItems: 'center', 
    height: 28 
  },
  connectorLine: { 
    width: 2, 
    height: '100%', 
    backgroundColor: '#CBD5E1' 
  },
  fareBox: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#EFF6FF', 
    padding: 16, 
    borderRadius: 16 
  },
  fareLabel: { 
    fontSize: 16, 
    color: '#64748B', 
    fontWeight: '600' 
  },
  fareAmount: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#1E40AF' 
  },
  timerBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    backgroundColor: '#FEF3C7', 
    paddingVertical: 12, 
    borderRadius: 12 
  },
  timerText: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#92400E' 
  },
  actionButtons: { 
    flexDirection: 'row', 
    gap: 16, 
    paddingHorizontal: 24, 
    paddingBottom: 28, 
    paddingTop: 12 
  },
  declineButton: { 
    flex: 1, 
    paddingVertical: 18, 
    borderWidth: 2, 
    borderColor: '#EF4444', 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  declineText: { 
    color: '#EF4444', 
    fontSize: 17, 
    fontWeight: '700' 
  },
  acceptButton: { 
    flex: 1.6, 
    backgroundColor: '#10B981', 
    paddingVertical: 18, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  acceptText: { 
    color: 'white', 
    fontSize: 17, 
    fontWeight: '700' 
  },
  carMarker: { 
    width: 56, 
    height: 56 
  },
});