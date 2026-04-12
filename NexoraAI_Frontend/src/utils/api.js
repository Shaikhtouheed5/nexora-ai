/**
 * utils/api.js — Centralized API client for NexoraAI
 * All network calls go through apiCall(). No other fetch() calls in the app.
 */

import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export const API_BASE = 'https://nexora-scanner.onrender.com';

/**
 * Get the current Supabase session token.
 * Returns null if not logged in — caller decides how to handle.
 */
export const getSessionToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
};

/**
 * Normalize the image scan response to always return { text: string }.
 * Backend should return { text } at top level, but handles edge cases.
 */
const normalizeImageScanResponse = (raw) => {
  if (typeof raw?.text === 'string') return { text: raw.text };
  if (typeof raw?.data?.text === 'string') return { text: raw.data.text };
  if (typeof raw?.result?.text === 'string') return { text: raw.result.text };
  if (Array.isArray(raw?.responses) && typeof raw.responses[0]?.text === 'string') {
    return { text: raw.responses[0].text };
  }
  throw new Error('Unexpected response shape: ' + JSON.stringify(raw));
};

export const apiCall = async (endpoint, method = 'GET', body = null) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const token = await getSessionToken();

    if (!token) {
      Alert.alert('Session Expired', 'Please log in again to continue.', [{ text: 'OK' }]);
      throw new Error('No auth token — user not logged in');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    const text = await response.text();
    console.log('🌐 RAW RESPONSE:', text.slice(0, 500));

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${text}`);
    }

    const parsed = JSON.parse(text);

    // Normalize image scan response shape
    if (endpoint.includes('/scan/image')) {
      return normalizeImageScanResponse(parsed);
    }

    return parsed;

  } catch (error) {
    console.error('❌ API ERROR:', error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
