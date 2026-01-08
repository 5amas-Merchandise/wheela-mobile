import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

import { getAuthToken } from '../../utils/auth';

const { width } = Dimensions.get('window');

export default function TripSearchScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const [searching, setSearching] = useState(true);
  const [driversFound, setDriversFound] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('3 min');
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [token, setToken] = useState(null);
  const [requestId, setRequestId] = useState(null);

  const { requestId: initialRequestId, rideType, pickup, dropoff, estimatedFare } = route.params || {};

  useEffect(() => {
    const loadToken = async () => {
      const authToken = await getAuthToken();
      setToken(authToken);
    };
    loadToken();

    // Start search animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Simulate finding drivers
    simulateDriverSearch();
  }, []);

  const simulateDriverSearch = () => {
    // Simulate drivers appearing
    setTimeout(() => {
      setDriversFound(1);
      const drivers = [
        {
          id: 1,
          latitude: pickup.latitude + 0.001,
          longitude: pickup.longitude + 0.001,
          heading: 45,
        },
        {
          id: 2,
          latitude: pickup.latitude - 0.002,
          longitude: pickup.longitude + 0.002,
          heading: 120,
        },
      ];
      setNearbyDrivers(drivers);
      
      // Simulate driver found after 5 seconds
      setTimeout(() => {
        setSearching(false);
        Alert.alert(
          'Driver Found!',
          'John is arriving in 3 minutes',
          [
            {
              text: 'View Details',
              onPress: () => navigation.navigate('TripTracking', {
                driverName: 'John',
                driverRating: '4.9',
                carModel: 'Toyota Camry',
                licensePlate: 'ABC123',
                estimatedArrival: '3 min',
                pickup,
                dropoff,
                fare: estimatedFare,
              }),
            },
          ]
        );
      }, 5000);
    }, 2000);
  };

  const cancelSearch = async () => {
    if (requestId && token) {
      try {
        await axios.post(
          `${baseUrl}/trips/cancel/${requestId}`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );
      } catch (error) {
        console.error('Cancel error:', error);
      }
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          ...pickup,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        {/* Pickup Marker */}
        {pickup && (
          <Marker coordinate={pickup} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pickupMarker}>
              <Ionicons name="location" size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Nearby Drivers */}
        {nearbyDrivers.map((driver) => (
          <Marker
            key={driver.id}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driver.heading}
          >
            <Animated.View style={[styles.driverMarker, { opacity: fadeAnim }]}>
              <Ionicons name="car" size={24} color="#00B0F3" />
            </Animated.View>
          </Marker>
        ))}
      </MapView>

      {/* Searching Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finding your ride</Text>
        <Text style={styles.headerSubtitle}>
          {searching ? 'Searching for nearby drivers...' : 'Driver found!'}
        </Text>
      </View>

      {/* Search Card */}
      <View style={styles.searchCard}>
        <View style={styles.searchStatus}>
          <Animated.View style={[styles.searchingIcon, { opacity: fadeAnim }]}>
            <Ionicons name="search" size={32} color="#00B0F3" />
          </Animated.View>
          
          <View style={styles.searchInfo}>
            <Text style={styles.searchTitle}>
              {searching ? 'Searching...' : 'Driver Found!'}
            </Text>
            <Text style={styles.searchSubtitle}>
              {searching 
                ? `Found ${driversFound} driver${driversFound !== 1 ? 's' : ''} nearby`
                : 'John is arriving in 3 minutes'
              }
            </Text>
          </View>
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={20} color="#666" />
            <Text style={styles.detailText}>Estimated arrival: {estimatedTime}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash" size={20} color="#666" />
            <Text style={styles.detailText}>Fare: ₦{estimatedFare?.toLocaleString()}</Text>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={cancelSearch}
        >
          <Text style={styles.cancelButtonText}>Cancel Ride</Text>
        </TouchableOpacity>
      </View>

      {/* Live Updates */}
      {searching && (
        <View style={styles.updatesCard}>
          <Ionicons name="information-circle" size={20} color="#F59E0B" />
          <Text style={styles.updatesText}>
            We're finding the best driver for you...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchCard: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  searchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchingIcon: {
    marginRight: 16,
  },
  searchInfo: {
    flex: 1,
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },
  searchSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  detailsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#0A2540',
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  updatesCard: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  updatesText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#92400E',
  },
  pickupMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00B0F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  driverMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00B0F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});