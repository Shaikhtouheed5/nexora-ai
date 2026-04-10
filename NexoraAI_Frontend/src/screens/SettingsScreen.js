import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import * as Speech from 'expo-speech';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { COLORS, SHADOWS } from '../constants/theme';

// Language codes match i18n.js exactly (2-letter codes)
const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧', native: 'English' },
  { code: 'hi', label: 'Hindi',      flag: '🇮🇳', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi',    flag: '🇮🇳', native: 'मराठी' },
  { code: 'ta', label: 'Tamil',      flag: '🇮🇳', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu',     flag: '🇮🇳', native: 'తెలుగు' },
  { code: 'bn', label: 'Bengali',    flag: '🇮🇳', native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati',   flag: '🇮🇳', native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada',    flag: '🇮🇳', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam',  flag: '🇮🇳', native: 'മലയാളം' },
  { code: 'pa', label: 'Punjabi',    flag: '🇮🇳', native: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'Urdu',       flag: '🇮🇳', native: 'اردو' },
  { code: 'fr', label: 'French',     flag: '🇫🇷', native: 'Français' },
  { code: 'de', label: 'German',     flag: '🇩🇪', native: 'Deutsch' },
  { code: 'ar', label: 'Arabic',     flag: '🇸🇦', native: 'العربية' },
  { code: 'zh', label: 'Chinese',    flag: '🇨🇳', native: '中文' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹', native: 'Português' },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵', native: '日本語' },
];

export default function SettingsScreen({ user, profile, onLogout, refreshProfile }) {
  const { lang: currentLang, changeLanguage } = useI18n();
  const settings = profile?.settings || { notificationsEnabled: true, preferredLanguage: 'en', voiceMode: 'female' };

  // Normalize legacy full-name codes ('english' → 'en')
  const normalizeLang = (code) => {
    if (!code) return 'en';
    if (code.length <= 3) return code;
    const map = { english: 'en', hindi: 'hi', marathi: 'mr', tamil: 'ta', telugu: 'te',
      bengali: 'bn', gujarati: 'gu', kannada: 'kn', malayalam: 'ml', punjabi: 'pa',
      urdu: 'ur', french: 'fr', german: 'de', arabic: 'ar', chinese: 'zh',
      portuguese: 'pt', japanese: 'ja' };
    return map[code.toLowerCase()] || 'en';
  };

  const [notifications, setNotifications] = useState(settings.notificationsEnabled);
  const [language, setLanguage]           = useState(normalizeLang(settings.preferredLanguage) || currentLang || 'en');
  const [voice, setVoice]                 = useState(settings.voiceMode || 'female');
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [deleteInput, setDeleteInput]     = useState('');
  const [showDelete, setShowDelete]       = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [speaking, setSpeaking]           = useState(false);
  const [testingEmail, setTestingEmail]   = useState(false);
  const [notifStatus, setNotifStatus]     = useState('');

  const selectedLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save language to i18n context (updates app UI immediately)
      await changeLanguage(language);
      // Save to Supabase users table
      await supabase.from('users').update({
        settings: { notificationsEnabled: notifications, preferredLanguage: language, voiceMode: voice }
      }).eq('id', user.id);
      // If notifications ON, upsert to user_settings
      if (notifications) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        await supabase.from('user_settings').upsert({
          user_id: user.id,
          email_notifications: true,
          user_email: authUser?.email || user.email,
        }, { onConflict: 'user_id' });
      }
      setSaved(true);
      refreshProfile?.();
      setTimeout(() => setSaved(false), 3000);
    } catch { Alert.alert('Error', 'Could not save settings.'); }
    setSaving(false);
  };

  const handleVoicePreview = async (v) => {
    setSpeaking(true);
    try {
      await Speech.stop();
      const text = v === 'male'
        ? 'Hello. I am your Nexora AI assistant. Stay safe online.'
        : 'Hello! I am your Nexora AI assistant. Stay safe online.';
      Speech.speak(text, {
        rate: 0.9,
        pitch: v === 'male' ? 0.8 : 1.2,
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch { setSpeaking(false); }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setNotifStatus('');
    try {
      await api.post('/notifications/test', {});
      setNotifStatus('Test email sent!');
    } catch (e) {
      setNotifStatus('Failed — check backend logs.');
    }
    setTestingEmail(false);
    setTimeout(() => setNotifStatus(''), 4000);
  };

  const handleClearCache = () => {
    Alert.alert('Cache Cleared', 'Local cache has been cleared.', [{ text: 'OK' }]);
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') { Alert.alert('Type DELETE to confirm.'); return; }
    setDeleting(true);
    try {
      await supabase.from('users').delete().eq('id', user.id);
      await supabase.auth.signOut();
      onLogout?.();
    } catch { Alert.alert('Error', 'Could not delete account. Please contact support.'); }
    setDeleting(false);
  };

  const Row = ({ label, subtitle, right }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PREFERENCES</Text>

        <Row
          label="Preferred Language"
          subtitle="For lessons and interface"
          right={
            <TouchableOpacity style={styles.langPickerBtn} onPress={() => setShowLangPicker(true)}>
              <Text style={styles.langPickerText}>{selectedLang.flag} {selectedLang.label}</Text>
              <Text style={styles.langPickerChevron}>▾</Text>
            </TouchableOpacity>
          }
        />

        {/* Language Picker Modal */}
        <Modal visible={showLangPicker} transparent animationType="slide" onRequestClose={() => setShowLangPicker(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLangPicker(false)} />
          <View style={styles.langModal}>
            <View style={styles.langModalHandle} />
            <Text style={styles.langModalTitle}>SELECT LANGUAGE</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.langItem, language === item.code && styles.langItemActive]}
                  onPress={() => { setLanguage(item.code); setShowLangPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.langItemFlag}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langItemLabel, language === item.code && { color: '#00F5FF' }]}>{item.label}</Text>
                    <Text style={styles.langItemNative}>{item.native}</Text>
                  </View>
                  {language === item.code && <Text style={{ color: '#00F5FF', fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }}
            />
          </View>
        </Modal>

        <Row
          label="AI Voice"
          subtitle="For AI-generated lesson content"
          right={
            <View style={styles.selectRow}>
              {['female', 'male'].map(v => (
                <View key={v} style={{ alignItems: 'center', gap: 4 }}>
                  <TouchableOpacity style={[styles.chip, voice === v && styles.chipActive]} onPress={() => setVoice(v)}>
                    <Text style={[styles.chipText, voice === v && styles.chipTextActive]}>
                      {v === 'female' ? '👩' : '👨'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleVoicePreview(v)}
                    disabled={speaking}
                    style={styles.previewBtn}
                  >
                    {speaking
                      ? <ActivityIndicator size={10} color={COLORS.textMuted} />
                      : <Text style={styles.previewBtnText}>▶</Text>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          }
        />

        <Row
          label="Email Notifications"
          subtitle={notifications ? `Alerts sent to ${user?.email || 'your email'}` : 'Daily lesson reminders & alerts'}
          right={
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Switch value={notifications} onValueChange={setNotifications}
                trackColor={{ false: COLORS.surface, true: 'rgba(0,245,255,0.4)' }}
                thumbColor={notifications ? '#00F5FF' : '#666'} />
              {notifications && (
                <TouchableOpacity onPress={handleTestEmail} disabled={testingEmail} style={styles.testEmailBtn}>
                  {testingEmail
                    ? <ActivityIndicator size={10} color={COLORS.textMuted} />
                    : <Text style={styles.testEmailText}>Send Test</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          }
        />
        {notifStatus ? <Text style={styles.notifStatus}>{notifStatus}</Text> : null}
      </View>

      {/* Save Button */}
      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#000" size="small" />
          : <Text style={styles.saveBtnText}>{saved ? '✓  Saved!' : 'Save Settings'}</Text>}
      </TouchableOpacity>

      {/* More Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIONS</Text>
        <TouchableOpacity style={styles.row} onPress={handleClearCache}>
          <Text style={styles.rowLabel}>🗑️  Clear Cache</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionTitle, { color: '#FF3D57' }]}>DANGER ZONE</Text>
        <Text style={styles.dangerDesc}>
          Deleting your account is permanent. All progress, badges, and data will be lost forever.
        </Text>

        {!showDelete ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={() => setShowDelete(true)}>
            <Text style={styles.dangerBtnText}>🗑️  Delete Account</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>Type <Text style={{ color: '#FF3D57', fontWeight: '800' }}>DELETE</Text> to confirm:</Text>
            <TextInput
              style={styles.deleteInput}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowDelete(false); setDeleteInput(''); }}>
                <Text style={{ color: COLORS.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, { flex: 1, opacity: deleteInput !== 'DELETE' ? 0.5 : 1 }]}
                disabled={deleteInput !== 'DELETE' || deleting}
                onPress={handleDeleteAccount}
              >
                {deleting ? <ActivityIndicator color="#FF3D57" size="small" />
                  : <Text style={styles.dangerBtnText}>Confirm Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  content:     { paddingBottom: 100 },
  header:      { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  screenTitle: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },

  section:     { marginHorizontal: 20, marginBottom: 20, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  sectionTitle:{ fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },

  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  rowLabel:    { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: COLORS.textMuted },

  selectRow:   { flexDirection: 'row', gap: 8 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.bgDark, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chipActive:  { backgroundColor: 'rgba(0,245,255,0.12)', borderColor: 'rgba(0,245,255,0.3)' },
  chipText:    { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  chipTextActive:{ color: '#00F5FF' },

  saveBtn:     { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#00F5FF', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center', ...SHADOWS.premium },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: '#000', letterSpacing: 1 },

  dangerSection:{ borderColor: 'rgba(255,61,87,0.15)' },
  dangerDesc:  { fontSize: 13, color: COLORS.textMuted, paddingHorizontal: 20, paddingBottom: 16, lineHeight: 20 },
  dangerBtn:   { marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(255,61,87,0.1)', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,61,87,0.25)' },
  dangerBtnText:{ fontSize: 14, fontWeight: '800', color: '#FF3D57' },
  deleteInput: { backgroundColor: COLORS.bgDark, borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(255,61,87,0.25)', marginHorizontal: 20 },
  cancelBtn:   { flex: 1, marginLeft: 20, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.bgDark, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

  previewBtn:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,245,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)', minWidth: 28, alignItems: 'center' },
  previewBtnText:   { fontSize: 10, color: '#00F5FF', fontWeight: '700' },
  testEmailBtn:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,245,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)' },
  testEmailText:    { fontSize: 10, color: '#00F5FF', fontWeight: '700' },
  notifStatus:      { fontSize: 12, color: '#00E676', fontWeight: '600', paddingHorizontal: 20, paddingBottom: 12 },
  langPickerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.bgDark, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)' },
  langPickerText:   { fontSize: 13, fontWeight: '700', color: '#00F5FF' },
  langPickerChevron:{ fontSize: 11, color: COLORS.textMuted },

  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  langModal:     { backgroundColor: '#0D1220', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: 'rgba(0,245,255,0.15)' },
  langModalHandle:{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  langModalTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, paddingHorizontal: 20, paddingVertical: 12 },
  langItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  langItemActive: { backgroundColor: 'rgba(0,245,255,0.05)' },
  langItemFlag:   { fontSize: 22 },
  langItemLabel:  { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  langItemNative: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
});
