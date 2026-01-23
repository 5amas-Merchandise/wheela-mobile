import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Vibration,
  Platform,
  Image,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAuthToken } from '../../utils/auth';
import * as Notifications from 'expo-notifications';

const baseUrl = 'https://wheels-backend-7ydc.onrender.com';

// Try to load the logo, but handle errors gracefully
let WHEELS_LOGO = null;
try {
  WHEELS_LOGO = require('../../../assets/logo.jpg');
} catch (error) {
  console.warn('Logo not found at path ../../../assets/logo.jpg');
  // You can provide a default logo or use null
}

// Configure notifications with custom icon
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Set default notification channel for Android
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Wheels Notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0066FF',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  }).catch(error => {
    console.warn('Error setting notification channel:', error);
  });
}

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const notificationListener = useRef();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [driverVehicleType, setDriverVehicleType] = useState('CITY_CAR');
  const [subscribing, setSubscribing] = useState(false);

  // Initialize notifications
  useEffect(() => {
    registerForPushNotificationsAsync();
    
    // Listen for notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Subscription notification received:', notification);
      Vibration.vibrate(300);
    });

    return () => {
      // Proper cleanup for notifications
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      // Alternative cleanup method
      Notifications.removeAllListeners?.();
    };
  }, []);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  // Register for push notifications with custom configuration
  async function registerForPushNotificationsAsync() {
  try {
    // Check for existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // Return if permission not granted
    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permission');
      return null;
    }

    // Get the push token with your actual project ID
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '89ca3ed1-d2fb-429a-9fdb-614202a280e5', // Your actual project ID from app.json
    });

    console.log('Push token:', token.data);
    
    // For Android, we need to set the notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0066FF',
      });
    }

    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

  // Send notification helper function with custom logo/icon
  const sendNotification = async (title, body, data = {}) => {
    try {
      const notificationContent = {
        title,
        body,
        data: { 
          ...data, 
          screen: 'SubscriptionScreen',
          logo: WHEELS_LOGO ? 'wheels_logo' : 'default_icon'
        },
        sound: true,
        vibrate: [0, 250, 250],
      };

      // Add badge number if applicable
      if (data.badgeCount) {
        notificationContent.badge = data.badgeCount;
      }

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

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
        const newSubscription = subRes.data.subscription;
        const oldSubscription = currentSubscription;
        
        setCurrentSubscription(newSubscription);

        // Send notification if subscription is new or has changed
        if (!oldSubscription || oldSubscription._id !== newSubscription._id) {
          sendNotification(
            '✅ Subscription Active',
            `Your ${newSubscription.plan.duration} plan is now active!`,
            { 
              subscriptionId: newSubscription._id, 
              plan: newSubscription.plan.duration,
              action: 'subscription_updated',
              icon: 'subscription_icon',
              color: '#0066FF',
            }
          );
        }

        // Check if subscription is expiring soon (less than 24 hours)
        const expiryDate = new Date(newSubscription.expiresAt);
        const now = new Date();
        const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);
        
        if (hoursUntilExpiry > 0 && hoursUntilExpiry <= 24) {
          sendNotification(
            '⚠️ Subscription Expiring Soon',
            `Your subscription expires in ${Math.ceil(hoursUntilExpiry)} hours. Renew now!`,
            { 
              subscriptionId: newSubscription._id,
              hoursUntilExpiry: Math.ceil(hoursUntilExpiry),
              action: 'subscription_expiring',
              icon: 'warning_icon',
              color: '#FF9500',
            }
          );
        }
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

      const newBalance = walletRes.data.wallet?.balance || 0;
      const oldBalance = walletBalance;
      setWalletBalance(newBalance);

      // Send notification for wallet updates (funding)
      if (newBalance > oldBalance) {
        const amountAdded = (newBalance - oldBalance) / 100;
        sendNotification(
          '💰 Wallet Funded',
          `₦${amountAdded.toFixed(2)} added to your wallet!`,
          { 
            walletBalance: newBalance,
            amountAdded: amountAdded,
            action: 'wallet_funded',
            icon: 'wallet_icon',
            color: '#34C759',
          }
        );
      }

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
              const response = await axios.post(
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

              // Send success notification with custom logo
              sendNotification(
                '🎉 Subscription Activated!',
                `Your ${plan.duration} plan has been activated successfully!`,
                { 
                  plan: plan.duration,
                  price: plan.price,
                  action: 'subscription_activated',
                  icon: 'success_icon',
                  color: '#0066FF',
                  badgeCount: 1,
                }
              );

              Alert.alert('Success', 'Subscription activated!');
              fetchSubscriptionData();
            } catch (err) {
              console.error('Subscription error:', err);
              
              // Send error notification
              sendNotification(
                '❌ Subscription Failed',
                err.response?.data?.error?.message || 'Could not subscribe. Please try again.',
                { 
                  action: 'subscription_failed',
                  icon: 'error_icon',
                  color: '#FF3B30',
                }
              );
              
              Alert.alert('Error', err.response?.data?.error?.message || 'Could not subscribe');
            } finally {
              setSubscribing(false);
            }
          }
        }
      ]
    );
  };

  const handleRenewSubscription = () => {
    if (!currentSubscription) return;

    Alert.alert(
      'Renew Subscription',
      `Renew your ${currentSubscription.plan.duration} plan for ₦${currentSubscription.plan.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew Now',
          onPress: async () => {
            setSubscribing(true);
            try {
              const token = await getAuthToken();
              const response = await axios.post(
                `${baseUrl}/subscriptions/subscribe`,
                {
                  vehicleType: driverVehicleType,
                  duration: currentSubscription.plan.duration,
                  autoRenew: false
                },
                {
                  headers: { Authorization: `Bearer ${token}` }
                }
              );

              // Send renewal notification
              sendNotification(
                '🔄 Subscription Renewed',
                `Your ${currentSubscription.plan.duration} plan has been renewed!`,
                { 
                  plan: currentSubscription.plan.duration,
                  price: currentSubscription.plan.price,
                  action: 'subscription_renewed',
                  icon: 'renew_icon',
                  color: '#34C759',
                }
              );

              Alert.alert('Success', 'Subscription renewed successfully!');
              fetchSubscriptionData();
            } catch (err) {
              console.error('Renewal error:', err);
              
              // Send error notification
              sendNotification(
                '❌ Renewal Failed',
                err.response?.data?.error?.message || 'Could not renew subscription.',
                { 
                  action: 'renewal_failed',
                  icon: 'error_icon',
                  color: '#FF3B30',
                }
              );
              
              Alert.alert('Error', err.response?.data?.error?.message || 'Could not renew subscription');
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

  const handleFundWallet = () => {
    Alert.alert(
      'Fund Wallet',
      'To add funds to your wallet, please contact admin support:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy Admin Number',
          onPress: () => {
            // In a real app, you'd copy to clipboard
            Alert.alert(
              'Contact Admin',
              'Please call or WhatsApp admin at: +234 800 123 4567\n\nOr visit the admin office.',
              [{ text: 'OK' }]
            );
          }
        },
        {
          text: 'Request Fund',
          onPress: () => {
            // Navigate to fund request screen or open form
            Alert.alert(
              'Fund Request',
              'A fund request has been sent to admin. They will contact you shortly.',
              [
                { 
                  text: 'OK',
                  onPress: () => {
                    sendNotification(
                      '📱 Fund Request Sent',
                      'Your wallet fund request has been sent to admin.',
                      { 
                        action: 'fund_request_sent',
                        icon: 'fund_request_icon',
                        color: '#0066FF',
                      }
                    );
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  // Function to clear all notifications
  const clearAllNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.dismissAllNotificationsAsync();
      Alert.alert('Success', 'All notifications cleared.');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      Alert.alert('Error', 'Could not clear notifications.');
    }
  };

  // Function to handle test notification with logo
  const handleTestNotification = () => {
    sendNotification(
      '🔔 Wheels Notification Test',
      'This is a test notification from Wheels app with custom logo.',
      { 
        action: 'test_notification',
        icon: WHEELS_LOGO ? 'wheels_logo' : 'default_icon',
        color: '#0066FF',
        badgeCount: 1,
      }
    );
    Alert.alert('Test Sent', 'A test notification has been sent.');
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
      {/* Header with Logo */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          {WHEELS_LOGO ? (
            <Image source={WHEELS_LOGO} style={styles.headerLogo} resizeMode="contain" />
          ) : (
            <Ionicons name="card-outline" size={24} color="#0066FF" style={styles.headerIcon} />
          )}
          <Text style={styles.headerTitle}>Subscription</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <Ionicons name="refresh" size={24} color="#0066FF" />
        </TouchableOpacity>
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
        <TouchableOpacity style={styles.fundWalletBtn} onPress={handleFundWallet}>
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.fundWalletText}>Fund Wallet</Text>
        </TouchableOpacity>
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

          {/* Renew Button */}
          <TouchableOpacity 
            style={styles.renewBtn}
            onPress={handleRenewSubscription}
            disabled={subscribing}
          >
            {subscribing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.renewBtnText}>Renew Subscription</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noSubCard}>
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text style={styles.noSubTitle}>No Active Subscription</Text>
          <Text style={styles.noSubText}>Choose a plan below to start riding</Text>
          
          {/* Send notification reminder */}
          <TouchableOpacity 
            style={styles.reminderBtn}
            onPress={() => {
              sendNotification(
                '⏰ Subscription Reminder',
                'Don\'t forget to subscribe to continue accepting rides!',
                { 
                  action: 'subscription_reminder',
                  icon: 'reminder_icon',
                  color: '#FF9500',
                }
              );
              Alert.alert('Reminder Set', 'You will be reminded about subscription.');
            }}
          >
            <Ionicons name="notifications-outline" size={16} color="#0066FF" />
            <Text style={styles.reminderText}>Set Reminder</Text>
          </TouchableOpacity>
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
                <Ionicons name="star" size={12} color="#FFFFFF" />
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

            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.featureText}>24/7 support</Text>
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

      {/* Notification Settings */}
      <View style={styles.notificationSection}>
        <Text style={styles.sectionTitle}>Notification Settings</Text>
        <View style={styles.notificationCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationInfo}>
              <Ionicons name="notifications-outline" size={20} color="#0066FF" />
              <Text style={styles.notificationLabel}>Subscription Reminders</Text>
            </View>
            <Text style={styles.notificationStatus}>Enabled</Text>
          </View>
          
          <View style={styles.notificationRow}>
            <View style={styles.notificationInfo}>
              <Ionicons name="wallet-outline" size={20} color="#0066FF" />
              <Text style={styles.notificationLabel}>Wallet Updates</Text>
            </View>
            <Text style={styles.notificationStatus}>Enabled</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.testNotificationBtn}
            onPress={handleTestNotification}
          >
            <Ionicons name="send-outline" size={16} color="#FFFFFF" />
            <Text style={styles.testNotificationText}>Send Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.clearNotificationsBtn}
            onPress={clearAllNotifications}
          >
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
            <Text style={styles.clearNotificationsText}>Clear All Notifications</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer with App Logo */}
      {WHEELS_LOGO && (
        <View style={styles.footer}>
          <Image source={WHEELS_LOGO} style={styles.footerLogo} resizeMode="contain" />
          <Text style={styles.footerText}>Wheels - Subscription Management</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      )}
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
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 8,
    borderRadius: 4,
  },
  headerIcon: {
    marginRight: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    marginBottom: 16,
  },
  fundWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0066FF',
    paddingVertical: 12,
    borderRadius: 8,
  },
  fundWalletText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  currentSubCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    marginBottom: 16,
  },
  timeRemainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066FF',
  },
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
  },
  renewBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noSubCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  reminderText: {
    color: '#0066FF',
    fontSize: 14,
    fontWeight: '600',
  },
  plansSection: {
    marginHorizontal: 20,
    marginBottom: 20,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recommendedPlan: {
    borderColor: '#0066FF',
    backgroundColor: '#EFF6FF',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0066FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  notificationSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  notificationStatus: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  testNotificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  testNotificationText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  clearNotificationsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 8,
  },
  clearNotificationsText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
  },
  footerLogo: {
    width: 80,
    height: 80,
    marginBottom: 10,
    borderRadius: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 5,
  },
  footerVersion: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});