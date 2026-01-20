// src/screens/passenger/TripCompletedScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  ActivityIndicator,
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

  const [rating, setRating] = useState(5);
  const [tipAmount, setTipAmount] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [tripDetails, setTripDetails] = useState(null);
  const [driverDetails, setDriverDetails] = useState({
    name: driverName,
    rating: driverRating,
    vehicleModel,
    vehiclePlate,
    profilePicUrl: null,
  });

  const tipOptions = [0, 100, 200, 500, 1000];
  const quickComments = ['Great ride!', 'Very professional', 'Clean vehicle', 'Safe driver', 'Friendly'];

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

  const handleSubmit = async () => {
    if (hasSubmitted) {
      Alert.alert('Already Submitted', 'You have already submitted your rating for this trip.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Submit rating
      const ratingResponse = await fetch(`${baseUrl}/trips/${tripId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: rating,
          comment: comment || '',
          tipAmount: tipAmount,
        }),
      });

      if (ratingResponse.ok) {
        setHasSubmitted(true);
        
        // Process tip payment if any
        if (tipAmount > 0) {
          const tipResponse = await fetch(`${baseUrl}/wallet/pay-tip`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tripId: tripId,
              driverId: driverId,
              amount: tipAmount,
            }),
          });

          if (!tipResponse.ok) {
            console.warn('Failed to process tip, but rating was submitted');
          }
        }

        Alert.alert(
          '✅ Thank You!',
          `Your ${rating}-star rating has been submitted${tipAmount > 0 ? ' along with your tip' : ''}.`,
          [
            {
              text: 'Done',
              onPress: () => navigation.navigate('PassengerMain'),
            },
          ]
        );
      } else {
        const errorText = await ratingResponse.text();
        throw new Error(errorText || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
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

  const totalAmount = fare + tipAmount;

  const getRatingEmoji = () => {
    switch(rating) {
      case 5: return '🌟';
      case 4: return '😊';
      case 3: return '😐';
      case 2: return '😕';
      case 1: return '😞';
      default: return '⭐';
    }
  };

  const getRatingText = () => {
    switch(rating) {
      case 5: return 'Excellent!';
      case 4: return 'Good';
      case 3: return 'Average';
      case 2: return 'Below Average';
      case 1: return 'Poor';
      default: return 'Rate your ride';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Header with Animation */}
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

        {/* Rating Section */}
        {!hasSubmitted && (
          <View style={styles.ratingCard}>
            <View style={styles.ratingHeader}>
              <Text style={styles.cardTitle}>Rate Your Ride</Text>
              <Text style={styles.ratingEmoji}>{getRatingEmoji()}</Text>
            </View>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color={star <= rating ? "#FFD700" : "#D1D1D6"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.ratingDescription}>{getRatingText()}</Text>

            {/* Quick Comments */}
            <View style={styles.quickCommentsContainer}>
              {quickComments.map((quickComment, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickCommentButton,
                    comment === quickComment && styles.quickCommentButtonSelected
                  ]}
                  onPress={() => setComment(comment === quickComment ? '' : quickComment)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.quickCommentText,
                    comment === quickComment && styles.quickCommentTextSelected
                  ]}>
                    {quickComment}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Comment */}
            <TextInput
              style={styles.commentInput}
              placeholder="Add a personal comment (optional)"
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={3}
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Tip Section */}
        {!hasSubmitted && (
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <Ionicons name="gift" size={24} color="#FF9500" />
              <View style={styles.tipHeaderText}>
                <Text style={styles.cardTitle}>Add a Tip</Text>
                <Text style={styles.tipSubtitle}>Show your appreciation</Text>
              </View>
            </View>
            
            <View style={styles.tipContainer}>
              {tipOptions.map((tip) => (
                <TouchableOpacity
                  key={tip}
                  style={[
                    styles.tipButton,
                    tipAmount === tip && styles.selectedTipButton,
                  ]}
                  onPress={() => setTipAmount(tip)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.tipButtonText,
                    tipAmount === tip && styles.selectedTipButtonText,
                  ]}>
                    {tip === 0 ? 'No Tip' : `₦${tip}`}
                  </Text>
                  {tip > 0 && tipAmount === tip && (
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Payment Breakdown */}
        <View style={styles.paymentCard}>
          <Text style={styles.cardTitle}>Payment Details</Text>
          <View style={styles.paymentBreakdown}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Trip Fare</Text>
              <Text style={styles.paymentValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            
            {tipAmount > 0 && (
              <View style={styles.paymentRow}>
                <View style={styles.tipLabelContainer}>
                  <Text style={styles.paymentLabel}>Driver Tip</Text>
                  <View style={styles.thankYouBadge}>
                    <Text style={styles.thankYouText}>Thank you! 🙏</Text>
                  </View>
                </View>
                <Text style={[styles.paymentValue, styles.tipValue]}>
                  +₦{tipAmount.toLocaleString()}
                </Text>
              </View>
            )}
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>₦{totalAmount.toLocaleString()}</Text>
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

        {/* Action Buttons */}
        {!hasSubmitted ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isSubmitting ? ['#CCCCCC', '#AAAAAA'] : ['#007AFF', '#0051D5']}
                style={styles.submitButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>
                      {tipAmount > 0 ? 'Submit & Pay Tip' : 'Submit Rating'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => navigation.navigate('PassengerMain')}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.submittedContainer}>
            <View style={styles.submittedBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.submittedText}>Rating Submitted Successfully!</Text>
            </View>
          </View>
        )}

        {/* Additional Actions */}
        <View style={styles.additionalActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('PassengerMain')}
            activeOpacity={0.7}
          >
            <Ionicons name="car-sport" size={20} color="#007AFF" />
            <Text style={styles.actionButtonText}>Book Another Ride</Text>
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('TripHistory')}
            activeOpacity={0.7}
          >
            <Ionicons name="time" size={20} color="#666" />
            <Text style={[styles.actionButtonText, { color: '#666' }]}>View Trip History</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

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
  ratingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingEmoji: {
    fontSize: 32,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingDescription: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  quickCommentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickCommentButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  quickCommentButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  quickCommentText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  quickCommentTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  commentInput: {
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    minHeight: 100,
  },
  tipCard: {
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
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  tipHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  tipSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tipButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  selectedTipButton: {
    backgroundColor: '#FF9500',
    borderColor: '#FF9500',
  },
  tipButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  selectedTipButtonText: {
    color: '#FFFFFF',
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
  tipLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  tipValue: {
    color: '#FF9500',
  },
  thankYouBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  thankYouText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
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
  actionButtons: {
    marginBottom: 16,
  },
  submitButton: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    shadowOpacity: 0.1,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submittedContainer: {
    marginBottom: 16,
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F7ED',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  submittedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
  additionalActions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
});