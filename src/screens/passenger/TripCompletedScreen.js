// src/screens/passenger/TripCompletedScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const baseUrl = 'https://wheels-backend-7ydc.onrender.com';

export default function TripCompletedScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  
  const {
    tripId,
    driverId,
    driverName = 'Driver',
    driverRating = '4.8',
    vehicleModel = 'Car',
    vehiclePlate = 'ABC-123',
    fare = 0,
    serviceType = 'CITY_RIDE',
    paymentMethod = 'wallet',
    tripDuration = 0,
    pickupAddress = '',
    destinationAddress = '',
    distanceKm = 0,
  } = route.params || {};

  const [tripDetails, setTripDetails] = useState(null);
  const [driverDetails, setDriverDetails] = useState({
    name: driverName,
    rating: driverRating,
    vehicleModel,
    vehiclePlate,
    profilePicUrl: null,
  });

  useEffect(() => {
    fetchTripDetails();
    fetchDriverDetails();
  }, []);

  const fetchTripDetails = async () => {
    try {
      const token = await getAuthToken();
      if (!token || !tripId) return;

      const response = await fetch(`${baseUrl}/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTripDetails(data.trip);
      }
    } catch (error) {
      console.error('Error fetching trip details:', error);
    }
  };

  const fetchDriverDetails = async () => {
    try {
      const token = await getAuthToken();
      if (!token || !driverId) return;

      const response = await fetch(`${baseUrl}/users/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setDriverDetails({
            name: data.user.name || driverName,
            rating: data.user.driverProfile?.rating || driverRating,
            vehicleModel: data.user.driverProfile?.vehicleModel || vehicleModel,
            vehiclePlate: data.user.driverProfile?.vehicleNumber || vehiclePlate,
            profilePicUrl: data.user.driverProfile?.profilePicUrl || null,
          });
        }
      }
    } catch (error) {
      console.warn('Error fetching driver details:', error);
    }
  };

  const formatServiceType = (type) => {
    const typeMap = {
      'CITY_RIDE': 'City Ride',
      'DELIVERY_BIKE': 'Bike Delivery',
      'LUXURY_RENTAL': 'Luxury Rental',
      'KEKE': 'Keke (Tricycle)',
      'CAR_RENTAL': 'Car Rental',
      'BIKE_RIDE': 'Bike Ride',
    };
    return typeMap[type] || type.replace('_', ' ');
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimeOfDay = (dateString) => {
    if (!dateString) return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.checkmarkContainer}>
            <LinearGradient
              colors={['#34C759', '#2EBB4F']}
              style={styles.checkmarkGradient}
            >
              <Ionicons name="checkmark" size={60} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>Trip Completed!</Text>
          <Text style={styles.successSubtitle}>
            {formatDate(tripDetails?.completedAt)}
          </Text>
          <Text style={styles.successTime}>
            at {formatTimeOfDay(tripDetails?.completedAt)}
          </Text>
        </View>

        {/* Trip Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Trip Summary</Text>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="cash" size={22} color="#007AFF" />
              </View>
              <Text style={styles.summaryLabel}>Fare</Text>
              <Text style={styles.summaryValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="time" size={22} color="#FF9500" />
              </View>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{formatTime(tripDuration)}</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="speedometer" size={22} color="#34C759" />
              </View>
              <Text style={styles.summaryLabel}>Distance</Text>
              <Text style={styles.summaryValue}>{distanceKm || '0'} km</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <View style={styles.iconCircle}>
                <Ionicons name="card" size={22} color="#FF3B30" />
              </View>
              <Text style={styles.summaryLabel}>Payment</Text>
              <Text style={styles.summaryValue}>
                {paymentMethod === 'cash' ? 'Cash' : 'Wallet'}
              </Text>
            </View>
          </View>
        </View>

        {/* Route Card */}
        {(pickupAddress || destinationAddress) && (
          <View style={styles.routeCard}>
            <View style={styles.routeItem}>
              <View style={styles.routeIconContainer}>
                <View style={styles.pickupDot} />
              </View>
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {pickupAddress || 'Pickup location'}
                </Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routeItem}>
              <View style={styles.routeIconContainer}>
                <View style={styles.dropoffDot} />
              </View>
              <View style={styles.routeDetails}>
                <Text style={styles.routeLabel}>DROPOFF</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {destinationAddress || 'Destination'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Driver Card */}
        <View style={styles.driverCard}>
          <Text style={styles.cardTitle}>Your Driver</Text>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatarContainer}>
              {driverDetails.profilePicUrl ? (
                <Image 
                  source={{ uri: driverDetails.profilePicUrl }} 
                  style={styles.driverAvatarImage}
                />
              ) : (
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {driverDetails.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              </View>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverDetails.name}</Text>
              <View style={styles.driverStats}>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>{driverDetails.rating}</Text>
                  <Text style={styles.ratingCount}>(500+ trips)</Text>
                </View>
              </View>
              <View style={styles.vehicleInfo}>
                <Ionicons name="car-sport" size={16} color="#666" />
                <Text style={styles.vehicleText}>
                  {driverDetails.vehicleModel} • {driverDetails.vehiclePlate}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>Payment Details</Text>
          <View style={styles.paymentBreakdown}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Trip Fare</Text>
              <Text style={styles.paymentValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            
            <View style={styles.paymentMethodRow}>
              <Ionicons 
                name={paymentMethod === 'cash' ? "cash" : "wallet"} 
                size={16} 
                color="#666" 
              />
              <Text style={styles.paymentMethodText}>
                Paid via {paymentMethod === 'cash' ? 'Cash' : 'Wallet'}
              </Text>
            </View>
          </View>
        </View>

        {/* Return Home Button */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('PassengerMain')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#007AFF', '#0051D5']}
            style={styles.homeButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="home" size={22} color="#FFFFFF" />
            <Text style={styles.homeButtonText}>Return to Home</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 30,
    paddingBottom: 20,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  checkmarkContainer: {
    marginBottom: 20,
  },
  checkmarkGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  successTime: {
    fontSize: 14,
    color: '#999',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIconContainer: {
    marginRight: 16,
    paddingTop: 2,
  },
  pickupDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#E3F2FD',
  },
  dropoffDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    borderWidth: 3,
    borderColor: '#FFE5E5',
  },
  routeDetails: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  routeAddress: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E5EA',
    marginLeft: 7,
    marginVertical: 8,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  driverAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  driverAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  driverAvatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 6,
  },
  driverStats: {
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 4,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  paymentBreakdown: {
    paddingHorizontal: 4,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentLabel: {
    fontSize: 16,
    color: '#666',
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#007AFF',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#666',
  },
  homeButton: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  homeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  homeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});