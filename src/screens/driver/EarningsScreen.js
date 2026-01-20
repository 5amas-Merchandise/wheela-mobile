import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import axios from 'axios';
import { getAuthToken } from '../../utils/auth';

const baseUrl = 'https://wheels-backend-7ydc.onrender.com'; // Use the correct backend URL

// Replace with your actual logo
const WHEELA_LOGO = require('../../../assets/logo.jpg');

export default function TripHistoryScreen() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('driver'); // Default to driver role
  const [stats, setStats] = useState({
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    totalEarnings: 0,
  });

  useEffect(() => {
    fetchTripHistory();
  }, [role]);

  const fetchTripHistory = async () => {
    try {
      setLoading(true);
      
      // Get auth token
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Error', 'Please login to view trip history');
        setLoading(false);
        return;
      }

      // Configure axios headers
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      };

      console.log('Fetching trip history with role:', role);

      try {
        // Fetch trip history
        const historyRes = await axios.get(`${baseUrl}/trips/history`, {
          ...config,
          params: { 
            role: role, 
            limit: 50, 
            status: 'all' 
          },
        });

        console.log('History response:', historyRes.data);

        if (historyRes.data.success) {
          setTrips(historyRes.data.trips || []);
          
          // Calculate stats from the response
          const completedTrips = historyRes.data.stats?.completedTrips || 0;
          const cancelledTrips = historyRes.data.stats?.cancelledTrips || 0;
          const totalSpent = historyRes.data.stats?.totalSpent || 0;
          
          setStats({
            totalTrips: historyRes.data.stats?.totalTrips || 0,
            completedTrips: completedTrips,
            cancelledTrips: cancelledTrips,
            totalEarnings: role === 'driver' ? totalSpent : 0,
          });
        } else {
          Alert.alert('Error', historyRes.data?.error?.message || 'Failed to load trip history');
        }
      } catch (fetchErr) {
        console.error('Fetch trip history error:', fetchErr);
        
        // Try the simple endpoint as fallback
        const simpleRes = await axios.get(`${baseUrl}/trips`, {
          ...config,
          params: { 
            role: role, 
            limit: 50 
          },
        });
        
        if (simpleRes.data?.trips) {
          // Filter completed/cancelled trips
          const completedTrips = simpleRes.data.trips.filter(trip => 
            trip.status === 'completed' || trip.status === 'cancelled'
          );
          
          setTrips(completedTrips);
          
          // Calculate simple stats
          const total = completedTrips.length;
          const completed = completedTrips.filter(t => t.status === 'completed').length;
          const cancelled = completedTrips.filter(t => t.status === 'cancelled').length;
          const earnings = completedTrips
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + (t.finalFare || t.estimatedFare || 0), 0);
            
          setStats({
            totalTrips: total,
            completedTrips: completed,
            cancelledTrips: cancelled,
            totalEarnings: earnings,
          });
        } else {
          throw fetchErr;
        }
      }

    } catch (err) {
      console.error('Error loading trip history:', err.response?.data || err.message);
      if (err.response) {
        // Server responded with error
        if (err.response.status === 401) {
          Alert.alert('Session Expired', 'Please login again');
        } else if (err.response.status === 403) {
          Alert.alert('Access Denied', 'You are not authorized to view this content');
        } else if (err.response.status === 404) {
          Alert.alert('Not Found', 'Trip history endpoint not found');
        } else {
          Alert.alert('Error', err.response.data?.error?.message || 'Could not load trip history');
        }
      } else if (err.request) {
        // Request made but no response
        Alert.alert('Network Error', 'Please check your internet connection');
      } else {
        Alert.alert('Error', 'Could not load trip history');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = () => {
    setRole(role === 'driver' ? 'passenger' : 'driver');
  };

  const refreshData = () => {
    fetchTripHistory();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00B0F3" />
        <Text style={styles.loadingText}>Loading trip history...</Text>
      </View>
    );
  }

  const renderTrip = ({ item }) => {
    // Format date for display
    const tripDate = new Date(item.completedAt || item.cancelledAt || item.requestedAt || item.date);
    const formattedDate = tripDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Determine status color
    const statusColor = item.status === 'completed' ? '#00B0F3' : '#FF6B6B';
    
    // Format pickup and destination addresses
    const pickupAddress = item.pickup?.address || item.pickupLocation?.address || 'Pickup location';
    const dropoffAddress = item.dropoff?.address || item.dropoffLocation?.address || 'Dropoff location';
    
    // Get fare amount
    const fareAmount = item.fareInNaira || 
                      (item.finalFare ? (item.finalFare ).toFixed(2) : 
                      (item.estimatedFare ? (item.estimatedFare ).toFixed(2) : '0.00'));

    return (
      <View style={styles.tripItem}>
        <View style={styles.tripHeader}>
          <View>
            <Text style={styles.tripDate}>{formattedDate}</Text>
            <View style={styles.statusContainer}>
              <View 
                style={[
                  styles.statusDot, 
                  { backgroundColor: statusColor }
                ]} 
              />
              <Text style={styles.tripStatus}>
                {item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Unknown'}
              </Text>
            </View>
          </View>
          <Text style={styles.tripFare}>
            ₦{fareAmount}
          </Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.pickupDot]} />
            <Text style={styles.routeAddress} numberOfLines={1}>
              {pickupAddress}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.dropoffDot]} />
            <Text style={styles.routeAddress} numberOfLines={1}>
              {dropoffAddress}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <View style={styles.serviceContainer}>
            <Text style={styles.serviceLabel}>Service:</Text>
            <Text style={styles.serviceValue}>{item.serviceType || 'Standard'}</Text>
          </View>
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceLabel}>Distance:</Text>
            <Text style={styles.distanceValue}>{item.distanceKm || item.distance || '0'} km</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Logo */}
      <View style={styles.header}>
        <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Trip History</Text>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Summary</Text>
          <TouchableOpacity style={styles.roleToggle} onPress={toggleRole}>
            <Text style={styles.roleToggleText}>
              View as {role === 'driver' ? 'Passenger' : 'Driver'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.completedTrips}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.cancelledTrips}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              ₦{(stats.totalEarnings ).toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>
              {role === 'driver' ? 'Earnings' : 'Spent'}
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Trips List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Trips</Text>
        <TouchableOpacity onPress={refreshData}>
          <View style={styles.refreshButton}>
            <Text style={styles.refreshText}>Refresh</Text>
          </View>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        renderItem={renderTrip}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No trips completed yet.</Text>
            <Text style={styles.emptySubtext}>
              {role === 'driver' 
                ? 'Start accepting rides to see your history here.' 
                : 'Book your first ride to see your history here.'}
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={refreshData}>
              <Text style={styles.emptyButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={refreshData}
      />

      <Text style={styles.note}>
        Showing trips where you were the {role}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#010C44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFFAA',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  statsCard: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 20,
    padding: 24,
    marginBottom: 30,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  roleToggle: {
    backgroundColor: '#00B0F320',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  roleToggleText: {
    color: '#00B0F3',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: '#FFFFFF08',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#00B0F3',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#00B0F3',
    fontSize: 20,
    fontWeight: '700',
  },
  refreshButton: {
    backgroundColor: '#FFFFFF10',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 20,
  },
  tripItem: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tripDate: {
    color: '#FFFFFFAA',
    fontSize: 14,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  tripStatus: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tripFare: {
    color: '#00B0F3',
    fontSize: 20,
    fontWeight: '800',
  },
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: '#00B0F3',
  },
  dropoffDot: {
    backgroundColor: '#FF6B6B',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#FFFFFF30',
    marginLeft: 5,
    marginVertical: 2,
  },
  routeAddress: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF20',
  },
  serviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceLabel: {
    color: '#FFFFFFAA',
    fontSize: 14,
    marginRight: 6,
  },
  serviceValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceLabel: {
    color: '#FFFFFFAA',
    fontSize: 14,
    marginRight: 6,
  },
  distanceValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#FFFFFFAA',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#FFFFFF60',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#010C44',
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    color: '#FFFFFFAA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
});