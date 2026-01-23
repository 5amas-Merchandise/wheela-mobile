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
  RefreshControl,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import { getAuthToken } from '../../utils/auth';
import { Ionicons } from '@expo/vector-icons';

const baseUrl = 'https://wheels-backend-7ydc.onrender.com';

// Replace with your actual logo
const WHEELA_LOGO = require('../../../assets/logo.jpg');

export default function TripHistoryScreen() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState('driver');
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
      
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Error', 'Please login to view trip history');
        setLoading(false);
        return;
      }

      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      };

      console.log('Fetching trip history with role:', role);

      try {
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
        
        const simpleRes = await axios.get(`${baseUrl}/trips`, {
          ...config,
          params: { 
            role: role, 
            limit: 50 
          },
        });
        
        if (simpleRes.data?.trips) {
          const completedTrips = simpleRes.data.trips.filter(trip => 
            trip.status === 'completed' || trip.status === 'cancelled'
          );
          
          setTrips(completedTrips);
          
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
        Alert.alert('Network Error', 'Please check your internet connection');
      } else {
        Alert.alert('Error', 'Could not load trip history');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleRole = () => {
    setRole(role === 'driver' ? 'passenger' : 'driver');
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTripHistory();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
        <Text style={styles.loadingText}>Loading trip history...</Text>
      </View>
    );
  }

  const renderTrip = ({ item }) => {
    const tripDate = new Date(item.completedAt || item.cancelledAt || item.requestedAt || item.date);
    const formattedDate = tripDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isCompleted = item.status === 'completed';
    const statusColor = isCompleted ? '#10B981' : '#FF6B6B';
    
    const pickupAddress = item.pickup?.address || item.pickupLocation?.address || 'Pickup location';
    const dropoffAddress = item.dropoff?.address || item.dropoffLocation?.address || 'Dropoff location';
    
    const fareAmount = item.fareInNaira || 
                      (item.finalFare ? item.finalFare.toFixed(2) : 
                      (item.estimatedFare ? item.estimatedFare.toFixed(2) : '0.00'));

    return (
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <View style={styles.dateStatusContainer}>
            <Text style={styles.tripDate}>{formattedDate}</Text>
            <View style={styles.statusBadge}>
              <View 
                style={[
                  styles.statusDot, 
                  { backgroundColor: statusColor }
                ]} 
              />
              <Text style={[
                styles.tripStatus,
                { color: statusColor }
              ]}>
                {item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Unknown'}
              </Text>
            </View>
          </View>
          <View style={styles.fareContainer}>
            <Text style={styles.tripFare}>
              ₦{parseFloat(fareAmount).toLocaleString('en-US')}
            </Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routeRow}>
            <View style={[styles.routeIconContainer, styles.pickupIcon]}>
              <Ionicons name="location" size={16} color="#0066FF" />
            </View>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {pickupAddress}
            </Text>
          </View>
          
          <View style={styles.connectorLine}>
            <View style={styles.dashedLine} />
          </View>
          
          <View style={styles.routeRow}>
            <View style={[styles.routeIconContainer, styles.dropoffIcon]}>
              <Ionicons name="flag" size={16} color="#FF6B6B" />
            </View>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {dropoffAddress}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="car" size={16} color="#666" />
              <Text style={styles.infoText}>{item.serviceType || 'Standard'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time" size={16} color="#666" />
              <Text style={styles.infoText}>
                {tripDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
          
          {item.distanceKm && (
            <View style={styles.distanceRow}>
              <Ionicons name="navigate" size={16} color="#666" />
              <Text style={styles.distanceText}>
                {item.distanceKm || item.distance || '0'} km
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Trip History</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.roleButton} 
          onPress={toggleRole}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={role === 'driver' ? 'car-sport' : 'person'} 
            size={20} 
            color="#0066FF" 
          />
          <Text style={styles.roleButtonText}>
            {role === 'driver' ? 'Driver' : 'Passenger'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Overview */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0066FF']}
            tintColor="#0066FF"
          />
        }
      >
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.totalCard]}>
            <Ionicons name="document-text" size={24} color="#0066FF" />
            <Text style={styles.statNumber}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          
          <View style={[styles.statCard, styles.completedCard]}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.statNumber}>{stats.completedTrips}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          
          <View style={[styles.statCard, styles.cancelledCard]}>
            <Ionicons name="close-circle" size={24} color="#FF6B6B" />
            <Text style={styles.statNumber}>{stats.cancelledTrips}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
          
          <View style={[styles.statCard, styles.earningsCard]}>
            <Ionicons name="cash" size={24} color="#8B5CF6" />
            <Text style={styles.statNumber}>
              ₦{(stats.totalEarnings || 0).toLocaleString('en-US')}
            </Text>
            <Text style={styles.statLabel}>
              {role === 'driver' ? 'Earnings' : 'Spent'}
            </Text>
          </View>
        </View>

        {/* Recent Trips Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons name="time" size={20} color="#111827" />
            <Text style={styles.sectionTitle}>Recent Trips</Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#0066FF" />
          </TouchableOpacity>
        </View>

        {trips.length > 0 ? (
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id || item._id || Math.random().toString()}
            renderItem={renderTrip}
            scrollEnabled={false}
            ListFooterComponent={<View style={{ height: 40 }} />}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={80} color="#E5E7EB" />
            <Text style={styles.emptyTitle}>No Trips Yet</Text>
            <Text style={styles.emptySubtitle}>
              {role === 'driver' 
                ? 'Start accepting rides to see your history here.' 
                : 'Book your first ride to see your history here.'}
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={onRefresh}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.viewingNote}>
          Viewing trips as {role}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 8,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  roleButtonText: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  totalCard: {
    borderTopWidth: 4,
    borderTopColor: '#0066FF',
  },
  completedCard: {
    borderTopWidth: 4,
    borderTopColor: '#10B981',
  },
  cancelledCard: {
    borderTopWidth: 4,
    borderTopColor: '#FF6B6B',
  },
  earningsCard: {
    borderTopWidth: 4,
    borderTopColor: '#8B5CF6',
  },
  statNumber: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  dateStatusContainer: {
    flex: 1,
  },
  tripDate: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tripStatus: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fareContainer: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tripFare: {
    color: '#0066FF',
    fontSize: 18,
    fontWeight: '800',
  },
  routeContainer: {
    marginBottom: 20,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  routeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickupIcon: {
    backgroundColor: '#EFF6FF',
  },
  dropoffIcon: {
    backgroundColor: '#FEF2F2',
  },
  routeAddress: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  connectorLine: {
    height: 24,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  dashedLine: {
    width: 1,
    height: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  tripFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  distanceText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0066FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  viewingNote: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
    fontWeight: '500',
  },
});