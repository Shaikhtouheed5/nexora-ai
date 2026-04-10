import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../lib/ThemeContext';

export default function GlassCard({ children, style, intensity = 20, tint = 'default' }) {
    const { isDark, colors } = useTheme();

    const containerStyle = {
        borderRadius: 24,
        overflow: 'hidden',
        borderColor: colors.glassBorder,
        borderWidth: 1,
        backgroundColor: Platform.OS === 'android' ? colors.glassBg : 'transparent', // Android fallback
        ...Platform.select({
            ios: {
                shadowColor: colors.glassShadow,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
            },
            android: {
                elevation: 4,
            },
        }),
    };

    const blurTint = tint === 'default' ? (isDark ? 'dark' : 'light') : tint;

    return (
        <View style={[containerStyle, style]}>
            {Platform.OS === 'ios' && (
                <BlurView intensity={intensity} tint={blurTint} style={StyleSheet.absoluteFill} />
            )}
            <View style={[styles.innerContent, { borderColor: colors.glassHighlight }]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    innerContent: {
        padding: 20,
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    }
});
