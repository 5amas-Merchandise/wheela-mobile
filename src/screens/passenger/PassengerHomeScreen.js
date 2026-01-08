// src/screens/passenger/PassengerHomeScreen.js
import React, { useEffect, useState, useRef } from 'react';
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

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// Replace with your LocationIQ API key
const LOCATIONIQ_API_KEY = 'pk.b84a833d23e60c83f10a0b59524191b6';

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
  const [routeDistance, setRouteDistance] = useState(0); // in km
  const [routeDuration, setRouteDuration] = useState(0); // in seconds

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };

      setCurrentLocation(region);
      setPickupLocation(region);
      await reverseGeocode(region, true);
      setLoading(false);
      mapRef.current?.animateToRegion(region, 1000);
    })();
  }, []);

  const reverseGeocode = async (coords, isPickup = false) => {
    try {
      const addresses = await Location.reverseGeocodeAsync(coords);
      if (addresses.length > 0) {
        const addr = addresses[0];
        const fullAddress = [addr.street || addr.name, addr.city || addr.subregion, addr.region]
          .filter(Boolean)
          .join(', ') || 'Current Location';
        if (isPickup) setPickupAddress(fullAddress);
        else setDropoffAddress(fullAddress);
      }
    } catch (err) {
      if (isPickup) setPickupAddress('Current Location');
    }
  };

  // Fetch route from LocationIQ
  const fetchLocationIQRoute = async (origin, destination) => {
    try {
      const url = `https://us1.locationiq.com/v1/directions/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?key=${LOCATIONIQ_API_KEY}&steps=true&alternatives=false&geometries=polyline&overview=full`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Decode polyline
        const coordinates = decodePolyline(route.geometry);
        
        // Get distance (in meters) and duration (in seconds)
        const distanceInKm = route.distance / 1000;
        const durationInSec = route.duration;

        return {
          coordinates,
          distance: distanceInKm,
          duration: durationInSec,
        };
      } else {
        throw new Error('No route found');
      }
    } catch (error) {
      console.error('LocationIQ API Error:', error);
      Alert.alert('Route Error', 'Could not fetch route. Please try again.');
      return null;
    }
  };

  // Decode polyline (Google's polyline encoding algorithm)
  const decodePolyline = (encoded) => {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  const displayRoute = async (origin, destination) => {
    if (!origin || !destination) return;

    // Show loading indicator
    setLoading(true);

    const routeData = await fetchLocationIQRoute(origin, destination);

    if (routeData) {
      setRouteCoords(routeData.coordinates);
      setRouteDistance(routeData.distance);
      setRouteDuration(routeData.duration);

      // Calculate fare based on actual road distance
      const ride = RIDE_TYPES.find((r) => r.id === selectedRideType);
      const fare = Math.round(500 + routeData.distance * 150 * ride.multiplier);
      setEstimatedFare(fare);

      // Fit map to show entire route
      mapRef.current?.fitToCoordinates(routeData.coordinates, {
        edgePadding: { top: 100, right: 100, bottom: 400, left: 100 },
        animated: true,
      });
    }

    setLoading(false);
  };

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

  // Format duration for display
  const formatDuration = (seconds) => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  if (loading && !currentLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00B0F3" />
        <Text style={styles.loadingText}>Getting your location...</Text>
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
      >
        {/* Pickup Marker */}
        {pickupLocation && (
          <Marker coordinate={pickupLocation}>
            <View style={styles.pickupMarker}>
              <Ionicons name="location" size={30} color="white" />
            </View>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {dropoffLocation && (
          <Marker coordinate={dropoffLocation}>
            <View style={styles.dropoffMarker}>
              <Ionicons name="flag" size={30} color="white" />
            </View>
          </Marker>
        )}

        {/* Road-Following Polyline from LocationIQ */}
        {routeCoords.length > 0 && (
          <>
            {/* Subtle shadow underneath for depth */}
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(0,0,0,0.2)"
              strokeWidth={8}
              lineCap="round"
              lineJoin="round"
            />
            {/* Main vibrant blue route on top */}
            <Polyline
              coordinates={routeCoords}
              strokeColor="#00B0F3"
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}
      </MapView>

      {/* Loading overlay when fetching route */}
      {loading && currentLocation && (
        <View style={styles.routeLoadingOverlay}>
          <ActivityIndicator size="large" color="#00B0F3" />
          <Text style={styles.routeLoadingText}>Finding best route...</Text>
        </View>
      )}

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
          onPress={() => currentLocation && mapRef.current?.animateToRegion(currentLocation, 1000)}
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

      {/* Search Card */}
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
                setRouteDistance(0);
                setRouteDuration(0);
              }}
            >
              <Ionicons name="close-circle" size={18} color="#FF4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Route Info */}
        {routeDistance > 0 && (
          <View style={styles.routeInfo}>
            <View style={styles.routeInfoItem}>
              <Ionicons name="navigate" size={16} color="#666" />
              <Text style={styles.routeInfoText}>
                {routeDistance.toFixed(1)} km
              </Text>
            </View>
            <View style={styles.routeInfoItem}>
              <Ionicons name="time" size={16} color="#666" />
              <Text style={styles.routeInfoText}>
                {formatDuration(routeDuration)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Panel - Only when destination selected */}
      {dropoffLocation && estimatedFare && (
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
              onPress={() =>
                navigation.navigate('DriverMatching', {
                  pickup: pickupLocation,
                  dropoff: dropoffLocation,
                  pickupAddress,
                  dropoffAddress,
                  serviceType: selectedRideType,
                  estimatedFare,
                  distance: routeDistance,
                  duration: routeDuration,
                })
              }
            >
              <Text style={styles.requestText}>Request Ride</Text>
            </TouchableOpacity>
          </View>
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
                          estimatedFare *
                            item.multiplier /
                            RIDE_TYPES.find((r) => r.id === selectedRideType)?.multiplier
                        ).toLocaleString()
                      : '---'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Instructions Tooltip */}
      {!dropoffLocation && (
        <View style={styles.instructionsTooltip}>
          <Ionicons name="information-circle" size={20} color="#00B0F3" />
          <Text style={styles.instructionsText}>
            Tap "Where to?" to set destination
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  routeLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  routeLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  menuButton: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  currentLocationButton: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  profileButton: {
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  searchCard: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  addressText: {
    marginLeft: 12,
    fontSize: 17,
    color: '#000',
    flex: 1,
  },
  placeholder: {
    color: '#999',
    fontStyle: 'italic',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  routeInfo: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 20,
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeInfoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 12,
  },
  rideSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  rideName: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    color: '#000',
  },
  rideEta: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  requestArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fare: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
  },
  distanceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  requestBtn: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#00B0F3',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  requestText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
  },
  pickupMarker: {
    backgroundColor: '#00B0F3',
    padding: 12,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  dropoffMarker: {
    backgroundColor: '#FF4444',
    padding: 12,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
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
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  rideOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedOption: {
    backgroundColor: '#F0F9FF',
  },
  rideOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  rideOptionName: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
    color: '#000',
  },
  rideOptionEta: {
    fontSize: 14,
    color: '#666',
    marginLeft: 16,
  },
  rideOptionPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  instructionsTooltip: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  instructionsText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
});