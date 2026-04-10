import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Image, ScrollView, TouchableWithoutFeedback
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const SIDEBAR_WIDTH = 280;

const NAV_ITEMS = [
  { key: 'home',        label: '🏠  Home',          screen: 'scan' },
  { key: 'profile',     label: '👤  Profile',        screen: 'profile' },
  { key: 'security',    label: '🔐  Security',       screen: 'security' },
  { key: 'leaderboard', label: '🏆  Leaderboard',    screen: 'leaderboard' },
  { key: 'settings',    label: '⚙️   Settings',       screen: 'settings' },
  { key: 'help',        label: '❓  Help Center',     screen: 'help' },
];

function maskEmail(email = '') {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return name.slice(0, 3) + '***@' + domain;
}

function getInitials(name = '', email = '') {
  const n = (name || email || 'NA').trim().split(' ');
  return n.length >= 2 ? (n[0][0] + n[n.length - 1][0]).toUpperCase() : (n[0] || 'NA').slice(0, 2).toUpperCase();
}

export default function Sidebar({ visible, user, profile, onNavigate, onClose, onLogout, activeTab }) {
  const slideAnim  = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: visible ? 0 : SIDEBAR_WIDTH,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: visible ? 1 : 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  if (!visible && slideAnim._value === SIDEBAR_WIDTH) return null;

  const xp          = profile?.xp || 0;
  const lvl         = profile?.level || 1;
  const streak      = profile?.streak || 0;
  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Agent';
  const avatarUrl   = profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  const initials    = getInitials(displayName, user?.email);

  // Level XP thresholds (matches web gamificationService LEVELS table)
  const LEVEL_XP   = [0, 0, 100, 300, 600, 1000, 1500, 2200, 3000];
  const LEVEL_NAME = ['', 'Rookie', 'Apprentice', 'Defender', 'Guardian', 'Sentinel', 'Specialist', 'Expert', 'Elite'];
  const rankName   = LEVEL_NAME[lvl] || 'Rookie';
  const nextXp     = LEVEL_XP[lvl + 1] ?? 3000;
  const prevXp     = LEVEL_XP[lvl] ?? 0;
  const xpPct      = nextXp > prevXp ? Math.min(1, (xp - prevXp) / (nextXp - prevXp)) : 1;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Dark overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sidebar panel (slides in from right) */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {/* User Profile Block */}
          <View style={styles.profileBlock}>
            <View style={styles.avatar}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                : <Text style={styles.avatarText}>{initials}</Text>
              }
            </View>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{maskEmail(user?.email || '')}</Text>

            {/* XP Bar */}
            <View style={styles.xpSection}>
              <View style={styles.xpLabels}>
                <Text style={styles.xpLabel}>Lv.{lvl} · {rankName}</Text>
                <Text style={styles.xpLabel}>{xp.toLocaleString()} XP</Text>
              </View>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${xpPct * 100}%` }]} />
              </View>
            </View>
          </View>

          {/* Nav Items */}
          <View style={styles.navSection}>
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.screen;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => { onNavigate(item.screen); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  {isActive && <View style={styles.activeBar} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Logout at bottom */}
        <View style={styles.logoutSection}>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>🚪  Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SIDEBAR_WIDTH,
    height: height,
    backgroundColor: '#080C18',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,245,255,0.1)',
    ...SHADOWS.premium,
    flexDirection: 'column',
  },
  profileBlock: {
    padding: 24,
    paddingTop: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,245,255,0.08)',
    alignItems: 'center',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,245,255,0.1)',
    borderWidth: 2, borderColor: 'rgba(0,245,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, overflow: 'hidden',
    ...SHADOWS.premium,
  },
  avatarImg:  { width: '100%', height: '100%' },
  avatarText: { fontSize: 22, fontWeight: '900', color: '#00F5FF' },
  userName:   { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  userEmail:  { fontSize: 12, color: COLORS.textMuted, marginBottom: 16 },

  xpSection:  { width: '100%' },
  xpLabels:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpLabel:    { fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },
  xpTrack:    { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  xpFill:     { height: '100%', backgroundColor: '#00F5FF', borderRadius: 4, shadowColor: '#00F5FF', shadowOpacity: 0.5, shadowRadius: 4 },

  navSection: { padding: 12, flex: 1 },
  navItem: {
    paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 12, marginBottom: 4,
    flexDirection: 'row', alignItems: 'center',
    position: 'relative',
    borderWidth: 1, borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderColor: 'rgba(0,245,255,0.15)',
  },
  navLabel:      { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  navLabelActive:{ color: '#00F5FF', fontWeight: '700' },
  activeBar: {
    position: 'absolute', left: 0, top: '20%', height: '60%',
    width: 3, backgroundColor: '#00F5FF', borderRadius: 2,
  },

  logoutSection: { paddingHorizontal: 12, paddingBottom: 36 },
  divider:       { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  logoutBtn: {
    paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,61,87,0.2)',
    backgroundColor: 'rgba(255,61,87,0.05)',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#FF3D57' },
});
