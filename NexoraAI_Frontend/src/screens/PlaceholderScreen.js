import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function PlaceholderScreen({ title, onBack }) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Coming soon</Text>
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
                <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        padding: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textMuted,
        marginBottom: 40,
    },
    backButton: {
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.glassBg,
    },
    backText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: 0.5,
    },
});
