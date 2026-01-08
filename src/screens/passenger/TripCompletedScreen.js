import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import axios from 'axios'
import Constants from 'expo-constants'
import { useNavigation, useRoute } from '@react-navigation/native'
import { sendLocalNotification } from '../../utils/notifications'

const baseUrl = (
  (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) ||
  (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.baseUrl) ||
  process.env.BASE_URL ||
  ''
)

export default function TripCompletedScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { tripId } = route.params || {}
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    async function fetchTrip() {
      try {
        const res = await axios.get(baseUrl + `/trips/${tripId}`)
        if (res.data && res.data.trip) {
          setTrip(res.data.trip)
        } else {
          setTrip(null)
        }
      } catch (err) {
        Alert.alert('Error', 'Could not load trip details')
      } finally {
        setLoading(false)
      }
    }
    fetchTrip()
  }, [tripId])

  const submitRating = async () => {
    if (!rating) return
    try {
      await axios.post(baseUrl + `/trips/${tripId}/rate`, { rating })
      setFeedback('Thank you! Your rating has been submitted.')
    } catch (err) {
      setFeedback('Error: Could not submit rating.')
    }
  }

  if (loading) {
    return <View style={styles.container}><Text>Loading...</Text></View>
  }
  if (!trip) {
    return <View style={styles.container}><Text>Trip not found.</Text></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Trip Completed</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Driver: {trip.driverName || trip.driverId || 'Unknown'}</Text>
        <Text style={styles.label}>Fare: ₦{(trip.finalFare / 100).toFixed(2)}</Text>
        <Text style={styles.label}>From: {trip.pickupLocation?.address || 'N/A'}</Text>
        <Text style={styles.label}>To: {trip.dropoffLocation?.address || 'N/A'}</Text>
        <Text style={styles.label}>Date: {trip.completedAt ? new Date(trip.completedAt).toLocaleString() : 'N/A'}</Text>
        <Text style={styles.label}>Payment: {trip.paymentMethod || 'Wallet'}</Text>
        <Text style={styles.label}>Trip ID: {trip._id}</Text>
      </View>
      <Text style={styles.rateLabel}>Rate your trip:</Text>
      <View style={styles.ratingRow}>
        {[1,2,3,4,5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Text style={[styles.star, rating >= star && styles.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={submitRating}>
        <Text style={styles.buttonText}>Submit Rating</Text>
      </TouchableOpacity>
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.replace('PassengerHome')}>
        <Text style={styles.homeText}>Return to Home</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#E6EEF6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: '100%',
  },
  label: {
    color: '#516880',
    fontSize: 16,
    marginBottom: 4,
  },
  rateLabel: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#0A2540',
  },
  ratingRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  star: {
    fontSize: 32,
    color: '#E6EEF6',
    marginHorizontal: 4,
  },
  starActive: {
    color: '#FFD700',
  },
  button: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  homeBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0A2540',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  homeText: {
    color: '#0A2540',
    fontWeight: '700',
    fontSize: 16,
  },
  feedback: {
    color: '#00C896',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    marginVertical: 8,
  },
})
