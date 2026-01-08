import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import axios from 'axios';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getAuthToken, logout } from '../../utils/auth';

const baseUrl = 'http://172.20.10.9:8000' || "https://wheels-backend.vercel.app";

export default function ProfileScreen() {
  const navigation = useNavigation();

  const [user, setUser] = useState({
    name: 'Not set',
    email: 'Not set',
    phone: 'Not set',
    profilePicUrl: '',
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Session Expired', 'Please login again', [
          { text: 'OK', onPress: () => navigation.replace('Welcome') },
        ]);
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
          name: u.name || 'Not set',
          email: u.email || 'Not set',
          phone: u.phone || 'Not set',
          profilePicUrl: u.profilePicUrl || '',
        });
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.error('Profile fetch error:', err.response?.data || err.message);

      if (err.response?.status === 401) {
        await removeAuthToken();
        Alert.alert('Session Expired', 'Please login again', [
          { text: 'OK', onPress: () => navigation.replace('Welcome') },
        ]);
      } else {
        Alert.alert('Error', 'Failed to load profile. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile(true);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('Welcome');
        },
      },
    ]);
  };

  const handleChangePassword = () => {
    Alert.alert('Coming Soon', 'Password change feature will be available soon.');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00B0F3" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00B0F3']} />
      }
    >
      <Text style={styles.header}>My Profile</Text>

      {/* Profile Picture */}
      <View style={styles.picSection}>
        {user.profilePicUrl ? (
          <Image source={{ uri: user.profilePicUrl }} style={styles.profilePic} />
        ) : (
          <View style={styles.placeholderPic}>
            <Ionicons name="person" size={60} color="#999" />
          </View>
        )}

        {/* Optional: Allow photo update later */}
        <TouchableOpacity style={styles.editPicButton}>
          <Ionicons name="camera" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* User Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={22} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{user.name}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={22} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email Address</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={22} color="#666" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{user.phone}</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <TouchableOpacity style={styles.secondaryButton} onPress={handleChangePassword}>
        <Text style={styles.secondaryButtonText}>Change Password</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#0A2540',
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0A2540',
    textAlign: 'center',
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: 20,
  },
  picSection: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  profilePic: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#00B0F3',
  },
  placeholderPic: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#00B0F3',
    borderStyle: 'dashed',
  },
  editPicButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#00B0F3',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  infoSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoContent: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    color: '#0A2540',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00B0F3',
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#00B0F3',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
});