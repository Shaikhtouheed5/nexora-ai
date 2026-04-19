import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { ShieldCheck, ShieldAlert, AlertTriangle, Check, X } from 'lucide-react-native';
import { COLORS, SHADOWS, STATUS_CONFIG } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useI18n } from '../lib/i18n';
import GlassCard from './GlassCard';

export default function ResultCard({ result, onPress, onMarkSafe, onMarkMalicious }) {
    const { colors, isDark } = useTheme();
    const { t } = useI18n();

    // Normalize fields — backend may return verdict/riskLevel instead of classification
    const classification = result.classification || result.verdict || 'Unknown';
    const body = result.body || result.text || '';
    const sender = result.sender || '';
    const confidence = result.confidence != null
        ? result.confidence
        : (result.score != null ? result.score / 100 : 0);

    const config = STATUS_CONFIG[classification] || STATUS_CONFIG.Safe;
    const swipeableRef = useRef(null);

    const renderLeftActions = (progress, dragX) => {
        const trans = dragX.interpolate({
            inputRange: [0, 50, 100],
            outputRange: [-20, 0, 0],
        });
        return (
            <View style={[styles.swipeActionLeft, { backgroundColor: COLORS.success }]}>
                <Animated.View style={[styles.swipeContent, { transform: [{ translateX: trans }] }]}>
                    <Check size={24} color="#FFF" />
                    <Text style={styles.swipeText}>{t('mark_safe').toUpperCase()}</Text>
                </Animated.View>
            </View>
        );
    };

    const renderRightActions = (progress, dragX) => {
        const trans = dragX.interpolate({
            inputRange: [-100, -50, 0],
            outputRange: [0, 0, 20],
        });
        return (
            <View style={[styles.swipeActionRight, { backgroundColor: COLORS.malicious }]}>
                <Animated.View style={[styles.swipeContent, { transform: [{ translateX: trans }] }]}>
                    <X size={24} color="#FFF" />
                    <Text style={styles.swipeText}>{t('mark_malicious').toUpperCase()}</Text>
                </Animated.View>
            </View>
        );
    };

    const handleSwipeLeft = () => {
        if (onMarkSafe) onMarkSafe(result);
        swipeableRef.current?.close();
    };

    const handleSwipeRight = () => {
        if (onMarkMalicious) onMarkMalicious(result);
        swipeableRef.current?.close();
    };

    const getIcon = () => {
        if (classification === 'Safe') return <ShieldCheck size={24} color={config.color} />;
        if (classification === 'Malicious') return <ShieldAlert size={24} color={config.color} />;
        return <AlertTriangle size={24} color={config.color} />;
    };

    // Format date logic
    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Swipeable
            ref={swipeableRef}
            renderLeftActions={renderLeftActions}
            renderRightActions={renderRightActions}
            onSwipeableLeftOpen={handleSwipeLeft}
            onSwipeableRightOpen={handleSwipeRight}
            containerStyle={styles.swipeContainer}
        >
            <GlassCard style={[styles.card, { borderColor: config.color + '40' }]}>
                <TouchableOpacity onPress={onPress}>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
                            {getIcon()}
                        </View>
                        <View style={styles.headerText}>
                            <Text style={[styles.sender, { color: colors.textPrimary }]}>{sender}</Text>
                            <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(result.date)}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: config.color + '20', borderColor: config.color }]}>
                            <Text style={[styles.badgeText, { color: config.color }]}>
                                {t(config.label).toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <Text numberOfLines={2} style={[styles.messagePreview, { color: colors.textSecondary }]}>
                        {body}
                    </Text>

                    {classification !== 'Safe' && (
                        <View style={[styles.footer, { borderTopColor: colors.glassBorder }]}>
                            <Text style={[styles.riskLabel, { color: config.color }]}>
                                {t('risk_level')}: {classification.toUpperCase()}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </GlassCard>
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    swipeContainer: {
        marginBottom: 16,
        overflow: 'hidden',
        borderRadius: 24,
    },
    card: {
        borderRadius: 24, // Matches container
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    sender: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    date: {
        fontSize: 11,
        fontWeight: '500',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    messagePreview: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 12,
    },
    footer: {
        borderTopWidth: 1,
        paddingTop: 12,
        marginTop: 4,
    },
    riskLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },

    // Swipe Actions
    swipeActionLeft: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 20,
    },
    swipeActionRight: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 20,
    },
    swipeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    swipeText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
