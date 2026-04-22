import axios from 'axios'
import { BASE_URL } from '../config'

const api = axios.create({
  baseURL: BASE_URL,
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
