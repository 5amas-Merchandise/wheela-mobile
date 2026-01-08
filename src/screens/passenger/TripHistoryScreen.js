// src/screens/passenger/TripHistoryScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Dummy ride history data – replace with API later
const dummyTrips = [
  {
    id: '1',
    date: 'Jan 6, 2026',
    time: '3:45 PM',
    pickup: 'Ikeja City Mall',
    dropoff: 'Victoria Island',
    price: '₦4,800',
    type: 'City Ride',
    icon: 'car-outline',
    status: 'completed',
  },
  {
    id: '2',
    date: 'Jan 5, 2026',
    time: '11:20 AM',
    pickup: 'MM Airport',
    dropoff: 'Lekki Phase 1',
    price: '₦7,200',
    type: 'City Ride',
    icon: 'car-outline',
    status: 'completed',
  },
  {
    id: '3',
    date: 'Jan 4, 2026',
    time: '8:15 PM',
    pickup: 'Surulere',
    dropoff: 'Yaba',
    price: '₦2,100',
    type: 'Bike',
    icon: 'bicycle',
    status: 'completed',
  },
  {
    id: '4',
    date: 'Jan 2, 2026',
    time: '6:30 PM',
    pickup: 'Ajah',
    dropoff: 'Ikoyi',
    price: '₦6,500',
    type: 'City Ride',
    icon: 'car-outline',
    status: 'completed',
  },
  {
    id: '5',
    date: 'Dec 30, 2025',
    time: '10:05 AM',
    pickup: 'Oshodi',
    dropoff: 'Allen Avenue',
    price: '₦3,200',
    type: 'Keke',
    icon: 'triangle-outline',
    status: 'completed',
  },
];

export default function TripHistoryScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate API refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderTripItem = ({ item }) => (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={() => {
        // Navigate to trip details (create later)
        // navigation.navigate('TripDetails', { tripId: item.id });
      }}
    >
      <View style={styles.tripHeader}>
        <Text style={styles.tripDate}>{item.date}</Text>
        <Text style={styles.tripPrice}>{item.price}</Text>
      </View>

      <View style={styles.tripBody}>
        <View style={styles.routeContainer}>
          <View style={styles.dotLine}>
            <View style={styles.greenDot} />
            <View style={styles.line} />
            <View style={styles.redDot} />
          </View>

          <View style={styles.addresses}>
            <Text style={styles.pickupText} numberOfLines={1}>
              {item.pickup}
            </Text>
            <Text style={styles.dropoffText} numberOfLines={1}>
              {item.dropoff}
            </Text>
          </View>

          <View style={styles.rideTypeIcon}>
            <Ionicons name={item.icon} size={28} color="#00B0F3" />
          </View>
        </View>

        <View style={styles.tripFooter}>
          <Text style={styles.tripTime}>{item.time}</Text>
          <Text style={styles.tripType}>{item.type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <View style={{ width: 28 }} /> {/* Spacer */}
      </View>

      <FlatList
        data={dummyTrips}
        keyExtractor={(item) => item.id}
        renderItem={renderTripItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00B0F3']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>No rides yet</Text>
            <Text style={styles.emptySubtext}>Your trip history will appear here</Text>
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