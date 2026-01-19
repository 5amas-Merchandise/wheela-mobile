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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import * as Auth from '../../utils/auth';

const API_URL = 'https://wheels-backend.vercel.app';

// Add timeout to axios requests
const axiosInstance = axios.create({
  timeout: 30000, // 30 second timeout
});

export default function IntercityBookingFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { trip } = route.params;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Passenger Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [numberOfSeats, setNumberOfSeats] = useState('1');
  const [specialRequests, setSpecialRequests] = useState('');

  // Next of Kin (Optional)
  const [showNextOfKin, setShowNextOfKin] = useState(false);
  const [nextOfKinName, setNextOfKinName] = useState('');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedUser = await Auth.getStoredUser();
      setUser(storedUser);
      
      if (storedUser) {
        setFullName(storedUser.name || storedUser.fullName || '');
        setEmail(storedUser.email || '');
        setPhone(storedUser.phone || '');
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const validateForm = () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return false;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }

    if (!phone.trim() || phone.length < 10) {
      Alert.alert('Validation Error', 'Please enter a valid phone number');
      return false;
    }

    const seats = parseInt(numberOfSeats);
    if (isNaN(seats) || seats < 1 || seats > 10) {
      Alert.alert('Validation Error', 'Please enter a valid number of seats (1-10)');
      return false;
    }

    if (seats > trip.availability.availableSeats) {
      Alert.alert(
        'Seats Unavailable', 
        `Only ${trip.availability.availableSeats} seats available`
      );
      return false;
    }

    return true;
  };

  const handleBooking = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const token = await Auth.getAuthToken();

      if (!token) {
        Alert.alert('Authentication Required', 'Please login to continue');
        navigation.navigate('Login');
        return;
      }

      // Build booking data - simplified structure
      const bookingData = {
        scheduleId: trip.scheduleId,
        passengerDetails: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        },
        numberOfSeats: parseInt(numberOfSeats),
        specialRequests: specialRequests.trim() || undefined
      };

      // Only add nextOfKin if all required fields are filled
      if (showNextOfKin && nextOfKinName.trim() && nextOfKinPhone.trim()) {
        bookingData.passengerDetails.nextOfKin = {
          name: nextOfKinName.trim(),
          phone: nextOfKinPhone.trim(),
          relationship: nextOfKinRelationship.trim() || 'Not specified',
        };
      }

      console.log('📝 Sending booking request:', JSON.stringify(bookingData, null, 2));

      const response = await axiosInstance.post(
        `${API_URL}/intercity/bookings`,
        bookingData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('✅ Booking response:', response.data);

      if (response.data.success) {
        setLoading(false);
        Alert.alert(
          'Booking Successful! 🎉',
          `Your booking ${response.data.booking.bookingReference} has been confirmed.\n\n` +
          `Amount: ₦${response.data.booking.totalAmountInNaira}\n` +
          `Seats: ${response.data.booking.numberOfSeats}`,
          [
            {
              text: 'View Booking',
              onPress: () => {
                navigation.navigate('IntercityBookingDetails', {
                  bookingId: response.data.booking.id,
                  bookingReference: response.data.booking.bookingReference
                });
              }
            },
            {
              text: 'OK',
              onPress: () => navigation.navigate('IntercityBookings')
            }
          ]
        );
      } else {
        throw new Error(response.data.error?.message || 'Booking failed');
      }
    } catch (error) {
      console.error('❌ Booking error:', error);
      
      let errorMessage = 'Unable to complete booking. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your internet connection and try again.';
      } else if (error.response) {
        // Server responded with error
        console.error('Error response:', error.response.data);
        errorMessage = error.response.data?.error?.message || 
                      `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Request made but no response
        console.error('No response received:', error.request);
        errorMessage = 'No response from server. Please check your internet connection.';
      } else {
        // Other errors
        errorMessage = error.message || errorMessage;
      }
      
      Alert.alert('Booking Failed', errorMessage);
    } finally {
      setLoading(false);
    }
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

  const calculateTotal = () => {
    const seats = parseInt(numberOfSeats) || 1;
    const pricePerSeat = parseFloat(trip.pricing.priceInNaira);
    return (seats * pricePerSeat).toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color="#0A2540" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Complete Booking</Text>
        
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          
          {/* Trip Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Trip Summary</Text>
            
            <View style={styles.summaryRow}>
              <View style={styles.summaryColumn}>
                <Text style={styles.summaryTime}>{formatTime(trip.departure.time)}</Text>
                <Text style={styles.summaryLocation}>
                  {trip.route.from.split(',')[0]}
                </Text>
              </View>
              
              <View style={styles.summaryCenter}>
                <Ionicons name="arrow-forward" size={20} color="#00B0F3" />
                <Text style={styles.summaryDuration}>{getDuration(trip.route.duration)}</Text>
              </View>
              
              <View style={[styles.summaryColumn, { alignItems: 'flex-end' }]}>
                <Text style={styles.summaryTime}>{formatTime(trip.arrival.time)}</Text>
                <Text style={styles.summaryLocation}>
                  {trip.route.to.split(',')[0]}
                </Text>
              </View>
            </View>

            <View style={styles.summaryInfo}>
              <View style={styles.summaryInfoItem}>
                <MaterialIcons name="business" size={16} color="#64748B" />
                <Text style={styles.summaryInfoText}>{trip.company.name}</Text>
              </View>
              <View style={styles.summaryInfoItem}>
                <Ionicons name="calendar-outline" size={16} color="#64748B" />
                <Text style={styles.summaryInfoText}>
                  {new Date(trip.departure.date).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Passenger Details Form */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Passenger Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
                placeholderTextColor="#94A3B8"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+234 800 000 0000"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Number of Seats *</Text>
              <TextInput
                style={styles.input}
                value={numberOfSeats}
                onChangeText={setNumberOfSeats}
                placeholder="1"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                editable={!loading}
              />
              <Text style={styles.helperText}>
                Max {trip.availability.availableSeats} seats available
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Special Requests (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={specialRequests}
                onChangeText={setSpecialRequests}
                placeholder="Any special requirements or requests"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>
          </View>

          {/* Next of Kin (Optional) */}
          <View style={styles.formCard}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setShowNextOfKin(!showNextOfKin)}
              disabled={loading}
            >
              <Text style={styles.formTitle}>Next of Kin (Optional)</Text>
              <Ionicons 
                name={showNextOfKin ? 'chevron-up' : 'chevron-down'} 
                size={24} 
                color="#64748B" 
              />
            </TouchableOpacity>

            {showNextOfKin && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={nextOfKinName}
                    onChangeText={setNextOfKinName}
                    placeholder="Next of kin name"
                    placeholderTextColor="#94A3B8"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={nextOfKinPhone}
                    onChangeText={setNextOfKinPhone}
                    placeholder="+234 800 000 0000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Relationship</Text>
                  <TextInput
                    style={styles.input}
                    value={nextOfKinRelationship}
                    onChangeText={setNextOfKinRelationship}
                    placeholder="e.g., Spouse, Parent, Sibling"
                    placeholderTextColor="#94A3B8"
                    editable={!loading}
                  />
                </View>
              </>
            )}
          </View>

          {/* Price Summary */}
          <View style={styles.priceCard}>
            <Text style={styles.formTitle}>Price Summary</Text>
            
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>
                Price per seat × {numberOfSeats || 1}
              </Text>
              <Text style={styles.priceValue}>
                ₦{parseFloat(trip.pricing.priceInNaira).toLocaleString()}
              </Text>
            </View>

            <View style={styles.priceDivider} />

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₦{calculateTotal()}</Text>
            </View>

            <Text style={styles.priceNote}>
              * Payment will be collected at the terminal before departure
            </Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.actionBar}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalAmount}>₦{calculateTotal()}</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.bookButton, loading && styles.bookButtonDisabled]}
            onPress={handleBooking}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.bookButtonText}>Processing...</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.bookButtonText}>Confirm Booking</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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

  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryColumn: {
    flex: 1,
  },
  summaryTime: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },
  summaryLocation: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryCenter: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  summaryDuration: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  summaryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  summaryInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryInfoText: {
    fontSize: 12,
    color: '#64748B',
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A2540',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0A2540',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },

  priceCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A2540',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00B0F3',
  },
  priceNote: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 12,
  },

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
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalText: {
    fontSize: 14,
    color: '#64748B',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00B0F3',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  bookButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});