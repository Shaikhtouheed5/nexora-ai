import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';
import { apiCall } from '../utils/api';
import PlaceholderScreen from './PlaceholderScreen';

const DIFFICULTY_COLORS = {
    easy:   { bg: 'rgba(16, 185, 129, 0.15)',  text: '#10B981' },
    medium: { bg: 'rgba(245, 158, 11, 0.15)',  text: '#F59E0B' },
    hard:   { bg: 'rgba(239, 68, 68, 0.15)',   text: '#EF4444' },
};

const CTA_LABELS = {
    scan:     'Scan Now',
    quiz:     'Take Quiz',
    scenario: 'Start Scenario',
};

export default function ChallengeScreen({ user, onNavigate, xpEarned = 0 }) {
    const [challenge, setChallenge]             = useState(null);
    const [loading, setLoading]                 = useState(true);
    const [error, setError]                     = useState(null);
    const [showPlaceholder, setShowPlaceholder] = useState(false);
    const [placeholderTitle, setPlaceholderTitle] = useState('');

    const toastOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (xpEarned <= 0) return;
        toastOpacity.setValue(1);
        const timer = setTimeout(() => {
            Animated.timing(toastOpacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start();
        }, 1500);
        return () => clearTimeout(timer);
    }, [xpEarned]);

    const loadChallenge = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiCall('/challenges/daily');
            setChallenge(data);
        } catch (e) {
            setError(e.message || 'Failed to load challenge');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadChallenge();
    }, [loadChallenge]);

    const handleCTA = () => {
        if (!challenge) return;
        if (challenge.type === 'scan') {
            const onScanComplete = async (verdict, scanToken) => {
                try {
                    const result = await apiCall(
                        `/challenges/${challenge.id}/complete`,
                        'POST',
                        { verdict, scan_token: scanToken },
                    );
                    onNavigate('challenge', { xpEarned: result.xp_earned ?? 0 });
                } catch {
                    onNavigate('challenge');
                }
            };
            onNavigate('scan', { onScanComplete });
        } else if (challenge.type === 'quiz') {
            setPlaceholderTitle('Quiz coming soon');
            setShowPlaceholder(true);
        } else if (challenge.type === 'scenario') {
            setPlaceholderTitle('Scenario coming soon');
            setShowPlaceholder(true);
        }
    };

    if (showPlaceholder) {
        return (
            <PlaceholderScreen
                title={placeholderTitle}
                onBack={() => setShowPlaceholder(false)}
            />
        );
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadChallenge} activeOpacity={0.7}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!challenge) return null;

    const diffStyle = DIFFICULTY_COLORS[challenge.difficulty] || DIFFICULTY_COLORS.easy;
    const ctaLabel  = challenge.completed
        ? 'Completed ✓'
        : (CTA_LABELS[challenge.type] || 'Start');

    return (
        <ScrollView
            style={styles.root}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* XP toast */}
            {xpEarned > 0 && (
                <Animated.View style={[styles.xpToast, { opacity: toastOpacity }]}>
                    <Text style={styles.xpToastText}>+{xpEarned} XP</Text>
                </Animated.View>
            )}

            {/* Header */}
            <Text style={styles.screenLabel}>DAILY CHALLENGE</Text>

            {/* Card */}
            <View style={[styles.card, SHADOWS.glass]}>
                {/* Difficulty badge */}
                <View style={[styles.badge, { backgroundColor: diffStyle.bg }]}>
                    <Text style={[styles.badgeText, { color: diffStyle.text }]}>
                        {challenge.difficulty.toUpperCase()}
                    </Text>
                </View>

                <Text style={styles.title}>{challenge.title}</Text>
                <Text style={styles.description}>{challenge.description}</Text>

                {/* XP reward */}
                <View style={styles.xpRow}>
                    <Text style={styles.xpLabel}>XP REWARD</Text>
                    <Text style={styles.xpValue}>+{challenge.xp_reward}</Text>
                </View>

                {/* Completed indicator */}
                {challenge.completed && (
                    <View style={styles.completedBanner}>
                        <Text style={styles.completedText}>✓ Completed today</Text>
                    </View>
                )}
            </View>

            {/* CTA button */}
            <TouchableOpacity
                style={[
                    styles.ctaButton,
                    challenge.completed && styles.ctaButtonDone,
                ]}
                onPress={handleCTA}
                activeOpacity={0.75}
            >
                <Text style={styles.ctaText}>{ctaLabel}</Text>
            </TouchableOpacity>

            {/* View Leaderboard — shown after XP is earned */}
            {xpEarned > 0 && (
                <TouchableOpacity
                    style={styles.leaderboardButton}
                    onPress={() => onNavigate('leaderboard')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.leaderboardButtonText}>🏆  View Leaderboard</Text>
                </TouchableOpacity>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        padding: 24,
    },

    // Screen header
    screenLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: COLORS.textMuted,
        letterSpacing: 3,
        marginBottom: 20,
        marginTop: 8,
    },

    // Challenge card
    card: {
        backgroundColor: COLORS.glassBg,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 24,
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 16,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 10,
        lineHeight: 28,
    },
    description: {
        fontSize: 14,
        color: COLORS.textMuted,
        lineHeight: 22,
        marginBottom: 20,
    },
    xpRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    xpLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.textMuted,
        letterSpacing: 1.5,
    },
    xpValue: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.primary,
    },
    completedBanner: {
        marginTop: 16,
        padding: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        alignItems: 'center',
    },
    completedText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#10B981',
    },

    // CTA
    ctaButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    ctaButtonDone: {
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    ctaText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.textPrimary,
        letterSpacing: 0.5,
    },

    // Leaderboard shortcut
    leaderboardButton: {
        marginTop: 12,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
    },
    leaderboardButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: 0.3,
    },

    // XP toast
    xpToast: {
        alignSelf: 'center',
        backgroundColor: '#f59e0b',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 24,
        marginBottom: 12,
    },
    xpToastText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 0.5,
    },

    // Error state
    errorText: {
        fontSize: 14,
        color: COLORS.malicious,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: COLORS.glassBg,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    retryText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
    },
});
