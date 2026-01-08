// src/screens/driver/DriverOnlineMapScreen.js

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth'; // Uses WHEELA_TOKEN correctly

const baseUrl = 'http://172.20.10.9:8000'; // Change to ngrok URL when testing outside local network
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
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));
  const [pollingInterval, setPollingInterval] = useState(null);

  // Pulse animation when online
  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
    }
  }, [isOnline]);

  // Initial setup: token, location, go online
  useEffect(() => {
    const init = async () => {
      try {
        const authToken = await getAuthToken();

        if (!authToken || authToken.trim() === '' || authToken === 'null' || authToken === 'undefined') {
          Alert.alert('Session Expired', 'Please log in again.');
          navigation.replace('Login'); // Replace with your login screen name
          return;
        }

        const cleanToken = authToken.trim();
        setToken(cleanToken);

        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is required to go online.');
          navigation.replace('DriverHomeOffline');
          return;
        }

        // Get current position
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading || 0,
        };

        setLocation(coords);
        setHeading(coords.heading || 0);
        setLoading(false);

        // Go online and start services
        await goOnline(coords, cleanToken);
        startLocationTracking(cleanToken);
        startPollingForRequests(cleanToken);
      } catch (error) {
        console.error('Initialization failed:', error);
        Alert.alert('Error', 'Failed to start driver mode. Please try again.');
        navigation.replace('DriverHomeOffline');
      }
    };

    init();

    // Cleanup
    return () => {
      if (locationSubscription) locationSubscription.remove();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, []);

  const goOnline = async (currentCoords, authToken) => {
    try {
      console.log('Sending go online request... Token preview:', authToken.substring(0, 20) + '...');

      await axios.post(
        `${baseUrl}/drivers/availability`,
        {
          isAvailable: true,
          location: {
            type: 'Point',
            coordinates: [currentCoords.longitude, currentCoords.latitude],
          },
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      setIsOnline(true);
    } catch (err) {
      console.error('Failed to go online:', err.response?.data || err.message);
      Alert.alert('Connection Failed', 'Unable to connect to server. Check your internet and try again.');
      navigation.replace('DriverHomeOffline');
    }
  };

  const startLocationTracking = async (authToken) => {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      async (loc) => {
        const newCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading ?? heading,
        };

        setLocation(newCoords);
        if (loc.coords.heading !== null) setHeading(loc.coords.heading);

        try {
          await axios.post(
            `${baseUrl}/drivers/availability`,
            {
              location: {
                type: 'Point',
                coordinates: [newCoords.longitude, newCoords.latitude],
              },
            },
            {
              headers: { Authorization: `Bearer ${authToken}` },
            }
          );
        } catch (err) {
          console.log('Location update failed (non-critical):', err.message);
        }

        mapRef.current?.animateToRegion({
          latitude: newCoords.latitude,
          longitude: newCoords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }, 1000);
      }
    );

    setLocationSubscription(subscription);
  };

  const startPollingForRequests = (authToken) => {
    const interval = setInterval(async () => {
      if (!isOnline) return;

      try {
        const res = await axios.get(`${baseUrl}/drivers/offered-request`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (res.data.request && !incomingRequest) {
          setIncomingRequest(res.data.request);
          showRequestModal();
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          console.log('Polling error:', err.message);
        }
        // 404 means no current offer — that's normal
      }
    }, 5000);

    setPollingInterval(interval);
  };

  const showRequestModal = () => {
    setRequestModalVisible(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
  };

  const hideRequestModal = () => {
    Animated.timing(slideAnim, { toValue: height, duration: 400, useNativeDriver: true }).start(() => {
      setRequestModalVisible(false);
      setIncomingRequest(null);
    });
  };

  const acceptRide = async () => {
    try {
      await axios.post(
        `${baseUrl}/trips/accept`,
        { requestId: incomingRequest.requestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      hideRequestModal();
      navigation.navigate('TripFlow', { requestId: incomingRequest.requestId });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to accept ride');
      hideRequestModal();
    }
  };

  const rejectRide = async () => {
    try {
      await axios.post(
        `${baseUrl}/trips/reject`,
        { requestId: incomingRequest.requestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.log('Reject failed:', err.message);
    }
    hideRequestModal();
  };

  const goOffline = () => {
    Alert.alert('Go Offline?', 'You will stop receiving ride requests.', [
      { text: 'Cancel' },
      {
        text: 'Go Offline',
        onPress: async () => {
          try {
            await axios.post(
              `${baseUrl}/drivers/availability`,
              { isAvailable: false },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch (err) {
            console.log('Offline request failed:', err.message);
          }

          setIsOnline(false);
          if (locationSubscription) locationSubscription.remove();
          if (pollingInterval) clearInterval(pollingInterval);
          navigation.replace('DriverHomeOffline');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#00B0F3" />
        <Text style={styles.loadingText}>Preparing map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsTraffic={true}
        initialRegion={{
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
      >
        {location && (
          <>
            <Circle
              center={location}
              radius={100}
              strokeColor="rgba(0,176,243,0.5)"
              fillColor="rgba(0,176,243,0.2)"
            />
            <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
              <Animated.Image
                source={CAR_MARKER}
                style={[
                  styles.carMarker,
                  {
                    transform: [
                      { rotate: `${heading}deg` },
                      { scale: pulseAnim },
                    ],
                  },
                ]}
              />
            </Marker>
          </>
        )}
      </MapView>

      {/* Online Status */}
      <View style={styles.topStatus}>
        <View style={styles.statusBox}>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#4ADE80' : '#FF4444' }]} />
          <Text style={styles.statusText}>
            {isOnline ? 'Online • Waiting for rides' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Go Offline Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.offlineBtn} onPress={goOffline}>
          <Ionicons name="power" size={24} color="white" />
          <Text style={styles.offlineText}>Go Offline</Text>
        </TouchableOpacity>
      </View>

      {/* Incoming Ride Request Modal */}
      <Modal visible={requestModalVisible} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.requestCard, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>New Ride Request</Text>
              <TouchableOpacity onPress={hideRequestModal}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            {incomingRequest && (
              <>
                <View style={styles.passengerInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {incomingRequest.passengerName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.passengerName}>{incomingRequest.passengerName}</Text>
                    <Text style={styles.rating}>⭐ {incomingRequest.rating || 4.8}</Text>
                  </View>
                </View>

                <View style={styles.routeInfo}>
                  <View style={styles.routePoint}>
                    <View style={styles.dotGreen} />
                    <Text style={styles.address}>{incomingRequest.pickupAddress || 'Nearby pickup'}</Text>
                  </View>
                </View>

                <View style={styles.tripDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="cash" size={20} color="#666" />
                    <Text style={styles.fareAmount}>₦{Number(incomingRequest.fare || 0).toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={rejectRide}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={acceptRide}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.serviceType}>Service: {incomingRequest.serviceType || 'Standard'}</Text>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#010C44' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#fff' },
  topStatus: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 16, right: 16, backgroundColor: 'white', borderRadius: 16, padding: 16, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8 },
  statusBox: { flexDirection: 'row', alignItems: 'center' },
  onlineDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { fontSize: 18, fontWeight: '700' },
  bottomBar: { position: 'absolute', bottom: 30, left: 16, right: 16, alignItems: 'center' },
  offlineBtn: { backgroundColor: '#FF4444', flexDirection: 'row', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, gap: 12, elevation: 8 },
  offlineText: { color: 'white', fontSize: 18, fontWeight: '700' },
  carMarker: { width: 48, height: 48 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  requestCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  requestTitle: { fontSize: 22, fontWeight: '800', color: '#000' },
  passengerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00B0F3', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: 'white', fontSize: 24, fontWeight: '700' },
  passengerName: { fontSize: 18, fontWeight: '700', color: '#000' },
  rating: { fontSize: 16, color: '#666', marginTop: 4 },
  routeInfo: { marginBottom: 24 },
  routePoint: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80', marginRight: 12 },
  address: { fontSize: 16, color: '#000', flex: 1 },
  tripDetails: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32 },
  detailItem: { alignItems: 'center' },
  fareAmount: { fontSize: 32, fontWeight: '800', color: '#000', marginTop: 8 },
  actionButtons: { flexDirection: 'row', gap: 16 },
  rejectBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF4444', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  rejectText: { color: '#FF4444', fontSize: 18, fontWeight: '700' },
  acceptBtn: { flex: 1, backgroundColor: '#00B0F3', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  acceptText: { color: 'white', fontSize: 18, fontWeight: '700' },
  serviceType: { fontSize: 16, color: '#000', textAlign: 'center', marginTop: 16 },
});