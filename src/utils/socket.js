// src/utils/socket.js - FIXED VERSION
// Native WebSocket + reconnection logic for ride-hailing app

import { getAuthToken } from './auth';

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_RECONNECT_DELAY = 1500; // ms

// ⚠️ CRITICAL FIX: Use the SAME base URL as your REST API
const BASE_WS_URL = 'wss://wheels-backend-7ydc.onrender.com'; // Changed from wheels-backend-7ydc.onrender.com

// Global event listeners (simple pub/sub style)
const listeners = new Map(); // eventName → Set<callback>

export const addListener = (event, callback) => {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
};

export const removeListener = (event, callback) => {
  if (listeners.has(event)) {
    listeners.get(event).delete(callback);
    if (listeners.get(event).size === 0) listeners.delete(event);
  }
};

const notify = (event, data) => {
  if (listeners.has(event)) {
    listeners.get(event).forEach(cb => cb(data));
  }
};

const connect = async () => {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws;
  }

  const token = await getAuthToken();
  if (!token) {
    console.warn('No auth token → cannot connect WebSocket');
    return null;
  }

  const url = `${BASE_WS_URL}?token=${encodeURIComponent(token)}`;

  console.log('🌐 Connecting WebSocket →', url.replace(/token=[^&]+/, 'token=***'));

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('✅ WebSocket OPEN');
    reconnectAttempts = 0;
    notify('connect', { socket: ws });
  };

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      console.log('⬇️ WS message:', data.type || data.notificationType || 'unknown');

      // Normalize common events
      if (data.type === 'notification') {
        notify(data.notificationType || 'notification', data);
      } else {
        notify(data.type, data);
      }
    } catch (err) {
      console.error('Parse error in WS message:', err, e.data);
    }
  };

  ws.onerror = (e) => {
    console.error('⚠️ WebSocket error:', e.message || e);
    notify('error', e);
  };

  ws.onclose = (e) => {
    console.log('🔌 WebSocket CLOSED', e.code, e.reason);
    notify('disconnect', { code: e.code, reason: e.reason });

    ws = null;

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = BASE_RECONNECT_DELAY * Math.pow(1.6, reconnectAttempts);
      console.log(`🔄 Reconnecting in ${Math.round(delay/1000)}s (attempt ${reconnectAttempts + 1})`);
      reconnectTimer = setTimeout(connect, delay);
      reconnectAttempts++;
    } else {
      console.warn('🚫 Max reconnect attempts reached');
    }
  };

  return ws;
};

export const initWebSocket = async () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  return connect();
};

export const sendWS = (data) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    console.log('⬆️ Sent:', data.type || 'unknown');
    return true;
  } else {
    console.warn('Cannot send – WS not open', data.type);
    // Try to reconnect if closed
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      initWebSocket().catch(console.error);
    }
    return false;
  }
};

export const closeWebSocket = () => {
  if (ws) {
    console.log('Manually closing WebSocket');
    ws.close(1000, 'User logout / app close');
    ws = null;
  }
  if (reconnectTimer) clearTimeout(reconnectTimer);
  listeners.clear();
};

export const isWebSocketConnected = () => ws?.readyState === WebSocket.OPEN;

// Optional: manual ping (if server supports it)
export const ping = () => sendWS({ type: 'ping' });

// REMOVED auto-init on module load - better to call explicitly in App.js