import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

async function authHeader() {
  const token = await getAuthToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function setDriverAvailability(available) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/drivers/availability`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ available }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getDriverCurrentState() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/drivers/current-state`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getOfferedRequest() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/drivers/offered-request`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function acceptTripRequest(tripId) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/${tripId}/accept`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function rejectTripRequest(tripId) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/trips/${tripId}/reject`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
