// src/screens/passenger/TripHistoryScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuthToken } from '../../utils/auth';

const API_BASE_URL = 'https://wheels-backend-7ydc.onrender.com';
const GOOGLE_MAPS_API_KEY = 'AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo'; // Replace with your key

// Service type icon mapping
const SERVICE_ICONS = {
  'CITY_RIDE': 'car-outline',
  'OUTSTATION': 'airplane-outline',
  'RENTAL': 'time-outline',
  'LUXURY': 'car-sport-outline',
  'BIKE': 'bicycle-outline',
  'KEKE': 'triangle-outline',
};

// Service type display names
const SERVICE_NAMES = {
  'CITY_RIDE': 'City Ride',
  'OUTSTATION': 'Outstation',
  'RENTAL': 'Rental',
  'LUXURY': 'Luxury',
  'BIKE': 'Bike',
  'KEKE': 'Keke',
};

// Format date to readable format
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

// Format time to readable format
const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const options = { hour: 'numeric', minute: '2-digit', hour12: true };
  return date.toLocaleTimeString('en-US', options);
};

// Google Maps Geocoding function
const getAddressFromCoordinates = async (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return 'Unknown Location';
  }

  try {
    const [lng, lat] = coordinates;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results[0]) {
      // Get a shorter, more readable address
      const address = data.results[0].formatted_address;
      
      // For Lagos addresses, try to extract neighborhood
      if (address.includes('Lagos')) {
        // Try to get a more specific location name
        for (const component of data.results[0].address_components) {
          if (component.types.includes('neighborhood') || 
              component.types.includes('sublocality') ||
              component.types.includes('locality')) {
            return `${component.long_name}, Lagos`;
          }
        }
      }
      
      // Return first 40 characters to keep it readable
      return address.length > 40 ? address.substring(0, 40) + '...' : address;
    }
    
    // Fallback: Return coordinates
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  } catch (error) {
    console.error('Geocoding error:', error);
    
    // Fallback: Return coordinates
    const [lng, lat] = coordinates;
    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
};

export default function TripHistoryScreen({ route }) {
  const navigation = useNavigation();
  const role = route?.params?.role || 'passenger';
  
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addresses, setAddresses] = useState({}); // Cache for addresses

  const LIMIT = 20;

  // Fetch trip history from API
  const fetchTripHistory = async (isRefresh = false, loadMore = false) => {
    try {
      const currentOffset = loadMore ? offset : 0;
      
      if (loadMore) {
        setLoadingMore(true);
      } else if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      setError(null);

      // Get auth token
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated. Please login again.');
      }

      // Use the correct endpoint from your backend
      const response = await fetch(
        `${API_BASE_URL}/trips?role=${role}&limit=${LIMIT}&offset=${currentOffset}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to fetch trip history');
      }

      const data = await response.json();
      console.log('Trip history data:', data);

      let tripsData = data.trips || [];
      
      // Process trips: fetch addresses for each trip
      const processedTrips = await Promise.all(
        tripsData.map(async (trip) => {
          // Try to get addresses from stored fields first
          let pickupAddress = trip.pickupAddress || trip.pickupLocationName || '';
          let dropoffAddress = trip.dropoffAddress || trip.dropoffLocationName || '';
          
          // If no stored addresses, try geocoding
          if (!pickupAddress && trip.pickupLocation?.coordinates) {
            pickupAddress = await getAddressFromCoordinates(trip.pickupLocation.coordinates);
          }
          
          if (!dropoffAddress && trip.dropoffLocation?.coordinates) {
            dropoffAddress = await getAddressFromCoordinates(trip.dropoffLocation.coordinates);
          }
          
          return {
            ...trip,
            pickupDisplayAddress: pickupAddress || 'Pickup Location',
            dropoffDisplayAddress: dropoffAddress || 'Destination'
          };
        })
      );

      if (loadMore) {
        setTrips(prev => [...prev, ...processedTrips]);
        setOffset(currentOffset + LIMIT);
      } else {
        setTrips(processedTrips);
        setOffset(LIMIT);
      }

      // Calculate simple stats from trips
      calculateStats(processedTrips);
      setHasMore(processedTrips.length === LIMIT);

    } catch (err) {
      console.error('Error fetching trip history:', err);
      setError(err.message);
      
      if (err.message.includes('Not authenticated')) {
        Alert.alert('Session Expired', 'Please log in again', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Calculate stats from trips
  const calculateStats = (tripList) => {
    const completedTrips = tripList.filter(trip => trip.status === 'completed');
    const totalSpent = completedTrips.reduce((sum, trip) => sum + (trip.finalFare || trip.estimatedFare || 0), 0);
    
    setStats({
      totalTrips: tripList.length,
      completedTrips: completedTrips.length,
      totalSpent: totalSpent // Keep as exact amount
    });
  };

  // Initial load
  useEffect(() => {
    fetchTripHistory();
  }, [role]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    fetchTripHistory(true);
  }, [role]);

  // Load more trips
  const loadMoreTrips = () => {
    if (!loadingMore && hasMore && trips.length > 0) {
      fetchTripHistory(false, true);
    }
  };

  // Navigate to trip details
  const viewTripDetails = (trip) => {
    navigation.navigate('TripDetails', { 
      trip: {
        ...trip,
        id: trip._id,
        fareAmount: trip.finalFare || trip.estimatedFare || 0,
        pickupAddress: trip.pickupDisplayAddress,
        dropoffAddress: trip.dropoffDisplayAddress,
        completedAt: trip.completedAt || trip.requestedAt
      }, 
      role 
    });
  };

  // Render single trip card
  const renderTripItem = ({ item }) => {
    const isCancelled = item.status === 'cancelled';
    const isCompleted = item.status === 'completed';
    const displayDate = item.completedAt || item.cancelledAt || item.requestedAt;
    const serviceIcon = SERVICE_ICONS[item.serviceType] || 'car-outline';
    const serviceName = SERVICE_NAMES[item.serviceType] || item.serviceType;
    const fareAmount = item.finalFare || item.estimatedFare || 0;

    return (
      <TouchableOpacity
        style={[styles.tripCard, isCancelled && styles.tripCardCancelled]}
        onPress={() => viewTripDetails(item)}
      >
        {/* Header: Date and Price */}
        <View style={styles.tripHeader}>
          <Text style={styles.tripDate}>{formatDate(displayDate)}</Text>
          <Text style={[styles.tripPrice, isCancelled && styles.cancelledText]}>
            {isCancelled ? 'Cancelled' : `₦${fareAmount.toLocaleString()}`}
          </Text>
        </View>

        {/* Body: Route and Icon */}
        <View style={styles.tripBody}>
          <View style={styles.routeContainer}>
            {/* Dot and Line */}
            <View style={styles.dotLine}>
              <View style={styles.greenDot} />
              <View style={styles.line} />
              <View style={styles.redDot} />
            </View>

            {/* Addresses */}
            <View style={styles.addresses}>
              <Text style={styles.pickupText} numberOfLines={1}>
                {item.pickupDisplayAddress || 'Pickup location'}
              </Text>
              <Text style={styles.dropoffText} numberOfLines={1}>
                {item.dropoffDisplayAddress || 'Destination'}
              </Text>
            </View>

            {/* Service Type Icon */}
            <View style={styles.rideTypeIcon}>
              <Ionicons 
                name={serviceIcon} 
                size={28} 
                color={isCancelled ? '#94A3B8' : '#00B0F3'} 
              />
            </View>
          </View>

          {/* Footer: Time, Service Type, Distance */}
          <View style={styles.tripFooter}>
            <Text style={styles.tripTime}>{formatTime(displayDate)}</Text>
            <Text style={styles.tripType}>{serviceName}</Text>
            {item.distanceKm > 0 && (
              <Text style={styles.tripDistance}>
                {item.distanceKm.toFixed(1)} km
              </Text>
            )}
          </View>
        </View>

        {/* Status badge */}
        <View style={[
          styles.statusBadge,
          isCancelled ? styles.statusCancelled : 
          isCompleted ? styles.statusCompleted : 
          styles.statusActive
        ]}>
          <Text style={[
            styles.statusBadgeText,
            isCancelled ? styles.statusBadgeTextCancelled :
            isCompleted ? styles.statusBadgeTextCompleted :
            styles.statusBadgeTextActive
          ]}>
            {item.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {/* Cancellation reason if cancelled */}
        {isCancelled && item.cancellationReason && (
          <View style={styles.cancellationBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#EF4444" />
            <Text style={styles.cancellationText}>
              {item.cancellationReason.replace(/_/g, ' ')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {role === 'driver' ? 'Driver History' : 'Trip History'}
          </Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00B0F3" />
          <Text style={styles.loadingText}>Loading trips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && trips.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {role === 'driver' ? 'Driver History' : 'Trip History'}
          </Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchTripHistory()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {role === 'driver' ? 'Driver History' : 'Trip History'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Stats Summary */}
      {stats && trips.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.completedTrips}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>₦{stats.totalSpent.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      )}

      {/* Trip List */}
      <FlatList
        data={trips}
        keyExtractor={(item) => item._id || item.id}
        renderItem={renderTripItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={['#00B0F3']} 
          />
        }
        onEndReached={loadMoreTrips}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => (
          loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#00B0F3" />
            </View>
          ) : null
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>No trips yet</Text>
            <Text style={styles.emptySubtext}>
              Your trip history will appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  listContent: {
    padding: 16,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  tripCardCancelled: {
    opacity: 0.7,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A2540',
  },
  tripPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00B0F3',
  },
  cancelledText: {
    color: '#EF4444',
    fontSize: 16,
  },
  tripBody: {
    flexDirection: 'column',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotLine: {
    alignItems: 'center',
    marginRight: 12,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  line: {
    width: 2,
    height: 32,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  addresses: {
    flex: 1,
  },
  pickupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A2540',
    marginBottom: 8,
  },
  dropoffText: {
    fontSize: 15,
    color: '#64748B',
  },
  rideTypeIcon: {
    marginLeft: 16,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tripTime: {
    fontSize: 14,
    color: '#64748B',
  },
  tripType: {
    fontSize: 14,
    color: '#00B0F3',
    fontWeight: '600',
  },
  tripDistance: {
    fontSize: 14,
    color: '#64748B',
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#EFF6FF',
  },
  statusCompleted: {
    backgroundColor: '#ECFDF5',
  },
  statusCancelled: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: '#3B82F6',
  },
  statusBadgeTextCompleted: {
    color: '#10B981',
  },
  statusBadgeTextCancelled: {
    color: '#EF4444',
  },
  cancellationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  cancellationText: {
    fontSize: 13,
    color: '#EF4444',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
});