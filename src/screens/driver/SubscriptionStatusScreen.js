import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import axios from 'axios'
import Constants from 'expo-constants'
import { sendLocalNotification } from '../../utils/notifications'

const baseUrl = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) || process.env.BASE_URL || ''

export default function SubscriptionStatusScreen() {
  const [status, setStatus] = useState('inactive')
  const [expiry, setExpiry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStatus() {
      try {
        // Fetch driver profile with subscription info
        const res = await axios.get(baseUrl + '/users/me')
        const sub = res.data?.user?.subscription
        if (sub && sub.expiresAt) {
          setStatus('active')
          setExpiry(sub.expiresAt)
          // Notify if expiring soon
          const expiryDate = new Date(sub.expiresAt)
          const now = new Date()
          const diffDays = (expiryDate - now) / (1000 * 60 * 60 * 24)
          if (diffDays <= 3 && diffDays > 0) {
            sendLocalNotification({
              title: 'Subscription Expiry',
              body: `Your driver subscription expires in ${Math.ceil(diffDays)} day(s).`,
              sound: true,
            })
          }
        } else {
          setStatus('inactive')
          setExpiry(null)
        }
      } catch (err) {
        Alert.alert('Error', 'Could not load subscription status')
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [])

  const renew = async () => {
    // Prompt for plan type
    Alert.alert(
      'Renew Subscription',
      'Choose a plan',
      [
        { text: 'Daily', onPress: () => handleRenew('daily') },
        { text: 'Weekly', onPress: () => handleRenew('weekly') },
        { text: 'Monthly', onPress: () => handleRenew('monthly') },
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }

  const handleRenew = async (type) => {
    try {
      const res = await axios.post(baseUrl + '/subscription/init', { type })
      if (res.data && res.data.authorization_url) {
        Alert.alert('Payment', 'Open payment URL in browser.', [
          { text: 'Open', onPress: () => { Linking.openURL(res.data.authorization_url) } },
          { text: 'Cancel', style: 'cancel' },
        ])
      } else {
        Alert.alert('Error', 'Could not initiate payment')
      }
    } catch (err) {
      Alert.alert('Error', 'Could not initiate payment')
    }
  }

  if (loading) {
    return <View style={styles.container}><Text>Loading...</Text></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Subscription Status</Text>
      <Text style={styles.status}>Status: {status}</Text>
      <Text style={styles.expiry}>Expiry: {expiry ? new Date(expiry).toLocaleDateString() : 'N/A'}</Text>
      <TouchableOpacity style={styles.renewBtn} onPress={renew}>
        <Text style={styles.renewText}>Renew Subscription</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 8,
    textAlign: 'center',
  },
  status: {
    color: '#0A2540',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
  },
  expiry: {
    color: '#516880',
    fontSize: 15,
    marginBottom: 16,
  },
  renewBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  renewText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
})
