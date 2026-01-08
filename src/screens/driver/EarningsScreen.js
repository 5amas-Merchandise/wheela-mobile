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
import Constants from 'expo-constants';

const baseUrl = process.env.BASE_URL;

// Replace with your actual logo
const WHEELA_LOGO = require('../../../assets/logo.jpg');

export default function EarningsScreen() {
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEarnings() {
      try {
        const res = await axios.get(`${baseUrl}/drivers/earnings`);
        setTotalEarnings(res.data.total / 100); // Assuming stored in kobo
        setTrips(res.data.trips || []);
      } catch (err) {
        Alert.alert('Error', 'Could not load earnings');
      } finally {
        setLoading(false);
      }
    }
    fetchEarnings();
  }, []);

  const requestPayout = async () => {
    try {
      await axios.post(`${baseUrl}/drivers/payout`);
      Alert.alert('Success', 'Payout request submitted! Processed within 24-48 hours.');
    } catch (err) {
      Alert.alert('Error', 'Could not request payout');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00B0F3" />
      </View>
    );
  }

  const renderTrip = ({ item }) => (
    <View style={styles.tripItem}>
      <View>
        <Text style={styles.tripDate}>{new Date(item.date).toLocaleDateString()}</Text>
        <Text style={styles.tripRoute}>
          {item.pickup?.address?.substring(0, 30)}... → {item.destination?.address?.substring(0, 30)}...
        </Text>
      </View>
      <Text style={styles.tripFare}>₦{item.fare.toFixed(2)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with Logo */}
      <View style={styles.header}>
        <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>My Earnings</Text>
      </View>

      {/* Total Earnings Card */}
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>Total Earnings</Text>
        <Text style={styles.earningsAmount}>₦{totalEarnings.toFixed(2)}</Text>
        <TouchableOpacity style={styles.payoutBtn} onPress={requestPayout}>
          <Text style={styles.payoutText}>Request Payout</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Trips List */}
      <Text style={styles.sectionTitle}>Recent Trips</Text>
      <FlatList
        data={trips}
        keyExtractor={(item) => item._id}
        renderItem={renderTrip}
        ListEmptyComponent={<Text style={styles.emptyText}>No trips completed yet.</Text>}
        showsVerticalScrollIndicator={false}
      />

      <Text style={styles.note}>Payouts are processed weekly on Mondays.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#010C44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  earningsCard: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 40,
  },
  earningsLabel: {
    color: '#00B0F3',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  earningsAmount: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 24,
  },
  payoutBtn: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  payoutText: {
    color: '#010C44',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#00B0F3',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  tripItem: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripDate: {
    color: '#FFFFFFAA',
    fontSize: 14,
  },
  tripRoute: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  tripFare: {
    color: '#00B0F3',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    color: '#FFFFFFAA',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
  },
  note: {
    color: '#FFFFFFAA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
});