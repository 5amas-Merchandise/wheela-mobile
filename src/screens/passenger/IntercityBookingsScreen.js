import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import * as Auth from '../../utils/auth';

// REPLACE WITH YOUR ACTUAL API URL
const API_URL = 'https://wheels-backend.vercel.app';

const STATUS_CONFIG = {
  confirmed: { 
    color: '#10B981', 
    bg: '#D1FAE5',
    label: 'CONFIRMED', 
    icon: 'checkmark-circle',
    description: 'Ready to travel'
  },
  checked_in: { 
    color: '#00B0F3', 
    bg: '#DBEAFE',
    label: 'CHECKED IN', 
    icon: 'log-in',
    description: 'Boarding pass ready'
  },
  completed: { 
    color: '#64748B', 
    bg: '#F1F5F9',
    label: 'COMPLETED', 
    icon: 'checkmark-done',
    description: 'Journey completed'
  },
  cancelled: { 
    color: '#EF4444', 
    bg: '#FEE2E2',
    label: 'CANCELLED', 
    icon: 'close-circle',
    description: 'Booking cancelled'
  },
  no_show: { 
    color: '#F59E0B', 
    bg: '#FEF3C7',
    label: 'NO SHOW', 
    icon: 'time',
    description: 'Did not board'
  },
  pending: {
    color: '#8B5CF6',
    bg: '#EDE9FE',
    label: 'PENDING',
    icon: 'time-outline',
    description: 'Awaiting confirmation'
  }
};

const FILTERS = [
  { id: 'all', label: 'All Trips' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function IntercityBookingsScreen() {
  const navigation = useNavigation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [user, setUser] = useState(null);
  const [scrollY] = useState(new Animated.Value(0));

  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
      fetchBookings();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const storedUser = await Auth.getStoredUser();
      setUser(storedUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const token = await Auth.getAuthToken();
      if (!token) {
        Alert.alert('Authentication Required', 'Please login to view your bookings.');
        navigation.goBack();
        return;
      }

      const response = await axios.get(`${API_URL}/intercity/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('✅ Bookings fetched:', response.data);

      if (response.data.success) {
        setBookings(response.data.bookings || []);
      } else {
        Alert.alert('Error', 'Failed to load bookings');
      }
    } catch (error) {
      console.error('❌ Fetch bookings error:', error);
      
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please login again.');
        await Auth.logout();
        navigation.goBack();
      } else {
        Alert.alert(
          'Connection Error', 
          'Unable to load bookings. Please check your internet connection.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleCancelBooking = (bookingId, bookingRef) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel ${bookingRef}?\n\nRefund will be processed within 5-7 business days.`,
      [
        { 
          text: 'No, Keep Booking', 
          style: 'cancel'
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => cancelBooking(bookingId)
        }
      ]
    );
  };

  const cancelBooking = async (bookingId) => {
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
          [{ text: 'OK', onPress: () => fetchBookings() }]
        );
      }
    } catch (error) {
      console.error('❌ Cancel error:', error);
      const errorMsg = error.response?.data?.error?.message || 'Unable to cancel booking. Please try again.';
      Alert.alert('Cancellation Failed', errorMsg);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    // Convert 24-hour format to 12-hour with AM/PM
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isUpcoming = (departureDate) => {
    if (!departureDate) return false;
    return new Date(departureDate) > new Date();
  };

  const getFilteredBookings = () => {
    switch (activeFilter) {
      case 'upcoming':
        return bookings.filter(b => 
          isUpcoming(b.departure?.date) && 
          ['confirmed', 'checked_in', 'pending'].includes(b.status)
        );
      case 'past':
        return bookings.filter(b => 
          !isUpcoming(b.departure?.date) || 
          ['completed', 'no_show'].includes(b.status)
        );
      case 'cancelled':
        return bookings.filter(b => b.status === 'cancelled');
      default:
        return bookings;
    }
  };

  const getDuration = (duration) => {
    if (!duration) return 'N/A';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}h ${minutes}m`;
  };

  const renderBooking = ({ item, index }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const upcoming = isUpcoming(item.departure?.date);
    const canCancel = upcoming && ['confirmed', 'pending'].includes(item.status);

    return (
      <Animated.View
        style={[
          styles.bookingCard,
          {
            opacity: scrollY.interpolate({
              inputRange: [0, 100 * index, 100 * (index + 1)],
              outputRange: [1, 1, 0.8],
            }),
          },
        ]}
      >
        {/* Header */}
        <View style={styles.bookingHeader}>
          <View style={styles.companyInfo}>
            <View style={[styles.companyLogo, { backgroundColor: statusConfig.bg }]}>
              <MaterialIcons name="directions-bus" size={24} color={statusConfig.color} />
            </View>
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{item.company?.name || 'Transport Company'}</Text>
              <Text style={styles.bookingRef}>{item.bookingReference}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Route Information */}
        <View style={styles.routeContainer}>
          <View style={styles.routeColumn}>
            <Text style={styles.departureTime}>{formatTime(item.departure?.time)}</Text>
            <Text style={styles.city} numberOfLines={1}>
              {item.route?.from?.split(',')[0] || 'Departure'}
            </Text>
            <Text style={styles.terminal} numberOfLines={1}>
              {item.departure?.terminal || 'Main Terminal'}
            </Text>
          </View>

          <View style={styles.routeCenter}>
            <View style={styles.routeLine}>
              <View style={styles.routeDot} />
              <View style={styles.routeDash} />
              <Ionicons name="airplane" size={16} color="#00B0F3" style={styles.routePlane} />
              <View style={styles.routeDash} />
              <View style={styles.routeDot} />
            </View>
            <Text style={styles.durationText}>
              {getDuration(item.route?.duration)}
            </Text>
          </View>

          <View style={[styles.routeColumn, { alignItems: 'flex-end' }]}>
            <Text style={styles.arrivalTime}>{formatTime(item.arrival?.time)}</Text>
            <Text style={styles.city} numberOfLines={1}>
              {item.route?.to?.split(',')[0] || 'Arrival'}
            </Text>
            <Text style={styles.terminal} numberOfLines={1}>
              {item.arrival?.terminal || 'Main Terminal'}
            </Text>
          </View>
        </View>

        {/* Trip Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#64748B" />
            <Text style={styles.detailText}>{formatDate(item.departure?.date)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={16} color="#64748B" />
            <Text style={styles.detailText}>
              {item.numberOfSeats} seat{item.numberOfSeats > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash-outline" size={16} color="#64748B" />
            <Text style={styles.detailText}>
              ₦{parseFloat(item.totalAmountInNaira).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => navigation.navigate('IntercityBookingDetails', { 
              bookingId: item.id,
              bookingReference: item.bookingReference
            })}
          >
            <Ionicons name="eye-outline" size={16} color="#00B0F3" />
            <Text style={styles.viewBtnText}>VIEW DETAILS</Text>
          </TouchableOpacity>

          {canCancel && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancelBooking(item.id, item.bookingReference)}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          )}

          {item.status === 'confirmed' && upcoming && (
            <TouchableOpacity 
              style={styles.checkInBtn}
              onPress={() => Alert.alert('Check-In', 'Check-in feature coming soon!')}
            >
              <Ionicons name="qr-code-outline" size={16} color="#10B981" />
              <Text style={styles.checkInBtnText}>CHECK IN</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  };

  const filteredBookings = getFilteredBookings();

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
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Bookings</Text>
          {user && (
            <Text style={styles.userName}>
              {user.name?.split(' ')[0] || user.fullName?.split(' ')[0] || 'User'}'s Trips
            </Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.refreshBtn}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name={refreshing ? "hourglass-outline" : "refresh"} 
            size={22} 
            color={refreshing ? '#94A3B8' : '#00B0F3'} 
          />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterBtn,
              activeFilter === filter.id && styles.filterBtnActive
            ]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[
              styles.filterText,
              activeFilter === filter.id && styles.filterTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bookings List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00B0F3" />
          <Text style={styles.loadingText}>Loading your bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#00B0F3"
              colors={['#00B0F3']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons 
                  name={
                    activeFilter === 'upcoming' ? 'calendar-outline' :
                    activeFilter === 'cancelled' ? 'close-circle-outline' :
                    'bus-outline'
                  } 
                  size={64} 
                  color="#CBD5E1" 
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeFilter === 'upcoming' 
                  ? 'No Upcoming Trips'
                  : activeFilter === 'past'
                  ? 'No Past Bookings'
                  : activeFilter === 'cancelled'
                  ? 'No Cancelled Bookings'
                  : 'No Bookings Yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'all' 
                  ? 'Start your journey with premium intercity travel'
                  : activeFilter === 'upcoming'
                  ? 'Your upcoming adventures will appear here'
                  : 'Your booking history will appear here'}
              </Text>
              {activeFilter === 'all' && (
                <TouchableOpacity
                  style={styles.bookNowBtn}
                  onPress={() => navigation.navigate('Intercity')}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.bookNowText}>BOOK A NEW TRIP</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListHeaderComponent={
            filteredBookings.length > 0 ? (
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  {filteredBookings.length} {activeFilter === 'all' ? 'Total' : filter.label} 
                  {' '}Booking{filteredBookings.length !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Floating Action Button */}
      {!loading && filteredBookings.length > 0 && (
        <TouchableOpacity 
          style={styles.floatingBtn}
          onPress={() => navigation.navigate('Intercity')}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { 
    alignItems: 'center',
    flex: 1 
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#0A2540',
  },
  userName: { 
    fontSize: 12, 
    color: '#64748B', 
    marginTop: 2 
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter Styles
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterContent: { 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    gap: 12
  },
  filterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterBtnActive: {
    backgroundColor: '#00B0F3',
    borderColor: '#00B0F3',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },

  // List Styles
  list: { 
    paddingVertical: 16,
    paddingBottom: 100 
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  statsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },

  // Booking Card Styles
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  companyInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1,
    marginRight: 12
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  companyDetails: {
    flex: 1
  },
  companyName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0A2540',
    marginBottom: 4
  },
  bookingRef: { 
    fontSize: 12, 
    color: '#64748B',
    fontFamily: 'monospace'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: { 
    fontSize: 10, 
    fontWeight: '700',
    letterSpacing: 0.5
  },

  // Route Styles
  routeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  routeColumn: { 
    flex: 1 
  },
  departureTime: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#0A2540', 
    marginBottom: 4 
  },
  arrivalTime: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#0A2540', 
    marginBottom: 4 
  },
  city: { 
    fontSize: 13, 
    color: '#0A2540', 
    fontWeight: '600', 
    marginBottom: 2 
  },
  terminal: { 
    fontSize: 11, 
    color: '#64748B' 
  },
  routeCenter: { 
    alignItems: 'center', 
    paddingHorizontal: 12,
    minWidth: 80
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B0F3',
  },
  routeDash: {
    width: 16,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  routePlane: {
    marginHorizontal: 4,
  },
  durationText: { 
    fontSize: 11, 
    color: '#64748B', 
    fontWeight: '600' 
  },

  // Details Row
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  detailItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  detailText: { 
    fontSize: 12, 
    color: '#64748B',
    fontWeight: '500' 
  },

  // Action Buttons
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    gap: 6,
  },
  viewBtnText: { 
    fontSize: 12, 
    color: '#00B0F3', 
    fontWeight: '700' 
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    gap: 6,
  },
  cancelBtnText: { 
    fontSize: 12, 
    color: '#EF4444', 
    fontWeight: '700' 
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    gap: 6,
  },
  checkInBtnText: { 
    fontSize: 12, 
    color: '#10B981', 
    fontWeight: '700' 
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: { 
    fontSize: 16, 
    color: '#64748B', 
    marginTop: 16, 
    fontWeight: '500' 
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00B0F3',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookNowText: { 
    color: '#FFFFFF', 
    fontWeight: '700', 
    fontSize: 14 
  },

  // Floating Action Button
  floatingBtn: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00B0F3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});