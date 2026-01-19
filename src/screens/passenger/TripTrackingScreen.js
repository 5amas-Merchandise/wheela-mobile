// src/screens/passenger/TripTrackingScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');
const baseUrl = 'https://wheels-backend.vercel.app';
const GOOGLE_MAPS_API_KEY = 'AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo';

export default function TripTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);

  const {
    tripId,
    driverId,
    passengerName = 'Passenger',
    passengerPhone = '',
    serviceType = 'CITY_RIDE',
    fare = 0,
    pickup,
    destination,
    pickupAddress = 'Pickup location',
    destinationAddress = 'Destination',
    driverName = 'Driver',
    driverPhone = '',
    driverRating = '4.8',
    vehicleModel = 'Toyota Camry',
    vehiclePlate = 'ABC-123',
    paymentMethod = 'wallet',
  } = route.params || {};

  // Trip states
  const [tripPhase, setTripPhase] = useState('pickup'); // 'pickup' or 'in_progress'
  const [tripStatus, setTripStatus] = useState('assigned');
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  
  // Location states
  const [driverLocation, setDriverLocation] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropoffCoord, setDropoffCoord] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  
  // Trip metrics
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [timeToTarget, setTimeToTarget] = useState(null);
  const [tripValid, setTripValid] = useState(true);
  const [timer, setTimer] = useState(0);
  
  // Driver details from backend
  const [driverDetails, setDriverDetails] = useState({
    name: driverName,
    phone: driverPhone,
    rating: driverRating,
    vehicleModel: vehicleModel,
    vehiclePlate: vehiclePlate,
    profilePicUrl: null,
  });

  // Guard against missing tripId
  if (!tripId) {
    console.error('❌ Missing tripId:', route.params);
    Alert.alert(
      'Invalid Trip Data',
      'Unable to load trip information.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
    return null;
  }

  // Poll trip status and driver details
  useEffect(() => {
    if (!tripId || !tripValid) return;

    const pollTripStatus = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch(`${baseUrl}/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.trip) {
            const trip = data.trip;
            setTripStatus(trip.status);

            // Update trip phase based on status
            if (trip.status === 'started' || trip.status === 'in_progress') {
              setTripPhase('in_progress');
            }

            // Fetch driver details if we have driverId
            if (trip.driverId && driverId) {
              fetchDriverDetails(trip.driverId);
            }

            // Handle trip end states
            if (trip.status === 'completed') {
              console.log(`✅ Trip ${tripId} completed, navigating to completion screen`);
              setTripValid(false);
              
              // Calculate trip duration
              const startTime = trip.startedAt ? new Date(trip.startedAt) : new Date(trip.requestedAt);
              const endTime = trip.completedAt ? new Date(trip.completedAt) : new Date();
              const tripDuration = Math.floor((endTime - startTime) / 1000); // in seconds

              setTimeout(() => {
                navigation.replace('TripCompleted', {
                  tripId,
                  driverId: trip.driverId || driverId,
                  driverName: driverDetails.name,
                  driverRating: driverDetails.rating,
                  vehicleModel: driverDetails.vehicleModel,
                  vehiclePlate: driverDetails.vehiclePlate,
                  fare: trip.finalFare || trip.estimatedFare || fare,
                  serviceType: trip.serviceType || serviceType,
                  paymentMethod: trip.paymentMethod || paymentMethod,
                  tripDuration: tripDuration,
                  pickupAddress: trip.pickupLocation ? pickupAddress : '',
                  destinationAddress: trip.dropoffLocation ? destinationAddress : '',
                  distanceKm: trip.distanceKm || 0,
                });
              }, 1000);
            } else if (trip.status === 'cancelled') {
              Alert.alert(
                'Trip Cancelled',
                'This trip has been cancelled.',
                [{ 
                  text: 'OK', 
                  onPress: () => navigation.navigate('PassengerMain')
                }]
              );
              setTripValid(false);
            }
          }
        } else if (response.status === 404) {
          console.log(`❌ Trip ${tripId} not found`);
          Alert.alert(
            'Trip Not Found',
            'This trip is no longer available.',
            [{ text: 'OK', onPress: () => navigation.navigate('PassengerMain') }]
          );
          setTripValid(false);
        }
      } catch (error) {
        console.warn('⚠️ Trip status polling error:', error);
      }
    };

    pollTripStatus();
    const intervalId = setInterval(pollTripStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(intervalId);
  }, [tripId, tripValid]);

  // Fetch driver details
  const fetchDriverDetails = async (driverIdParam) => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(`${baseUrl}/users/${driverIdParam || driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setDriverDetails({
            name: data.user.name || driverName,
            phone: data.user.phone || driverPhone,
            rating: data.user.driverProfile?.rating || driverRating,
            vehicleModel: data.user.driverProfile?.vehicleModel || vehicleModel,
            vehiclePlate: data.user.driverProfile?.vehicleNumber || vehiclePlate,
            profilePicUrl: data.user.driverProfile?.profilePicUrl || null,
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Error fetching driver details:', error);
    }
  };

  // Initialize screen
  useEffect(() => {
    initializeScreen();
  }, []);

  // Start timer when trip starts
  useEffect(() => {
    let timerInterval;
    if (tripPhase === 'in_progress') {
      timerInterval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [tripPhase]);

  // Update route when trip phase changes or locations update
  useEffect(() => {
    if (tripPhase === 'in_progress' && passengerLocation && dropoffCoord) {
      fetchRoute(passengerLocation, dropoffCoord);
      updateMapRegion(passengerLocation, dropoffCoord);
    } else if (tripPhase === 'pickup' && driverLocation && pickupCoord) {
      fetchRoute(driverLocation, pickupCoord);
      updateMapRegion(driverLocation, pickupCoord);
    }
  }, [tripPhase, driverLocation, passengerLocation]);

  const initializeScreen = async () => {
    try {
      console.log('📍 Initializing passenger trip tracking:', tripId);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to track your trip.',
          [{ text: 'OK' }]
        );
      } else {
        // Get passenger's current location
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const passengerLoc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setPassengerLocation(passengerLoc);
      }

      // Validate and set pickup coordinates
      let pickupCoordinate = null;
      if (pickup?.coordinates && Array.isArray(pickup.coordinates)) {
        const [pickupLng, pickupLat] = pickup.coordinates;
        pickupCoordinate = { latitude: pickupLat, longitude: pickupLng };
      } else if (pickup?.latitude && pickup?.longitude) {
        pickupCoordinate = pickup;
      }
      setPickupCoord(pickupCoordinate);

      // Validate and set destination coordinates
      let dropoffCoordinate = null;
      if (destination?.coordinates && Array.isArray(destination.coordinates)) {
        const [dropoffLng, dropoffLat] = destination.coordinates;
        dropoffCoordinate = { latitude: dropoffLat, longitude: dropoffLng };
      } else if (destination?.latitude && destination?.longitude) {
        dropoffCoordinate = destination;
      }
      setDropoffCoord(dropoffCoordinate);

      // Simulate driver location (in production, this comes from real-time tracking)
      if (pickupCoordinate) {
        const simulatedDriverLoc = {
          latitude: pickupCoordinate.latitude + 0.003,
          longitude: pickupCoordinate.longitude + 0.003,
        };
        setDriverLocation(simulatedDriverLoc);
        
        const distance = calculateDistance(simulatedDriverLoc, pickupCoordinate);
        const time = calculateTime(simulatedDriverLoc, pickupCoordinate);
        setDistanceToTarget(distance);
        setTimeToTarget(time);

        await fetchRoute(simulatedDriverLoc, pickupCoordinate);
        
        // ✅ FIX: Properly center map on driver and pickup
        updateMapRegion(simulatedDriverLoc, pickupCoordinate);
      }

      startLocationTracking();

      setInitializing(false);
      setLoading(false);
      console.log('✅ Passenger tracking initialized successfully');
    } catch (error) {
      console.error('❌ Initialize error:', error);
      setLoading(false);
      setInitializing(false);
    }
  };

  const updateMapRegion = (from, to) => {
    if (!from || !to) return;

    const centerLat = (from.latitude + to.latitude) / 2;
    const centerLng = (from.longitude + to.longitude) / 2;
    const latDelta = Math.abs(from.latitude - to.latitude) * 2.0 + 0.015;
    const lngDelta = Math.abs(from.longitude - to.longitude) * 2.0 + 0.015;
    
    const newRegion = {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.02),
      longitudeDelta: Math.max(lngDelta, 0.02 * (width / height)),
    };
    
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.animateToRegion(newRegion, 1000);
      }, 500);
    }
  };

  const fetchRoute = async (from, to) => {
    if (!from || !to) return;

    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes?.[0]) {
        const points = data.routes[0].overview_polyline.points;
        const decoded = decodePolyline(points);
        setRouteCoordinates(decoded);
      } else {
        console.warn('⚠️ No routes found, using straight line');
        setRouteCoordinates([from, to]);
      }
    } catch (error) {
      console.error('❌ Route fetching error:', error);
      setRouteCoordinates([from, to]);
    }
  };

  const decodePolyline = (encoded) => {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  const startLocationTracking = async () => {
    try {
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (position) => {
          if (!position) return;
          
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          setPassengerLocation(newLocation);
          
          if (tripPhase === 'in_progress' && dropoffCoord) {
            const distance = calculateDistance(newLocation, dropoffCoord);
            const time = calculateTime(newLocation, dropoffCoord);
            setDistanceToTarget(distance);
            setTimeToTarget(time);
            
            if (distance > 0.5) {
              fetchRoute(newLocation, dropoffCoord);
            }
          }
        }
      );
    } catch (error) {
      console.error('❌ Location tracking error:', error);
    }
  };

  const makePhoneCall = () => {
    if (!driverDetails.phone) {
      Alert.alert('Error', 'Driver phone number not available');
      return;
    }
    
    const phoneNumber = driverDetails.phone.replace(/\D/g, '');
    if (phoneNumber.length < 10) {
      Alert.alert('Error', 'Invalid phone number format');
      return;
    }
    
    Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
      console.error('Failed to make call:', err);
      Alert.alert('Error', 'Cannot make phone call.');
    });
  };

  const openWhatsApp = () => {
    if (!driverDetails.phone) {
      Alert.alert('Error', 'Driver phone number not available');
      return;
    }
    
    const phoneNumber = driverDetails.phone.replace(/\D/g, '');
    const message = `Hello ${driverDetails.name}, this is ${passengerName} regarding trip #${tripId}`;
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open WhatsApp:', err);
      Alert.alert('Error', 'WhatsApp is not installed or cannot be opened.');
    });
  };

  const cancelTrip = async () => {
    if (!tripId || !tripValid) {
      Alert.alert('Error', 'This trip is no longer available.');
      return;
    }

    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip? A cancellation fee may apply.',
      [
        { text: 'No, Keep Trip', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) {
                Alert.alert('Error', 'Authentication error. Please try again.');
                return;
              }

              const response = await fetch(`${baseUrl}/trips/${tripId}/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ 
                  reason: 'passenger_cancelled',
                  cancelledBy: 'passenger'
                }),
              });

              if (response.ok) {
                Alert.alert(
                  'Trip Cancelled',
                  'The trip has been cancelled successfully.',
                  [{ text: 'OK', onPress: () => navigation.navigate('PassengerMain') }]
                );
              } else {
                const errorText = await response.text();
                console.error('Cancel trip failed:', errorText);
                Alert.alert('Error', 'Failed to cancel trip. Please try again.');
              }
            } catch (error) {
              console.error('Cancel trip error:', error);
              Alert.alert('Error', 'Failed to cancel trip. Please check your connection.');
            }
          },
        },
      ]
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading screen
  if (loading || initializing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading trip...</Text>
          <Text style={styles.loadingSubText}>
            {tripPhase === 'pickup' 
              ? 'Tracking driver to pickup' 
              : 'Tracking trip to destination'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (tripValid) {
              Alert.alert(
                'Leave Screen',
                'Are you sure you want to leave trip tracking?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Yes', onPress: () => navigation.goBack() }
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {tripPhase === 'pickup' ? 'Driver En Route' : 'Trip in Progress'}
        </Text>
        
        <View style={styles.headerRight}>
          <View style={[
            styles.statusBadge,
            tripPhase === 'in_progress' && styles.statusBadgeActive
          ]}>
            <Text style={[
              styles.statusBadgeText,
              tripPhase === 'in_progress' && styles.statusBadgeTextActive
            ]}>
              {tripPhase === 'pickup' ? 'To Pickup' : 'In Progress'}
            </Text>
          </View>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsTraffic={true}
          showsCompass={true}
          showsScale={true}
          zoomEnabled={true}
          scrollEnabled={true}
          rotateEnabled={true}
          initialRegion={{
            latitude: passengerLocation?.latitude || pickupCoord?.latitude || 9.0820,
            longitude: passengerLocation?.longitude || pickupCoord?.longitude || 8.6753,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Passenger marker */}
          {passengerLocation && (
            <Marker coordinate={passengerLocation} title="Your Location">
              <View style={styles.passengerMarker}>
                <Ionicons name="person" size={18} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          {/* Driver marker */}
          {driverLocation && tripPhase === 'pickup' && (
            <Marker coordinate={driverLocation} title={`${driverDetails.name} (Driver)`}>
              <View style={styles.driverMarker}>
                <Ionicons name="car-sport" size={20} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          {/* Pickup marker */}
          {pickupCoord && (
            <Marker coordinate={pickupCoord} title="Pickup Location">
              <View style={styles.pickupMarker}>
                <View style={styles.pickupPin}>
                  <Ionicons name="location" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.pickupTriangle} />
              </View>
            </Marker>
          )}

          {/* Destination marker */}
          {dropoffCoord && (
            <Marker coordinate={dropoffCoord} title="Destination">
              <View style={styles.destinationMarker}>
                <View style={styles.destinationPin}>
                  <Ionicons name="flag" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.destinationTriangle} />
              </View>
            </Marker>
          )}

          {/* Route polyline */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={tripPhase === 'pickup' ? '#007AFF' : '#34C759'}
              strokeWidth={5}
              lineDashPattern={tripPhase === 'pickup' ? [10, 5] : [0]}
            />
          )}
        </MapView>

        {/* Recenter button */}
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => {
            if (tripPhase === 'in_progress' && passengerLocation && dropoffCoord) {
              updateMapRegion(passengerLocation, dropoffCoord);
            } else if (tripPhase === 'pickup' && driverLocation && pickupCoord) {
              updateMapRegion(driverLocation, pickupCoord);
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Driver Info - COMPLETE DETAILS */}
          <View style={styles.driverSection}>
            <View style={styles.driverAvatar}>
              {driverDetails.profilePicUrl ? (
                <Image 
                  source={{ uri: driverDetails.profilePicUrl }} 
                  style={styles.driverAvatarImage}
                />
              ) : (
                <Text style={styles.driverAvatarText}>
                  {driverDetails.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverDetails.name}</Text>
              <View style={styles.driverDetails}>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>{driverDetails.rating}</Text>
                </View>
                <Text style={styles.vehicleText}>
                  {driverDetails.vehicleModel} • {driverDetails.vehiclePlate}
                </Text>
              </View>
              {driverDetails.phone && (
                <Text style={styles.phoneText}>📞 {driverDetails.phone}</Text>
              )}
            </View>
            <View style={styles.contactButtons}>
              <TouchableOpacity 
                style={styles.contactButton} 
                onPress={makePhoneCall}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={18} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.contactButton} 
                onPress={openWhatsApp}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Trip Status */}
          <View style={styles.statusSection}>
            <View style={styles.statusRow}>
              <Ionicons 
                name={tripPhase === 'pickup' ? "car" : "time"} 
                size={20} 
                color={tripPhase === 'pickup' ? '#007AFF' : '#34C759'} 
              />
              <View style={styles.statusDetails}>
                <Text style={styles.statusTitle}>
                  {tripPhase === 'pickup' ? 'Driver on the way' : 'Trip in progress'}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {tripPhase === 'pickup' 
                    ? `Arriving in ~${timeToTarget} min • ${distanceToTarget} km away`
                    : `En route to destination • ${formatTime(timer)} elapsed`}
                </Text>
              </View>
            </View>
          </View>

          {/* Current Location */}
          <View style={styles.locationSection}>
            <View style={styles.locationRow}>
              <View style={[
                styles.locationDot, 
                { backgroundColor: tripPhase === 'pickup' ? '#007AFF' : '#34C759' }
              ]} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>
                  {tripPhase === 'pickup' ? 'PICKUP LOCATION' : 'CURRENT LOCATION'}
                </Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {tripPhase === 'pickup' ? pickupAddress : 'Tracking your location...'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.locationRow}>
              <View style={[
                styles.locationDot, 
                { backgroundColor: '#FF3B30' }
              ]} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>DESTINATION</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {destinationAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Trip Details */}
          <View style={styles.tripDetails}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>TRIP FARE</Text>
              <Text style={styles.fareAmount}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            
            {distanceToTarget !== null && timeToTarget !== null && (
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Ionicons name="speedometer-outline" size={18} color="#666" />
                  <Text style={styles.metricText}>
                    {distanceToTarget} km
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Ionicons name="time-outline" size={18} color="#666" />
                  <Text style={styles.metricText}>
                    {timeToTarget} min {tripPhase === 'pickup' ? 'ETA' : 'remaining'}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Ionicons name="cash-outline" size={18} color="#666" />
                  <Text style={styles.metricText}>
                    {paymentMethod === 'cash' ? 'Cash' : 'Wallet'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Cancel Button */}
          {tripValid && tripStatus !== 'completed' && tripStatus !== 'cancelled' && (
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={cancelTrip}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
              <Text style={styles.cancelText}>Cancel Trip</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Helper functions
const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * 
    Math.cos(coord2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance.toFixed(1);
};

const calculateTime = (coord1, coord2) => {
  const distance = parseFloat(calculateDistance(coord1, coord2));
  const averageSpeed = 40; // km/h
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = timeInHours * 60;
  return Math.max(Math.ceil(timeInMinutes), 1);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  loadingText: {
    color: '#000',
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubText: {
    color: '#666',
    marginTop: 8,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  headerRight: {
    width: 100,
    alignItems: 'flex-end',
  },
  statusBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeActive: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: '#34C759',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  recenterButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  passengerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupMarker: {
    alignItems: 'center',
  },
  pickupPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#007AFF',
    marginTop: -2,
  },
  destinationMarker: {
    alignItems: 'center',
  },
  destinationPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  destinationTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF3B30',
    marginTop: -2,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
  },
  driverAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  driverAvatarImage: {
    width: '100%',
    height: '100%',
  },
  driverAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  driverDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
    fontWeight: '600',
  },
  vehicleText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  phoneText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  contactButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDetails: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  locationSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  tripDetails: {
    marginBottom: 20,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  fareLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  fareAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#007AFF',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFE5E5',
    gap: 8,
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});