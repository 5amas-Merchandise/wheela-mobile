import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth';

const baseUrl = 'https://wheels-backend-7ydc.onrender.com';

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [driverVehicleType, setDriverVehicleType] = useState('CITY_CAR');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Error', 'Please log in again');
        navigation.replace('Login');
        return;
      }

      // Fetch driver profile to get vehicle type
      const profileRes = await axios.get(`${baseUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const serviceCategories = profileRes.data?.user?.driverProfile?.serviceCategories || [];
      let vehicleType = 'CITY_CAR';
      
      if (serviceCategories.includes('KEKE')) {
        vehicleType = 'KEKE';
      } else if (serviceCategories.includes('DELIVERY_BIKE')) {
        vehicleType = 'BIKE';
      } else if (serviceCategories.includes('CITY_RIDE')) {
        vehicleType = 'CITY_CAR';
      }
      
      setDriverVehicleType(vehicleType);

      // Fetch current subscription
      const subRes = await axios.get(`${baseUrl}/subscriptions/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (subRes.data.hasActiveSubscription) {
        setCurrentSubscription(subRes.data.subscription);
      } else {
        setCurrentSubscription(null);
      }

      // Fetch available plans
      const plansRes = await axios.get(`${baseUrl}/subscriptions/plans`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { vehicleType }
      });

      setAvailablePlans(plansRes.data.plans || []);

      // Fetch wallet balance
      const walletRes = await axios.get(`${baseUrl}/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setWalletBalance(walletRes.data.wallet?.balance || 0);

    } catch (err) {
      console.error('Error fetching subscription data:', err);
      Alert.alert('Error', 'Could not load subscription data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubscriptionData(false);
  };

  const handleSubscribe = async (plan) => {
    const priceKobo = plan.price * 100;
    
    if (walletBalance < priceKobo) {
      Alert.alert(
        'Insufficient Balance',
        `You need ₦${plan.price.toLocaleString()} to subscribe. Your current balance is ₦${(walletBalance / 100).toFixed(2)}.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Subscription',
      `Subscribe to ${plan.duration} plan for ₦${plan.price.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setSubscribing(true);
            try {
              const token = await getAuthToken();
              await axios.post(
                `${baseUrl}/subscriptions/subscribe`,
                {
                  vehicleType: driverVehicleType,
                  duration: plan.duration,
                  autoRenew: false
                },
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );

              Alert.alert('Success', 'Subscription activated!');
              fetchSubscriptionData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error?.message || 'Could not subscribe');
            } finally {
              setSubscribing(false);
            }
          }
        }
      ]
    );
  };

  const getVehicleTypeName = (type) => {
    const names = {
      'CITY_CAR': 'City Car',
      'KEKE': 'Keke/Tricycle',
      'BIKE': 'Delivery Bike'
    };
    return names[type] || type;
  };

  const formatTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Wallet Balance */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <Ionicons name="wallet-outline" size={24} color="#0066FF" />
          <Text style={styles.walletTitle}>Wallet Balance</Text>
        </View>
        <Text style={styles.walletBalance}>
          ₦{(walletBalance / 100).toFixed(2)}
        </Text>
        <Text style={styles.walletNote}>
          Contact admin to fund your wallet
        </Text>
      </View>

      {/* Current Subscription */}
      {currentSubscription ? (
        <View style={styles.currentSubCard}>
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
          
          <Text style={styles.currentSubTitle}>Current Plan</Text>
          <Text style={styles.currentSubPlan}>
            {currentSubscription.plan.duration.toUpperCase()}
          </Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle Type</Text>
            <Text style={styles.detailValue}>
              {getVehicleTypeName(currentSubscription.vehicleType)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Price Paid</Text>
            <Text style={styles.detailValue}>
              {currentSubscription.plan.priceFormatted}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expires</Text>
            <Text style={styles.detailValue}>
              {new Date(currentSubscription.expiresAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.timeRemainingCard}>
            <Ionicons name="time-outline" size={20} color="#0066FF" />
            <Text style={styles.timeRemainingText}>
              {formatTimeRemaining(currentSubscription.expiresAt)}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.noSubCard}>
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text style={styles.noSubTitle}>No Active Subscription</Text>
          <Text style={styles.noSubText}>Choose a plan below</Text>
        </View>
      )}

      {/* Available Plans */}
      <View style={styles.plansSection}>
        <Text style={styles.sectionTitle}>
          Plans for {getVehicleTypeName(driverVehicleType)}
        </Text>
        
        {availablePlans.map((plan) => (
          <View
            key={plan.duration}
            style={[styles.planCard, plan.recommended && styles.recommendedPlan]}
          >
            {plan.recommended && (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>RECOMMENDED</Text>
              </View>
            )}
            
            <Text style={styles.planDuration}>
              {plan.duration.toUpperCase()}
            </Text>
            <Text style={styles.planPrice}>{plan.priceFormatted}</Text>
            
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.featureText}>
                {plan.durationDays} days access
              </Text>
            </View>
            
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.featureText}>Unlimited rides</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.subscribeBtn,
                currentSubscription && styles.subscribeBtnDisabled
              ]}
              onPress={() => handleSubscribe(plan)}
              disabled={currentSubscription !== null || subscribing}
            >
              {subscribing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.subscribeBtnText}>
                  {currentSubscription ? 'Already Subscribed' : 'Subscribe Now'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  walletCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  walletBalance: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0066FF',
    marginBottom: 8,
  },
  walletNote: {
    fontSize: 12,
    color: '#6B7280',
  },
  currentSubCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  activeBadgeText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  currentSubTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  currentSubPlan: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timeRemainingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  timeRemainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066FF',
  },
  noSubCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  noSubTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  noSubText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  plansSection: {
    marginHorizontal: 20,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  recommendedPlan: {
    borderColor: '#0066FF',
    backgroundColor: '#EFF6FF',
  },
  recommendedBadge: {
    backgroundColor: '#0066FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  planDuration: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0066FF',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
  },
  subscribeBtn: {
    backgroundColor: '#0066FF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  subscribeBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  subscribeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});