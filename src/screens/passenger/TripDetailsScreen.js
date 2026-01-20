// src/screens/TripDetailsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuthToken } from '../../utils/auth';

const API_BASE_URL = 'https://wheels-backend-7ydc.onrender.com';
const GOOGLE_MAPS_API_KEY = 'AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo'; // Replace with your key

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const options = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleDateString('en-US', options);
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
      return data.results[0].formatted_address;
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

export default function TripDetailsScreen({ route }) {
  const navigation = useNavigation();
  const { trip: initialTrip, role } = route.params || {};
  const [trip, setTrip] = useState(initialTrip);
  const [loading, setLoading] = useState(!initialTrip);
  const [addresses, setAddresses] = useState({
    pickup: '',
    dropoff: ''
  });
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  useEffect(() => {
    if (!initialTrip && route.params?.tripId) {
      fetchTripDetails(route.params.tripId);
    } else if (initialTrip) {
      fetchAddresses(initialTrip);
    }
  }, []);

  const fetchTripDetails = async (tripId) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch(
        `${API_BASE_URL}/trips/${tripId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch trip details');
      }

      const data = await response.json();
      const tripData = data.trip;
      setTrip(tripData);
      await fetchAddresses(tripData);
    } catch (err) {
      Alert.alert('Error', 'Failed to load trip details');
      console.error('Error fetching trip details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async (tripData) => {
    try {
      setLoadingAddresses(true);
      
      let pickupAddress = tripData.pickupAddress || tripData.pickupLocationName || '';
      let dropoffAddress = tripData.dropoffAddress || tripData.dropoffLocationName || '';
      
      // If no stored addresses, fetch from coordinates
      if (!pickupAddress && tripData.pickupLocation?.coordinates) {
        pickupAddress = await getAddressFromCoordinates(tripData.pickupLocation.coordinates);
      }
      
      if (!dropoffAddress && tripData.dropoffLocation?.coordinates) {
        dropoffAddress = await getAddressFromCoordinates(tripData.dropoffLocation.coordinates);
      }
      
      setAddresses({
        pickup: pickupAddress || 'Pickup Location',
        dropoff: dropoffAddress || 'Destination'
      });
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setAddresses({
        pickup: 'Pickup Location',
        dropoff: 'Destination'
      });
    } finally {
      setLoadingAddresses(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00B0F3" />
          <Text style={styles.loadingText}>Loading trip details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#EF4444" />
          <Text style={styles.errorText}>Trip details not available</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCancelled = trip.status === 'cancelled';
  const isCompleted = trip.status === 'completed';
  const fareAmount = trip.finalFare || trip.estimatedFare || 0;
  const driverEarnings = trip.driverEarnings || trip.finalFare || trip.estimatedFare || 0;
  const commission = trip.commission || 0;

  const openMaps = (coordinates, label) => {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return;
    }
    
    const [lng, lat] = coordinates;
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    
    Linking.openURL(url).catch(err => {
      console.error('Failed to open maps:', err);
      Alert.alert('Error', 'Could not open maps app');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={[
          styles.statusBanner,
          isCancelled ? styles.statusCancelled : 
          isCompleted ? styles.statusCompleted :
          styles.statusActive
        ]}>
          <Ionicons 
            name={isCancelled ? 'close-circle' : 
                  isCompleted ? 'checkmark-circle' : 
                  'time-outline'} 
            size={24} 
            color={isCancelled ? '#EF4444' : 
                   isCompleted ? '#10B981' : 
                   '#3B82F6'} 
          />
          <Text style={[
            styles.statusText,
            isCancelled ? styles.statusTextCancelled :
            isCompleted ? styles.statusTextCompleted :
            styles.statusTextActive
          ]}>
            {trip.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {/* Route Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.routeCard}>
            <TouchableOpacity 
              style={styles.routeItem}
              onPress={() => trip.pickupLocation?.coordinates && openMaps(trip.pickupLocation.coordinates, 'Pickup')}
              disabled={!trip.pickupLocation?.coordinates}
            >
              <View style={styles.routeIconContainer}>
                <View style={styles.greenDot} />
              </View>
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>Pickup</Text>
                {loadingAddresses ? (
                  <ActivityIndicator size="small" color="#64748B" />
                ) : (
                  <Text style={styles.routeAddress}>{addresses.pickup}</Text>
                )}
              </View>
              {trip.pickupLocation?.coordinates && (
                <Ionicons name="open-outline" size={18} color="#64748B" style={styles.mapIcon} />
              )}
            </TouchableOpacity>

            <View style={styles.routeLine} />

            <TouchableOpacity 
              style={styles.routeItem}
              onPress={() => trip.dropoffLocation?.coordinates && openMaps(trip.dropoffLocation.coordinates, 'Dropoff')}
              disabled={!trip.dropoffLocation?.coordinates}
            >
              <View style={styles.routeIconContainer}>
                <View style={styles.redDot} />
              </View>
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>Dropoff</Text>
                {loadingAddresses ? (
                  <ActivityIndicator size="small" color="#64748B" />
                ) : (
                  <Text style={styles.routeAddress}>{addresses.dropoff}</Text>
                )}
              </View>
              {trip.dropoffLocation?.coordinates && (
                <Ionicons name="open-outline" size={18} color="#64748B" style={styles.mapIcon} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Fare Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fare</Text>
          <View style={styles.card}>
            <View style={styles.fareSummary}>
              <Text style={styles.fareLabel}>Total Fare</Text>
              <Text style={styles.fareAmount}>₦{fareAmount.toLocaleString()}</Text>
            </View>
            
            {role === 'driver' && isCompleted && (
              <>
                <View style={styles.fareBreakdown}>
                  <Text style={styles.breakdownLabel}>Breakdown</Text>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownText}>Fare</Text>
                    <Text style={styles.breakdownValue}>₦{fareAmount.toLocaleString()}</Text>
                  </View>
                  {commission > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownText}>Commission</Text>
                      <Text style={[styles.breakdownValue, styles.commissionText]}>
                        -₦{commission.toLocaleString()}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.breakdownRow, styles.earningsRow]}>
                    <Text style={[styles.breakdownText, styles.earningsText]}>Your Earnings</Text>
                    <Text style={[styles.breakdownValue, styles.earningsAmount]}>
                      ₦{driverEarnings.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </>
            )}
            
            <View style={styles.paymentMethod}>
              <Ionicons 
                name={trip.paymentMethod === 'cash' ? 'cash-outline' : 'wallet-outline'} 
                size={18} 
                color="#64748B" 
              />
              <Text style={styles.paymentMethodText}>
                Paid with {trip.paymentMethod === 'cash' ? 'Cash' : 'Wallet'}
              </Text>
            </View>
          </View>
        </View>

        {/* Trip Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Information</Text>
          <View style={styles.card}>
            <InfoRow 
              icon="calendar-outline" 
              label="Requested" 
              value={formatDate(trip.requestedAt)} 
            />
            {trip.startedAt && (
              <InfoRow 
                icon="play-outline" 
                label="Started" 
                value={formatDate(trip.startedAt)} 
              />
            )}
            {trip.completedAt && (
              <InfoRow 
                icon="checkmark-outline" 
                label="Completed" 
                value={formatDate(trip.completedAt)} 
              />
            )}
            {trip.cancelledAt && (
              <InfoRow 
                icon="close-outline" 
                label="Cancelled" 
                value={formatDate(trip.cancelledAt)} 
              />
            )}
            <InfoRow 
              icon="car-outline" 
              label="Service Type" 
              value={trip.serviceType.replace(/_/g, ' ')} 
            />
            {trip.distanceKm > 0 && (
              <InfoRow 
                icon="navigate-outline" 
                label="Distance" 
                value={`${trip.distanceKm.toFixed(1)} km`} 
              />
            )}
            {trip.durationMinutes > 0 && (
              <InfoRow 
                icon="time-outline" 
                label="Duration" 
                value={`${trip.durationMinutes} minutes`} 
              />
            )}
          </View>
        </View>

        {/* Cancellation Info */}
        {isCancelled && trip.cancellationReason && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cancellation Details</Text>
            <View style={[styles.card, styles.cancellationCard]}>
              <View style={styles.cancellationRow}>
                <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                <Text style={styles.cancellationReason}>
                  {trip.cancellationReason.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Cash Payment Info */}
        {isCompleted && trip.paymentMethod === 'cash' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Confirmation</Text>
            <View style={[styles.card, styles.paymentConfirmationCard]}>
              <View style={styles.paymentConfirmationRow}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.paymentConfirmationText}>
                  Cash payment confirmed
                </Text>
              </View>
              {trip.cashReceivedAt && (
                <Text style={styles.cashDateText}>
                  Received on {formatDate(trip.cashReceivedAt)}
                </Text>
              )}
              {trip.cashAmount && (
                <Text style={styles.cashAmountText}>
                  Amount: ₦{trip.cashAmount.toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Trip ID */}
        <View style={styles.section}>
          <Text style={styles.tripId}>Trip ID: {trip._id || trip.id}</Text>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper Components
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoLeft}>
      <Ionicons name={icon} size={20} color="#64748B" />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

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
  content: {
    flex: 1,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
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
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusTextActive: {
    color: '#3B82F6',
  },
  statusTextCompleted: {
    color: '#10B981',
  },
  statusTextCancelled: {
    color: '#EF4444',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIconContainer: {
    marginRight: 16,
    alignItems: 'center',
  },
  greenDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  redDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  routeLine: {
    width: 2,
    height: 32,
    backgroundColor: '#E2E8F0',
    marginLeft: 7,
    marginVertical: 8,
  },
  routeDetails: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  routeAddress: {
    fontSize: 16,
    color: '#0A2540',
    fontWeight: '600',
    lineHeight: 22,
  },
  mapIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
  fareSummary: {
    alignItems: 'center',
    marginBottom: 16,
  },
  fareLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  fareAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#00B0F3',
  },
  fareBreakdown: {
    marginBottom: 16,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  earningsRow: {
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
  },
  breakdownText: {
    fontSize: 14,
    color: '#64748B',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#0A2540',
    fontWeight: '600',
  },
  commissionText: {
    color: '#EF4444',
  },
  earningsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A2540',
  },
  earningsAmount: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '700',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 15,
    color: '#64748B',
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 15,
    color: '#0A2540',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cancellationCard: {
    backgroundColor: '#FEF2F2',
  },
  cancellationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancellationReason: {
    fontSize: 15,
    color: '#EF4444',
    marginLeft: 8,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  paymentConfirmationCard: {
    backgroundColor: '#ECFDF5',
  },
  paymentConfirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentConfirmationText: {
    fontSize: 15,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 8,
  },
  cashDateText: {
    fontSize: 14,
    color: '#059669',
    marginLeft: 28,
    marginBottom: 4,
  },
  cashAmountText: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '700',
    marginLeft: 28,
  },
  tripId: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
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
  backButton: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});