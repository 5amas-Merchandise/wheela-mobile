// src/screens/driver/RideRequestScreen.js (SIMPLIFIED CASH-ONLY VERSION)
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  ScrollView,
  BackHandler,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');
const baseUrl = 'https://wheels-backend-7ydc.onrender.com';

export default function RideRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);
  
  const {
    tripId,
    passengerName = 'Passenger',
    passengerPhone = '',
    serviceType = 'CITY_RIDE',
    fare = 0,
    pickup,
    destination,
    pickupAddress = 'Pickup location',
    destinationAddress = 'Destination',
  } = route.params || {};

  const [tripPhase, setTripPhase] = useState('pickup');
  const [tripStatus, setTripStatus] = useState('assigned');
  const [tripValid, setTripValid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropoffCoord, setDropoffCoord] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [region, setRegion] = useState(null);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [timeToTarget, setTimeToTarget] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);

  useEffect(() => {
    if (!tripId) {
      Alert.alert(
        'Invalid Trip Data',
        'Unable to load trip information.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [tripId]);

  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

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
            const status = data.trip.status;
            setTripStatus(status);

            if (status === 'started' || status === 'in_progress') {
              setTripPhase('in_progress');
            }

            if (status === 'cancelled' || status === 'completed') {
              Alert.alert(
                'Trip Ended',
                status === 'cancelled' ? 'This trip has been cancelled.' : 'Trip completed successfully!',
                [{ 
                  text: 'OK', 
                  onPress: () => {
                    setTripValid(false);
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'DriverOnlineMap' }],
                    });
                  }
                }]
              );
              setTripValid(false);
            }
          }
        } else if (response.status === 404) {
          Alert.alert(
            'Trip Not Found',
            'This trip is no longer available.',
            [{ 
              text: 'OK', 
              onPress: () => {
                setTripValid(false);
                navigation.navigate('DriverOnlineMap');
              }
            }]
          );
          setTripValid(false);
        }
      } catch (error) {
        console.warn('Trip status polling error:', error.message);
      }
    };

    pollTripStatus();
    const intervalId = setInterval(pollTripStatus, 10000);
    return () => clearInterval(intervalId);
  }, [tripId, tripValid]);

  useEffect(() => {
    initializeScreen();
  }, []);

  useEffect(() => {
    if (driverLocation && tripPhase === 'in_progress' && dropoffCoord) {
      fetchRoute(driverLocation, dropoffCoord);
      updateMapRegion(driverLocation, dropoffCoord);
    } else if (driverLocation && tripPhase === 'pickup' && pickupCoord) {
      fetchRoute(driverLocation, pickupCoord);
      updateMapRegion(driverLocation, pickupCoord);
    }
  }, [tripPhase]);

  const initializeScreen = async () => {
    try {
      if (!pickup?.coordinates) {
        throw new Error('Invalid pickup location data');
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to navigate.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeout: 10000,
      });

      const driverLoc = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setDriverLocation(driverLoc);

      const [pickupLng, pickupLat] = pickup.coordinates;
      const pickupCoordinate = { latitude: pickupLat, longitude: pickupLng };
      setPickupCoord(pickupCoordinate);

      if (destination?.coordinates?.length === 2) {
        const [dropoffLng, dropoffLat] = destination.coordinates;
        const dropoffCoordinate = { latitude: dropoffLat, longitude: dropoffLng };
        setDropoffCoord(dropoffCoordinate);
      }

      const targetCoord = tripPhase === 'pickup' ? pickupCoordinate : dropoffCoord;
      if (targetCoord) {
        const distance = calculateDistance(driverLoc, targetCoord);
        const time = calculateTime(driverLoc, targetCoord);
        setDistanceToTarget(distance);
        setTimeToTarget(time);
        await fetchRoute(driverLoc, targetCoord);
        updateMapRegion(driverLoc, targetCoord);
      } else {
        updateMapRegion(driverLoc, pickupCoordinate);
      }

      startLocationTracking();
      setInitializing(false);
    } catch (error) {
      console.error('❌ Initialize error:', error);
      Alert.alert(
        'Initialization Error',
        error.message || 'Failed to initialize navigation.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      setInitializing(false);
    }
  };

  const updateMapRegion = (from, to) => {
    try {
      const centerLat = (from.latitude + to.latitude) / 2;
      const centerLng = (from.longitude + to.longitude) / 2;
      const latDelta = Math.abs(from.latitude - to.latitude) * 1.8 + 0.01;
      const lngDelta = Math.abs(from.longitude - to.longitude) * 1.8 + 0.01;
      
      const newRegion = {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: Math.max(latDelta, 0.05),
        longitudeDelta: Math.max(lngDelta, 0.05 * (width / height)),
      };
      
      setRegion(newRegion);
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
    } catch (error) {
      console.error('Map region update error:', error);
    }
  };

  const fetchRoute = async (from, to) => {
    if (!from || !to) return;

    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&mode=driving`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes?.[0]) {
        const points = data.routes[0].overview_polyline.points;
        const decoded = decodePolyline(points);
        setRouteCoordinates(decoded);
      } else {
        setRouteCoordinates([from, to]);
      }
    } catch (error) {
      console.error('Route fetching error:', error);
      setRouteCoordinates([from, to]);
    }
  };

  const decodePolyline = (encoded) => {
    try {
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
    } catch (error) {
      console.error('Polyline decode error:', error);
      return [];
    }
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
          
          setDriverLocation(newLocation);
          
          const targetCoord = tripPhase === 'pickup' ? pickupCoord : dropoffCoord;
          if (targetCoord) {
            const distance = calculateDistance(newLocation, targetCoord);
            const time = calculateTime(newLocation, targetCoord);
            setDistanceToTarget(distance);
            setTimeToTarget(time);
          }
        }
      );
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  };

  const openNavigation = () => {
    const targetCoord = tripPhase === 'pickup' ? pickupCoord : dropoffCoord;
    
    if (!targetCoord) {
      Alert.alert('Error', 'Destination not available');
      return;
    }
    
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${targetCoord.latitude},${targetCoord.longitude}&dirflg=d`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${targetCoord.latitude},${targetCoord.longitude}&travelmode=driving`,
    });
    
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open navigation:', err);
      Alert.alert('Error', 'Cannot open navigation app.');
    });
  };

  const makePhoneCall = () => {
    if (!passengerPhone) {
      Alert.alert('Error', 'Passenger phone number not available');
      return;
    }
    
    const phoneNumber = passengerPhone.replace(/\D/g, '');
    if (phoneNumber.length < 10) {
      Alert.alert('Error', 'Invalid phone number format');
      return;
    }
    
    Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
      console.error('Failed to make call:', err);
      Alert.alert('Error', 'Cannot make phone call.');
    });
  };

  const startTrip = async () => {
    if (!tripId || !tripValid) {
      Alert.alert('Error', 'This trip is no longer available.');
      return;
    }

    setLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication token not available');

      const response = await fetch(`${baseUrl}/trips/${tripId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setTripPhase('in_progress');
        setTripStatus('started');
        
        if (dropoffCoord && driverLocation) {
          await fetchRoute(driverLocation, dropoffCoord);
          updateMapRegion(driverLocation, dropoffCoord);
        }
        
        Alert.alert('Trip Started', 'You have started the trip. Navigate to the destination.', [{ text: 'OK' }]);
      } else {
        const errorText = await response.text();
        Alert.alert('Start Failed', 'Failed to start trip. Please try again.');
      }
    } catch (error) {
      console.error('❌ Start trip error:', error);
      Alert.alert('Network Error', 'Failed to start trip. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const finishTrip = () => {
    if (!tripId || !tripValid) {
      Alert.alert('Error', 'This trip is no longer available.');
      return;
    }

    setShowCompleteModal(true);
  };

  const completeTrip = async () => {
    if (completingTrip) return;
    
    if (!tripId || !tripValid) {
      Alert.alert('Error', 'This trip is no longer available.');
      return;
    }

    setCompletingTrip(true);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication token not available');

      // SIMPLIFIED: Send only trip ID, no pricing data
      const response = await fetch(`${baseUrl}/trips/${tripId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cashReceived: true })
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        throw new Error('Invalid server response');
      }

      if (response.ok && responseData.success !== false) {
        setShowCompleteModal(false);
        setTripValid(false);
        
        Alert.alert(
          '✅ Trip Completed Successfully!',
          `Trip has been completed. Cash received: ₦${Number(fare).toLocaleString()}`,
          [
            { 
              text: 'Return to Map', 
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DriverOnlineMap' }],
                });
              }
            }
          ],
          { cancelable: false }
        );
        
      } else {
        console.error('❌ Trip completion failed:', responseData);
        
        if (response.status === 400 && responseData.error?.code === 'TRIP_ALREADY_ENDED') {
          Alert.alert(
            'Trip Already Completed',
            'This trip has already been completed or cancelled.',
            [{ 
              text: 'OK', 
              onPress: () => {
                setTripValid(false);
                setShowCompleteModal(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DriverOnlineMap' }],
                });
              }
            }]
          );
        } else if (response.status === 404) {
          Alert.alert(
            'Trip Not Found',
            'This trip no longer exists in the system.',
            [{ 
              text: 'OK', 
              onPress: () => {
                setTripValid(false);
                setShowCompleteModal(false);
                navigation.navigate('DriverOnlineMap');
              }
            }]
          );
        } else {
          Alert.alert(
            'Completion Failed',
            responseData.error?.message || 'Failed to complete trip. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Complete trip error:', error);
      
      if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        Alert.alert(
          'Network Error',
          'Unable to connect to the server. Please check your internet connection.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setShowCompleteModal(false) },
            { text: 'Retry', onPress: () => {
              setCompletingTrip(false);
              setTimeout(() => completeTrip(), 1000);
            }}
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to complete trip');
      }
    } finally {
      setCompletingTrip(false);
    }
  };

  const cancelTrip = async () => {
    if (!tripId || !tripValid) {
      Alert.alert('Error', 'This trip is no longer available.');
      return;
    }

    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip?',
      [
        { text: 'No, Keep Trip', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              if (!token) {
                Alert.alert('Error', 'Authentication error.');
                return;
              }

              const response = await fetch(`${baseUrl}/trips/${tripId}/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ reason: 'driver_cancelled' }),
              });

              if (response.ok) {
                Alert.alert(
                  'Trip Cancelled',
                  'The trip has been cancelled successfully.',
                  [{ 
                    text: 'OK', 
                    onPress: () => {
                      setTripValid(false);
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'DriverOnlineMap' }],
                      });
                    }
                  }]
                );
              } else {
                Alert.alert('Error', 'Failed to cancel trip.');
              }
            } catch (error) {
              console.error('Cancel trip error:', error);
              Alert.alert('Network Error', 'Failed to cancel trip.');
            }
          },
        },
      ]
    );
  };

  const handleBackPress = () => {
    Alert.alert(
      'Leave Trip Screen',
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Trip', 
          style: 'destructive',
          onPress: () => {
            if (tripPhase === 'in_progress') {
              finishTrip();
            } else {
              cancelTrip();
            }
          }
        },
        { 
          text: 'Just Leave', 
          onPress: () => navigation.navigate('DriverOnlineMap')
        }
      ]
    );
    return true;
  };

  const calculateDistance = (coord1, coord2) => {
    try {
      const R = 6371;
      const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
      const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(coord1.latitude * Math.PI / 180) * 
                Math.cos(coord2.latitude * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      return distance.toFixed(1);
    } catch (error) {
      console.error('Distance calculation error:', error);
      return '0.0';
    }
  };

  const calculateTime = (coord1, coord2) => {
    try {
      const distance = parseFloat(calculateDistance(coord1, coord2));
      const averageSpeed = 40;
      const timeInHours = distance / averageSpeed;
      const timeInMinutes = timeInHours * 60;
      return Math.max(Math.ceil(timeInMinutes), 1);
    } catch (error) {
      console.error('Time calculation error:', error);
      return 1;
    }
  };

  if (initializing || !region || !driverLocation) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading navigation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {tripPhase === 'pickup' ? 'Pickup Passenger' : 'Trip in Progress'}
        </Text>
        
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, tripPhase === 'in_progress' && styles.statusBadgeActive]}>
            <Text style={[styles.statusBadgeText, tripPhase === 'in_progress' && styles.statusBadgeTextActive]}>
              {tripPhase === 'pickup' ? 'To Pickup' : 'In Progress'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          showsUserLocation={true}
          showsTraffic={true}
        >
          {driverLocation && (
            <Marker coordinate={driverLocation} title="Your Location" description="Driver">
              <View style={styles.driverMarker}>
                <Ionicons name="car-sport" size={24} color="#007AFF" />
              </View>
            </Marker>
          )}

          {pickupCoord && tripPhase === 'pickup' && (
            <Marker coordinate={pickupCoord} title="Pickup Location" description={pickupAddress}>
              <View style={styles.pickupMarker}>
                <View style={styles.pickupPin}>
                  <Ionicons name="person" size={14} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          )}

          {dropoffCoord && tripPhase === 'in_progress' && (
            <Marker coordinate={dropoffCoord} title="Destination" description={destinationAddress}>
              <View style={styles.destinationMarker}>
                <View style={styles.destinationPin}>
                  <Ionicons name="flag" size={14} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          )}

          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={tripPhase === 'pickup' ? '#007AFF' : '#34C759'}
              strokeWidth={5}
            />
          )}
        </MapView>
      </View>

      <View style={styles.bottomCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.passengerSection}>
            <View style={styles.passengerAvatar}>
              <Text style={styles.avatarText}>{passengerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.passengerInfo}>
              <Text style={styles.passengerName} numberOfLines={1}>{passengerName}</Text>
              <Text style={styles.serviceType}>{serviceType.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.callButton} onPress={makePhoneCall} disabled={!passengerPhone}>
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.locationSection}>
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: tripPhase === 'pickup' ? '#007AFF' : '#34C759' }]} />
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>
                  {tripPhase === 'pickup' ? 'PICKUP LOCATION' : 'DESTINATION'}
                </Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {tripPhase === 'pickup' ? pickupAddress : destinationAddress}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tripDetails}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>TRIP FARE</Text>
              <Text style={styles.fareAmount}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            
            {distanceToTarget !== null && timeToTarget !== null && (
              <View style={styles.distanceRow}>
                <View style={styles.distanceItem}>
                  <Ionicons name="time-outline" size={18} color="#666" />
                  <Text style={styles.distanceText}>{timeToTarget} min</Text>
                </View>
                <View style={styles.distanceItem}>
                  <Ionicons name="location-outline" size={18} color="#666" />
                  <Text style={styles.distanceText}>{distanceToTarget} km {tripPhase === 'pickup' ? 'away' : 'to go'}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.paymentMethodRow}>
              <Ionicons name="cash-outline" size={16} color="#666" />
              <Text style={styles.paymentMethodText}>Payment: Cash</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.navigateButton} onPress={openNavigation}>
              <Ionicons name="navigate" size={22} color="#007AFF" />
              <Text style={styles.navigateText}>Navigate</Text>
            </TouchableOpacity>
            
            {tripPhase === 'pickup' ? (
              <TouchableOpacity 
                style={[styles.primaryButton, (!tripValid || tripStatus !== 'assigned') && styles.disabledButton]} 
                onPress={startTrip}
                disabled={loading || !tripValid || tripStatus !== 'assigned'}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="play-circle-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Start Trip</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.primaryButton, styles.finishButton, !tripValid && styles.disabledButton]} 
                onPress={finishTrip}
                disabled={!tripValid}
              >
                <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Finish Trip</Text>
              </TouchableOpacity>
            )}
          </View>

          {tripValid && (
            <TouchableOpacity style={styles.cancelButton} onPress={cancelTrip}>
              <Ionicons name="close-circle-outline" size={18} color="#FF3B30" />
              <Text style={styles.cancelText}>Cancel Trip</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <Modal visible={showCompleteModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Complete Trip</Text>
                <TouchableOpacity onPress={() => !completingTrip && setShowCompleteModal(false)} disabled={completingTrip}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Trip Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Passenger:</Text>
                  <Text style={styles.summaryValue}>{passengerName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service:</Text>
                  <Text style={styles.summaryValue}>{serviceType.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Payment Method:</Text>
                  <Text style={styles.summaryValue}>Cash</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Fare:</Text>
                  <Text style={styles.summaryValueHighlight}>₦{Number(fare).toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Confirmation</Text>
                <Text style={styles.confirmationText}>
                  Confirm you received ₦{Number(fare).toLocaleString()} cash from the passenger.
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButtonSecondary} 
                  onPress={() => !completingTrip && setShowCompleteModal(false)}
                  disabled={completingTrip}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButtonPrimary, completingTrip && styles.disabledButton]} 
                  onPress={completeTrip}
                  disabled={completingTrip}
                >
                  {completingTrip ? (
                    <View style={styles.loadingButtonContent}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.modalButtonPrimaryText}>Completing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalButtonPrimaryText}>Confirm Cash Received</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { color: '#000', marginTop: 20, fontSize: 18, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', zIndex: 10 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000', textAlign: 'center', flex: 1 },
  headerRight: { width: 100, alignItems: 'flex-end' },
  statusBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusBadgeActive: { backgroundColor: '#E8F5E9' },
  statusBadgeText: { color: '#007AFF', fontSize: 12, fontWeight: '600' },
  statusBadgeTextActive: { color: '#34C759' },
  mapContainer: { flex: 1 },
  map: { flex: 1, width: '100%', height: '100%' },
  driverMarker: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#007AFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  pickupMarker: { alignItems: 'center' },
  pickupPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  destinationMarker: { alignItems: 'center' },
  destinationPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  bottomCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 24, maxHeight: height * 0.55, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  scrollContent: { paddingBottom: 10 },
  passengerSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  passengerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 2 },
  serviceType: { fontSize: 13, color: '#666', fontWeight: '600' },
  callButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' },
  locationSection: { backgroundColor: '#F8F9FA', borderRadius: 16, padding: 16, marginBottom: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start' },
  locationDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12, marginTop: 4 },
  locationDetails: { flex: 1 },
  locationLabel: { fontSize: 12, color: '#666', marginBottom: 4, fontWeight: '600', letterSpacing: 0.5 },
  locationAddress: { fontSize: 16, color: '#000', lineHeight: 22, fontWeight: '500' },
  tripDetails: { marginBottom: 20 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  fareLabel: { fontSize: 13, color: '#666', fontWeight: '600', letterSpacing: 0.5 },
  fareAmount: { fontSize: 28, fontWeight: '800', color: '#007AFF' },
  distanceRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#F8F9FA', borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  distanceItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distanceText: { fontSize: 15, color: '#666', fontWeight: '600' },
  paymentMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F8F9FA', borderRadius: 8, alignSelf: 'flex-start' },
  paymentMethodText: { fontSize: 14, color: '#666', fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  navigateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F8FF', paddingVertical: 16, borderRadius: 12, gap: 8 },
  navigateText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  primaryButton: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 12, gap: 8 },
  finishButton: { backgroundColor: '#34C759' },
  disabledButton: { backgroundColor: '#CCCCCC' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  cancelText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: height * 0.85 },
  modalScrollContent: { paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#000' },
  modalSection: { marginBottom: 24 },
  modalLabel: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  summaryLabel: { fontSize: 15, color: '#666', fontWeight: '500' },
  summaryValue: { fontSize: 15, color: '#000', fontWeight: '600' },
  summaryValueHighlight: { fontSize: 18, color: '#34C759', fontWeight: '700' },
  confirmationText: { fontSize: 16, color: '#666', lineHeight: 22 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalButtonSecondary: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#F0F0F0', alignItems: 'center' },
  modalButtonSecondaryText: { fontSize: 16, fontWeight: '600', color: '#666' },
  modalButtonPrimary: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#34C759', alignItems: 'center' },
  loadingButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalButtonPrimaryText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});