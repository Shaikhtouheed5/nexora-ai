/**
 * useSmsScanner.js — React hook wrapping the native SmsModule
 *
 * Exposes:
 *   requestPermission()          → Promise<boolean>
 *   loadInbox()                  → Promise<Array<{id,sender,body,date}>>
 *   startListening(callback)     → unsubscribe function
 *
 * All functions are Android-only no-ops on other platforms.
 */

import { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';

const { SmsModule } = NativeModules;

// ── Permission ────────────────────────────────────────────────────────────────

/**
 * Requests READ_SMS + RECEIVE_SMS via PermissionsAndroid (JS side),
 * then confirms with the native module that both are actually granted.
 * Returns true only when both permissions are granted.
 */
export const requestPermission = async () => {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);

    const bothGranted =
      granted['android.permission.READ_SMS']    === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

    return bothGranted;
  } catch (e) {
    console.warn('[useSmsScanner] requestPermission error:', e.message);
    return false;
  }
};

// ── Inbox ─────────────────────────────────────────────────────────────────────

/**
 * Reads the SMS inbox via the native ContentProvider query.
 * Returns up to 50 messages, newest first.
 * Each message: { id: string, sender: string, body: string, date: string (ISO) }
 */
export const loadInbox = async () => {
  if (Platform.OS !== 'android' || !SmsModule) return [];

  try {
    const raw = await SmsModule.getSmsInbox();
    return raw.map(m => ({
      id:     m.id     || String(m.date),
      sender: m.sender || 'Unknown',
      body:   m.body   || '',
      date:   new Date(m.date).toISOString(),
    }));
  } catch (e) {
    console.warn('[useSmsScanner] loadInbox error:', e.message);
    return [];
  }
};

// ── Real-time listener ────────────────────────────────────────────────────────

/**
 * Subscribes to the "onSmsReceived" native event fired by SmsReceiver.kt.
 * @param {function} callback  Called with { sender, body, date } on each new SMS
 * @returns {function}         Call to unsubscribe
 */
export const startListening = (callback) => {
  if (Platform.OS !== 'android' || !SmsModule) return () => {};

  const emitter      = new NativeEventEmitter(SmsModule);
  const subscription = emitter.addListener('onSmsReceived', ({ sender, body }) => {
    callback({
      sender,
      body,
      id:   String(Date.now()),
      date: new Date().toISOString(),
    });
  });

  return () => subscription.remove();
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * React hook that starts the SMS listener on mount and cleans up on unmount.
 * @param {function} onNewMessage  Callback for each incoming SMS
 */
export const useSmsScanner = ({ onNewMessage } = {}) => {
  const cbRef    = useRef(onNewMessage);
  const unsubRef = useRef(null);

  // Keep latest callback without re-subscribing
  useEffect(() => { cbRef.current = onNewMessage; }, [onNewMessage]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    unsubRef.current = startListening((msg) => {
      cbRef.current?.(msg);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  return { requestPermission, loadInbox, startListening };
};
