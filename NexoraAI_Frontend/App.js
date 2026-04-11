import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
  Image, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from './src/constants/theme';
import { supabase } from './src/lib/supabase.js';
import { I18nProvider, useI18n } from './src/lib/i18n';
import { ThemeProvider, useTheme } from './src/lib/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

// ─── Screens ────────────────────────────────────────────────────────────────
import LoginScreen       from './src/screens/LoginScreen';
import ScannerScreen     from './src/screens/ScannerScreen';
import EducationScreen   from './src/screens/EducationScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen     from './src/screens/ProfileScreen';
import SettingsScreen    from './src/screens/SettingsScreen';
import TextScannerScreen from './src/screens/TextScannerScreen';
import HelpCenterScreen  from './src/screens/HelpCenterScreen';
import SecurityScreen    from './src/screens/SecurityScreen';
import MonitorScreen     from './src/screens/MonitorScreen';

// ─── Components ─────────────────────────────────────────────────────────────
import Sidebar from './src/components/Sidebar';

// ─── Bottom Tab Config ───────────────────────────────────────────────────────
const BOTTOM_TABS = [
  { key: 'scan',        label: 'MONITOR',    icon: '🛡️' },
  { key: 'learn',       label: 'PROTOCOLS',  icon: '📚' },
  { key: 'text-scan',   label: 'SCAN TEXT',  icon: '🔍' },
  { key: 'leaderboard', label: 'RANKINGS',   icon: '🏆' },
];

// ─────────────────────────────────────────────────────────────────────────────
function AppContent() {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [activeTab, setActiveTab] = useState('scan');
  const [loading, setLoading]     = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { t }              = useI18n();
  const { isDark, colors } = useTheme();

  // ── Deep link handler (OAuth callback) ────────────────────────────────
  useEffect(() => {
    const handleUrl = async ({ url }) => {
      if (!url || !url.includes('auth/callback')) return;
      const parsed = Linking.parse(url);
      const access_token = parsed.queryParams?.access_token;
      const refresh_token = parsed.queryParams?.refresh_token;
      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error && data?.user) {
          setUser(data.user);
          _loadProfile(data.user.id);
        }
      }
    };

    // Handle cold-start deep link
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });

    // Handle foreground deep link
    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, []);

  // ── Auth: Supabase session ──────────────────────────────────────────────
  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        _loadProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes (login / logout / refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          _loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const _loadProfile = async (uid) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();
      if (data) setProfile(data);
    } catch (e) {
      console.warn('[App] profile load failed:', e.message);
    }
  };

  const handleLogout = async () => {
    setSidebarOpen(false);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setActiveTab('scan');
  };

  const handleNavigate = (screen) => {
    setActiveTab(screen);
    setSidebarOpen(false);
  };

  // ── Loading splash ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: colors.bg }]}>
        <Image
          source={require('./logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 24 }} />
        <Text style={[styles.splashText, { color: colors.textSecondary }]}>
          INITIALIZING NEXORA AI
        </Text>
      </View>
    );
  }

  // ── Login gate ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <LoginScreen
        onLogin={(u) => {
          setUser(u);
          _loadProfile(u.id);
        }}
      />
    );
  }

  // ── Screen renderer ─────────────────────────────────────────────────────
  const renderScreen = () => {
    const commonProps = { user, profile, onLogout: handleLogout };

    switch (activeTab) {
      case 'scan':
        return <ScannerScreen {...commonProps} />;
      case 'learn':
        return <EducationScreen userId={user.id} />;
      case 'text-scan':
        return <TextScannerScreen user={user} />;
      case 'leaderboard':
        return <LeaderboardScreen />;
      case 'profile':
        return (
          <ProfileScreen
            {...commonProps}
            onRefreshProfile={() => _loadProfile(user.id)}
          />
        );
      case 'settings':
        return <SettingsScreen {...commonProps} />;
      case 'security':
        return <SecurityScreen {...commonProps} />;
      case 'monitor':
        return <MonitorScreen />;
      case 'help':
        return <HelpCenterScreen user={user} />;
      default:
        return <ScannerScreen {...commonProps} />;
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgDark} />

      {/* ── Top Header Bar ── */}
      <View style={[styles.header, { backgroundColor: colors.bgDark, borderBottomColor: colors.border }]}>
        {/* Logo / Brand */}
        <View style={styles.headerLeft}>
          <Image source={require('./logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>NEXORA</Text>
        </View>

        {/* Hamburger → opens right sidebar */}
        <TouchableOpacity
          style={[styles.hamburgerBtn, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
          onPress={() => setSidebarOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.hamburgerIcon, { color: colors.primary }]}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* ── Active Screen ── */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* ── Bottom Tab Bar ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgDark, borderTopColor: colors.border }]}>
        {BOTTOM_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, { opacity: isActive ? 1 : 0.5 }]}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.primary : colors.textMuted },
                ]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Right Sliding Sidebar ── */}
      <Sidebar
        visible={sidebarOpen}
        user={user}
        profile={profile}
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />
    </SafeAreaView>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AppContent />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Splash
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 130,
    height: 130,
  },
  splashText: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
    borderBottomWidth: 1,
    height: Platform.OS === 'ios' ? 60 : 64,
    ...SHADOWS.glass,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 34,
    height: 34,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3,
  },
  hamburgerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    fontSize: 18,
    lineHeight: 22,
  },

  // Screens
  screenContainer: {
    flex: 1,
  },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 10,
    height: Platform.OS === 'ios' ? 88 : 66,
    ...SHADOWS.premium,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 3,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -10,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
});
