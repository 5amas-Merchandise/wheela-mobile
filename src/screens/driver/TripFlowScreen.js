import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import axios from 'axios';
import Constants from 'expo-constants';
import { useNavigation, useRoute } from '@react-navigation/native';

const baseUrl = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) || process.env.BASE_URL || '';

export default function TripFlowScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { tripId } = route.params || {};

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!tripId) {
      Alert.alert('Error', 'No trip ID');
      setLoading(false);
      return;
    }

    const fetchTrip = async () => {
      try {
        const res = await axios.get(`${baseUrl}/trips/${tripId}`);
        setTrip(res.data.trip);
      } catch (err) {
        Alert.alert('Error', 'Could not load trip');
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();

    // Optional: poll for updates
    const interval = setInterval(fetchTrip, 10000);
    return () => clearInterval(interval);
  }, [tripId]);

  const updateStatus = async (newStatus) => {
    setActionLoading(true);
    try {
      let endpoint = '';
      if (newStatus === 'arrived') endpoint = '/start';
      else if (newStatus === 'picked_up') endpoint = '/pickup';
      else if (newStatus === 'completed') endpoint = '/complete';

      await axios.post(`${baseUrl}/trips/${tripId}${endpoint}`);
      const res = await axios.get(`${baseUrl}/trips/${tripId}`);
      setTrip(res.data.trip);

      if (newStatus === 'completed') {
        Alert.alert('Trip Completed ✓', `You earned ₦${(res.data.trip.fare / 100).toFixed(2)}`, [
          { text: 'OK', onPress: () => navigation.replace('DriverOnlineMap') },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Status update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openNavigation = () => {
    if (!trip?.destination?.lat || !trip?.destination?.lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${trip.destination.lat},${trip.destination.lng}&travelmode=driving`;
    Linking.openURL(url);
  };

  const callPassenger = () => {
    if (!trip?.passengerPhone) return;
    Linking.openURL(`tel:${trip.passengerPhone}`);
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

  const currentRegion = {
    latitude: trip.currentLocation?.lat || trip.pickup.lat,
    longitude: trip.currentLocation?.lng || trip.pickup.lng,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      {/* Full Screen Map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={currentRegion}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        <Marker coordinate={trip.pickup} title="Pickup" pinColor="#00B0F3" />
        <Marker coordinate={trip.destination} title="Drop-off" pinColor="#FFFFFF" />

        {/* Route Polyline (simplified - use Directions API in production) */}
        <Polyline
          coordinates={[trip.pickup, trip.destination]}
          strokeColor="#00B0F3"
          strokeWidth={6}
        />
      </MapView>

      {/* Bottom Action Card */}
      <View style={styles.bottomCard}>
        <Text style={styles.tripStatus}>{trip.status.replace('_', ' ').toUpperCase()}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Passenger</Text>
          <Text style={styles.infoValue}>{trip.passengerName || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Destination</Text>
          <Text style={styles.infoValue}>{trip.destination.address}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fare</Text>
          <Text style={styles.fare}>₦{(trip.fare / 100).toFixed(2)}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={callPassenger}>
            <Text style={styles.secondaryText}>Call Passenger</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={openNavigation}>
            <Text style={styles.secondaryText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Main Action Button */}
        {trip.status === 'accepted' && (
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={() => updateStatus('arrived')}
            disabled={actionLoading}
          >
            <Text style={styles.mainText}>Arrived at Pickup</Text>
          </TouchableOpacity>
        )}

        {trip.status === 'arrived' && (
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={() => updateStatus('picked_up')}
            disabled={actionLoading}
          >
            <Text style={styles.mainText}>Passenger Picked Up</Text>
          </TouchableOpacity>
        )}

        {trip.status === 'in_progress' && (
          <TouchableOpacity
            style={styles.mainBtn}
            onPress={() => updateStatus('completed')}
            disabled={actionLoading}
          >
            <Text style={styles.mainText}>Complete Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#010C44',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 18,
  },
  map: {
    flex: 1,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  tripStatus: {
    color: '#00B0F3',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#516880',
    fontSize: 16,
    fontWeight: '600',
  },
  infoValue: {
    color: '#010C44',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  fare: {
    color: '#00B0F3',
    fontSize: 28,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  secondaryBtn: {
    backgroundColor: '#010C4420',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    flex: 0.45,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#010C44',
    fontSize: 16,
    fontWeight: '700',
  },
  mainBtn: {
    backgroundColor: '#00B0F3',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  mainText: {
    color: '#010C44',
    fontSize: 20,
    fontWeight: '800',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
});