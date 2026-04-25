import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert,
    Dimensions, RefreshControl, Image, Animated, Easing,
    Modal, TextInput, KeyboardAvoidingView, Platform,
    Linking, AppState,
} from 'react-native';
import { requestSmsPermissions } from '../hooks/useSmsPermission';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Shield, Smartphone, Activity, AlertTriangle, ShieldCheck, ShieldAlert, ArrowDown, ArrowUp } from 'lucide-react-native';
import { COLORS, SHADOWS, STATUS_CONFIG } from '../constants/theme';
import { useTheme } from '../lib/ThemeContext';
import { useI18n } from '../lib/i18n';
import api, { normalizeScanResult } from '../lib/api';
import { getAllSMS, getRelativeTime, SmsAndroid } from '../services/smsInbox';
import ResultCard from '../components/ResultCard';
import AnalysisModal from '../components/AnalysisModal';
import ThreatHeatmap from '../components/ThreatHeatmap';
import GlassCard from '../components/GlassCard';
import ConfidenceGauge from '../components/ConfidenceGauge';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { registerBackgroundScanner } from '../services/backgroundScanner';
import { smsService } from '../services/smsListener';

const { width } = Dimensions.get('window');

const FILTERS = [
    { key: 'all', label: 'all' },
    { key: 'threats', label: 'threats' },
    { key: 'suspicious', label: 'suspicious' },
    { key: 'safe', label: 'safe' },
];

const SORT_OPTIONS = [
    { key: 'newest', label: 'newest' },
    { key: 'oldest', label: 'oldest' },
    { key: 'threat', label: 'by_threat' },
];

export default function ScannerScreen({ onScanComplete } = {}) {
    const { colors, isDark } = useTheme();
    const { t, lang } = useI18n();

    const [scanning, setScanning] = useState(false);
    const [monitoring, setMonitoring] = useState(true);
    const [scannedMessages, setScannedMessages] = useState([]);
    const [stats, setStats] = useState({ total: 0, threats: 0, suspicious: 0, safe: 0 });
    const [isDemo, setIsDemo] = useState(false);
    const [advice, setAdvice] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [lastScanCount, setLastScanCount] = useState(0);

    // Notification Setup
    useEffect(() => {
        const setup = async () => {
            try {
                const { status } = await Notifications.requestPermissionsAsync();
                if (status !== 'granted') {
                    console.log('Notification permissions not granted');
                }
            } catch (e) {
                console.log('Notification permission request failed:', e);
            }

            try {
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowAlert: true,
                        shouldPlaySound: true,
                        shouldSetBadge: true,
                    }),
                });
            } catch (e) {
                console.log('setNotificationHandler failed:', e);
            }

            try {
                await registerBackgroundScanner();
            } catch (e) {
                console.log('registerBackgroundScanner failed:', e);
            }
        };
        setup();
    }, []);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Filter & Sort state
    const [activeFilter, setActiveFilter] = useState('all');
    const [sortMode, setSortMode] = useState('threat');
    const [showSortMenu, setShowSortMenu] = useState(false);

    // Quick Scan (FAB modal)
    const [showQuickScan, setShowQuickScan] = useState(false);
    const [quickScanText, setQuickScanText] = useState('');
    const [quickScanLoading, setQuickScanLoading] = useState(false);
    const [quickScanResult, setQuickScanResult] = useState(null);

    // Connected Apps toggles
    const [connectedApps, setConnectedApps] = useState({
        telegram: false, sms: true,
    });

    // Pulse animation for refresh
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        try { scanAllMessages(); } catch (e) { console.log('scanAllMessages failed:', e); }
        try { loadAdvice(); } catch (e) { console.log('loadAdvice failed:', e); }

        // Robust event-driven Hybrid Monitoring
        try {
            smsService.start(async (text) => {
                try {
                    console.log('New message detected via service:', text);
                    await handleNewIncomingMessage(text);
                } catch (e) {
                    console.log('handleNewIncomingMessage failed:', e);
                }
            });
        } catch (e) {
            console.log('smsService.start failed:', e);
        }

        return () => {
            try { smsService.stop(); } catch (e) { console.log('smsService.stop failed:', e); }
        };
    }, [lang]);

    const loadAdvice = async () => {
        try {
            const data = await api.get('/edu/advice', { params: { lang } });
            setAdvice(Array.isArray(data) ? data : []);
        } catch (e) {
            console.log('Advice retrieval failed:', e);
            setAdvice([]);
        }
    };

    useEffect(() => {
        if (scanning) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease)
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                        easing: Easing.inOut(Easing.ease)
                    })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [scanning]);

    const scanAllMessages = async () => {
        setScanning(true);
        try {
            let msgs = [];
            let demo = true;
            try {
                const smsResult = await getAllSMS();
                msgs = smsResult.messages || [];
                demo = smsResult.isDemo ?? true;
            } catch (smsErr) {
                console.warn('SMS read failed, using empty list:', smsErr);
                msgs = [];
                demo = true;
            }

            const response = await api.scanBatch(msgs);
            const results = response?.results || [];

            // Check for new threats in the batch
            checkForNewThreats(results);

            setScannedMessages(results);
            calculateStats(results);
            setIsDemo(demo);
        } catch (e) {
            console.error('Scan error:', e);
            setScannedMessages([]);
            calculateStats([]);
        }
        setScanning(false);
    };

    const handleNewIncomingMessage = async (text) => {
        try {
            // Scan only the single new message
            const rawResult = await api.scanMessage(text);

            // The API might not return the original body/sender, so we merge it
            const result = {
                id: Date.now().toString(), // Ensure unique ID for list rendering
                body: rawResult.body || text,
                sender: rawResult.sender || 'Unknown Sender',
                date: new Date().toISOString(),
                ...rawResult
            };

            // Update state: prepend new result if not already there
            setScannedMessages(prev => {
                const exists = prev.some(m => m.body === result.body);
                if (exists) return prev;
                const newMsgs = [result, ...prev];
                calculateStats(newMsgs);
                return newMsgs;
            });

            // If malicious, trigger notification immediately
            if (result.classification === 'Malicious' && result.confidence > 0.6) {
                triggerThreatNotification(result);
            }
        } catch (e) {
            console.error('Failed to scan incoming message:', e);
        }
    };

    const checkForNewThreats = (messages) => {
        if (messages.length > lastScanCount) {
            const newThreats = messages.filter(m =>
                m.classification === 'Malicious' &&
                m.confidence > 0.6
            );

            if (newThreats.length > 0) {
                // Only notify if we haven't already notified for this exact message
                // For simplicity, we just notify for the first new one
                triggerThreatNotification(newThreats[0]);
            }
            setLastScanCount(messages.length);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await scanAllMessages();
        setRefreshing(false);
    };

    const calculateStats = (messages) => {
        const total = messages.length;
        const threats = messages.filter(m => m.classification === 'Malicious').length;
        const suspicious = messages.filter(m => m.classification === 'Suspicious').length;
        const safe = total - threats - suspicious;

        setStats({ total, threats, suspicious, safe });
    };

    const triggerThreatNotification = async (threat) => {
        if (Platform.OS === 'web') return; // Cannot schedule native notifications on web

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "⚠️ URGENT SECURITY ALERT",
                body: `Threat detected from ${threat.sender || 'Unknown'}. Neural Score: ${Math.round(threat.confidence * 100)}%`,
                data: { threatId: threat.id },
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null, // show immediately
        });
    };

    const getFilteredMessages = () => {
        let filtered = [...scannedMessages];

        // 1. Filter
        if (activeFilter === 'threats') filtered = filtered.filter(m => m.classification === 'Malicious');
        else if (activeFilter === 'suspicious') filtered = filtered.filter(m => m.classification === 'Suspicious');
        else if (activeFilter === 'safe') filtered = filtered.filter(m => m.classification === 'Safe');

        // 2. Sort
        if (sortMode === 'newest') {
            filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        } else if (sortMode === 'oldest') {
            filtered.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        } else if (sortMode === 'threat') {
            const threatScore = { 'Malicious': 3, 'Suspicious': 2, 'Caution': 1, 'Safe': 0 };
            filtered.sort((a, b) => (threatScore[b.classification] || 0) - (threatScore[a.classification] || 0));
        }

        return filtered;
    };

    const handleMarkSafe = async (message) => {
        try {
            await api.post('/scan/mark-safe', {
                sender: message.sender,
                message_body: message.body,
                original_classification: message.classification,
                user_label: 'safe'
            });
            setScannedMessages(prev => prev.map(m =>
                m.id === message.id ? { ...m, classification: 'Safe' } : m
            ));
            Alert.alert(t('marked_safe_title'), t('marked_safe_msg'));
        } catch (e) {
            console.error(e);
        }
    };

    const handleMarkMalicious = async (message) => {
        try {
            await api.post('/scan/mark-malicious', {
                sender: message.sender,
                message_body: message.body,
                original_classification: message.classification,
                user_label: 'malicious'
            });
            setScannedMessages(prev => prev.map(m =>
                m.id === message.id ? { ...m, classification: 'Malicious' } : m
            ));
            Alert.alert(t('reported_title'), t('reported_msg'));
        } catch (e) {
            console.error(e);
        }
    };

    const filteredMessages = getFilteredMessages();

    const handleQuickScan = async () => {
        if (!quickScanText.trim()) return;
        setQuickScanLoading(true);
        setQuickScanResult(null);
        try {
            const raw = await api.scanText(quickScanText.trim());
            const result = normalizeScanResult(raw);
            setQuickScanResult(result);
            if (onScanComplete) {
                onScanComplete(result.riskLevel.toLowerCase(), raw.scan_token);
            }
        } catch (e) {
            Alert.alert('Scan Failed', e.message || 'Could not reach the server.');
        } finally {
            setQuickScanLoading(false);
        }
    };

    const handleTelegramConnect = async (userId) => {
        const BOT_USERNAME = 'NexoraAIBot';
        const telegramUrl = `https://t.me/${BOT_USERNAME}?start=${userId || 'guest'}`;
        const supported = await Linking.canOpenURL(telegramUrl);
        if (supported) {
            await Linking.openURL(telegramUrl);
        } else {
            Alert.alert('Telegram Not Found', 'Please install Telegram to connect your account.');
        }
    };

    const APPS = [
        { key: 'sms', label: 'SMS', icon: '💬' },
        { key: 'telegram', label: 'Telegram', icon: '✈️' },
    ];

    const riskColor = { SAFE: '#00E676', SUSPICIOUS: '#FFB300', MALICIOUS: '#FF3D57' };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ScrollView
                style={[styles.container, { backgroundColor: colors.bg }]}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Hero Section - 1/3 of screen */}
                <View style={styles.heroSection}>
                    <View style={styles.heroBackground}>
                        <ExpoLinearGradient
                            colors={[colors.primary + '20', 'transparent']}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>

                    <View style={styles.heroContent}>
                        <ConfidenceGauge
                            value={stats ? stats.safe / (stats.total || 1) : 0.85}
                            size={Math.min(width - 40, 280)}
                            strokeWidth={20}
                        />
                        <View style={styles.heroBadge}>
                            <Shield size={16} color={colors.primary} />
                            <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
                                {t('integrity_score').toUpperCase()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Header Status */}
                <View style={[styles.header, { marginTop: 24 }]}>
                    <View>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('network_integrity').toUpperCase()}</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            {scanning ? t('scanning_network') : t('realtime_monitoring')}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, {
                        backgroundColor: scanning ? colors.primaryLight : (monitoring ? colors.safeLight : colors.surfaceLight),
                        borderColor: scanning ? colors.primary : (monitoring ? colors.safe : colors.textMuted)
                    }]}>
                        <Activity size={14} color={scanning ? colors.primary : (monitoring ? colors.safe : colors.textMuted)} style={{ marginRight: 6 }} />
                        <Text style={[styles.statusText, { color: scanning ? colors.primary : (monitoring ? colors.safe : colors.textMuted) }]}>
                            {scanning ? 'SCANNING' : (monitoring ? t('active').toUpperCase() : t('idle').toUpperCase())}
                        </Text>
                    </View>
                </View>

                {scanning && !refreshing && (
                    <GlassCard style={styles.scanningCard}>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 16 }}>
                            <Shield size={48} color={colors.primary} />
                        </Animated.View>
                        <Text style={[styles.loadingTitle, { color: colors.textPrimary }]}>{t('scanning_network')}</Text>
                        <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>{t('filtering_packets')}</Text>
                        <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                    </GlassCard>
                )}

                {/* Dashboard Stats */}
                {!scanning && stats && (
                    <View style={styles.statsContainer}>
                        {/* Removed Threat Heatmap */}

                        {stats.threats > 0 && (
                            <GlassCard style={[styles.alertBanner, { borderColor: colors.malicious }]}>
                                <View style={styles.alertHeader}>
                                    <View style={[styles.iconBox, { backgroundColor: colors.maliciousLight }]}>
                                        <ShieldAlert size={20} color={colors.malicious} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.alertTitle, { color: colors.malicious }]}>{t('urgent_threats')}</Text>
                                        <Text style={[styles.alertText, { color: colors.textPrimary }]}>{stats.threats} {t('breaches').toLowerCase()} detected.</Text>
                                    </View>
                                </View>
                            </GlassCard>
                        )}

                        <View style={styles.grid}>
                            <GlassCard style={styles.statCard}>
                                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total}</Text>
                                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('inspected')}</Text>
                            </GlassCard>
                            <GlassCard style={styles.statCard}>
                                <Text style={[styles.statValue, { color: colors.malicious }]}>{stats.threats}</Text>
                                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('breaches')}</Text>
                            </GlassCard>
                            <GlassCard style={styles.statCard}>
                                <Text style={[styles.statValue, { color: colors.suspicious }]}>{stats.suspicious}</Text>
                                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('suspicious')}</Text>
                            </GlassCard>
                        </View>
                    </View>
                )}

                {/* Filters & Sort */}
                {!scanning && (
                    <View style={styles.filterSection}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                            {FILTERS.map(f => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[
                                        styles.filterPill,
                                        activeFilter === f.key ?
                                            { backgroundColor: colors.primary, borderColor: colors.primary } :
                                            { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }
                                    ]}
                                    onPress={() => setActiveFilter(f.key)}
                                >
                                    <Text style={[
                                        styles.filterText,
                                        activeFilter === f.key ? { color: '#FFF' } : { color: colors.textSecondary }
                                    ]}>
                                        {t(f.label).toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.sortButton, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                            onPress={() => setShowSortMenu(!showSortMenu)}
                        >
                            <Text style={[styles.sortText, { color: colors.primary }]}>
                                {t(SORT_OPTIONS.find(s => s.key === sortMode)?.label || 'newest')}
                            </Text>
                            {showSortMenu ? <ArrowUp size={14} color={colors.primary} /> : <ArrowDown size={14} color={colors.primary} />}
                        </TouchableOpacity>
                    </View>
                )}

                {showSortMenu && (
                    <View style={[styles.sortMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {SORT_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.key}
                                style={[styles.sortOption, sortMode === opt.key && { backgroundColor: colors.primaryLight }]}
                                onPress={() => {
                                    setSortMode(opt.key);
                                    setShowSortMenu(false);
                                }}
                            >
                                <Text style={[styles.sortOptionText, { color: sortMode === opt.key ? colors.primary : colors.textSecondary }]}>
                                    {t(opt.label)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Message List */}
                <View style={styles.listContainer}>
                    <View style={styles.listHeader}>
                        <Text style={[styles.listTitle, { color: colors.textPrimary }]}>{t('live_feedback')}</Text>
                        <View style={styles.liveIndicator}>
                            <View style={[styles.dot, { backgroundColor: colors.success }]} />
                        </View>
                    </View>

                    {isDemo && (
                        <View style={styles.demoBanner}>
                            <Text style={styles.demoBannerText}>
                                ⚠️ Showing demo data — grant SMS permission to see real messages
                            </Text>
                        </View>
                    )}

                    {filteredMessages.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Smartphone size={48} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: 16 }} />
                            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('no_packets')}</Text>
                        </View>
                    ) : (
                        filteredMessages.map((msg, index) => (
                            <ResultCard
                                key={msg.id || index}
                                result={msg}
                                onPress={() => {
                                    setSelectedMessage(msg);
                                    setModalVisible(true);
                                }}
                                onMarkSafe={handleMarkSafe}
                                onMarkMalicious={handleMarkMalicious}
                            />
                        ))
                    )}
                </View>
                {/* ── Connected Apps ── */}
                <View style={styles.connectedSection}>
                    <Text style={[styles.listTitle, { color: colors.textPrimary, marginBottom: 14 }]}>CONNECTED APPS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        {APPS.map(app => (
                            <TouchableOpacity
                                key={app.key}
                                style={[
                                    styles.appChip,
                                    connectedApps[app.key]
                                        ? { backgroundColor: COLORS.primary + '22', borderColor: COLORS.primary }
                                        : { backgroundColor: COLORS.surface, borderColor: COLORS.glassBorder },
                                ]}
                                onPress={async () => {
                                const next = !connectedApps[app.key];
                                if (app.key === 'sms' && next) {
                                    const granted = await requestSmsPermissions();
                                    if (!granted) {
                                        Alert.alert(
                                            'Permission Required',
                                            'SMS permission denied. Enable it in device Settings to monitor SMS.'
                                        );
                                        return;
                                    }
                                }
                                if (app.key === 'telegram' && next) {
                                    await handleTelegramConnect(null);
                                    // Don't toggle yet — toggled after user returns from Telegram
                                    return;
                                }
                                setConnectedApps(prev => ({ ...prev, [app.key]: next }));
                            }}
                            >
                                <Text style={{ fontSize: 22 }}>{app.icon}</Text>
                                <Text style={[styles.appChipLabel, { color: connectedApps[app.key] ? COLORS.primary : colors.textMuted }]}>
                                    {app.label}
                                </Text>
                                <View style={[styles.appChipDot, { backgroundColor: connectedApps[app.key] ? COLORS.primary : COLORS.glassBorder }]} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

            </ScrollView>

            <AnalysisModal
                visible={modalVisible}
                result={selectedMessage}
                onClose={() => setModalVisible(false)}
                onMarkSafe={() => {
                    handleMarkSafe(selectedMessage);
                    setModalVisible(false);
                }}
                advice={advice}
            />

            {/* ── FAB — Quick Scan ── */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => { setShowQuickScan(true); setQuickScanResult(null); setQuickScanText(''); }}
                activeOpacity={0.85}
            >
                <Text style={styles.fabIcon}>＋</Text>
            </TouchableOpacity>

            {/* ── Quick Scan Bottom Sheet Modal ── */}
            <Modal
                visible={showQuickScan}
                transparent
                animationType="slide"
                onRequestClose={() => setShowQuickScan(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowQuickScan(false)} />
                    <View style={styles.modalSheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Quick Scan</Text>
                        <Text style={styles.sheetSubtitle}>Paste any message to check it instantly</Text>

                        <TextInput
                            style={styles.sheetInput}
                            placeholder="Paste a suspicious message here..."
                            placeholderTextColor={COLORS.textMuted}
                            multiline
                            numberOfLines={5}
                            value={quickScanText}
                            onChangeText={setQuickScanText}
                            textAlignVertical="top"
                        />

                        {quickScanResult && (
                            <View style={[styles.qsResult, { borderColor: riskColor[quickScanResult.riskLevel] || '#555' }]}>
                                <Text style={[styles.qsRiskLabel, { color: riskColor[quickScanResult.riskLevel] || '#888' }]}>
                                    {quickScanResult.riskLevel}  —  Score {quickScanResult.score ?? '—'}/100
                                </Text>
                                {(quickScanResult.reasons || []).slice(0, 3).map((r, i) => (
                                    <Text key={i} style={styles.qsReason}>• {r}</Text>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.sheetBtn, (quickScanLoading || !quickScanText.trim()) && { opacity: 0.5 }]}
                            onPress={handleQuickScan}
                            disabled={quickScanLoading || !quickScanText.trim()}
                        >
                            {quickScanLoading
                                ? <ActivityIndicator color="#000" size="small" />
                                : <Text style={styles.sheetBtnText}>SCAN NOW</Text>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setShowQuickScan(false)} style={styles.sheetCancel}>
                            <Text style={{ color: COLORS.textMuted, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 100 },
    heroSection: {
        height: Dimensions.get('window').height / 3.2,
        backgroundColor: COLORS.bgDark,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.glassBorder,
    },
    heroBackground: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.5,
    },
    heroContent: {
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        paddingHorizontal: 20,
        overflow: 'hidden',
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 10,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    heroBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    headerTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
    headerSubtitle: { fontSize: 14, fontWeight: '500' },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    scanningCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        marginBottom: 24,
    },
    loadingTitle: { fontSize: 18, fontWeight: '800', marginTop: 10, letterSpacing: 1 },
    loadingSubtitle: { fontSize: 13, marginTop: 6 },
    statsContainer: { marginBottom: 30, paddingHorizontal: 20 },
    grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
    statValue: { fontSize: 24, fontWeight: '800' },
    statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 4, letterSpacing: 0.5 },
    alertBanner: { marginBottom: 16 },
    alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    alertTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
    alertText: { fontSize: 13, fontWeight: '500' },

    // Filters
    filterSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10, paddingHorizontal: 20 },
    filterScroll: { flex: 1 },
    filterPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    filterText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    sortText: { fontSize: 11, fontWeight: '700' },
    sortMenu: {
        position: 'absolute',
        top: 280, // Approximate
        right: 20,
        width: 150,
        borderRadius: 12,
        borderWidth: 1,
        zIndex: 100,
        ...SHADOWS.soft,
        paddingVertical: 4,
    },
    sortOption: { paddingVertical: 10, paddingHorizontal: 16 },
    sortOptionText: { fontSize: 13, fontWeight: '600' },

    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    listTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    listContainer: { paddingBottom: 20, paddingHorizontal: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, fontWeight: '600' },
    demoBanner: {
        backgroundColor: 'rgba(255,179,0,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,179,0,0.35)',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    demoBannerText: { fontSize: 12, fontWeight: '700', color: '#FFB300' },
    meterContainer: { width: '80%', height: 8, marginTop: 8, marginBottom: 8 },
    meterTrack: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
    meterFill: { height: '100%', borderRadius: 4, minWidth: 4 },

    // Connected Apps
    connectedSection: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
    appChip: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, paddingHorizontal: 18,
        borderRadius: 18, borderWidth: 1,
        gap: 6, minWidth: 80,
    },
    appChipLabel: { fontSize: 11, fontWeight: '700' },
    appChipDot: { width: 7, height: 7, borderRadius: 4 },

    // FAB
    fab: {
        position: 'absolute', bottom: 32, right: 24,
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6, shadowRadius: 12, elevation: 10,
    },
    fabIcon: { fontSize: 28, color: '#000', fontWeight: '900', lineHeight: 34 },

    // Quick Scan Modal
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    modalSheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 28, paddingBottom: 40,
        borderTopWidth: 1, borderColor: 'rgba(0,245,255,0.15)',
    },
    sheetHandle: {
        width: 44, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignSelf: 'center', marginBottom: 24,
    },
    sheetTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 6 },
    sheetSubtitle: { fontSize: 13, color: COLORS.textMuted, marginBottom: 20 },
    sheetInput: {
        backgroundColor: COLORS.bgDark,
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,245,255,0.12)',
        paddingHorizontal: 16, paddingVertical: 14,
        fontSize: 14, color: COLORS.textPrimary,
        minHeight: 120, marginBottom: 16,
    },
    qsResult: {
        borderRadius: 14, borderWidth: 1,
        padding: 14, marginBottom: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    qsRiskLabel: { fontSize: 15, fontWeight: '900', marginBottom: 8, letterSpacing: 0.5 },
    qsReason: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 20 },
    sheetBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 16, height: 54,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
    },
    sheetBtnText: { color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
    sheetCancel: { alignItems: 'center', paddingVertical: 8 },
});
