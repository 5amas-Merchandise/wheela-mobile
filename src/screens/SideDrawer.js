// src/screens/passenger/SideDrawer.js
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

import { getAuthToken, logout } from '../utils/auth'; // Adjust path if needed

const baseUrl = "https://wheels-backend.vercel.app";

const SideDrawer = ({ navigation }) => {
  const [user, setUser] = useState({
    name: 'Loading...',
    phone: '',
    profilePicUrl: '',
  });
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        navigation.replace('Welcome');
        return;
      }

      const res = await axios.get(`${baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (res.data && res.data.user) {
        const u = res.data.user;
        setUser({
          name: u.name || 'Passenger',
          phone: u.phone || 'Not set',
          profilePicUrl: u.profilePicUrl || '',
        });
      }
    } catch (err) {
      console.error('SideDrawer profile error:', err);
      if (err.response?.status === 401) {
        await removeAuthToken();
        navigation.replace('Welcome');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const menuItems = [
    { id: 'home', title: 'Home', icon: 'home-outline', screen: 'PassengerHome' },
    { id: 'history', title: 'Ride History', icon: 'time-outline', screen: 'TripHistory' },
    { id: 'intercity', title: 'City to City', icon: 'car-outline', screen: 'CityToCity' },
    { id: 'haulage', title: 'Haulage & Logistics', icon: 'cube-outline', screen: 'HaulageLogistics' },
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
        await logout(); // ← Now uses the correct function
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
          await logout(); // ← Also use logout here
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
            <View style={styles.defaultAvatar}>
              <Ionicons name="person" size={36} color="#FFFFFF" />
            </View>
          )}

          <View style={styles.userInfo}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.phone}>{user.phone}</Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={16} color="#FBBF24" />
              <Text style={styles.ratingText}>4.92</Text>
            </View>
          </View>
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
  avatarLoading: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { marginLeft: 16, justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  phone: { fontSize: 14, color: '#64748B', marginVertical: 4 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 14, color: '#64748B' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuText: { fontSize: 16, color: '#1E293B', marginLeft: 20 },
  driverCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0F9FF',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
  },
  driverTextContainer: { flex: 1, marginLeft: 16 },
  driverTitle: { fontSize: 16, fontWeight: '700', color: '#0E4E8B' },
  driverSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
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
  logoutText: { fontSize: 16, color: '#EF4444', marginLeft: 12, fontWeight: '600' },
  version: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
});

export default SideDrawer;