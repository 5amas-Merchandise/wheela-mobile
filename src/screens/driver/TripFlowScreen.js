// src/screens/driver/TripFlowScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuthToken } from '../../utils/auth';

const baseUrl = 'https://wheels-backend.vercel.app';
const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY'; // Replace with your Google Maps API key

function decodePolyline(encoded) {
  let index = 0, lat = 0, lng = 0;
  const polyline = [];
  while (index < encoded.length) {
    let shift = 0, result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    polyline.push({ latitude: lat * 1e-5, longitude: lng * 1e-5 });
  }
  return polyline;
}

export default function TripFlowScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tripId, passengerName, passengerPhone, destination, destinationAddress, fare } = route.params;

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [token, setToken] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [tripDistance, setTripDistance] = useState('Calculating...');
  const [tripDuration, setTripDuration] = useState('Calculating...');

  useEffect(() => {
    const initialize = async () => {
      const authToken = await getAuthToken();
      setToken(authToken);

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrentLocation(position.coords);

      fetchTrip(authToken);
    };
    initialize();
  }, []);

  useEffect(() => {
    if (currentLocation && trip?.dropoffLocation?.coordinates) {
      const destLng = trip.dropoffLocation.coordinates[0];
      const destLat = trip.dropoffLocation.coordinates[1];
      fetchRoute(currentLocation.latitude, currentLocation.longitude, destLat, destLng);
    }
  }, [currentLocation, trip]);

  const fetchRoute = async (originLat, originLng, destLat, destLng) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_API_KEY}`
      );
      const data = await response.json();
      if (data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        const coords = decodePolyline(points);
        setRouteCoordinates(coords);
        setTripDistance(data.routes[0].legs[0].distance.text);
        setTripDuration(data.routes[0].legs[0].duration.text);
      }
    } catch (err) {
      console.error('Failed to fetch route:', err);
    }
  };

  const fetchTrip = async (authToken) => {
    try {
      const res = await fetch(`${baseUrl}/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrip(data.trip);
      } else {
        Alert.alert('Error', 'Could not load trip');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not load trip');
    } finally {
      setLoading(false);
    }
  };

  const completeTrip = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${baseUrl}/trips/${tripId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        Alert.alert('Trip Completed ✓', `You earned ₦${data.trip.finalFare.toLocaleString()}`, [
          { text: 'OK', onPress: () => navigation.replace('DriverOnlineMap') },
        ]);
      } else {
        Alert.alert('Error', 'Status update failed');
      }
    } catch (err) {
      Alert.alert('Error', 'Status update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openNavigation = () => {
    if (destination?.coordinates) {
      const destLat = destination.coordinates[1];
      const destLng = destination.coordinates[0];
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
      Linking.openURL(url);
    }
  };

  const callPassenger = () => {
    if (passengerPhone) {
      Linking.openURL(`tel:${passengerPhone}`);
    }
  };

  const whatsappPassenger = () => {
    if (passengerPhone) {
      Linking.openURL(`whatsapp://send?phone=${passengerPhone.replace('+', '')}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00B0F3" />
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  const destLat = trip.dropoffLocation?.coordinates?.[1] || 0;
  const destLng = trip.dropoffLocation?.coordinates?.[0] || 0;

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || destLat,
          longitude: currentLocation?.longitude || destLng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        <Marker coordinate={{ latitude: destLat, longitude: destLng }} title="Drop-off" pinColor="#FF3B30" />
        <Polyline coordinates={routeCoordinates} strokeColor="#00B0F3" strokeWidth={6} />
      </MapView>

      <View style={styles.bottomCard}>
        <Text style={styles.tripStatus}>In Progress</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Passenger</Text>
          <Text style={styles.infoValue}>{passengerName || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Destination</Text>
          <Text style={styles.infoValue}>{destinationAddress}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Distance Remaining</Text>
          <Text style={styles.infoValue}>{tripDistance}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estimated Time</Text>
          <Text style={styles.infoValue}>{tripDuration}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fare</Text>
          <Text style={styles.fare}>₦{fare.toLocaleString()}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={callPassenger}>
            <Ionicons name="call-outline" size={24} color="#010C44" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={whatsappPassenger}>
            <Ionicons name="logo-whatsapp" size={24} color="#010C44" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={openNavigation}>
            <Text style={styles.secondaryText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mainBtn} onPress={completeTrip} disabled={actionLoading}>
          {actionLoading ? <ActivityIndicator color="#010C44" /> : <Text style={styles.mainText}>Complete Trip</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010C44' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#010C44' },
  loadingText: { color: '#FFFFFF', marginTop: 16, fontSize: 18 },
  map: { flex: 1 },
  bottomCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 32, paddingTop: 24, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 20 },
  tripStatus: { color: '#00B0F3', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  infoLabel: { color: '#516880', fontSize: 16, fontWeight: '600' },
  infoValue: { color: '#010C44', fontSize: 16, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 16 },
  fare: { color: '#00B0F3', fontSize: 28, fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
  secondaryBtn: { backgroundColor: '#010C4420', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center' },
  secondaryText: { color: '#010C44', fontSize: 16, fontWeight: '700' },
  mainBtn: { backgroundColor: '#00B0F3', paddingVertical: 20, borderRadius: 16, alignItems: 'center', shadowColor: '#00B0F3', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 15 },
  mainText: { color: '#010C44', fontSize: 20, fontWeight: '800' },
  errorText: { color: '#FFFFFF', fontSize: 18, textAlign: 'center', marginTop: 50 },
});