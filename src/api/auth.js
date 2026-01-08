import axios from 'axios'
import Constants from 'expo-constants'

const baseUrl = (
  (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) ||
  (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.baseUrl) ||
  process.env.BASE_URL ||
  ''
)

const api = axios.create({
  baseURL: baseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

export async function signup({ role, name, email, phone }) {
  // Backend expects either email or phone for signup; include role and name
  const payload = { role, name }
  if (email) payload.email = email
  if (phone) payload.phone = phone

  const res = await api.post('/auth/signup', payload)
  return res.data
}

export async function verifyOtp({ phone, email, otp }) {
  const payload = { otp }
  if (phone) payload.phone = phone
  if (email) payload.email = email

  const res = await api.post('/auth/verify-otp', payload)
  return res.data
}

export default api
