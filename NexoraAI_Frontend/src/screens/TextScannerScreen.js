import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, Platform,
  Animated, KeyboardAvoidingView, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../constants/theme';
import { api, normalizeScanResult } from '../lib/api';
import { scanImage } from '../utils/scanImage';
import { awardXP, awardBadge, XP_RULES } from '../lib/gamificationService';

const SCAN_HISTORY_KEY = '@nexora_scan_history';
const TABS = ['Paste & Scan', 'Camera Scan', 'History'];

const RISK_CONFIG = {
  SAFE:       { color: '#00E676', bg: 'rgba(0,230,118,0.1)',  border: 'rgba(0,230,118,0.25)',  emoji: '🟢', label: 'SAFE' },
  SUSPICIOUS: { color: '#FFB300', bg: 'rgba(255,179,0,0.1)',  border: 'rgba(255,179,0,0.25)',  emoji: '🟡', label: 'SUSPICIOUS' },
  MALICIOUS:  { color: '#FF3D57', bg: 'rgba(255,61,87,0.1)',  border: 'rgba(255,61,87,0.25)',  emoji: '🔴', label: 'MALICIOUS' },
};

export default function TextScannerScreen({ user }) {
  const [activeTab, setActiveTab]       = useState(0);
  const [inputText, setInputText]       = useState('');
  const [scanning, setScanning]         = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [result, setResult]             = useState(null);
  const [history, setHistory]           = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [firstScanDone, setFirstScanDone] = useState(false);
  const [extractedText, setExtractedText] = useState('');

  const resultAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
    setHistoryLoaded(true);
  };

  const saveToHistory = async (text, scanResult) => {
    const entry = {
      id: Date.now(),
      preview: text.slice(0, 80),
      result: scanResult,
      timestamp: new Date().toISOString(),
    };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  };

  const deleteFromHistory = async (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  };

  const animateResult = () => {
    resultAnim.setValue(0);
    Animated.timing(resultAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const performScan = async (text) => {
    if (!text.trim()) {
      Alert.alert('Empty Input', 'Please enter or paste some text to scan.');
      return;
    }
    setScanning(true);
    setResult(null);

    try {
      const raw = await api.scanText(text.trim());
      const scanResult = normalizeScanResult(raw);
      setResult(scanResult);
      await saveToHistory(text.trim(), scanResult);
      animateResult();

      if (!firstScanDone && user?.id) {
        await awardXP(user.id, XP_RULES.FIRST_SCAN);
        await awardBadge(user.id, 'scam_detector');
        setFirstScanDone(true);
      }
    } catch (e) {
      Alert.alert('Scan Error', e.message || 'Could not analyze the message. Check your connection.');
    } finally {
      setScanning(false);
    }
  };

  const performImageScan = async (uri) => {
    setCameraScanning(true);
    setResult(null);
    setExtractedText('');

    try {
      // Backend does OCR (Google Vision) + scan in one call — returns full result object
      const raw = await scanImage(uri);

      if (raw.extracted_text) setExtractedText(raw.extracted_text);

      if (!raw.extracted_text?.trim() || raw.verdict === 'unverified') {
        Alert.alert('No Text Found', 'No readable text found in the image. Try a clearer screenshot.');
        return;
      }

      const scanResult = normalizeScanResult(raw);
      await saveToHistory(raw.extracted_text, scanResult);
      setResult(scanResult);
      animateResult();

      if (!firstScanDone && user?.id) {
        await awardXP(user.id, XP_RULES.FIRST_SCAN);
        await awardBadge(user.id, 'scam_detector');
        setFirstScanDone(true);
      }
    } catch (e) {
      Alert.alert('Image Scan Error', e.message || 'Could not scan the image. Please try again.');
    } finally {
      setCameraScanning(false);
    }
  };

  const launchCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Enable camera access in Settings to scan suspicious messages.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await performImageScan(result.assets[0].uri);
    }
  };

  const launchGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Photo Access Required',
        'Enable photo library access in Settings to scan screenshots.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await performImageScan(result.assets[0].uri);
    }
  };

  const getRiskConfig = (riskLevel) =>
    RISK_CONFIG[riskLevel?.toUpperCase()] || RISK_CONFIG.SUSPICIOUS;

  // ── Paste & Scan Tab ────────────────────────────────────────────────────────
  const PasteTab = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>MESSAGE TO ANALYZE</Text>
            {inputText.length > 0 && (
              <TouchableOpacity onPress={() => { setInputText(''); setResult(null); }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 12, fontWeight: '700' }}>✕ Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.textarea}
            multiline
            placeholder="Paste suspicious SMS, email, or message here..."
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{inputText.length} characters</Text>
        </View>

        <TouchableOpacity
          style={[styles.scanBtn, (scanning || !inputText.trim()) && styles.scanBtnDisabled]}
          onPress={() => performScan(inputText)}
          disabled={scanning || !inputText.trim()}
          activeOpacity={0.8}
        >
          {scanning
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.scanBtnText}>🔍  Analyze with AI</Text>}
        </TouchableOpacity>

        {result && <ResultCard result={result} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ── Camera Scan Tab ─────────────────────────────────────────────────────────
  const CameraTab = () => (
    <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
      <View style={styles.cameraHero}>
        <Text style={{ fontSize: 52, marginBottom: 12 }}>📷</Text>
        <Text style={styles.cameraTitle}>IMAGE SCAN</Text>
        <Text style={styles.cameraSubtitle}>
          Capture or pick a screenshot of a suspicious message. NexoraAI extracts the text and scans it for phishing threats.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.scanBtn, { width: '100%' }, cameraScanning && styles.scanBtnDisabled]}
        onPress={launchCamera}
        disabled={cameraScanning}
        activeOpacity={0.8}
      >
        {cameraScanning
          ? <ActivityIndicator color="#000" size="small" />
          : <Text style={styles.scanBtnText}>📷  Take Photo</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryBtn, { width: '100%', marginTop: 12 }, cameraScanning && styles.scanBtnDisabled]}
        onPress={launchGallery}
        disabled={cameraScanning}
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryBtnText}>🖼️  Choose from Gallery</Text>
      </TouchableOpacity>

      {extractedText ? (
        <View style={[styles.inputCard, { width: '100%', marginTop: 20 }]}>
          <Text style={styles.inputLabel}>EXTRACTED TEXT</Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 10 }}>
            {extractedText}
          </Text>
        </View>
      ) : null}

      {result && <ResultCard result={result} />}
    </ScrollView>
  );

  // ── History Tab ─────────────────────────────────────────────────────────────
  const HistoryTab = () => (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      {!historyLoaded ? (
        <ActivityIndicator color="#00F5FF" style={{ marginTop: 40 }} />
      ) : history.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📋</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 15, fontWeight: '600' }}>No scan history yet</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 8 }}>Scan a message to see history here</Text>
        </View>
      ) : (
        history.map(entry => {
          const rc = getRiskConfig(entry.result?.riskLevel);
          return (
            <View key={entry.id} style={styles.historyItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyPreview} numberOfLines={2}>{entry.preview}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <View style={[styles.riskPill, { backgroundColor: rc.bg, borderColor: rc.border }]}>
                    <Text style={[styles.riskPillText, { color: rc.color }]}>{rc.emoji} {rc.label}</Text>
                  </View>
                  <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Delete Scan', 'Remove from history?', [
                  { text: 'Cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteFromHistory(entry.id) },
                ])}
              >
                <Text style={{ color: COLORS.textMuted, fontSize: 20, paddingLeft: 12 }}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // ── Result Card ─────────────────────────────────────────────────────────────
  const ResultCard = ({ result }) => {
    const rc = getRiskConfig(result?.riskLevel);
    return (
      <Animated.View style={[
        styles.resultCard,
        { opacity: resultAnim, transform: [{ translateY: resultAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }] },
        { width: '100%', marginTop: 20 },
      ]}>
        <View style={[styles.riskBanner, { backgroundColor: rc.bg, borderColor: rc.border }]}>
          <Text style={styles.riskEmoji}>{rc.emoji}</Text>
          <View>
            <Text style={[styles.riskLabel, { color: rc.color }]}>{rc.label}</Text>
            <Text style={[styles.riskScore, { color: rc.color }]}>
              Confidence: {result?.score ?? '--'}/100
            </Text>
          </View>
        </View>

        {result?.reasons?.length > 0 && (
          <View style={styles.reasonsList}>
            <Text style={styles.reasonsTitle}>DETECTED PATTERNS</Text>
            {result.reasons.map((r, i) => (
              <View key={i} style={styles.reasonRow}>
                <Text style={{ color: rc.color, fontSize: 14 }}>•</Text>
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.rescanBtn}
          onPress={() => { setResult(null); setInputText(''); setExtractedText(''); }}
        >
          <Text style={styles.rescanText}>↺  Scan Again</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Text Scanner</Text>
        <Text style={styles.subtitle}>AI-powered phishing detection</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => { setActiveTab(i); setResult(null); }}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 0 && <PasteTab />}
        {activeTab === 1 && <CameraTab />}
        {activeTab === 2 && <HistoryTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  header:       { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title:        { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary },
  subtitle:     { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },

  tabRow:       { flexDirection: 'row', marginHorizontal: 20, marginBottom: 4, backgroundColor: COLORS.surface, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabActive:    { backgroundColor: 'rgba(0,245,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)' },
  tabText:      { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  tabTextActive:{ color: '#00F5FF' },

  inputCard:    { backgroundColor: COLORS.surface, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  inputHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  inputLabel:   { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5 },
  textarea:     { color: COLORS.textPrimary, fontSize: 14, lineHeight: 22, minHeight: 140, maxHeight: 220 },
  charCount:    { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 8 },

  scanBtn:      { backgroundColor: '#00F5FF', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...SHADOWS.premium },
  scanBtnDisabled: { opacity: 0.4 },
  scanBtnText:  { fontSize: 16, fontWeight: '900', color: '#000' },

  secondaryBtn: { backgroundColor: 'rgba(0,245,255,0.08)', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)' },
  secondaryBtnText: { fontSize: 15, fontWeight: '800', color: '#00F5FF' },

  cameraHero:   { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, marginBottom: 24 },
  cameraTitle:  { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 2, marginBottom: 12 },
  cameraSubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  resultCard:   { backgroundColor: COLORS.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  riskBanner:   { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  riskEmoji:    { fontSize: 36 },
  riskLabel:    { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  riskScore:    { fontSize: 13, fontWeight: '600', marginTop: 2 },

  reasonsList:  { padding: 20 },
  reasonsTitle: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: 14 },
  reasonRow:    { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-start' },
  reasonText:   { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

  rescanBtn:    { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', height: 50, alignItems: 'center', justifyContent: 'center' },
  rescanText:   { fontSize: 14, fontWeight: '700', color: '#00F5FF' },

  historyItem:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  historyPreview: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  riskPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  riskPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
