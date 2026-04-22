import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

async function authHeader() {
  const token = await getAuthToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function getWallet() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/wallet`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getTransactions({ limit = 50, offset = 0 } = {}) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/wallet/transactions?limit=${limit}&offset=${offset}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function initializeFunding({ amount, email }) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/wallet/fund/initialize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount, email }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
