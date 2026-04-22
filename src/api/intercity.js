import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

async function authHeader() {
  const token = await getAuthToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function searchIntercityTrips({ departureState, arrivalState, date }) {
  const params = new URLSearchParams({ departureState, arrivalState, date });
  const res = await fetch(`${BASE_URL}/intercity/search?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getIntercityBookings() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/intercity/bookings`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function createIntercityBooking(bookingData) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/intercity/bookings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bookingData),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getIntercityBookingById(bookingId) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/intercity/bookings/${bookingId}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function cancelIntercityBooking(bookingId, reason = 'Cancelled by passenger') {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/intercity/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
