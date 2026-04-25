import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Dimensions, FlatList,
    RefreshControl, ActivityIndicator, StatusBar, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Medal, Award, User, Crown } from 'lucide-react-native';
import api from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/ThemeContext';
import { COLORS, SHADOWS } from '../constants/theme';
import GlassCard from '../components/GlassCard';

const { width } = Dimensions.get('window');

// Top Rank Colors
const RANK_COLORS = {
    1: '#FFD700', // Gold
    2: '#C0C0C0', // Silver
    3: '#CD7F32', // Bronze
};

export default function LeaderboardScreen() {
    const { t } = useI18n();
    const { colors, isDark } = useTheme();
    const [leaderboard, setLeaderboard] = useState([]);
    const [userRank, setUserRank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const insets = useSafeAreaInsets();

    const fetchLeaderboard = async () => {
        try {
            const data = await api.getLeaderboard();
            const users = (data?.top_users || []).map((u, i) => ({
                ...u,
                _key: u.id || `user_${i}`,
            }));
            setLeaderboard(users);
            setUserRank(data?.user_rank || null);
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            setLeaderboard([]);
            setUserRank(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchLeaderboard();
    }, []);

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: (insets?.top || 0) + 20 }]}>
            <View style={styles.headerIconContainer}>
                <Trophy size={32} color={RANK_COLORS[1]} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('leaderboard_title')}
            </Text>
            <Text style={styles.subtitle}>{t('top_secure_users')}</Text>
        </View>
    );

    const renderItem = ({ item, index }) => {
        const rank = index + 1;
        const isTop3 = rank <= 3;
        const isSelf = item.id === userRank?.id;
        const rankColor = RANK_COLORS[rank] || colors?.textMuted || '#94A3B8';
        const badgeBg = isTop3 ? (rankColor + '20') : (colors?.bgDark || '#020617');
        const badgeBorder = isTop3 ? rankColor : 'transparent';
        const displayName = item.display_name || item.email || 'Agent';
        const initials = item.avatar_initials || displayName.slice(0, 2).toUpperCase();
        const xp = item.xp ?? item.xp_points ?? item.score ?? 0;

        return (
            <GlassCard style={[styles.card, isSelf && { borderColor: COLORS.primary, borderWidth: 1 }]}>
                <View style={styles.cardContent}>
                    {/* Rank Badge */}
                    <View style={[styles.rankBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                        {isTop3
                            ? <Crown size={16} color={rankColor} />
                            : <Text style={[styles.rankText, { color: colors.textSecondary }]}>#{rank}</Text>
                        }
                    </View>

                    {/* Avatar circle */}
                    <View style={[styles.avatarCircle, { backgroundColor: isSelf ? COLORS.primary + '30' : 'rgba(255,255,255,0.08)' }]}>
                        <Text style={[styles.avatarInitials, { color: isSelf ? COLORS.primary : colors.textSecondary }]}>
                            {initials}
                        </Text>
                    </View>

                    {/* Name */}
                    <View style={styles.userInfo}>
                        <Text style={[styles.emailText, { color: isSelf ? COLORS.primary : colors.textPrimary }]}>
                            {displayName}{isSelf ? ' (You)' : ''}
                        </Text>
                        <Text style={[styles.subText, { color: colors.textMuted }]}>
                            {item.scans_completed ?? 0} scans
                        </Text>
                    </View>

                    {/* XP */}
                    <View style={styles.scoreContainer}>
                        <Text style={[styles.scoreText, { color: isSelf ? COLORS.primary : COLORS.textPrimary }]}>{xp}</Text>
                        <Text style={styles.scoreLabel}>XP</Text>
                    </View>
                </View>
            </GlassCard>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    const bottomInset = insets?.bottom || 0;
    const safeRank = userRank?.rank ?? '-';
    const safeScore = userRank?.xp ?? 0;

    return (
        <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* Background Gradient */}
            <LinearGradient
                colors={[COLORS.primary + '15', 'transparent']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.3 }}
            />

            <FlatList
                data={leaderboard}
                renderItem={renderItem}
                keyExtractor={(item) => item?._key || Math.random().toString()}
                contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                ListHeaderComponent={renderHeader}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors?.textMuted || COLORS.textMuted }]}>{t('no_leaderboard')}</Text>
                }
            />

            {/* Sticky 'My Rank' Footer */}
            {userRank && (
                <View style={[styles.footer, { paddingBottom: bottomInset + 10, borderColor: colors?.glassBorder || COLORS.glassBorder }]}>
                    <View style={styles.footerContent}>
                        <View style={styles.footerRank}>
                            <Text style={[styles.footerLabel, { color: colors?.textMuted || COLORS.textMuted }]}>{(t('rank') || 'Rank').toUpperCase()}</Text>
                            <Text style={[styles.footerValue, { color: COLORS.primary }]}>#{safeRank}</Text>
                        </View>
                        <View style={styles.footerDivider} />
                        <View style={styles.footerScore}>
                            <Text style={[styles.footerLabel, { color: colors?.textMuted || COLORS.textMuted }]}>{(t('score') || 'Score').toUpperCase()}</Text>
                            <Text style={[styles.footerValue, { color: colors?.textPrimary || COLORS.textPrimary }]}>{safeScore}</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.glassBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        ...SHADOWS.glass,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontWeight: '600',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    listContent: {
        paddingHorizontal: 16,
    },
    card: {
        marginBottom: 12,
        borderRadius: 20,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bgDark,
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    rankText: {
        fontSize: 14,
        fontWeight: '700',
    },
    avatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    avatarInitials: {
        fontSize: 13,
        fontWeight: '800',
    },
    userInfo: {
        flex: 1,
        flexDirection: 'column',
        gap: 2,
    },
    emailText: {
        fontSize: 14,
        fontWeight: '700',
    },
    subText: {
        fontSize: 11,
        fontWeight: '500',
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreText: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    scoreLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 14,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface, // Solid background for footer
        borderTopWidth: 1,
        paddingTop: 16,
        ...SHADOWS.premium,
    },
    footerContent: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    footerRank: {
        alignItems: 'center',
    },
    footerScore: {
        alignItems: 'center',
    },
    footerLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 4,
    },
    footerValue: {
        fontSize: 22,
        fontWeight: '900',
    },
    footerDivider: {
        width: 1,
        height: 32,
        backgroundColor: COLORS.glassBorder,
    },
});
