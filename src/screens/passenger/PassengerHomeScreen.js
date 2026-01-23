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
  TextInput,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';

// Check if BlurView is available (it's only on iOS)
let BlurView;
try {
  BlurView = require('@react-native-community/blur').BlurView;
} catch {
  BlurView = View; // Fallback for Android or when not available
}

// Import WebSocket functions - make sure they exist
import {
  initWebSocket,
  sendWS,
  addListener,
  removeListener,
  isWebSocketConnected,
} from '../../utils/socket';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const GOOGLE_API_KEY = 'AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo';

const RIDE_TYPES = [
  { id: 'CITY_RIDE', name: 'City Ride', icon: 'car-sport', color: '#00B0F3', multiplier: 2.3, eta: '~3 min' },
  { id: 'DELIVERY_BIKE', name: 'Bike', icon: 'bicycle', color: '#4ADE80', multiplier: 0.8, eta: '~2 min' },
  { id: 'LUXURY_RENTAL', name: 'Luxury', icon: 'diamond', color: '#F43F5E', multiplier: 3.5, eta: '~8 min' },
  { id: 'KEKE', name: 'Keke', icon: 'triangle', color: '#EC4899', multiplier: 0.6, eta: '~4 min' },
];

export default function PassengerHomeScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);

  // States
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
  const [tripStatus, setTripStatus] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [wsReady, setWsReady] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [showWsLoader, setShowWsLoader] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [showPickupSearch, setShowPickupSearch] = useState(false);
  const [pickupSearchQuery, setPickupSearchQuery] = useState('');
  const [pickupSearchResults, setPickupSearchResults] = useState([]);
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);

  // Initialize location
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

  // Center map when location updates
  useEffect(() => {
    if (isMapReady && currentLocation && mapRef.current) {
      mapRef.current.animateToRegion(currentLocation, 1000);
    }
  }, [isMapReady, currentLocation]);

  // Initialize WebSocket
  useEffect(() => {
    let mounted = true;
    let reconnectTimeout = null;

    const initializeWebSocket = async () => {
      try {
        console.log('Initializing WebSocket connection...');
        
        if (isWebSocketConnected()) {
          console.log('WebSocket already connected');
          if (mounted) {
            setWsReady(true);
            setShowWsLoader(false);
          }
          return;
        }

        await initWebSocket();
        
        if (mounted) {
          setWsReady(isWebSocketConnected());
          setTimeout(() => {
            if (mounted) setShowWsLoader(false);
          }, 2000);
        }
      } catch (error) {
        console.error('WebSocket init error:', error);
        if (mounted) {
          setWsReady(false);
          const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
          reconnectTimeout = setTimeout(() => {
            if (mounted) {
              setConnectionAttempts(prev => prev + 1);
              initializeWebSocket();
            }
          }, delay);
        }
      }
    };

    initializeWebSocket();

    const handleConnect = () => {
      console.log('✅ WebSocket connected');
      if (mounted) {
        setWsReady(true);
        setConnectionAttempts(0);
        setTimeout(() => {
          if (mounted) setShowWsLoader(false);
        }, 1000);
      }
    };

    const handleDisconnect = () => {
      console.log('🔌 WebSocket disconnected');
      if (mounted) {
        setWsReady(false);
        setShowWsLoader(true);
      }
    };

    addListener('connect', handleConnect);
    addListener('disconnect', handleDisconnect);

    return () => {
      mounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      removeListener('connect', handleConnect);
      removeListener('disconnect', handleDisconnect);
    };
  }, []);

  // Trip event listeners
  useEffect(() => {
    if (!wsReady) return;

    const handleTripAccepted = (data) => {
      console.log('Driver accepted trip:', data);
      setDriverData(data);
      setTripStatus('driver_nearby');
    };

    const handleDriverLocation = (data) => {
      console.log('Driver location update:', data);
      if (data.driverLocation) {
        setDriverLocation(data.driverLocation);
      }
    };

    const handleTripStarted = () => {
      setTripStatus('trip_started');
    };

    const handleTripCompleted = (data) => {
      setTripStatus('trip_completed');
      setDriverData(null);
      setDriverLocation(null);
    };

    addListener('trip:accepted', handleTripAccepted);
    addListener('trip:driver_location', handleDriverLocation);
    addListener('trip:started', handleTripStarted);
    addListener('trip:completed', handleTripCompleted);

    return () => {
      removeListener('trip:accepted', handleTripAccepted);
      removeListener('trip:driver_location', handleDriverLocation);
      removeListener('trip:started', handleTripStarted);
      removeListener('trip:completed', handleTripCompleted);
    };
  }, [wsReady]);

  // Google services
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
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
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

      // Fit map to show route
      if (mapRef.current && isMapReady) {
        mapRef.current.fitToCoordinates(routeData.coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 300, left: 100 },
          animated: true,
        });
      }
    }
    setLoading(false);
  };

  // Pickup location search
  const searchPickupLocation = async (text) => {
    setPickupSearchQuery(text);
    
    if (text.trim().length < 2) {
      setPickupSearchResults([]);
      return;
    }

    setPickupSearchLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        text
      )}&key=${GOOGLE_API_KEY}&components=country:ng`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.status === 'OK') {
        setPickupSearchResults(data.predictions);
      } else {
        setPickupSearchResults([]);
      }
    } catch (err) {
      console.error('Pickup search error:', err);
      setPickupSearchResults([]);
    } finally {
      setPickupSearchLoading(false);
    }
  };

  const selectPickupLocation = async (item) => {
    try {
      setPickupSearchLoading(true);
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=geometry,name,formatted_address&key=${GOOGLE_API_KEY}`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK') {
        const { lat, lng } = data.result.geometry.location;
        const address = data.result.formatted_address || item.description;
        
        const coords = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };

        setPickupLocation(coords);
        setPickupAddress(address);
        setShowPickupSearch(false);
        
        // Center map on new pickup location
        if (mapRef.current) {
          mapRef.current.animateToRegion(coords, 1000);
        }
        
        // Recalculate route if dropoff exists
        if (dropoffLocation) {
          displayRoute(coords, dropoffLocation);
        }
      }
    } catch (err) {
      console.error('Error selecting pickup:', err);
      Alert.alert('Error', 'Failed to select location');
    } finally {
      setPickupSearchLoading(false);
    }
  };

  // Navigation functions
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
      Alert.alert('Cancel Trip', 'Are you sure you want to cancel this trip?', [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => {
          // Implement cancellation logic
          sendWS({ type: 'trip:cancel', tripId: driverData.tripId });
          setTripStatus(null);
          setDriverData(null);
          setDriverLocation(null);
        }},
      ]);
    }
  }, [driverData, wsReady]);

  const handleManualReconnect = useCallback(async () => {
    try {
      await initWebSocket();
    } catch (err) {
      Alert.alert('Error', 'Reconnection failed.');
    }
  }, []);

  // Get selected ride details
  const selectedRide = RIDE_TYPES.find(r => r.id === selectedRideType) || RIDE_TYPES[0];

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
              <Ionicons name="location" size={24} color="white" />
            </View>
          </Marker>
        )}

        {dropoffLocation && (
          <Marker coordinate={dropoffLocation}>
            <View style={styles.dropoffMarker}>
              <Ionicons name="flag" size={24} color="white" />
            </View>
          </Marker>
        )}

        {driverLocation && (
          <Marker coordinate={driverLocation}>
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={24} color="white" />
            </View>
          </Marker>
        )}

        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#00B0F3" strokeWidth={4} />
        )}
      </MapView>

      {/* WebSocket Loader */}
      {showWsLoader && (
        <View style={styles.wsLoaderOverlay}>
          <View style={styles.wsLoaderContainer}>
            <ActivityIndicator size="large" color="#00B0F3" />
            <Text style={styles.wsLoaderText}>Connecting to Server...</Text>
            <Text style={styles.wsLoaderSubtext}>
              Please wait while we establish connection
            </Text>
            {connectionAttempts > 0 && (
              <Text style={styles.wsLoaderAttempts}>
                Attempt {connectionAttempts}...
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={24} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={() => {
            if (currentLocation) {
              mapRef.current?.animateToRegion(currentLocation, 1000);
            }
          }}
        >
          <Ionicons name="locate" size={24} color="#00B0F3" />
        </TouchableOpacity>
      </View>

      {/* Pickup Search Modal */}
      {showPickupSearch && (
        <View style={styles.pickupSearchOverlay}>
          <View style={styles.pickupSearchContainer}>
            <View style={styles.pickupSearchHeader}>
              <TouchableOpacity
                style={styles.pickupSearchBack}
                onPress={() => setShowPickupSearch(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <TextInput
                style={styles.pickupSearchInput}
                placeholder="Search pickup location..."
                value={pickupSearchQuery}
                onChangeText={searchPickupLocation}
                autoFocus
              />
            </View>

            {pickupSearchLoading && (
              <View style={styles.pickupSearchLoading}>
                <ActivityIndicator size="small" color="#00B0F3" />
                <Text style={styles.pickupSearchLoadingText}>Searching...</Text>
              </View>
            )}

            <FlatList
              data={pickupSearchResults}
              keyExtractor={(item) => item.place_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickupSearchItem}
                  onPress={() => selectPickupLocation(item)}
                >
                  <Ionicons name="location-outline" size={20} color="#666" />
                  <View style={styles.pickupSearchItemText}>
                    <Text style={styles.pickupSearchItemMain}>
                      {item.structured_formatting?.main_text || item.description}
                    </Text>
                    <Text style={styles.pickupSearchItemSub}>
                      {item.structured_formatting?.secondary_text || ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}

      {/* Search Card */}
      {!tripStatus && (
        <View style={styles.searchCard}>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => setShowPickupSearch(true)}
          >
            <Ionicons name="location" size={20} color="#00B0F3" />
            <View style={styles.addressContainer}>
              <Text style={styles.addressText} numberOfLines={1}>
                {pickupAddress}
              </Text>
            </View>
            <Ionicons name="search" size={16} color="#666" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.locationRow} onPress={goToSearchDestination}>
            <Ionicons name="flag" size={20} color="#FF4444" />
            <View style={styles.addressContainer}>
              <Text style={[styles.addressText, !dropoffAddress && styles.placeholder]}>
                {dropoffAddress || 'Where to?'}
              </Text>
            </View>
          </TouchableOpacity>
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

      {/* Bottom Panel */}
      {!tripStatus && dropoffLocation && estimatedFare && (
        <View style={styles.bottomPanel}>
          {/* Ride Type Selector */}
          <TouchableOpacity 
            style={styles.rideSelector} 
            onPress={() => setShowRideModal(true)}
          >
            <View style={styles.rideLeft}>
              <View
                style={[
                  styles.rideIcon,
                  { backgroundColor: selectedRide.color },
                ]}
              >
                <Ionicons
                  name={selectedRide.icon}
                  size={28}
                  color="white"
                />
              </View>
              <View style={styles.rideInfo}>
                <Text style={styles.rideName}>{selectedRide.name}</Text>
                <Text style={styles.rideEta}>{selectedRide.eta}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={24} color="#666" />
          </TouchableOpacity>

          <View style={styles.requestArea}>
            <View>
              <Text style={styles.fare}>₦{estimatedFare?.toLocaleString()}</Text>
              <Text style={styles.distanceText}>Approximate fare</Text>
            </View>

            <TouchableOpacity
              style={[styles.requestBtn, !wsReady && styles.requestBtnDisabled]}
              onPress={() => {
                if (!wsReady) {
                  Alert.alert('Connection Error', 'Please wait for connection');
                  return;
                }
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
              disabled={!wsReady}
            >
              <Text style={styles.requestText}>
                {wsReady ? 'Request Ride' : 'Connecting...'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trip Status Overlay */}
      {tripStatus && driverData && (
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

          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={30} color="#666" />
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverData.driverName || 'Driver'}</Text>
              <Text style={styles.vehicleInfo}>
                {driverData.vehicleModel || 'Car'} • {driverData.vehiclePlate || 'ABC-123'}
              </Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>{driverData.rating || '4.8'}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.cancelTripButton} onPress={cancelTrip}>
            <Text style={styles.cancelTripText}>Cancel Trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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
  
  // WebSocket Loader
  wsLoaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  wsLoaderContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  wsLoaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00B0F3',
    marginTop: 16,
  },
  wsLoaderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  wsLoaderAttempts: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
  },
  
  // Top Bar
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
  menuButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  currentLocationButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  // Pickup Search
  pickupSearchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    zIndex: 90,
  },
  pickupSearchContainer: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 40,
  },
  pickupSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  pickupSearchBack: {
    padding: 8,
    marginRight: 8,
  },
  pickupSearchInput: {
    flex: 1,
    fontSize: 16,
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  pickupSearchLoading: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  pickupSearchLoadingText: {
    marginLeft: 12,
    color: '#666',
  },
  pickupSearchItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
  },
  pickupSearchItemText: {
    marginLeft: 12,
    flex: 1,
  },
  pickupSearchItemMain: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  pickupSearchItemSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  
  // Search Card
  searchCard: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  addressContainer: {
    flex: 1,
    marginLeft: 12,
  },
  addressText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  placeholder: {
    color: '#999',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  
  // Bottom Panel
  bottomPanel: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
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
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideInfo: {
    marginLeft: 12,
  },
  rideName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  rideEta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  requestArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fare: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  distanceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  requestBtn: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
  },
  requestBtnDisabled: {
    backgroundColor: '#ccc',
  },
  requestText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Ride Type Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  rideOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#F0F9FF',
  },
  rideOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    color: '#000',
  },
  rideOptionEta: {
    fontSize: 12,
    color: '#666',
    marginLeft: 12,
    marginTop: 2,
  },
  rideOptionPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  
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
    shadowOffset: { width: 0, height: 4 },
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
  driverDetails: {
    flex: 1,
  },
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  pickupMarker: {
    backgroundColor: '#00B0F3',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dropoffMarker: {
    backgroundColor: '#FF4444',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  driverMarker: {
    backgroundColor: '#4ADE80',
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ rotate: '45deg' }],
  },
});