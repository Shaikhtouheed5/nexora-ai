/**
 * utils/api.js — Centralized API client for NexoraAI
 * All network calls go through apiCall(). No other fetch() calls in the app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://nexora-scanner.onrender.com';

const getToken = async () => {
  try {
    const raw = await AsyncStorage.getItem('sb-oyvyeutjidgafipmgixz-auth-token');
    if (raw) return JSON.parse(raw).access_token;
  } catch {}
  return null;
};

export const apiCall = async (endpoint, method = 'GET', body = null) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const token = await getToken();
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    const text = await response.text();
    console.log('🌐 RAW RESPONSE:', text.slice(0, 500));

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${text}`);
    }

    return JSON.parse(text);

  } catch (error) {
    console.error('❌ API ERROR:', error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
