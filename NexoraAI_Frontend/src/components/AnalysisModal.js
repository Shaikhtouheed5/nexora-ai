import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, StyleSheet,
    TouchableOpacity, ScrollView, Dimensions,
    Image, Platform, ActivityIndicator
} from 'react-native';
import { X, ShieldCheck } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { COLORS, SHADOWS, STATUS_CONFIG } from '../constants/theme';
import api from '../lib/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AnalysisModal({ visible, result, onClose, onMarkSafe, advice }) {
    const { t, lang } = useI18n();
    const [dynamicAdvice, setDynamicAdvice] = useState(null);
    const [loadingAdvice, setLoadingAdvice] = useState(false);

    useEffect(() => {
        if (visible && result && result.classification !== 'Safe') {
            setLoadingAdvice(true);
            setDynamicAdvice(null);
            api.getMessageAdvice(result.body, result.classification, lang)
                .then(res => {
                    setDynamicAdvice(res && res.length > 0 ? res : null);
                    setLoadingAdvice(false);
                })
                .catch(err => {
                    console.error("Failed to load dynamic advice", err);
                    setLoadingAdvice(false);
                });
        } else {
            setDynamicAdvice(null);
            setLoadingAdvice(false);
        }
    }, [visible, result, lang]);

    if (!result) return null;

    const config = STATUS_CONFIG[result.classification] || STATUS_CONFIG.Safe;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Glass Header */}
                    <View style={[styles.header, { backgroundColor: config.color }]}>
                        <View style={styles.headerIndicator} />
                        <Text style={styles.headerTitle}>{t('analysis_report')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="rgba(2, 6, 23, 0.6)" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Status Section */}
                        <View style={[styles.statusCard, { backgroundColor: COLORS.surface }]}>
                            <View style={[styles.badge, { backgroundColor: config.bg }]}>
                                <Text style={[styles.badgeText, { color: config.color }]}>
                                    {t(config.label).toUpperCase()}
                                </Text>
                            </View>
                            <Text style={styles.senderText}>{result.sender}</Text>
                            <Text style={styles.timeText}>
                                {new Date(result.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </Text>
                        </View>

                        {/* Confidence Breakdown */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('neural_check')}</Text>
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${result.confidence * 100}%`, backgroundColor: config.color }]} />
                                </View>
                                <Text style={[styles.scoreText, { color: config.color }]}>
                                    {Math.round(result.confidence * 100)}% Match
                                </Text>
                            </View>
                        </View>

                        {/* Full Content */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('decrypted_content')}</Text>
                            <View style={[styles.contentBox, { backgroundColor: COLORS.bgDark }]}>
                                <Text style={styles.messageBody}>{result.body}</Text>
                            </View>
                        </View>

                        {/* Strategic Defense Advice */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('strategic_defense_advice')}</Text>
                            {loadingAdvice ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={config.color} />
                                    <Text style={{ marginTop: 10, color: COLORS.textMuted, fontSize: 12 }}>
                                        Analyzing specific threats...
                                    </Text>
                                </View>
                            ) : dynamicAdvice && dynamicAdvice.length > 0 ? (
                                dynamicAdvice.slice(0, 3).map((item, idx) => (
                                    <View key={idx} style={styles.analysisRow}>
                                        <View style={[styles.analysisDot, { backgroundColor: config.color }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.adviceItemTitle, { color: config.color }]}>{item.title}</Text>
                                            <Text style={styles.analysisText}>{item.detail}</Text>
                                        </View>
                                    </View>
                                ))
                            ) : advice && advice.length > 0 ? (
                                advice.slice(0, 3).map((item, idx) => (
                                    <View key={idx} style={styles.analysisRow}>
                                        <View style={[styles.analysisDot, { backgroundColor: config.color }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.adviceItemTitle, { color: config.color }]}>{item.title}</Text>
                                            <Text style={styles.analysisText}>{item.detail}</Text>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.analysisRow}>
                                    <View style={styles.analysisDot} />
                                    <Text style={styles.analysisText}>
                                        {result.classification === 'Safe'
                                            ? t('safe_analysis')
                                            : t('threat_analysis')}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.actionContainer}>
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: COLORS.surface }]}
                                onPress={onClose}
                            >
                                <Text style={[styles.actionButtonText, { color: COLORS.textPrimary }]}>{t('dismiss')}</Text>
                            </TouchableOpacity>

                            {/* Only show Mark Safe if not already safe */}
                            {result.classification !== 'Safe' && (
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: config.color }]}
                                    onPress={() => {
                                        if (onMarkSafe) onMarkSafe();
                                    }}
                                >
                                    <Text style={[styles.actionButtonText, { color: COLORS.bgDark }]}>{t('secure_logs')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        height: SCREEN_HEIGHT * 0.85,
        ...SHADOWS.premium,
        overflow: 'hidden',
    },
    header: {
        paddingTop: 12,
        paddingBottom: 20,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    headerIndicator: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(2, 6, 23, 0.3)',
        borderRadius: 2,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: 'rgba(2, 6, 23, 0.6)',
        letterSpacing: 2,
    },
    closeButton: {
        position: 'absolute',
        right: 24,
        top: 24,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    statusCard: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 28,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        backgroundColor: COLORS.glassBg,
        ...SHADOWS.glass,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginBottom: 16,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    senderText: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    timeText: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.textMuted,
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    progressBar: {
        flex: 1,
        height: 10,
        backgroundColor: COLORS.bgDark,
        borderRadius: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    progressFill: {
        height: '100%',
        borderRadius: 5,
    },
    scoreText: {
        fontSize: 16,
        fontWeight: '900',
        width: 80,
    },
    contentBox: {
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        backgroundColor: COLORS.glassBg,
    },
    messageBody: {
        fontSize: 15,
        color: COLORS.textPrimary,
        lineHeight: 24,
        fontWeight: '500',
    },
    analysisRow: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 12,
    },
    analysisDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
        marginTop: 6,
    },
    analysisText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
        fontWeight: '500',
        flex: 1,
    },
    adviceItemTitle: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 2,
        letterSpacing: 0.3,
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 10,
    },
    actionButton: {
        flex: 1,
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
});
