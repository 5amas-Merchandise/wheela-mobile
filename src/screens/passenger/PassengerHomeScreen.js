// src/screens/passenger/PassengerHomeScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import {
  initWebSocket,
  sendWS,
  addListener,
  removeListener,
  isWebSocketConnected,
  closeWebSocket,
} from '../../utils/socket'; // ← updated import

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const GOOGLE_API_KEY = 'AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo';

const RIDE_TYPES = [
  { id: 'CITY_RIDE', name: 'City Ride', icon: 'car-sport', color: '#00B0F3', multiplier: 1.0, eta: '~3 min' },
  { id: 'DELIVERY_BIKE', name: 'Bike', icon: 'bicycle', color: '#4ADE80', multiplier: 0.8, eta: '~2 min' },
  { id: 'LUXURY_RENTAL', name: 'Luxury', icon: 'diamond', color: '#F43F5E', multiplier: 3.5, eta: '~8 min' },
  { id: 'KEKE', name: 'Keke', icon: 'triangle', color: '#EC4899', multiplier: 0.6, eta: '~4 min' },
];

export default function PassengerHomeScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);

  const [currentLocation, setCurrentLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('Getting location...');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [selectedRideType, setSelectedRideType] = useState('CITY_RIDE');
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRideModal, setShowRideModal] = useState(false);
  const [routeDistance, setRouteDistance] = useState(0);
  const [routeDuration, setRouteDuration] = useState(0);

  // Trip tracking states
  const [tripStatus, setTripStatus] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  // WebSocket state
  const [wsReady, setWsReady] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Map ready flag
  const [isMapReady, setIsMapReady] = useState(false);

  // ────────────────────────────────────────────────
  //  WEBSOCKET LIFECYCLE
  // ────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    let reconnectTimeout = null;

    const initializeWebSocket = async () => {
      try {
        console.log('Initializing WebSocket connection...');

        if (isWebSocketConnected()) {
          console.log('WebSocket already connected');
          if (mounted) setWsReady(true);
          return;
        }

        await initWebSocket();

        if (mounted) {
          setWsReady(isWebSocketConnected());
          setConnectionAttempts(0);
        }
      } catch (error) {
        console.error('WebSocket init error:', error);
        if (mounted) {
          setWsReady(false);
          const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
          reconnectTimeout = setTimeout(() => {
            if (mounted) {
              setConnectionAttempts((prev) => prev + 1);
              initializeWebSocket();
            }
          }, delay);
        }
      }
    };

    initializeWebSocket();

    // Connection listeners
    const handleConnect = () => {
      console.log('✅ WebSocket connected');
      if (mounted) {
        setWsReady(true);
        setConnectionAttempts(0);
      }
    };

    const handleDisconnect = () => {
      console.log('🔌 WebSocket disconnected');
      if (mounted) {
        setWsReady(false);
      }

      // Auto-reconnect
      reconnectTimeout = setTimeout(() => {
        if (mounted && !isWebSocketConnected()) {
          console.log('🔄 Auto-reconnecting...');
          initializeWebSocket();
        }
      }, 3000);
    };

    addListener('connect', handleConnect);
    addListener('disconnect', handleDisconnect);

    return () => {
      mounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      removeListener('connect', handleConnect);
      removeListener('disconnect', handleDisconnect);
      // Do NOT close socket here — keep it alive for other screens
    };
  }, []);

  // ────────────────────────────────────────────────
  //  TRIP EVENT LISTENERS (only when wsReady)
  // ────────────────────────────────────────────────

  useEffect(() => {
    if (!wsReady) return;

    console.log('Setting up trip event listeners...');

    const handleTripAccepted = (data) => {
      console.log('🚗 Driver accepted trip:', data);
      setDriverData(data);
      setTripStatus('driver_nearby');
      // Join trip room (if your backend supports this message)
      sendWS({ type: 'join:trip', tripId: data.tripId });
    };

    const handleDriverLocation = (data) => {
      console.log('📍 Driver location update:', data);
      if (data.driverLocation) {
        setDriverLocation(data.driverLocation);

        if (mapRef.current && isMapReady && currentLocation) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
              data.driverLocation,
            ],
            {
              edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
              animated: true,
            }
          );
        }
      }
    };

    const handleTripStarted = () => {
      console.log('▶️ Trip started');
      setTripStatus('trip_started');
      Alert.alert('Trip Started', 'Your trip has begun!');
    };

    const handleTripCompleted = (data) => {
      console.log('✅ Trip completed:', data);
      setTripStatus('trip_completed');
      setDriverData(null);
      setDriverLocation(null);
      Alert.alert(
        'Trip Completed',
        `Trip completed successfully! Fare: ₦${data?.fare || estimatedFare || '—'}`,
        [
          {
            text: 'Rate Driver',
            onPress: () =>
              navigation.navigate('RateDriver', { tripId: data?.tripId }),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    };

    const handleTripCancelledByDriver = (data) => {
      console.log('❌ Driver cancelled trip:', data);
      setTripStatus(null);
      setDriverData(null);
      setDriverLocation(null);
      Alert.alert('Trip Cancelled', 'The driver has cancelled the trip.');
    };

    const handleTripCancelledByPassenger = () => {
      console.log('❌ Passenger cancelled trip');
      setTripStatus(null);
      setDriverData(null);
      setDriverLocation(null);
    };

    addListener('trip:accepted', handleTripAccepted);
    addListener('trip:driver_location', handleDriverLocation);
    addListener('trip:started', handleTripStarted);
    addListener('trip:completed', handleTripCompleted);
    addListener('trip:cancelled_by_driver', handleTripCancelledByDriver);
    addListener('trip:cancelled_by_passenger', handleTripCancelledByPassenger);

    return () => {
      console.log('Cleaning up trip event listeners...');
      removeListener('trip:accepted', handleTripAccepted);
      removeListener('trip:driver_location', handleDriverLocation);
      removeListener('trip:started', handleTripStarted);
      removeListener('trip:completed', handleTripCompleted);
      removeListener('trip:cancelled_by_driver', handleTripCancelledByDriver);
      removeListener('trip:cancelled_by_passenger', handleTripCancelledByPassenger);
    };
  }, [wsReady, currentLocation, isMapReady, navigation, estimatedFare]);

  // ────────────────────────────────────────────────
  //  LOCATION & MAP INITIALIZATION
  // ────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is required.');
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isMounted) return;

        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };

        setCurrentLocation(region);
        setPickupLocation(region);
        await reverseGeocodeGoogle(region, true);

        setLoading(false);
      } catch (error) {
        console.error('Location error:', error);
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isMapReady && currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(currentLocation, 1000);
    }
  }, [isMapReady, currentLocation]);

  // ────────────────────────────────────────────────
  //  GOOGLE SERVICES (unchanged)
  // ────────────────────────────────────────────────

  const reverseGeocodeGoogle = async (coords, isPickup = false) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        if (isPickup) setPickupAddress(address);
        else setDropoffAddress(address);
      }
    } catch (err) {
      console.error('Google Geocode Error:', err);
    }
  };

  const fetchGoogleRoute = async (origin, destination) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_API_KEY}&mode=driving`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const points = decodePolyline(route.overview_polyline.points);
        const distanceInKm = leg.distance.value / 1000;
        const durationInSec = leg.duration.value;

        return {
          coordinates: points,
          distance: distanceInKm,
          duration: durationInSec,
        };
      }
      return null;
    } catch (error) {
      console.error('Route API Error:', error);
      return null;
    }
  };

  const decodePolyline = (encoded) => {
    const points = [];
    let index = 0,
      len = encoded.length;
    let lat = 0,
      lng = 0;

    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      let dlat = (result & 1) ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      let dlng = (result & 1) ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  const displayRoute = async (origin, destination) => {
    if (!origin || !destination) return;
    setLoading(true);

    const routeData = await fetchGoogleRoute(origin, destination);
    if (routeData) {
      setRouteCoords(routeData.coordinates);
      setRouteDistance(routeData.distance);
      setRouteDuration(routeData.duration);

      const ride = RIDE_TYPES.find((r) => r.id === selectedRideType);
      const fare = Math.round(500 + routeData.distance * 150 * ride.multiplier);
      setEstimatedFare(fare);

      if (mapRef.current && isMapReady) {
        mapRef.current.fitToCoordinates(routeData.coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 400, left: 100 },
          animated: true,
        });
      }
    }
    setLoading(false);
  };

  // ────────────────────────────────────────────────
  //  USER ACTIONS
  // ────────────────────────────────────────────────

  const goToSearchDestination = () => {
    navigation.navigate('SearchDestination', {
      onSelect: (coords, address) => {
        setDropoffLocation(coords);
        setDropoffAddress(address);
        if (pickupLocation) {
          displayRoute(pickupLocation, coords);
        }
      },
    });
  };

  const selectRide = (rideId) => {
    setSelectedRideType(rideId);
    setShowRideModal(false);

    if (routeDistance > 0) {
      const ride = RIDE_TYPES.find((r) => r.id === rideId);
      const fare = Math.round(500 + routeDistance * 150 * ride.multiplier);
      setEstimatedFare(fare);
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  const cancelTrip = useCallback(() => {
    if (driverData?.tripId && wsReady) {
      sendWS({ type: 'trip:cancel', tripId: driverData.tripId });
      setTripStatus(null);
      setDriverData(null);
      setDriverLocation(null);
    } else {
      Alert.alert('Error', 'Cannot cancel — not connected');
    }
  }, [driverData, wsReady]);

  const handleManualReconnect = useCallback(async () => {
    try {
      Alert.alert('Reconnecting', 'Attempting to reconnect...');
      await initWebSocket();
      setWsReady(isWebSocketConnected());

      if (isWebSocketConnected()) {
        Alert.alert('Success', 'Reconnected to server.');
      } else {
        Alert.alert('Failed', 'Could not reconnect.');
      }
    } catch (err) {
      Alert.alert('Error', 'Reconnection failed.');
    }
  }, []);

  const getSocketStatusText = () => {
    if (wsReady) return 'Connected';
    if (connectionAttempts > 0) return `Connecting... (${connectionAttempts})`;
    return 'Disconnected';
  };

  const getSocketStatusColor = () => {
    if (wsReady) return '#4ADE80';
    if (connectionAttempts > 0) return '#F59E0B';
    return '#F43F5E';
  };

  if (!currentLocation) {
    return (
      <View style={styles.loadingContainer}>
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
        initialRegion={currentLocation}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onMapReady={() => setIsMapReady(true)}
      >
        {pickupLocation && (
          <Marker coordinate={pickupLocation}>
            <View style={styles.pickupMarker}>
              <Ionicons name="location" size={30} color="white" />
            </View>
          </Marker>
        )}

        {dropoffLocation && (
          <Marker coordinate={dropoffLocation}>
            <View style={styles.dropoffMarker}>
              <Ionicons name="flag" size={30} color="white" />
            </View>
          </Marker>
        )}

        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={30} color="white" />
            </View>
          </Marker>
        )}

        {routeCoords.length > 0 && (
          <>
            <Polyline coordinates={routeCoords} strokeColor="#000" strokeWidth={6} />
            <Polyline coordinates={routeCoords} strokeColor="#00B0F3" strokeWidth={4} />
          </>
        )}
      </MapView>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={32} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={() => {
            if (isMapReady && currentLocation) {
              mapRef.current?.animateToRegion(currentLocation, 1000);
            }
          }}
        >
          <Ionicons name="locate" size={28} color="#00B0F3" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-circle" size={36} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Socket Status (debug only) */}
      {__DEV__ && (
        <TouchableOpacity style={styles.socketStatus} onPress={handleManualReconnect}>
          <View style={styles.socketStatusContent}>
            <View style={[styles.socketIndicator, { backgroundColor: getSocketStatusColor() }]} />
            <Text style={styles.socketStatusText}>{getSocketStatusText()}</Text>
            {connectionAttempts > 0 && (
              <ActivityIndicator size="small" color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Active Trip Overlay */}
      {tripStatus && (
        <View style={styles.tripStatusCard}>
          <View style={styles.tripStatusHeader}>
            <Ionicons
              name={tripStatus === 'driver_nearby' ? 'car' : 'checkmark-circle'}
              size={24}
              color="#00B0F3"
            />
            <Text style={styles.tripStatusText}>
              {tripStatus === 'driver_nearby' ? 'Driver on the way' : 'Trip in progress'}
            </Text>
          </View>

          {driverData && (
            <>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="person" size={30} color="#666" />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{driverData.driverName}</Text>
                  <Text style={styles.vehicleInfo}>
                    {driverData.vehicleModel} • {driverData.vehiclePlate}
                  </Text>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>{driverData.rating}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.cancelTripButton} onPress={cancelTrip}>
                <Text style={styles.cancelTripText}>Cancel Trip</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Search Card - shown when no active trip */}
      {!tripStatus && (
        <View style={styles.searchCard}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={22} color="#00B0F3" />
            <Text style={styles.addressText} numberOfLines={1}>
              {pickupAddress}
            </Text>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.locationRow} onPress={goToSearchDestination}>
            <Ionicons name="flag" size={22} color="#FF4444" />
            <Text style={[styles.addressText, !dropoffAddress && styles.placeholder]}>
              {dropoffAddress || 'Where to?'}
            </Text>

            {dropoffAddress && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setDropoffLocation(null);
                  setDropoffAddress('');
                  setRouteCoords([]);
                  setEstimatedFare(null);
                }}
              >
                <Ionicons name="close-circle" size={18} color="#FF4444" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {routeDistance > 0 && (
            <View style={styles.routeInfo}>
              <Text style={styles.routeInfoText}>
                {routeDistance.toFixed(1)} km • {formatDuration(routeDuration)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Ride Type Modal */}
      <Modal visible={showRideModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a ride</Text>
              <TouchableOpacity onPress={() => setShowRideModal(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={RIDE_TYPES}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.rideOption,
                    selectedRideType === item.id && styles.selectedOption,
                  ]}
                  onPress={() => selectRide(item.id)}
                >
                  <View style={styles.rideOptionLeft}>
                    <View style={[styles.rideIconLarge, { backgroundColor: item.color }]}>
                      <Ionicons name={item.icon} size={32} color="white" />
                    </View>
                    <View>
                      <Text style={styles.rideOptionName}>{item.name}</Text>
                      <Text style={styles.rideOptionEta}>{item.eta}</Text>
                    </View>
                  </View>
                  <Text style={styles.rideOptionPrice}>
                    ₦
                    {estimatedFare
                      ? Math.round(
                          (estimatedFare * item.multiplier) /
                            RIDE_TYPES.find((r) => r.id === selectedRideType).multiplier
                        ).toLocaleString()
                      : '--'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Bottom Panel - shown when destination selected and no active trip */}
      {!tripStatus && dropoffLocation && estimatedFare && (
        <View style={styles.bottomPanel}>
          <TouchableOpacity style={styles.rideSelector} onPress={() => setShowRideModal(true)}>
            <View style={styles.rideLeft}>
              <View
                style={[
                  styles.rideIcon,
                  { backgroundColor: RIDE_TYPES.find((r) => r.id === selectedRideType)?.color },
                ]}
              >
                <Ionicons
                  name={RIDE_TYPES.find((r) => r.id === selectedRideType)?.icon}
                  size={28}
                  color="white"
                />
              </View>
              <View>
                <Text style={styles.rideName}>
                  {RIDE_TYPES.find((r) => r.id === selectedRideType)?.name}
                </Text>
                <Text style={styles.rideEta}>
                  {RIDE_TYPES.find((r) => r.id === selectedRideType)?.eta}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={24} color="#666" />
          </TouchableOpacity>

          <View style={styles.requestArea}>
            <View>
              <Text style={styles.fare}>₦{estimatedFare.toLocaleString()}</Text>
              <Text style={styles.distanceText}>Approximate fare</Text>
            </View>

            <TouchableOpacity
              style={styles.requestBtn}
              onPress={() => {
                navigation.navigate('DriverMatching', {
                  pickup: pickupLocation,
                  dropoff: dropoffLocation,
                  pickupAddress,
                  dropoffAddress,
                  serviceType: selectedRideType,
                  estimatedFare,
                  distance: routeDistance,
                  duration: routeDuration,
                });
              }}
            >
              <Text style={styles.requestText}>Request Ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Styles remain unchanged from your original version
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  menuButton: { backgroundColor: 'white', borderRadius: 30, padding: 8, elevation: 5 },
  currentLocationButton: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 8,
    elevation: 5,
  },
  profileButton: { backgroundColor: 'white', borderRadius: 30, padding: 4, elevation: 5 },

  // Socket Status (debug)
  socketStatus: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 90,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },
  socketStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socketIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  socketStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 6,
  },
  connectionIndicator: { marginLeft: 4 },

  // Trip Status Card
  tripStatusCard: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 5,
  },
  tripStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00B0F3',
    marginLeft: 8,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverDetails: { flex: 1 },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  ratingContainer: { flexDirection: 'row', alignItems: 'center' },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  cancelTripButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelTripText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },

  // Markers
  driverMarker: {
    backgroundColor: '#00B0F3',
    padding: 8,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'white',
    transform: [{ rotate: '45deg' }],
  },

  // Search Card
  searchCard: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  addressText: { marginLeft: 12, fontSize: 16, color: '#000', flex: 1 },
  placeholder: { color: '#999', fontStyle: 'italic' },
  clearButton: { marginLeft: 8, padding: 4 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  routeInfo: {
    borderTopWidth: 1,
    borderColor: '#eee',
    marginTop: 8,
    paddingTop: 8,
  },
  routeInfoText: { fontSize: 14, color: '#666', fontWeight: '500' },

  // Bottom Panel
  bottomPanel: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    elevation: 12,
  },
  rideSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  rideLeft: { flexDirection: 'row', alignItems: 'center' },
  rideIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  rideName: { fontSize: 16, fontWeight: '700', marginLeft: 12 },
  rideEta: { fontSize: 12, color: '#666', marginLeft: 12 },
  requestArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fare: { fontSize: 24, fontWeight: '800' },
  distanceText: { fontSize: 12, color: '#666' },
  requestBtn: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  requestText: { color: 'white', fontWeight: '700', fontSize: 16 },

  // Ride Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: height * 0.7 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  rideOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  selectedOption: { backgroundColor: '#F0F9FF' },
  rideOptionLeft: { flexDirection: 'row', alignItems: 'center' },
  rideIconLarge: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  rideOptionName: { fontSize: 16, fontWeight: '600', marginLeft: 12 },
  rideOptionEta: { fontSize: 12, color: '#666', marginLeft: 12 },
  rideOptionPrice: { fontSize: 16, fontWeight: '700' },

  // Markers
  pickupMarker: {
    backgroundColor: '#00B0F3',
    padding: 8,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'white',
  },
  dropoffMarker: {
    backgroundColor: '#FF4444',
    padding: 8,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'white',
  },
});