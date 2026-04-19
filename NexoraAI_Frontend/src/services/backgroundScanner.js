import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from '../lib/api';
import { getAllSMS } from './smsInbox';

const BACKGROUND_SCAN_TASK = 'background-sms-scan';

// 1. Define the task
TaskManager.defineTask(BACKGROUND_SCAN_TASK, async () => {
    try {
        console.log('Running background scan...');

        // Fetch SMS
        const smsResult = await getAllSMS();
        const msgs = smsResult.messages || [];

        if (msgs.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

        // Scan messages
        const response = await api.scanBatch(msgs);
        const results = response?.results || [];

        // Find high threat messages (>60% confidence)
        const highThreats = results.filter(m =>
            m.classification === 'Malicious' &&
            m.confidence > 0.6
        );

        if (highThreats.length > 0) {
            // Send notification for the most critical threat
            const threat = highThreats[0];
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "⚠️ SECURE ALERT (Background)",
                    body: `Threat detected from ${threat.sender || 'Unknown'}. Neural Score: ${Math.round(threat.confidence * 100)}%`,
                    data: { threatId: threat.id },
                },
                trigger: null,
            });
            return BackgroundFetch.BackgroundFetchResult.NewData;
        }

        return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
        console.error('Background task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

// 2. Registration function
export async function registerBackgroundScanner() {
    if (Platform.OS === 'web') return;
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK);
        if (isRegistered) {
            console.log('Background task already registered');
            return;
        }

        await BackgroundFetch.registerTaskAsync(BACKGROUND_SCAN_TASK, {
            minimumInterval: 15 * 60, // 15 minutes (OS minimum)
            stopOnTerminate: false, // Keep running after app close
            startOnBoot: true, // Keep running after phone reboot
        });

        console.log('Background task registered successfully');
    } catch (err) {
        console.error('Task registration failed:', err);
    }
}

export async function unregisterBackgroundScanner() {
    try {
        await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SCAN_TASK);
    } catch (err) {
        console.error('Task unregistration failed:', err);
    }
}
