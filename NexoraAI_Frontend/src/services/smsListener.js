import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getAllSMS } from './smsInbox';

class SMSService {
    constructor() {
        this.lastClipText = '';
        this.lastMessageId = '';
        this.onNewMessage = null; // callback: (text) => void
        this.monitorInterval = null;
        this.isRunning = false;
        this.seenIds = new Set();
        this.initialScanDone = false;
    }

    /**
     * Start monitoring for new messages.
     * Strategy:
     * 1. Clipboard polling (Fallback for Expo Go)
     * 2. Inbox "Top Message" polling (Lightweight check for new IDs)
     */
    async start(onNewMessage) {
        if (this.isRunning) return;
        try {
            // Check for Android SMS permissions first
            const hasPermission = await this.verifyPermissions();
            if (!hasPermission) {
                console.log('SMS Service cannot start: Permission denied');
                return;
            }

            this.onNewMessage = onNewMessage;
            this.isRunning = true;
            this.seenIds = new Set();       // start empty — first poll scans everything
            this.initialScanDone = false;

            // Start the polling loop — first iteration will scan all existing messages
            this.monitorInterval = setInterval(async () => {
                if (!this.isRunning) return;
                try {
                    await this.checkClipboard();
                    await this.checkInbox();
                } catch (err) {
                    console.log('Monitor loop error:', err);
                }
            }, 3000); // 3 seconds is a safe sweet spot for battery vs speed

            console.log('SMS Service started (Verified Permissions & Hybrid Tracking)');
        } catch (e) {
            console.log('SMS Service start failed (non-fatal):', e);
            this.isRunning = false;
        }
    }

    async verifyPermissions() {
        if (Platform.OS !== 'android') return true; // iOS/Web has different handling
        try {
            const { PermissionsAndroid } = require('react-native');
            const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
            return granted;
        } catch (e) {
            return false;
        }
    }

    async checkClipboard() {
        try {
            const text = await Clipboard.getStringAsync();
            if (
                text &&
                text.length > 20 && // Increased min length to avoid small snippets
                text.length < 1000 &&
                text !== this.lastClipText
            ) {
                this.lastClipText = text;
                console.log('New content detected via clipboard');
                if (this.onNewMessage) {
                    this.onNewMessage(text);
                }
            }
        } catch (e) {
            // Permission restricted or clipboard blocked
        }
    }

    async checkInbox() {
        if (Platform.OS !== 'android') return;

        try {
            const { messages, isDemo } = await getAllSMS();
            if (isDemo || !messages || messages.length === 0) return;

            if (!this.initialScanDone) {
                // First load: scan ALL existing messages (oldest first), then mark all seen
                this.initialScanDone = true;
                console.log(`Initial inbox scan: ${messages.length} messages`);

                // Mark every message as seen BEFORE firing callbacks
                // so subsequent polls don't re-scan them
                messages.forEach(msg => this.seenIds.add(msg.id));

                // Fire callbacks oldest-first so UI displays in chronological order
                for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    if (this.onNewMessage) {
                        this.onNewMessage(msg.body);
                    }
                }
                return;
            }

            // Subsequent polls: only messages we haven't seen yet
            // Messages arrive newest-first; stop at first known ID
            const newMessages = [];
            for (const msg of messages) {
                if (this.seenIds.has(msg.id)) break;
                newMessages.push(msg);
            }

            if (newMessages.length > 0) {
                console.log(`Processing ${newMessages.length} new messages from inbox`);

                // Fire callbacks oldest-first
                for (let i = newMessages.length - 1; i >= 0; i--) {
                    const msg = newMessages[i];
                    this.seenIds.add(msg.id);

                    // Keep set bounded to last 500 IDs
                    if (this.seenIds.size > 500) {
                        const firstItem = this.seenIds.values().next().value;
                        this.seenIds.delete(firstItem);
                    }

                    if (this.onNewMessage) {
                        this.onNewMessage(msg.body);
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
     * Stop monitoring.
     */
    stop() {
        this.isRunning = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        console.log('SMS Service stopped');
    }
}

// Singleton
export const smsService = new SMSService();
