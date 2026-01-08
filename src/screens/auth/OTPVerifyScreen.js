import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation, useRoute } from '@react-navigation/native'
import axios from 'axios'
import Constants from 'expo-constants'

const JWT_KEY = 'WHEELA_JWT'
const baseUrl = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) || process.env.BASE_URL || ''

export default function OTPVerifyScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const phone = route.params?.phone || ''
  const email = route.params?.email || ''
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    if (!otp) {
      Alert.alert('Validation', 'Please enter the OTP code')
      return
    }
    setLoading(true)
    try {
      const payload = { otp }
      if (phone) payload.phone = phone
      if (email) payload.email = email
      const res = await axios.post(baseUrl + '/auth/verify', payload)
      const { token, user } = res.data
      await AsyncStorage.setItem(JWT_KEY, token)
      // Navigate to role switch or home
      navigation.reset({ index: 0, routes: [{ name: 'RoleSwitch' }] })
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Verification failed'
      Alert.alert('OTP error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your account</Text>
      <Text style={styles.subtitle}>
        Enter the OTP sent to {phone ? `phone ${phone}` : `email ${email}`}
      </Text>
      <TextInput
        placeholder="Enter OTP"
        value={otp}
        onChangeText={setOtp}
        style={styles.input}
        keyboardType="number-pad"
        maxLength={6}
      />
      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    color: '#0A2540',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#516880',
    marginBottom: 18,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E6EEF6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: 4,
  },
  button: {
    backgroundColor: '#0A2540',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
})
