import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

async function authedGet(path) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const getMe = () => authedGet('/users/me');
export const getUserById = (id) => authedGet(`/users/${id}`);
