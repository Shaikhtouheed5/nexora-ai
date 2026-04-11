import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, PermissionsAndroid, Platform, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/theme';
import { api } from '../lib/api';
import { getAllSMS } from '../services/smsInbox';

const MONITOR_RESULTS_KEY = '@nexora_monitor_results';
const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

const RISK_CONFIG = {
  SAFE:       { color: '#00E676', bg: 'rgba(0,230,118,0.1)',  border: 'rgba(0,230,118,0.25)',  emoji: '🟢', label: 'SAFE' },
  SUSPICIOUS: { color: '#FFB300', bg: 'rgba(255,179,0,0.1)',  border: 'rgba(255,179,0,0.25)',  emoji: '🟡', label: 'SUSPICIOUS' },
  MALICIOUS:  { color: '#FF3D57', bg: 'rgba(255,61,87,0.1)',  border: 'rgba(255,61,87,0.25)',  emoji: '🔴', label: 'MALICIOUS' },
};

const requestSmsPermission = async () => {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Permission Required',
        message: 'NexoraAI needs to read your SMS messages to detect phishing and smishing threats in real time.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

export default function MonitorScreen() {
  const [results, setResults]         = useState([]);
  const [stats, setStats]             = useState({ total: 0, threats: 0, suspicious: 0, safe: 0 });
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [permDenied, setPermDenied]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Load cached results while scanning
        try {
          const cached = await AsyncStorage.getItem(MONITOR_RESULTS_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            setResults(parsed);
            calculateStats(parsed);
          }
        } catch {}

        const smsGranted = await requestSmsPermission();
        if (!smsGranted) {
          console.warn('SMS permission denied');
          setPermDenied(true);
          setLoading(false);
          return;
        }

        // Delay after permission grant — native module needs time to settle
        await new Promise(resolve => setTimeout(resolve, 500));

        await scanMessages();
        intervalRef.current = setInterval(scanMessages, AUTO_REFRESH_INTERVAL);
      } catch (e) {
        // If everything fails, still render the screen empty
        console.warn('MonitorScreen init error:', e);
        setLoading(false);
      }
    };

    init();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const scanMessages = async () => {
    try {
      let messages = [];
      try {
        const smsResult = await getAllSMS();
        messages = smsResult?.messages || [];
      } catch (e) {
        console.warn('SMS read failed, using demo:', e);
        // fall through with empty messages — screen still renders
      }

      if (!messages.length) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const scanned = [];
      for (const msg of messages.slice(0, 50)) {
        try {
          const result = await api.scanText(msg.body || '');
          scanned.push({
            id: msg.id || String(Date.now() + Math.random()),
            preview: (msg.body || '').slice(0, 100),
            sender: msg.sender || 'Unknown',
            date: msg.date || new Date().toISOString(),
            riskLevel: result.riskLevel || 'SAFE',
            score: result.score ?? 0,
            reasons: result.reasons || [],
          });
        } catch {
          // skip individual scan failures silently
        }
      }

      setResults(scanned);
      calculateStats(scanned);
      setLastUpdated(new Date());
      await AsyncStorage.setItem(MONITOR_RESULTS_KEY, JSON.stringify(scanned));
    } catch (e) {
      console.warn('MonitorScreen scanMessages error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = (items) => {
    const threats    = items.filter(r => r.riskLevel === 'MALICIOUS').length;
    const suspicious = items.filter(r => r.riskLevel === 'SUSPICIOUS').length;
    const safe       = items.filter(r => r.riskLevel === 'SAFE').length;
    setStats({ total: items.length, threats, suspicious, safe });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await scanMessages();
  };

  const getRiskConfig = (riskLevel) =>
    RISK_CONFIG[riskLevel?.toUpperCase()] || RISK_CONFIG.SAFE;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Scanning SMS inbox...</Text>
      </View>
    );
  }

  if (permDenied) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text style={styles.permTitle}>SMS Permission Required</Text>
        <Text style={styles.permSubtitle}>
          Enable it in device Settings → Apps → NexoraAI → Permissions → SMS.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 80 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>SMS Monitor</Text>
        <Text style={styles.subtitle}>
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Pull to refresh'}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { value: stats.total,      color: COLORS.primary, label: 'INSPECTED' },
          { value: stats.threats,    color: '#FF3D57',       label: 'BREACHES' },
          { value: stats.suspicious, color: '#FFB300',       label: 'SUSPICIOUS' },
          { value: stats.safe,       color: '#00E676',       label: 'SAFE' },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Live Feedback */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>LIVE FEEDBACK</Text>
          <View style={styles.liveDot} />
        </View>

        {results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>📭</Text>
            <Text style={styles.emptyText}>No SMS messages found</Text>
          </View>
        ) : (
          results.map((item) => {
            const rc = getRiskConfig(item.riskLevel);
            return (
              <View key={item.id} style={[styles.msgCard, { borderColor: rc.border }]}>
                <View style={styles.msgRow}>
                  <View style={[styles.riskPill, { backgroundColor: rc.bg, borderColor: rc.border }]}>
                    <Text style={[styles.riskPillText, { color: rc.color }]}>
                      {rc.emoji} {rc.label}
                    </Text>
                  </View>
                  <Text style={styles.sender} numberOfLines={1}>{item.sender}</Text>
                  <Text style={styles.score}>{item.score}/100</Text>
                </View>
                <Text style={styles.preview} numberOfLines={2}>{item.preview}</Text>
                {item.reasons?.length > 0 && (
                  <Text style={[styles.reasons, { color: rc.color }]} numberOfLines={1}>
                    • {item.reasons[0]}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: COLORS.bg },
  loadingText:  { color: COLORS.textMuted, marginTop: 16, fontSize: 13, fontWeight: '600' },
  permTitle:    { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
  permSubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  header:       { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title:        { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary },
  subtitle:     { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },

  statsRow:     { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginVertical: 16 },
  statCard:     { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statValue:    { fontSize: 22, fontWeight: '900' },
  statLabel:    { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, marginTop: 4, letterSpacing: 0.5 },

  section:      { paddingHorizontal: 20 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: COLORS.textMuted, letterSpacing: 2 },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676' },

  msgCard:      { backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1 },
  msgRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  riskPill:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  riskPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  sender:       { flex: 1, fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  score:        { fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },
  preview:      { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  reasons:      { fontSize: 11, marginTop: 6, fontStyle: 'italic' },

  empty:        { alignItems: 'center', paddingVertical: 40 },
  emptyText:    { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
});
