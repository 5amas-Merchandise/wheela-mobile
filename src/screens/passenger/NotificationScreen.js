import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native'
import axios from 'axios'
import Constants from 'expo-constants'
import { useNavigation } from '@react-navigation/native'

const baseUrl = (
  (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) ||
  (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.baseUrl) ||
  process.env.BASE_URL ||
  ''
)

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const navigation = useNavigation()

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await axios.get(baseUrl + '/notifications?limit=50')
        setNotifications(res.data.notifications || [])
      } catch (err) {
        Alert.alert('Error', 'Could not load notifications')
      } finally {
        setLoading(false)
      }
    }
    fetchNotifications()
  }, [])

  const markAsRead = async (id) => {
    try {
      await axios.patch(baseUrl + `/notifications/${id}/read`)
      setNotifications((prev) => prev.map(n => n._id === id ? { ...n, read: true } : n))
    } catch (err) {
      Alert.alert('Error', 'Could not mark as read')
    }
  }

  if (loading) {
    return <View style={styles.container}><Text>Loading...</Text></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, item.read && styles.read]}
            onPress={() => markAsRead(item._id)}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No notifications.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 8,
    textAlign: 'center',
  },
  item: {
    backgroundColor: '#E6EEF6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  read: {
    opacity: 0.5,
  },
  title: {
    fontWeight: '700',
    color: '#0A2540',
    fontSize: 16,
  },
  body: {
    color: '#516880',
    fontSize: 15,
    marginBottom: 4,
  },
  date: {
    color: '#516880',
    fontSize: 13,
    textAlign: 'right',
  },
  empty: {
    color: '#516880',
    textAlign: 'center',
    marginTop: 24,
  },
})
