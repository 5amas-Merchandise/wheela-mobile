import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import axios from 'axios'
import Constants from 'expo-constants'

export default function ServiceSelectionScreen({ navigation, route }) {
  const [pickup, setPickup] = useState(null)
  const [destination, setDestination] = useState(null)
  const [selecting, setSelecting] = useState('pickup')
  const [currentLocation, setCurrentLocation] = useState(null)
  const [pickupAddress, setPickupAddress] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [serviceType, setServiceType] = useState(route?.params?.service?.key || 'ride')
  const baseUrl = process.env.BASE_URL

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({})
        setCurrentLocation(loc.coords)
      }
    })()
  }, [])

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate
    if (selecting === 'pickup') {
      setPickup({ latitude, longitude })
      setPickupAddress('')
  const [estimatedFare, setEstimatedFare] = useState(null)
      setSelecting('destination')
    } else {
      setDestination({ latitude, longitude })
      setDestinationAddress('')
    }
  }

  const useCurrentLocation = () => {
    if (currentLocation) {
      setPickup({ latitude: currentLocation.latitude, longitude: currentLocation.longitude })
      setSelecting('destination')
    } else {
      Alert.alert('Location not available')
    }
  }

  const confirmSelection = async () => {
    if (!pickup || !destination) {
      Alert.alert('Select both pickup and destination')
      return
    }
    setLoading(true)
    try {
      // Prepare GeoJSON Point for pickup
      const pickupPoint = {
        type: 'Point',
        coordinates: [pickup.longitude, pickup.latitude],
        address: pickupAddress || '',
      }
      // POST /request with pickup, serviceType, paymentMethod
      const res = await axios.post(baseUrl + '/request', {
        pickup: pickupPoint,
        serviceType,
        paymentMethod: 'wallet',
      })
      if (res.data && res.data.requestId) {
        navigation.navigate('DriverMatching', {
          requestId: res.data.requestId,
          candidates: res.data.candidates,
          pickup,
          destination,
        })
      } else {
        Alert.alert('Error', 'Could not create trip request')
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error?.message || 'Could not create trip request')
    } finally {
      setLoading(false)
    }
  }

  // Mock address geocoding: just set lat/lng for demo
  const handleAddressSelect = async (type) => {
    // In real app, use Google Places API
    if (type === 'pickup' && pickupAddress) {
      setPickup({ latitude: 6.5244 + Math.random() * 0.01, longitude: 3.3792 + Math.random() * 0.01 })
      setSelecting('destination')
    }
    if (type === 'destination' && destinationAddress) {
      setDestination({ latitude: 6.5244 + Math.random() * 0.01, longitude: 3.3792 + Math.random() * 0.01 })
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Pickup & Destination</Text>
      <View style={styles.addressWrap}>
        {selecting === 'pickup' ? (
          <>
            <TextInput
              style={styles.addressInput}
              placeholder="Enter pickup address (mock)"
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
            <TouchableOpacity style={styles.addressBtn} onPress={() => handleAddressSelect('pickup')}>
              <Text style={styles.addressBtnText}>Set Pickup by Address</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.addressInput}
              placeholder="Enter destination address (mock)"
              value={destinationAddress}
              onChangeText={setDestinationAddress}
            />
            <TouchableOpacity style={styles.addressBtn} onPress={() => handleAddressSelect('destination')}>
              <Text style={styles.addressBtnText}>Set Destination by Address</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <MapView
        style={styles.map}
        onPress={handleMapPress}
        initialRegion={{
          latitude: currentLocation?.latitude || 6.5244,
          longitude: currentLocation?.longitude || 3.3792,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {pickup && (
          <Marker
            coordinate={pickup}
            title="Pickup"
            pinColor="#0A2540"
          />
        )}
        {destination && (
          <Marker
            coordinate={destination}
            title="Destination"
            pinColor="#00C896"
          />
        )}
      </MapView>
      <View style={styles.info}>
        <Text style={styles.step}>
          {selecting === 'pickup' ? 'Tap map for pickup location or use current location, or enter address above' : 'Tap map for destination or enter address above'}
        </Text>
        {selecting === 'pickup' && (
          <TouchableOpacity style={styles.button} onPress={useCurrentLocation}>
            <Text style={styles.buttonText}>Use Current Location</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.button} onPress={confirmSelection} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
    textAlign: 'center',
    marginVertical: 12,
  },
  map: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6EEF6',
  },
  info: {
    padding: 16,
    alignItems: 'center',
  },
  step: {
    color: '#516880',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  addressWrap: {
    padding: 12,
    alignItems: 'center',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#E6EEF6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: '90%',
    fontSize: 15,
  },
  addressBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    width: '90%',
    marginBottom: 8,
  },
  addressBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
})
