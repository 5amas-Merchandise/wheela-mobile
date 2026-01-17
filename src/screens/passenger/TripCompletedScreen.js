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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth';

const baseUrl = 'https://wheels-backend.vercel.app';

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
    tripDuration = 0, // in seconds
  } = route.params || {};

  const [rating, setRating] = useState(5);
  const [tipAmount, setTipAmount] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [tripDetails, setTripDetails] = useState(null);

  const tipOptions = [0, 100, 200, 500, 1000];

  useEffect(() => {
    fetchTripDetails();
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
          'Thank You!',
          'Your rating and tip have been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('PassengerHome'),
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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Today';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimeOfDay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalAmount = fare + tipAmount;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#34C759" />
          </View>
          <Text style={styles.successTitle}>Trip Completed!</Text>
          <Text style={styles.successSubtitle}>
            {tripDetails?.completedAt 
              ? `Completed on ${formatDate(tripDetails.completedAt)}`
              : 'Thank you for riding with us'}
          </Text>
        </View>

        {/* Trip Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Summary</Text>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Ionicons name="cash-outline" size={24} color="#666" />
              <Text style={styles.summaryLabel}>Fare</Text>
              <Text style={styles.summaryValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Ionicons name="time-outline" size={24} color="#666" />
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{formatTime(tripDuration)}</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Ionicons name="car-outline" size={24} color="#666" />
              <Text style={styles.summaryLabel}>Service</Text>
              <Text style={styles.summaryValue}>{formatServiceType(serviceType)}</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Ionicons name="card-outline" size={24} color="#666" />
              <Text style={styles.summaryLabel}>Payment</Text>
              <Text style={styles.summaryValue}>{paymentMethod === 'cash' ? 'Cash' : 'Wallet'}</Text>
            </View>
          </View>
        </View>

        {/* Driver Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Driver</Text>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {driverName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.driverStats}>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>{driverRating}</Text>
                </View>
                <Text style={styles.vehicleText}>
                  {vehicleModel} • {vehiclePlate}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rating */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {hasSubmitted ? 'Your Rating' : 'Rate Your Driver'}
          </Text>
          <View style={styles.ratingContainerMain}>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => !hasSubmitted && setRating(star)}
                  disabled={hasSubmitted}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={40}
                    color="#FFD700"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingTextMain}>
              {rating === 5 ? 'Excellent! ⭐⭐⭐⭐⭐' : 
               rating === 4 ? 'Good ⭐⭐⭐⭐' : 
               rating === 3 ? 'Average ⭐⭐⭐' : 
               rating === 2 ? 'Fair ⭐⭐' : 'Poor ⭐'}
            </Text>
          </View>
        </View>

        {/* Tip */}
        {!hasSubmitted && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add a Tip (Optional)</Text>
            <Text style={styles.tipDescription}>
              Support your driver with a tip
            </Text>
            <View style={styles.tipContainer}>
              {tipOptions.map((tip) => (
                <TouchableOpacity
                  key={tip}
                  style={[
                    styles.tipButton,
                    tipAmount === tip && styles.selectedTipButton,
                  ]}
                  onPress={() => setTipAmount(tip)}
                >
                  <Text style={[
                    styles.tipButtonText,
                    tipAmount === tip && styles.selectedTipButtonText,
                  ]}>
                    {tip === 0 ? 'No Tip' : `₦${tip}`}
                  </Text>
                  {tip > 0 && tipAmount === tip && (
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Comment */}
        {!hasSubmitted && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add a Comment (Optional)</Text>
            <View style={styles.commentContainer}>
              <Text style={styles.commentLabel}>How was your ride?</Text>
              <View style={styles.commentInputContainer}>
                <Ionicons name="chatbubble-outline" size={20} color="#666" style={styles.commentIcon} />
                <Text style={styles.commentInput}>
                  {comment || 'Share your experience...'}
                </Text>
                <TouchableOpacity
                  onPress={() => setComment('')}
                  style={styles.clearCommentButton}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Fare Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fare Breakdown</Text>
          <View style={styles.fareBreakdown}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Trip Fare</Text>
              <Text style={styles.fareValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            <View style={styles.fareRow}>
              <View style={styles.tipLabelContainer}>
                <Text style={styles.fareLabel}>Tip</Text>
                {tipAmount > 0 && (
                  <Text style={styles.tipNote}>Thank you! 🙏</Text>
                )}
              </View>
              <Text style={[
                styles.fareValue,
                tipAmount > 0 && styles.tipValue
              ]}>
                ₦{tipAmount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.fareRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{totalAmount.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        {!hasSubmitted ? (
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <Text style={styles.submitButtonText}>Submitting...</Text>
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {tipAmount > 0 ? 'Submit & Pay Tip' : 'Submit Rating'}
                </Text>
                {tipAmount > 0 && (
                  <Text style={styles.submitTotalText}>
                    ₦{totalAmount.toLocaleString()}
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.submittedContainer}>
            <View style={styles.submittedBadge}>
              <Ionicons name="checkmark" size={20} color="#34C759" />
              <Text style={styles.submittedText}>Rating Submitted</Text>
            </View>
          </View>
        )}

        {/* Return to Passenger Online Button */}
        <TouchableOpacity
          style={styles.returnButton}
          onPress={() => navigation.navigate('PassengerOnline')}
          activeOpacity={0.7}
        >
          <Ionicons name="car-sport" size={22} color="#007AFF" />
          <Text style={styles.returnButtonText}>Find Another Ride</Text>
        </TouchableOpacity>

        {/* Back to Home Button */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('PassengerMain')}
          activeOpacity={0.7}
        >
          <Ionicons name="home-outline" size={20} color="#666" />
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  driverAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  driverStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    fontWeight: '600',
  },
  vehicleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ratingContainerMain: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ratingTextMain: {
    fontSize: 18,
    color: '#000',
    fontWeight: '600',
    textAlign: 'center',
  },
  tipDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  tipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  tipButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    gap: 6,
  },
  selectedTipButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tipButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  selectedTipButtonText: {
    color: '#FFFFFF',
  },
  commentContainer: {
    marginTop: 8,
  },
  commentLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  commentIcon: {
    marginRight: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 15,
    color: '#666',
    minHeight: 40,
  },
  clearCommentButton: {
    padding: 4,
  },
  fareBreakdown: {
    padding: 4,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  tipLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipNote: {
    fontSize: 12,
    color: '#34C759',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fareValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  tipValue: {
    color: '#34C759',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    color: '#000',
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 24,
    color: '#000',
    fontWeight: '800',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  submitTotalText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },
  submittedContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  submittedText: {
    fontSize: 16,
    color: '#34C759',
    fontWeight: '600',
  },
  returnButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#007AFF20',
    gap: 10,
  },
  returnButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  homeButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});