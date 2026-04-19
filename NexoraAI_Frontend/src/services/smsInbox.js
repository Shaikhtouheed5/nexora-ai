/**
 * Nexora SMS Inbox Provider
 *
 * Reads REAL SMS from the phone's inbox using react-native-get-sms-android.
 * Falls back to demo data only if the native module is unavailable (e.g., running in Expo Go).
 */

import { Platform, NativeModules, PermissionsAndroid, Alert } from 'react-native';

export let SmsAndroid = null;
try {
    const module = require('react-native-get-sms-android');
    SmsAndroid = module.default || module;
} catch (e) {
    // Native module not available (e.g., in Expo Go)
}

/**
 * Request SMS permission on Android.
 */
async function requestSmsPermission() {
    if (Platform.OS !== 'android') return false;

    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            {
                title: 'SMS Permission',
                message: 'Nexora needs access to your SMS to scan for phishing threats.',
                buttonPositive: 'Allow',
                buttonNegative: 'Deny',
            }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
        return false;
    }
}

/**
 * Read real SMS from the Android inbox.
 * Returns array of { id, sender, body, date }
 */
function readNativeSMS() {
    return new Promise((resolve, reject) => {
        if (!SmsAndroid || !SmsAndroid.list) {
            reject(new Error('Native SMS module not available or invalid'));
            return;
        }

        const filter = {
            box: 'inbox',
            maxCount: 200,
            indexFrom: 0,
            sort: true, // newest first
        };

        SmsAndroid.list(
            JSON.stringify(filter),
            (fail) => {
                reject(new Error(fail));
            },
            (count, smsList) => {
                try {
                    const messages = JSON.parse(smsList);
                    const formatted = messages.map((sms, index) => ({
                        id: sms._id || `sms_${index}`,
                        sender: sms.address || 'Unknown',
                        body: sms.body || '',
                        date: sms.date, // raw Unix ms — preserved as-is
                    }));
                    // Ensure newest-first order regardless of native sort
                    formatted.sort((a, b) => parseInt(b.date) - parseInt(a.date));
                    resolve(formatted);
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}

/**
 * Demo SMS for when native module isn't available (Expo Go).
 */
const DEMO_SMS = [
    {
        id: "demo_001", sender: "+1-800-APPLE",
        body: "Your Apple ID has been locked due to suspicious activity. Verify your identity immediately: http://apple-verify-secure.xyz/login",
        date: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
        id: "demo_002", sender: "Mom",
        body: "Hey sweetheart, can you pick up some milk on your way home? Dad says we also need bread. Love you!",
        date: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
        id: "demo_003", sender: "+44-7911-PRIZE",
        body: "CONGRATULATIONS! You've won a £1000 Amazon voucher! Claim your prize now before it expires: http://amazon-winner.top/claim",
        date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
        id: "demo_004", sender: "Uber",
        body: "Your Uber ride to Airport is arriving in 3 minutes. Track your driver in the app.",
        date: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
        id: "demo_005", sender: "+1-202-555-0147",
        body: "URGENT: Your bank account has been compromised! Secure your account now: http://192.168.1.1/secure-login",
        date: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
];

/**
 * Get all SMS messages.
 * Tries native SMS reading first; falls back to demo data if unavailable.
 */
export async function getAllSMS() {
    // Try native SMS reading (works in built APK)
    if (Platform.OS === 'android' && SmsAndroid) {
        try {
            const hasPermission = await requestSmsPermission();
            if (hasPermission) {
                const messages = await readNativeSMS();
                // Return whatever we found (even if empty) as real data
                return { messages, isDemo: false };
            }
        } catch (e) {
            console.log('Native SMS reading failed:', e.message);
        }
    }

    // Fallback: demo data (Expo Go / iOS / No module)
    return { messages: DEMO_SMS, isDemo: true };
}

/**
 * Format relative time for display.
 */
export function getRelativeTime(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
}
