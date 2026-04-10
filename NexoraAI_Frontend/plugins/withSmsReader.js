/**
 * Expo Config Plugin — Adds READ_SMS and RECEIVE_SMS permissions
 * to the Android manifest so the app can read the user's SMS inbox.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function withSmsReader(config) {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;
        const mainApplication = androidManifest.manifest;

        // Add SMS permissions
        if (!mainApplication['uses-permission']) {
            mainApplication['uses-permission'] = [];
        }

        const permissions = mainApplication['uses-permission'];
        const requiredPerms = [
            'android.permission.READ_SMS',
            'android.permission.RECEIVE_SMS',
        ];

        for (const perm of requiredPerms) {
            const exists = permissions.some(
                p => p.$?.['android:name'] === perm
            );
            if (!exists) {
                permissions.push({
                    $: { 'android:name': perm },
                });
            }
        }

        return config;
    });
}

module.exports = withSmsReader;
