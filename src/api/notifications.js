import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

async function authHeader() {
  const token = await getAuthToken();
  return { Authorization: `Bearer ${token}` };
}

export async function getNotifications() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/notifications`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function markNotificationRead(id) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
    headers,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
