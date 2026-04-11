/**
 * Nexora SMS Inbox Provider
 *
 * Uses the native SmsModule (SmsModule.java) when available in a bare-workflow
 * build (EAS Build), falling back to demo data in Expo Go / managed builds.
 */

import { Platform, NativeModules } from 'react-native';

// Exported for backwards compatibility
export const SmsAndroid = null;

const { SmsModule: NativeSmsModule } = NativeModules;

const DEMO_SMS = [
    {
        id: 'demo_001',
        sender: '+1-800-APPLE',
        body: 'Your Apple ID has been locked due to suspicious activity. Verify your identity immediately: http://apple-verify-secure.xyz/login',
        date: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
        id: 'demo_002',
        sender: 'Mom',
        body: 'Hey sweetheart, can you pick up some milk on your way home? Dad says we also need bread. Love you!',
        date: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
        id: 'demo_003',
        sender: '+44-7911-PRIZE',
        body: "CONGRATULATIONS! You've won a £1000 Amazon voucher! Claim your prize now before it expires: http://amazon-winner.top/claim",
        date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
        id: 'demo_004',
        sender: 'Uber',
        body: 'Your Uber ride to Airport is arriving in 3 minutes. Track your driver in the app.',
        date: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
        id: 'demo_005',
        sender: '+1-202-555-0147',
        body: 'URGENT: Your bank account has been compromised! Secure your account now: http://192.168.1.1/secure-login',
        date: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
        id: 'demo_006',
        sender: 'HSBC Alert',
        body: 'We noticed unusual activity on your account. Confirm your details: http://hsbc-secure-verify.net/confirm',
        date: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    },
    {
        id: 'demo_007',
        sender: 'Amazon',
        body: 'Your order #112-3456789 has shipped and will arrive by Friday. Track: https://amazon.com/track',
        date: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
];

/**
 * Returns SMS messages from the native inbox (EAS build) or demo data (Expo Go).
 * Returns { messages: [...], isDemo: boolean }
 */
export async function getAllSMS() {
    // Use real native module when available (EAS bare build)
    if (Platform.OS === 'android' && NativeSmsModule) {
        try {
            const rawMessages = await NativeSmsModule.getSmsInbox();
            if (rawMessages && rawMessages.length > 0) {
                const messages = rawMessages.map((sms, index) => ({
                    id: `native_${index}_${sms.date}`,
                    sender: sms.sender || 'Unknown',
                    body: sms.body || '',
                    date: sms.date
                        ? new Date(parseInt(sms.date, 10)).toISOString()
                        : new Date().toISOString(),
                }));
                return { messages, isDemo: false };
            }
        } catch (err) {
            console.warn('[smsInbox] Native getSmsInbox failed, falling back to demo:', err);
        }
    }
    // Fallback: demo data for Expo Go / iOS / permission denied
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
