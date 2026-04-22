import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

export async function estimateFare({ serviceType, pickup, dropoff }) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE_URL}/pricing/fare-estimate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ serviceType, pickup, dropoff }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
