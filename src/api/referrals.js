import { BASE_URL } from '../config';
import { getAuthToken } from '../utils/auth';

async function authHeader() {
  const token = await getAuthToken();
  return { Authorization: `Bearer ${token}` };
}

export async function validateReferralCode(code) {
  const res = await fetch(`${BASE_URL}/referrals/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getMyReferralCode() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/referrals/my-code`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getReferralHistory({ limit = 20 } = {}) {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/referrals/history?limit=${limit}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getReferralStats() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/referrals/stats`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getMyReferralBonus() {
  const headers = await authHeader();
  const res = await fetch(`${BASE_URL}/referrals/my-bonus`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
