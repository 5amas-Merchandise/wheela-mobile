import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Share,
  Linking,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import * as Auth from '../../utils/auth';

// REPLACE WITH YOUR ACTUAL API URL
const API_URL = 'https://wheels-backend-7ydc.onrender.com';

const STATUS_CONFIG = {
  confirmed: { 
    color: '#10B981', 
    bg: '#D1FAE5',
    label: 'CONFIRMED', 
    icon: 'checkmark-circle',
  },
  checked_in: { 
    color: '#00B0F3', 
    bg: '#DBEAFE',
    label: 'CHECKED IN', 
    icon: 'log-in',
  },
  completed: { 
    color: '#64748B', 
    bg: '#F1F5F9',
    label: 'COMPLETED', 
    icon: 'checkmark-done',
  },
  cancelled: { 
    color: '#EF4444', 
    bg: '#FEE2E2',
    label: 'CANCELLED', 
    icon: 'close-circle',
  },
  no_show: { 
    color: '#F59E0B', 
    bg: '#FEF3C7',
    label: 'NO SHOW', 
    icon: 'time',
  },
  pending: {
    color: '#8B5CF6',
    bg: '#EDE9FE',
    label: 'PENDING',
    icon: 'time-outline',
  }
};

export default function IntercityBookingDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { bookingId, bookingReference } = route.params;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const token = await Auth.getAuthToken();
      
      const response = await axios.get(
        `${API_URL}/intercity/bookings/${bookingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ Booking details fetched:', response.data);

      if (response.data.success) {
        setBooking(response.data.booking);
      } else {
        Alert.alert('Error', 'Failed to load booking details');
        navigation.goBack();
      }
    } catch (error) {
      console.error('❌ Fetch booking details error:', error);
      Alert.alert(
        'Error', 
        'Unable to load booking details. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel ${booking.bookingReference}?\n\nRefund will be processed within 5-7 business days.`,
      [
        { text: 'No, Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => cancelBooking()
        }
      ]
    );
  };

  const cancelBooking = async () => {
    try {
      const token = await Auth.getAuthToken();
      const response = await axios.post(
        `${API_URL}/intercity/bookings/${bookingId}/cancel`,
        { reason: 'Cancelled by passenger' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert(
          'Cancellation Successful',
          'Your booking has been cancelled. Refund will be processed within 5-7 business days.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('❌ Cancel error:', error);
      const errorMsg = error.response?.data?.error?.message || 'Unable to cancel booking.';
      Alert.alert('Cancellation Failed', errorMsg);
    }
  };

  const handleShare = async () => {
    try {
      const message = `🚌 Trip Booking Confirmation\n\n` +
        `Booking Reference: ${booking.bookingReference}\n` +
        `From: ${booking.route.from}\n` +
        `To: ${booking.route.to}\n` +
        `Date: ${formatDate(booking.departure.date)}\n` +
        `Time: ${formatTime(booking.departure.time)}\n` +
        `Seats: ${booking.numberOfSeats}\n` +
        `Amount: ₦${parseFloat(booking.totalAmountInNaira).toLocaleString()}\n\n` +
        `Company: ${booking.company.name}\n` +
        `Status: ${booking.status.toUpperCase()}`;

      await Share.share({ message });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleCallCompany = () => {
    if (booking?.company?.phone) {
      Linking.openURL(`tel:${booking.company.phone}`);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDuration = (duration) => {
    if (!duration) return 'N/A';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}h ${minutes}m`;
  };

  const canCancel = () => {
    if (!booking) return false;
    const upcoming = new Date(booking.departure?.date) > new Date();
    return upcoming && ['confirmed', 'pending'].includes(booking.status);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00B0F3" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Booking not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0A2540" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Booking Details</Text>
        
        <TouchableOpacity 
          style={styles.shareBtn}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={22} color="#00B0F3" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={24} color={statusConfig.color} />
            <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <Text style={styles.bookingRef}>{booking.bookingReference}</Text>
          <Text style={styles.bookingDate}>
            Booked on {formatDate(booking.bookingDate)}
          </Text>
        </View>

        {/* Journey Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Journey Details</Text>
          
          <View style={styles.journeyContainer}>
            <View style={styles.journeyRow}>
              <View style={styles.journeyTime}>
                <Text style={styles.timeText}>{formatTime(booking.departure.time)}</Text>
                <Text style={styles.dateText}>{formatDate(booking.departure.date)}</Text>
              </View>
              <View style={styles.journeyLine}>
                <View style={styles.circleFilled} />
                <View style={styles.verticalLine} />
                <Ionicons name="location" size={20} color="#00B0F3" style={styles.locationIcon} />
              </View>
              <View style={styles.journeyLocation}>
                <Text style={styles.cityText}>{booking.route.from.split(',')[0]}</Text>
                <Text style={styles.terminalText}>{booking.departure.terminal || 'Main Terminal'}</Text>
              </View>
            </View>

            <View style={styles.durationContainer}>
              <Ionicons name="time-outline" size={16} color="#64748B" />
              <Text style={styles.durationLabel}>
                {getDuration(booking.route.duration)} • {booking.route.distance} km
              </Text>
            </View>

            <View style={styles.journeyRow}>
              <View style={styles.journeyTime}>
                <Text style={styles.timeText}>{formatTime(booking.arrival.time)}</Text>
                <Text style={styles.dateText}>Arrival</Text>
              </View>
              <View style={styles.journeyLine}>
                <View style={styles.circle} />
              </View>
              <View style={styles.journeyLocation}>
                <Text style={styles.cityText}>{booking.route.to.split(',')[0]}</Text>
                <Text style={styles.terminalText}>{booking.arrival.terminal || 'Main Terminal'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Passenger Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passenger Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{booking.passenger.fullName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{booking.passenger.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{booking.passenger.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Seats</Text>
            <Text style={styles.infoValue}>
              {booking.numberOfSeats} seat{booking.numberOfSeats > 1 ? 's' : ''}
              {booking.seatNumbers?.length > 0 && ` (${booking.seatNumbers.join(', ')})`}
            </Text>
          </View>
        </View>

        {/* Vehicle & Amenities */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Information</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="directions-bus" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Vehicle Type</Text>
            <Text style={styles.infoValue}>
              {booking.vehicle.type.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="confirmation-number" size={20} color="#64748B" />
            <Text style={styles.infoLabel}>Vehicle Number</Text>
            <Text style={styles.infoValue}>{booking.vehicle.number || 'TBA'}</Text>
          </View>
          
          {booking.vehicle.amenities?.length > 0 && (
            <View style={styles.amenitiesContainer}>
              <Text style={styles.amenitiesTitle}>Amenities</Text>
              <View style={styles.amenitiesList}>
                {booking.vehicle.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityChip}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Company Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transport Company</Text>
          <View style={styles.companyHeader}>
            <View style={styles.companyIcon}>
              <MaterialIcons name="business" size={24} color="#00B0F3" />
            </View>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{booking.company.name}</Text>
              {booking.company.phone && (
                <TouchableOpacity onPress={handleCallCompany}>
                  <Text style={styles.companyPhone}>
                    📞 {booking.company.phone}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Information</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Total Amount</Text>
            <Text style={styles.paymentAmount}>
              ₦{parseFloat(booking.totalAmountInNaira).toLocaleString()}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Status</Text>
            <View style={styles.paymentStatusBadge}>
              <Text style={styles.paymentStatusText}>PAID</Text>
            </View>
          </View>
        </View>

        {/* Special Requests */}
        {booking.specialRequests && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Special Requests</Text>
            <Text style={styles.specialRequestsText}>{booking.specialRequests}</Text>
          </View>
        )}

        {/* Cancellation Info */}
        {booking.status === 'cancelled' && (
          <View style={[styles.card, styles.cancelCard]}>
            <View style={styles.cancelHeader}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <Text style={styles.cancelTitle}>Booking Cancelled</Text>
            </View>
            {booking.cancellationDate && (
              <Text style={styles.cancelDate}>
                Cancelled on {formatDate(booking.cancellationDate)}
              </Text>
            )}
            {booking.cancellationReason && (
              <Text style={styles.cancelReason}>
                Reason: {booking.cancellationReason}
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      {canCancel() && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelBooking}
          >
            <Ionicons name="close-circle" size={20} color="#FFFFFF" />
            <Text style={styles.cancelButtonText}>Cancel Booking</Text>
          </TouchableOpacity>
        </View>
      )}

      {booking.status === 'confirmed' && new Date(booking.departure?.date) > new Date() && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.checkInButton}
            onPress={() => Alert.alert('Check-In', 'Check-in feature coming soon!')}
          >
            <Ionicons name="qr-code" size={20} color="#FFFFFF" />
            <Text style={styles.checkInButtonText}>Check In</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
  },
  shareBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    flex: 1,
  },

  // Status Card
  statusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bookingRef: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A2540',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  bookingDate: {
    fontSize: 14,
    color: '#64748B',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 16,
  },

  // Journey
  journeyContainer: {
    paddingVertical: 8,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  journeyTime: {
    width: 80,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  journeyLine: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  circleFilled: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00B0F3',
  },
  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00B0F3',
  },
  verticalLine: {
    width: 2,
    height: 60,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  locationIcon: {
    marginTop: -10,
  },
  journeyLocation: {
    flex: 1,
  },
  cityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A2540',
  },
  terminalText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 96,
    gap: 6,
    marginVertical: 8,
  },
  durationLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 12,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A2540',
  },

  // Amenities
  amenitiesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  amenitiesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A2540',
    marginBottom: 12,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  amenityText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },

  // Company
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
  },
  companyPhone: {
    fontSize: 14,
    color: '#00B0F3',
    marginTop: 4,
  },

  // Payment
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  paymentLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
  },
  paymentStatusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },

  // Special Requests
  specialRequestsText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },

  // Cancel Card
  cancelCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  cancelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cancelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  cancelDate: {
    fontSize: 14,
    color: '#B91C1C',
    marginBottom: 8,
  },
  cancelReason: {
    fontSize: 14,
    color: '#DC2626',
    fontStyle: 'italic',
  },

  // Action Bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  checkInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});