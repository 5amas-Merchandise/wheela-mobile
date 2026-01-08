import React, { useState } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import axios from 'axios'
import Constants from 'expo-constants'
import { useNavigation } from '@react-navigation/native'

const baseUrl = 'https://wheels-backend.vercel.app'

export default function DriverOnboardingScreen() {
  const navigation = useNavigation()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name || !phone || !vehicle) {
      Alert.alert('Validation', 'Please fill all fields')
      return
    }
    setLoading(true)
    try {
      // Updated to match backend: POST /drivers/onboarding { name, phone, vehicle }
      await axios.post(baseUrl + '/drivers/onboarding', { name, phone, vehicle })
      Alert.alert('Success', 'Onboarding submitted!')
      navigation.replace('DriverHomeOffline')
    } catch (err) {
      Alert.alert('Error', 'Could not submit onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Driver Onboarding</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Name"
      />
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone"
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        value={vehicle}
        onChangeText={setVehicle}
        placeholder="Vehicle Info"
      />
      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.submitText}>{loading ? 'Submitting...' : 'Submit'}</Text>
      </TouchableOpacity>
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
  input: {
    borderWidth: 1,
    borderColor: '#E6EEF6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
})
