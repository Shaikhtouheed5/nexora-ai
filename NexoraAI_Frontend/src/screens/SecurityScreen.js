import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { supabase } from '../lib/supabase.js';
import { COLORS, SHADOWS } from '../constants/theme';

export default function SecurityScreen({ user, profile }) {
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwSuccess, setPwSuccess]   = useState('');
  const [pwError, setPwError]       = useState('');

  const [dataSharing, setDataSharing] = useState(profile?.settings?.dataSharing ?? true);

  const email    = user?.email || '';
  const created  = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
  const lastLogin = user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—';

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (!newPw || !confirmPw) { setPwError('Fill in both password fields.'); return; }
    if (newPw !== confirmPw)  { setPwError('Passwords do not match.'); return; }
    if (newPw.length < 6)    { setPwError('Password must be at least 6 characters.'); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwSuccess('Password updated successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) {
      setPwError(e.message || 'Failed to update password.');
    }
    setChangingPw(false);
  };

  const Row = ({ label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Security</Text>
        <Text style={styles.screenSubtitle}>Manage your account security</Text>
      </View>

      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>
        <Row label="Email"        value={email} />
        <Row label="Member Since" value={created} />
        <Row label="Last Sign In" value={lastLogin} />
      </View>

      {/* Change Password */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CHANGE PASSWORD</Text>
        <View style={styles.formBlock}>
          <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Min. 6 characters"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            value={newPw}
            onChangeText={setNewPw}
          />
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>CONFIRM NEW PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat new password"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            value={confirmPw}
            onChangeText={setConfirmPw}
          />
          {pwError   ? <Text style={styles.errorText}>{pwError}</Text>   : null}
          {pwSuccess ? <Text style={styles.successText}>{pwSuccess}</Text> : null}
          <TouchableOpacity
            style={[styles.actionBtn, changingPw && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            disabled={changingPw}
            activeOpacity={0.8}
          >
            {changingPw
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.actionBtnText}>UPDATE PASSWORD</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Privacy Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PRIVACY CONTROLS</Text>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Analytics & Data Sharing</Text>
            <Text style={styles.toggleSub}>Help improve NexoraAI with anonymised usage data</Text>
          </View>
          <Switch
            value={dataSharing}
            onValueChange={setDataSharing}
            trackColor={{ false: COLORS.surface, true: 'rgba(0,245,255,0.4)' }}
            thumbColor={dataSharing ? '#00F5FF' : '#666'}
          />
        </View>
      </View>

      {/* 2FA Placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TWO-FACTOR AUTHENTICATION</Text>
        <View style={styles.comingSoonBlock}>
          <Text style={styles.comingSoonIcon}>🔐</Text>
          <Text style={styles.comingSoonText}>TOTP / Email 2FA — Coming Soon</Text>
          <Text style={styles.comingSoonSub}>An extra layer of protection for your account.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  content:      { paddingBottom: 100 },
  header:       { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  screenTitle:  { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 4 },
  screenSubtitle:{ fontSize: 14, color: COLORS.textMuted },

  section:      { marginHorizontal: 20, marginBottom: 20, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },

  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  infoLabel:    { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  infoValue:    { fontSize: 13, color: COLORS.textPrimary, fontWeight: '700', maxWidth: '60%', textAlign: 'right' },

  formBlock:    { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  fieldLabel:   { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, marginBottom: 6 },
  input:        { backgroundColor: COLORS.bgDark, borderRadius: 14, paddingHorizontal: 18, height: 52, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(0,245,255,0.1)', marginBottom: 4 },
  errorText:    { color: '#FF3D57', fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  successText:  { color: '#00E676', fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  actionBtn:    { backgroundColor: '#00F5FF', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16, ...SHADOWS.premium },
  actionBtnText:{ fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  toggleLabel:  { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  toggleSub:    { fontSize: 12, color: COLORS.textMuted },

  comingSoonBlock: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  comingSoonIcon:  { fontSize: 36, marginBottom: 12 },
  comingSoonText:  { fontSize: 14, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },
  comingSoonSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
});
