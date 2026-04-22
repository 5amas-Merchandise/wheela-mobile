import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

async function authHeader() {
  const token = await getAuthToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getTrip(tripId) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/${tripId}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function cancelTrip(tripId, reason = 'Cancelled by user') {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/${tripId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function startTrip(tripId) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/${tripId}/start`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function completeTrip(tripId) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/${tripId}/complete`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getLoyalty() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/loyalty`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getTripHistory({ role = 'passenger', limit = 50, status = 'all' } = {}) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/history?role=${role}&limit=${limit}&status=${status}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
