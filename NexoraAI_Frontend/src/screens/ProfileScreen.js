import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Alert, ActivityIndicator, Platform
} from 'react-native';
import { supabase } from '../lib/supabase.js';
import { COLORS, SHADOWS } from '../constants/theme';
import { BADGES } from '../lib/gamificationService';

export default function ProfileScreen({ user, profile, onNavigate, refreshProfile }) {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName]         = useState('');
  const [saving, setSaving]           = useState(false);

  // Flat columns from users table (no more JSONB gamification)
  const xp     = profile?.xp || 0;
  const level  = profile?.level || 1;
  const streak = profile?.streak || 0;
  const badges = profile?.badges || [];

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Agent';
  const avatarUrl   = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  const getInitials = () => {
    const n = displayName.trim().split(' ');
    return n.length >= 2 ? (n[0][0] + n[n.length-1][0]).toUpperCase() : displayName.slice(0,2).toUpperCase();
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await supabase.from('users').update({ name: newName.trim() }).eq('id', user.id);
      refreshProfile?.();
      setEditingName(false);
      Alert.alert('✓ Name Updated', 'Your display name has been saved.');
    } catch { Alert.alert('Error', 'Could not update name.'); }
    setSaving(false);
  };

  const handleSyncGoogle = async () => {
    Alert.alert('Sync Profile', 'Profile data will be refreshed from your auth provider.');
    refreshProfile?.();
  };

  const allBadgeIds    = Object.keys(BADGES);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Profile</Text>
      </View>

      {/* Avatar + Name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarRing}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            : <Text style={styles.avatarText}>{getInitials()}</Text>
          }
        </View>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Full name"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            <TouchableOpacity style={styles.saveName} onPress={handleSaveName} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.bg} size="small" /> : <Text style={styles.saveNameText}>Save</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setNewName(displayName); setEditingName(true); }}>
            <Text style={styles.displayName}>{displayName} ✏️</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.emailText}>{user?.email}</Text>
        <Text style={styles.memberSince}>Member since {memberSince}</Text>

        {/* Auth Provider */}
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>{(profile?.provider || 'email').toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Streak',   value: `${streak}d` },
          { label: 'Badges',   value: badges.length },
          { label: 'Level',    value: `Lv.${level}` },
          { label: 'XP',       value: xp.toLocaleString() },
        ].map(({ label, value }) => (
          <View key={label} style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate?.('security')}>
          <Text style={styles.actionBtnText}>🔐  Change Password</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handleSyncGoogle}>
          <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>↻  Sync Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Badges */}
      <View style={styles.badgesSection}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgesGrid}>
          {allBadgeIds.map(bid => {
            const b       = BADGES[bid];
            const earned  = badges.includes(bid);
            return (
              <View key={bid} style={[styles.badgeCard, earned && styles.badgeCardEarned, !earned && styles.badgeCardLocked]}>
                <Text style={styles.badgeIcon}>{b.icon}</Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>{b.name}</Text>
                <Text style={styles.badgeDesc}>{b.desc}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.bg },
  content:         { paddingBottom: 100 },
  header:          { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  screenTitle:     { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },

  avatarSection:   { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  avatarRing:      { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,245,255,0.08)', borderWidth: 2, borderColor: 'rgba(0,245,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden', ...SHADOWS.premium },
  avatarImg:       { width: '100%', height: '100%' },
  avatarText:      { fontSize: 32, fontWeight: '900', color: '#00F5FF' },
  displayName:     { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emailText:       { fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 },
  memberSince:     { fontSize: 12, color: COLORS.textMuted },
  providerBadge:   { marginTop: 10, backgroundColor: 'rgba(0,245,255,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)' },
  providerText:    { fontSize: 11, fontWeight: '800', color: '#00F5FF', letterSpacing: 1 },

  nameEditRow:     { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  nameInput:       { flex: 1, backgroundColor: COLORS.bgDark, borderRadius: 12, paddingHorizontal: 16, height: 44, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)' },
  saveName:        { backgroundColor: '#00F5FF', borderRadius: 12, paddingHorizontal: 18, height: 44, alignItems: 'center', justifyContent: 'center' },
  saveNameText:    { color: '#000', fontWeight: '800', fontSize: 14 },

  statsGrid:       { flexDirection: 'row', padding: 20, gap: 12 },
  statCard:        { flex: 1, backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statValue:       { fontSize: 20, fontWeight: '900', color: '#00F5FF', marginBottom: 4 },
  statLabel:       { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  actionsSection:  { paddingHorizontal: 20, gap: 12, marginBottom: 28 },
  actionBtn:       { backgroundColor: '#00F5FF', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center' },
  actionBtnOutline:{ backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(0,245,255,0.3)' },
  actionBtnText:   { fontSize: 15, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  badgesSection:   { paddingHorizontal: 20 },
  sectionTitle:    { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
  badgesGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCard:       { width: '47%', backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  badgeCardEarned: { borderColor: 'rgba(0,245,255,0.2)', backgroundColor: 'rgba(0,245,255,0.05)' },
  badgeCardLocked: { opacity: 0.4 },
  badgeIcon:       { fontSize: 28, marginBottom: 8 },
  badgeName:       { fontSize: 12, fontWeight: '800', color: '#00F5FF', textAlign: 'center', marginBottom: 4 },
  badgeNameLocked: { color: COLORS.textMuted },
  badgeDesc:       { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', lineHeight: 14 },
});
