import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getAllSMS } from './smsInbox';

const { SmsModule: NativeSmsModule } = NativeModules;

class SMSService {
    constructor() {
        this.lastClipText = '';
        this.lastMessageId = '';
        this.onNewMessage = null; // callback: (text) => void
        this.monitorInterval = null;
        this.nativeSubscription = null;
        this.isRunning = false;
    }

    /**
     * Start monitoring for new messages.
     * Strategy priority:
     * 1. Native BroadcastReceiver (NativeSmsModule — EAS bare build only)
     * 2. Clipboard polling (Expo Go fallback)
     * 3. Inbox top-message polling (lightweight change detection)
     */
    start(onNewMessage) {
        if (this.isRunning) return;
        this.onNewMessage = onNewMessage;
        this.isRunning = true;

        // Initialize last message ID to avoid scanning old history on start
        this.initLastMessage();

        // Prefer native BroadcastReceiver over polling when available
        if (Platform.OS === 'android' && NativeSmsModule) {
            try {
                const emitter = new NativeEventEmitter(NativeSmsModule);
                this.nativeSubscription = emitter.addListener('onSmsReceived', ({ sender, body }) => {
                    console.log('📬 New SMS via native BroadcastReceiver from:', sender);
                    if (this.onNewMessage && body) {
                        this.onNewMessage(body);
                    }
                });
                console.log('📱 SMS Service started (Native BroadcastReceiver)');
            } catch (e) {
                console.warn('[SMSService] Native listener failed, falling back to polling:', e);
                this._startPolling();
            }
        } else {
            this._startPolling();
        }
    }

    _startPolling() {
        this.monitorInterval = setInterval(async () => {
            await this.checkClipboard();
            await this.checkInbox();
        }, 5000); // 5 second check — balance between speed and battery
        console.log('📱 SMS Service started (Hybrid Polling fallback)');
    }

    async initLastMessage() {
        try {
            const { messages } = await getAllSMS();
            if (messages && messages.length > 0) {
                this.lastMessageId = messages[0].id;
                this.lastClipText = messages[0].body;
            }
        } catch (e) {
            console.log('Failed to init last message:', e);
        }
    }

    async checkClipboard() {
        try {
            const text = await Clipboard.getStringAsync();
            if (
                text &&
                text.length > 15 &&
                text.length < 600 &&
                text !== this.lastClipText
            ) {
                this.lastClipText = text;
                console.log('📋 New message detected via clipboard');
                if (this.onNewMessage) {
                    this.onNewMessage(text);
                }
            }
        } catch (e) {
            // Clipboard access may be restricted
        }
    }

    async checkInbox() {
        if (Platform.OS !== 'android') return;

        try {
            const { messages, isDemo } = await getAllSMS();
            if (isDemo) return; // Don't poll demo data for changes

            if (messages && messages.length > 0) {
                const newest = messages[0];
                if (newest.id !== this.lastMessageId) {
                    console.log('📩 New message detected in inbox:', newest.id);
                    this.lastMessageId = newest.id;
                    this.lastClipText = newest.body;
                    if (this.onNewMessage) {
                        this.onNewMessage(newest.body);
                    }
                }
            }
        } catch (e) {
            console.log('Inbox check failed:', e);
        }
    }

    /**
     * Handle text shared to the app via Android Share Intent.
     */
    handleSharedText(text) {
        if (text && text.length > 5 && this.onNewMessage) {
            this.lastClipText = text; // avoid double-scan
            this.onNewMessage(text);
        }
    }

    /**
     * Stop monitoring and clean up all subscriptions.
     */
    stop() {
        this.isRunning = false;

        if (this.nativeSubscription) {
            this.nativeSubscription.remove();
            this.nativeSubscription = null;
        }

        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        console.log('📱 SMS Service stopped');
    }
}

// Singleton
export const smsService = new SMSService();
