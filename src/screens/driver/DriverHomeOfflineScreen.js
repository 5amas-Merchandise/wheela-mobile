import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import axios from 'axios';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Utils
import { getAuthToken, removeAuthToken } from '../../utils/auth'; // Added removeAuthToken

// Backend URL
const baseUrl = 'https://wheels-backend.vercel.app';

export default function DriverHomeOfflineScreen() {
  const navigation = useNavigation();

  const [driverData, setDriverData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(null);
  const [goingOnline, setGoingOnline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProfileData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setIsRefreshing(true);
    
    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => navigation.replace('Login') },
        ]);
        return;
      }

      setToken(authToken);

      // Fetch user data
      const res = await axios.get(`${baseUrl}/users/me`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000, // Add timeout
      });

      console.log('User profile response:', res.data);
      
      if (res.data && res.data.user) {
        const user = res.data.user;
        
        // Set user data
        setUserData({
          name: user.name || 'Driver',
          phone: user.phone || 'Not set',
          email: user.email || 'Not set',
        });
        
        // Set driver data with proper defaults
        setDriverData({
          driverProfile: user.driverProfile || {
            verified: false,
            verificationState: 'pending',
            isAvailable: false
          },
          roles: user.roles || { isUser: true, isDriver: true, isAdmin: false }
        });
      } else {
        throw new Error('Invalid response format');
      }

    } catch (err) {
      console.error('Error fetching profile:', err);
      
      // Handle specific error cases
      if (err.code === 'ECONNABORTED') {
        Alert.alert('Connection Timeout', 'Server is taking too long to respond.');
      } else if (err.response) {
        // Server responded with error status
        if (err.response.status === 401) {
          // Token expired or invalid
          await removeAuthToken();
          Alert.alert('Session Expired', 'Please log in again.', [
            { text: 'OK', onPress: () => navigation.replace('Login') },
          ]);
        } else if (err.response.status === 404) {
          Alert.alert('Not Found', 'User profile not found.');
        } else if (err.response.status === 500) {
          Alert.alert('Server Error', 'Please try again later.');
        } else {
          Alert.alert(
            'Error', 
            err.response.data?.error?.message || 'Could not load your profile.',
            [{ text: 'Retry', onPress: () => fetchProfileData(true) }]
          );
        }
      } else if (err.request) {
        // Request was made but no response
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        // Other errors
        Alert.alert('Error', 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchProfileData(true);
      return () => {};
    }, [])
  );

  const onRefresh = () => {
    if (!isRefreshing) {
      setRefreshing(true);
      fetchProfileData(false);
    }
  };

  const handleGoOnline = async () => {
    const profile = driverData?.driverProfile || {};
    const isVerified = profile.verified === true;
    const verificationState = profile.verificationState || 'pending';

    if (verificationState !== 'approved') {
      Alert.alert(
        'Verification Pending',
        verificationState === 'rejected' 
          ? 'Your verification was rejected. Please update your documents and try again.' 
          : 'Your documents are still under review. You will be notified once approved (usually 24-48 hours).',
        [
          { text: 'OK' },
          { 
            text: 'Update Documents', 
            onPress: () => navigation.navigate('DriverProfileVerification') 
          }
        ]
      );
      return;
    }

    if (!isVerified) {
      Alert.alert(
        'Account Not Verified',
        'Your account is not verified yet. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Go Online',
      'Are you ready to start accepting rides? Make sure you have a stable internet connection.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go Online', 
          onPress: async () => {
            setGoingOnline(true);
            try {
              // Update driver availability to online
              const response = await axios.post(
                `${baseUrl}/drivers/availability`,
                {
                  isAvailable: true,
                  lastSeen: new Date().toISOString(),
                },
                {
                  headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000,
                }
              );
              
              console.log('Go online response:', response.data);
              
              // Navigate to DriverOnlineMapScreen
              navigation.replace('DriverOnlineMap');
              
            } catch (err) {
              console.error('Error going online:', err);
              
              if (err.response?.status === 401) {
                await removeAuthToken();
                Alert.alert('Session Expired', 'Please log in again.', [
                  { text: 'OK', onPress: () => navigation.replace('Login') },
                ]);
              } else {
                Alert.alert(
                  'Error',
                  err.response?.data?.error?.message || 'Failed to go online. Please check your connection and try again.',
                  [{ text: 'OK' }]
                );
              }
            } finally {
              setGoingOnline(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAuthToken();
              navigation.replace('Login');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00B0F3" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  const profile = driverData?.driverProfile || {};
  const user = userData || {};
  const roles = driverData?.roles || { isUser: true, isDriver: true, isAdmin: false };

  console.log('Display data:', {
    profile: profile,
    user: user,
    roles: roles
  });

  const isVerified = profile.verified === true;
  const verificationState = profile.verificationState || 'pending';
  const profilePicUrl = profile.profilePicUrl || '';
  const isAvailable = profile.isAvailable || false;
  
  const vehicleDisplay = profile.vehicleMake && profile.vehicleModel && profile.vehicleNumber
    ? `${profile.vehicleMake} ${profile.vehicleModel} • ${profile.vehicleNumber.toUpperCase()}`
    : 'Not set';

  // Determine status text and color
  let statusText = '';
  let statusColor = '#FBBF24'; // yellow for pending
  
  switch(verificationState) {
    case 'approved':
      statusText = 'Verified ✓';
      statusColor = '#4ADE80'; // green
      break;
    case 'rejected':
      statusText = 'Rejected';
      statusColor = '#FF6B6B'; // red
      break;
    default:
      statusText = 'Pending Review';
      statusColor = '#FBBF24'; // yellow
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#00B0F3']}
          tintColor="#00B0F3"
        />
      }
    >
      {/* Header with Profile Picture */}
      <View style={styles.header}>
        {profilePicUrl ? (
          <Image 
            source={{ uri: profilePicUrl }} 
            style={styles.profileImage} 
            resizeMode="cover"
            onError={() => console.log('Failed to load profile image')}
          />
        ) : (
          <View style={styles.defaultAvatar}>
            <Ionicons name="person" size={60} color="#FFFFFFAA" />
          </View>
        )}
        
        <Text style={styles.welcome}>Welcome</Text>
        <Text style={styles.userName}>
          {user.name || 'Driver'}
        </Text>
        
        <View style={styles.contactInfo}>
          <View style={styles.contactItem}>
            <Ionicons name="call-outline" size={16} color="#FFFFFFAA" />
            <Text style={styles.contactText}>
              {user.phone || 'Phone not set'}
            </Text>
          </View>
          
          {user.email && user.email !== 'Not set' && (
            <View style={styles.contactItem}>
              <Ionicons name="mail-outline" size={16} color="#FFFFFFAA" />
              <Text style={styles.contactText}>
                {user.email}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Account Status</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
        
        <View style={[styles.statusRow, { marginTop: 8 }]}>
          <Ionicons name="radio-button-on" size={16} color={isAvailable ? '#4ADE80' : '#FF6B6B'} />
          <Text style={[styles.statusSubText, { color: isAvailable ? '#4ADE80' : '#FF6B6B' }]}>
            {isAvailable ? 'Currently Online' : 'Currently Offline'}
          </Text>
        </View>
        
        {verificationState === 'pending' && (
          <Text style={styles.pendingNote}>
            Your documents are under review. You'll be notified once approved (usually 24-48 hours).
          </Text>
        )}
        
        {verificationState === 'rejected' && (
          <Text style={styles.rejectedNote}>
            Your verification was rejected. Please update your documents and try again.
          </Text>
        )}
        
        {(verificationState === 'pending' || verificationState === 'rejected') && (
          <TouchableOpacity
            style={styles.updateBtn}
            onPress={() => navigation.navigate('DriverProfileVerification')}
          >
            <Text style={styles.updateBtnText}>
              {verificationState === 'rejected' ? 'Re-submit Documents' : 'Update Documents'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Driver Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        
        <View style={styles.infoRow}>
          <Ionicons name="car-sport-outline" size={20} color="#00B0F3" />
          <Text style={styles.infoLabel}>Vehicle:</Text>
          <Text style={styles.infoValue}>{vehicleDisplay}</Text>
        </View>
        
        {profile.nin && (
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={20} color="#00B0F3" />
            <Text style={styles.infoLabel}>NIN:</Text>
            <Text style={styles.infoValue}>{profile.nin}</Text>
          </View>
        )}
        
        {profile.licenseNumber && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={20} color="#00B0F3" />
            <Text style={styles.infoLabel}>License:</Text>
            <Text style={styles.infoValue}>{profile.licenseNumber}</Text>
          </View>
        )}
        
        {profile.serviceCategories && profile.serviceCategories.length > 0 && (
          <View style={styles.infoRow}>
            <Ionicons name="briefcase-outline" size={20} color="#00B0F3" />
            <Text style={styles.infoLabel}>Service:</Text>
            <Text style={styles.infoValue}>
              {profile.serviceCategories
                .map(cat => {
                  const serviceMap = {
                    'CITY_RIDE': 'City Ride',
                    'DELIVERY_BIKE': 'Delivery (Bike)',
                    'TRUCK': 'Truck/Logistics',
                    'INTERSTATE': 'Interstate Travel',
                    'KEKE': 'Keke/Tricycle',
                    'LUXURY_RENTAL': 'Luxury Rental'
                  };
                  return serviceMap[cat] || cat.replace('_', ' ');
                })
                .join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* Go Online Button */}
      <TouchableOpacity
        style={[
          styles.goOnlineBtn, 
          !isVerified && styles.disabledBtn,
          verificationState === 'rejected' && styles.rejectedBtn,
          goingOnline && styles.loadingBtn
        ]}
        onPress={handleGoOnline}
        disabled={!isVerified || goingOnline}
      >
        {goingOnline ? (
          <ActivityIndicator color="#010C44" size="small" />
        ) : (
          <>
            <Ionicons 
              name="radio-button-on" 
              size={28} 
              color={isVerified ? "#010C44" : "#FFFFFFAA"} 
              style={styles.goOnlineIcon}
            />
            <Text style={styles.goOnlineText}>
              {isVerified ? 'GO ONLINE NOW' : 
               verificationState === 'rejected' ? 'ACCOUNT REJECTED' : 'WAITING FOR APPROVAL'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('DriverProfileVerification')}
        >
          <Ionicons name="document-text-outline" size={24} color="#00B0F3" />
          <Text style={styles.actionText}>Update Documents</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Earnings')}
        >
          <Ionicons name="cash-outline" size={24} color="#00B0F3" />
          <Text style={styles.actionText}>View Earnings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#00B0F3" />
          <Text style={styles.actionText}>Settings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onRefresh}
        >
          <Ionicons name="refresh-outline" size={24} color="#00B0F3" />
          <Text style={styles.actionText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Debug Info Button */}
      <TouchableOpacity 
        style={styles.debugButton}
        onPress={() => {
          Alert.alert(
            'Debug Information',
            `Verification State: ${verificationState}\n` +
            `Verified: ${isVerified}\n` +
            `Available: ${isAvailable}\n` +
            `Name: ${user.name || 'Not set'}\n` +
            `Phone: ${user.phone || 'Not set'}\n` +
            `Email: ${user.email || 'Not set'}\n` +
            `Driver Role: ${roles.isDriver ? 'Yes' : 'No'}`
          );
        }}
      >
        <Text style={styles.debugButtonText}>🛠️ Debug Info</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C44',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
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
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#00B0F3',
    marginBottom: 16,
  },
  defaultAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1F5A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00B0F3',
    marginBottom: 16,
  },
  welcome: {
    color: '#FFFFFFAA',
    fontSize: 18,
    marginBottom: 4,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  contactInfo: {
    alignItems: 'center',
    gap: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    color: '#FFFFFFAA',
    fontSize: 16,
  },
  statusCard: {
    backgroundColor: '#1A1F5A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2F7A',
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '800',
  },
  statusSubText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  pendingNote: {
    color: '#FBBF24',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 20,
  },
  rejectedNote: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 20,
  },
  updateBtn: {
    backgroundColor: '#00B0F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  updateBtnText: {
    color: '#010C44',
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#1A1F5A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2F7A',
  },
  sectionTitle: {
    color: '#00B0F3',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  infoLabel: {
    color: '#FFFFFFAA',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 80,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  goOnlineBtn: {
    backgroundColor: '#00B0F3',
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  disabledBtn: {
    backgroundColor: '#006688',
    opacity: 0.8,
  },
  rejectedBtn: {
    backgroundColor: '#FF6B6B',
  },
  loadingBtn: {
    opacity: 0.8,
  },
  goOnlineIcon: {
    marginRight: 4,
  },
  goOnlineText: {
    color: '#010C44',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: '#1A1F5A',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#2A2F7A',
    gap: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 20,
  },
  logoutText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2F7A',
  },
  debugButtonText: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '600',
  },
});