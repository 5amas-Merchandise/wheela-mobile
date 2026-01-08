import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

const baseUrl = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) || process.env.BASE_URL || '';

// Replace with your actual logo
const WHEELA_LOGO = require('../../../assets/logo.jpg');

export default function DriverNotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await axios.get(`${baseUrl}/notifications?limit=50`);
        const notifs = res.data.notifications || [];
        // Sort newest first
        notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotifications(notifs);
      } catch (err) {
        // Silent fail - notifications are non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await axios.patch(`${baseUrl}/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      // Ignore
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationItem, item.read && styles.readItem]}
      onPress={() => markAsRead(item._id)}
    >
      <Text style={styles.notifTitle}>{item.title}</Text>
      <Text style={styles.notifBody}>{item.body}</Text>
      <Text style={styles.notifDate}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00B0F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={WHEELA_LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Notifications</Text>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications yet.</Text>
        }
        showsVerticalScrollIndicator={false}
      />
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
  notificationItem: {
    backgroundColor: '#FFFFFF10',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00B0F3',
  },
  readItem: {
    opacity: 0.6,
    borderLeftColor: '#FFFFFF30',
  },
  notifTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  notifBody: {
    color: '#FFFFFFAA',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  notifDate: {
    color: '#FFFFFF60',
    fontSize: 13,
    textAlign: 'right',
  },
  emptyText: {
    color: '#FFFFFFAA',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 80,
  },
});