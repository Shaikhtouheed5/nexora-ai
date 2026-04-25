/**
 * utils/api.js — Image scan API client
 * Includes abort-controller timeout and response normalization not present in lib/api.js.
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

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${text}`);
    }

    const parsed = JSON.parse(text);

    return parsed;

  } catch (error) {
    console.error('❌ API ERROR:', error.message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
