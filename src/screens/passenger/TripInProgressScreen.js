import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import axios from 'axios'
import Constants from 'expo-constants'
import { useNavigation, useRoute } from '@react-navigation/native'
import { sendLocalNotification } from '../../utils/notifications'

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}


function TripInProgressScreen() {
  const baseUrl = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) || process.env.BASE_URL || ''
  const navigation = useNavigation()
  const route = useRoute()
  const { trip: initialTrip } = route.params || {}
  const [trip, setTrip] = useState(initialTrip)
  const [status, setStatus] = useState(initialTrip?.status || 'in-progress')
  const [distance, setDistance] = useState(null)
  const [eta, setEta] = useState(null)

  useEffect(() => {
    // Poll for trip status updates
    if (!trip?._id) return
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(baseUrl + `/trips/${trip._id}`)
        if (res.data && res.data.trip) {
          setTrip(res.data.trip)
          setStatus(res.data.trip.status)
          if (res.data.trip.status === 'completed') {
            sendLocalNotification({
              title: 'Trip Completed',
              body: 'Your trip has ended. Please rate your driver.',
              sound: true,
            })
            clearInterval(poll)
            navigation.replace('TripCompleted', { tripId: res.data.trip._id })
          }
        }
      } catch (err) {}
    }, 4000)
    // Notify when trip starts
    sendLocalNotification({
      title: 'Trip Started',
      body: 'Your trip is now in progress!',
      sound: true,
    })
    return () => clearInterval(poll)
  }, [trip?._id])

  useEffect(() => {
    if (trip?.driverLocation && trip?.dropoffLocation && Array.isArray(trip.driverLocation.coordinates) && Array.isArray(trip.dropoffLocation.coordinates)) {
      const [driverLng, driverLat] = trip.driverLocation.coordinates
      const [destLng, destLat] = trip.dropoffLocation.coordinates
      const dist = haversineDistance(driverLat, driverLng, destLat, destLng)
      setDistance(dist)
      setEta(dist ? Math.ceil((dist / 30) * 60) : null)
    }
  }, [trip?.driverLocation, trip?.dropoffLocation])

  const endTrip = async () => {
    try {
      await axios.post(baseUrl + `/trips/${trip._id}/complete`)
      sendLocalNotification({
        title: 'Trip Completed',
        body: 'Your trip has ended. Please rate your driver.',
        sound: true,
      })
      navigation.replace('TripCompleted', { tripId: trip._id })
    } catch (err) {
      Alert.alert('Error', 'Could not complete trip')
    }
  }

  const cancelTrip = async () => {
    try {
      await axios.post(baseUrl + `/trips/${trip._id}/cancel`)
      sendLocalNotification({
        title: 'Trip Cancelled',
        body: 'Your trip has been cancelled.',
        sound: true,
      })
      navigation.replace('PassengerHome')
    } catch (err) {
      Alert.alert('Error', 'Could not cancel trip')
    }
  }

  const contactDriver = () => {
    Alert.alert('Contact Driver', `Call ${trip?.driverPhone || 'N/A'}`)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Trip In Progress</Text>
      <View style={styles.driverCard}>
        <Text style={styles.driverName}>Driver: {trip?.driverName || 'Unknown'}</Text>
        <Text style={styles.driverInfo}>Vehicle: {trip?.driverVehicle || 'N/A'}</Text>
        <Text style={styles.driverInfo}>Phone: {trip?.driverPhone || 'N/A'}</Text>
        <TouchableOpacity style={styles.contactBtn} onPress={contactDriver}>
          <Text style={styles.contactText}>Contact Driver</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: trip?.pickupLocation?.coordinates?.[1] || 6.5244,
            longitude: trip?.pickupLocation?.coordinates?.[0] || 3.3792,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {trip?.pickupLocation?.coordinates && (
            <Marker coordinate={{ latitude: trip.pickupLocation.coordinates[1], longitude: trip.pickupLocation.coordinates[0] }} title="Pickup" pinColor="#0A2540" />
          )}
          {trip?.dropoffLocation?.coordinates && (
            <Marker coordinate={{ latitude: trip.dropoffLocation.coordinates[1], longitude: trip.dropoffLocation.coordinates[0] }} title="Destination" pinColor="#00C896" />
          )}
          {trip?.driverLocation?.coordinates && (
            <Marker coordinate={{ latitude: trip.driverLocation.coordinates[1], longitude: trip.driverLocation.coordinates[0] }} title="Driver" pinColor="#FFD700" />
          )}
        </MapView>
      </View>
      <Text style={styles.status}>Status: {status}</Text>
      <Text style={styles.status}>Distance: {distance ? `${distance.toFixed(2)} km` : 'Calculating...'}</Text>
      <Text style={styles.status}>ETA: {eta ? `${eta} min` : 'Calculating...'}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.endBtn} onPress={endTrip} disabled={status === 'completed' || status === 'cancelled'}>
          <Text style={styles.endText}>End Trip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelTrip} disabled={status === 'completed' || status === 'cancelled'}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default TripInProgressScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 24,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A2540',
    textAlign: 'center',
    marginBottom: 8,
  },
  driverCard: {
    backgroundColor: '#E6EEF6',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  driverName: {
    fontWeight: '700',
    color: '#0A2540',
    fontSize: 16,
  },
  driverInfo: {
    color: '#516880',
    fontSize: 14,
  },
  mapWrap: {
    flex: 1,
    margin: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6EEF6',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  status: {
    textAlign: 'center',
    color: '#516880',
    marginVertical: 8,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  endBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  endText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  contactBtn: {
    backgroundColor: '#00C896',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    width: 140,
    alignSelf: 'center',
  },
  contactText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0A2540',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  cancelText: {
    color: '#0A2540',
    fontWeight: '700',
    fontSize: 16,
  },
})
