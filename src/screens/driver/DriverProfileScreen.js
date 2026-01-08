import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';

const baseUrl = 'https://wheels-backend.vercel.app'

// Replace with your actual logo & profile placeholder if needed
const WHEELA_LOGO = require('../../../assets/logo.jpg');
const PROFILE_PLACEHOLDER = require('../../../assets/profile-placeholder.png'); // Optional

export default function DriverProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    vehicle: '',
    rating: 0,
    totalTrips: 0,
    verified: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await axios.get(`${baseUrl}/driver/me`);
        setProfile({
          name: res.data.name || 'Driver',
          phone: res.data.phone || 'N/A',
          vehicle: res.data.vehicle || 'N/A',
          rating: res.data.rating || 0,
          totalTrips: res.data.totalTrips || 0,
          verified: res.data.verified || false,
        });
      } catch (err) {
        Alert.alert('Error', 'Could not load profile');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['WHEELA_TOKEN', 'WHEELA_USER', 'WHEELA_ROLE']);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Welcome' }],
            });
          },
        },
      ]
    );
  };

  const openSupport = () => {
    Linking.openURL('mailto:support@wheela.com'); // Or your support link
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>My Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Image source={PROFILE_PLACEHOLDER} style={styles.avatar} />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.phone}>{profile.phone}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.rating.toFixed(1)} ⭐</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.totalTrips}</Text>
            <Text style={styles.statLabel}>Trips Completed</Text>
          </View>
        </View>

        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>
            {profile.verified ? 'Verified Driver ✓' : 'Verification Pending'}
          </Text>
        </View>
      </View>

      {/* Vehicle Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Vehicle</Text>
        <Text style={styles.infoText}>{profile.vehicle}</Text>
      </View>

      {/* Menu Options */}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('DriverProfileVerification')}
      >
        <Text style={styles.menuText}>Documents & Verification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Earnings')}>
        <Text style={styles.menuText}>Earnings & Payouts</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={openSupport}>
        <Text style={styles.menuText}>Help & Support</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>App Version 1.0.0 • December 2025</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44',
  },
  content: {
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
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
  profileCard: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    backgroundColor: '#FFFFFF30',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  phone: {
    color: '#FFFFFFAA',
    fontSize: 16,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 24,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: '#00B0F3',
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: '#FFFFFFAA',
    fontSize: 14,
  },
  verifiedBadge: {
    backgroundColor: profile.verified ? '#00B0F320' : '#FFFFFF20',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoTitle: {
    color: '#00B0F3',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  menuItem: {
    backgroundColor: '#FFFFFF10',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  logoutBtn: {
    backgroundColor: '#FF3B3000',
    borderWidth: 2,
    borderColor: '#FF3B30',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 18,
    fontWeight: '800',
  },
  version: {
    color: '#FFFFFF60',
    fontSize: 13,
    textAlign: 'center',
  },
});