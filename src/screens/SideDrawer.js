// src/screens/SideDrawer.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import auth utilities
import { getAuthToken, logout } from '../utils/auth';

const baseUrl = "https://wheels-backend-7ydc.onrender.com";

// Cache keys
const USER_PROFILE_CACHE_KEY = 'USER_PROFILE_CACHE';
const USER_PROFILE_TIMESTAMP_KEY = 'USER_PROFILE_TIMESTAMP';

// Cache duration: 5 minutes (in milliseconds)
const CACHE_DURATION = 5 * 60 * 1000;

const SideDrawer = ({ navigation }) => {
  const [user, setUser] = useState({
    name: 'Loading...',
    phone: '',
    profilePicUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Check if cache is still valid
  const isCacheValid = async () => {
    try {
      const timestampStr = await AsyncStorage.getItem(USER_PROFILE_TIMESTAMP_KEY);
      if (!timestampStr) return false;
      
      const timestamp = parseInt(timestampStr, 10);
      const now = Date.now();
      return (now - timestamp) < CACHE_DURATION;
    } catch (error) {
      return false;
    }
  };

  // Get cached profile
  const getCachedProfile = async () => {
    try {
      const cached = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  };

  // Cache profile
  const cacheProfile = async (profileData) => {
    try {
      await AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profileData));
      await AsyncStorage.setItem(USER_PROFILE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.log('Cache error:', error);
    }
  };

  const fetchUserProfile = async (forceRefresh = false) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        await logout();
        navigation.replace('Welcome');
        return;
      }

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cacheValid = await isCacheValid();
        if (cacheValid) {
          const cachedProfile = await getCachedProfile();
          if (cachedProfile) {
            setUser(cachedProfile);
            setLoading(false);
            return;
          }
        }
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const res = await axios.get(`${baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        timeout: 8000,
      });

      clearTimeout(timeoutId);

      if (res.data && res.data.user) {
        const u = res.data.user;
        const profileData = {
          name: u.name || 'Passenger',
          phone: u.phone || 'Not set',
          profilePicUrl: u.profilePicUrl || '',
        };
        
        setUser(profileData);
        await cacheProfile(profileData);
        setRetryCount(0); // Reset retry count on success
      }
    } catch (err) {
      console.error('SideDrawer profile error:', err);
      
      // Check cache as fallback
      const cachedProfile = await getCachedProfile();
      if (cachedProfile) {
        setUser(cachedProfile);
        Alert.alert(
          'Offline Mode',
          'Showing cached profile. Some features may be limited.',
          [{ text: 'OK' }]
        );
      } else if (err.code === 'ECONNABORTED' || err.message === 'canceled') {
        // Timeout error
        if (retryCount < 2) {
          // Auto retry after delay
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            fetchUserProfile();
          }, 1000 * (retryCount + 1));
        } else {
          setUser({
            name: 'Network Error',
            phone: 'Check your connection',
            profilePicUrl: '',
          });
        }
      } else if (err.response?.status === 401) {
        // Unauthorized - token expired
        await logout();
        navigation.replace('Welcome');
      } else {
        // Other errors
        setUser({
          name: 'Error Loading',
          phone: 'Tap to retry',
          profilePicUrl: '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual retry function
  const handleRetry = () => {
    setLoading(true);
    setRetryCount(0);
    fetchUserProfile(true); // Force refresh
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const menuItems = [
    { id: 'home', title: 'Home', icon: 'home-outline', screen: 'PassengerHome' },
    { id: 'history', title: 'Ride History', icon: 'time-outline', screen: 'TripHistory' },
    { id: 'intercity', title: 'City to City', icon: 'car-outline', screen: 'CityToCity' },
    { id: 'wallet', title: 'Payment Methods', icon: 'card-outline', screen: 'PaymentMethods' },
    { id: 'promos', title: 'Promotions', icon: 'pricetag-outline', screen: 'Promotions' },
    { id: 'help', title: 'Help', icon: 'help-circle-outline', screen: 'Help' },
    { id: 'settings', title: 'Settings', icon: 'settings-outline', screen: 'Settings' },
  ];

  const handleNavigate = (screen) => {
    navigation.navigate(screen);
    navigation.closeDrawer();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            // Clear cache on logout
            await AsyncStorage.multiRemove([
              USER_PROFILE_CACHE_KEY,
              USER_PROFILE_TIMESTAMP_KEY,
            ]);
          } catch (error) {
            console.log('Error clearing cache:', error);
          }
          
          await logout();
          navigation.replace('Welcome');
        },
      },
    ]);
  };

  const handleBecomeDriver = () => {
    Alert.alert(
      'Become a Driver',
      'You will be logged out and redirected to the registration flow to become a Wheela driver. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'default',
          onPress: async () => {
            await logout();
            navigation.replace('Welcome');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* User Profile Header */}
        <View style={styles.header}>
          {loading ? (
            <View style={styles.avatarLoading}>
              <ActivityIndicator size="small" color="#64748B" />
            </View>
          ) : user.profilePicUrl ? (
            <Image source={{ uri: user.profilePicUrl }} style={styles.avatar} />
          ) : (
            <TouchableOpacity onPress={handleRetry}>
              <View style={[
                styles.defaultAvatar,
                (user.name === 'Error Loading' || user.name === 'Network Error') && 
                styles.errorAvatar
              ]}>
                <Ionicons name="person" size={36} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.userInfo} 
            onPress={handleRetry}
            disabled={loading}
          >
            <Text style={styles.name}>
              {user.name}
              {retryCount > 0 && ` (Retrying ${retryCount}/2)`}
            </Text>
            <Text style={styles.phone}>{user.phone}</Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={16} color="#FBBF24" />
              <Text style={styles.ratingText}>4.92</Text>
              {(user.name === 'Error Loading' || user.name === 'Network Error') && (
                <TouchableOpacity onPress={handleRetry}>
                  <View style={styles.retryButton}>
                    <Ionicons name="refresh" size={12} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleNavigate(item.screen)}
          >
            <Ionicons name={item.icon} size={24} color="#1E293B" />
            <Text style={styles.menuText}>{item.title}</Text>
          </TouchableOpacity>
        ))}

        {/* Become a Driver CTA */}
        <TouchableOpacity style={styles.driverCTA} onPress={handleBecomeDriver}>
          <Ionicons name="car-sport" size={28} color="#00B0F3" />
          <View style={styles.driverTextContainer}>
            <Text style={styles.driverTitle}>Drive with Wheela</Text>
            <Text style={styles.driverSubtitle}>Earn money on your schedule</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* Refresh Button */}
        <TouchableOpacity style={styles.refreshButton} onPress={handleRetry}>
          <Ionicons name="refresh-circle" size={24} color="#00B0F3" />
          <Text style={styles.refreshText}>Refresh Profile</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer with Logout */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Wheela v1.2.0</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  defaultAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#00B0F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorAvatar: {
    backgroundColor: '#EF4444',
  },
  avatarLoading: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { 
    marginLeft: 16, 
    justifyContent: 'center',
    flex: 1,
  },
  name: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1E293B',
    marginBottom: 4,
  },
  phone: { 
    fontSize: 14, 
    color: '#64748B', 
    marginBottom: 4,
  },
  rating: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4,
  },
  ratingText: { 
    fontSize: 14, 
    color: '#64748B',
  },
  retryButton: {
    backgroundColor: '#00B0F3',
    borderRadius: 10,
    padding: 4,
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuText: { 
    fontSize: 16, 
    color: '#1E293B', 
    marginLeft: 20,
  },
  driverCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0F9FF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
  },
  driverTextContainer: { 
    flex: 1, 
    marginLeft: 16,
  },
  driverTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0E4E8B',
  },
  driverSubtitle: { 
    fontSize: 13, 
    color: '#64748B', 
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshText: {
    fontSize: 14,
    color: '#00B0F3',
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutText: { 
    fontSize: 16, 
    color: '#EF4444', 
    marginLeft: 12, 
    fontWeight: '600',
  },
  version: { 
    fontSize: 12, 
    color: '#94A3B8', 
    textAlign: 'center',
  },
});

export default SideDrawer;