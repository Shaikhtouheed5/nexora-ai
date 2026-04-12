import { Platform, NativeModules } from 'react-native';

export const SmsAndroid = null;

const { SmsModule: NativeSmsModule } = NativeModules;

const DEMO_SMS = [];

export async function getAllSMS() {
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
    return { messages: DEMO_SMS, isDemo: true };
}

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
