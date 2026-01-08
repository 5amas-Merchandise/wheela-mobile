// src/screens/passenger/DriverMatchingScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuthToken } from '../../utils/auth';
import { Ionicons } from '@expo/vector-icons';

const baseUrl = "https://wheels-backend.vercel.app";

export default function DriverMatchingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    pickup,
    dropoff,
    pickupAddress,
    dropoffAddress,
    serviceType,
    estimatedFare,
  } = route.params;

  const [requestId, setRequestId] = useState(null);
  const pollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const startRideRequest = async () => {
      const token = await getAuthToken();
      try {
        const res = await axios.post(
          `${baseUrl}/trips/request`,
          {
            pickup: { type: 'Point', coordinates: [pickup.longitude, pickup.latitude] },
            dropoff: { type: 'Point', coordinates: [dropoff.longitude, dropoff.latitude] },
            pickupAddress,
            dropoffAddress,
            serviceType,
            paymentMethod: 'wallet',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { requestId } = res.data;
        setRequestId(requestId);

        pollRef.current = setInterval(async () => {
          try {
            const tripRes = await axios.get(`${baseUrl}/trips/${requestId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const trip = tripRes.data.trip;

            if (trip?.status === 'accepted' && trip.driverId) {
              clearInterval(pollRef.current);
              navigation.reset({
                index: 0,
                routes: [{ name: 'TripInProgress', params: { trip } }],
              });
            }
          } catch (err) {
            console.log('Polling error:', err);
          }
        }, 3000);
      } catch (err) {
        Alert.alert('No Drivers', 'No drivers available right now. Please try again later.');
        navigation.goBack();
      }
    };

    startRideRequest();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const cancelRide = async () => {
    if (requestId) {
      const token = await getAuthToken();
      try {
        await axios.post(
          `${baseUrl}/trips/${requestId}/cancel`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (err) {
        console.log('Cancel error:', err);
      }
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'PassengerHome' }],
    });
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.8],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={{
          ...pickup,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
      >
        <Marker coordinate={pickup}>
          <View style={styles.userMarker}>
            <Ionicons name="location" size={28} color="#00B0F3" />
          </View>
        </Marker>
        <Circle
          center={pickup}
          radius={300}
          fillColor="rgba(0, 176, 243, 0.1)"
          strokeColor="rgba(0, 176, 243, 0.3)"
          strokeWidth={2}
        />
        <Animated.View
          style={[
            styles.pulseCircle,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
        <Animated.View
          style={[
            styles.pulseCircle,
            styles.pulse2,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.title}>Finding your driver...</Text>
        <Text style={styles.subtitle}>
          Searching nearby for the best {serviceType.replace('_', ' ')}
        </Text>
        <Text style={styles.fare}>Estimated fare: ₦{estimatedFare?.toLocaleString()}</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelRide}>
          <Text style={styles.cancelText}>Cancel Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 16 },
  fare: { fontSize: 20, fontWeight: '600', marginBottom: 32 },
  cancelBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#FF4444',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
  },
  cancelText: { color: '#FF4444', textAlign: 'center', fontWeight: '700', fontSize: 16 },
  userMarker: { backgroundColor: 'white', padding: 6, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.3, elevation: 6 },
  pulseCircle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(0, 176, 243, 0.3)',
    top: '50%',
    left: '50%',
    marginLeft: -200,
    marginTop: -200,
  },
  pulse2: { backgroundColor: 'rgba(0, 176, 243, 0.2)' },
});