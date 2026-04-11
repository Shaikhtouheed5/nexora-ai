import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, StatusBar,
  ScrollView, Dimensions, Image, ActivityIndicator
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';
import { supabase } from '../lib/supabase.js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

// Required for expo-auth-session to work
WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

// Tabs: 0 = Sign In, 1 = Register, 2 = OTP (placeholder)
export default function LoginScreen({ onLogin }) {
  const [tab, setTab]                   = useState(0);
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName]         = useState('');
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const clear = () => { setError(''); setSuccess(''); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })
      if (error) throw error
      // navigation happens via onAuthStateChange in App.js
    } catch (err) {
      const message = err?.message || 'Login failed. Please try again.'
      if (/email not confirmed/i.test(message)) {
        setError('Email not confirmed. Please click the confirmation link sent to your Gmail and try again.')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) { setError('All fields required.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    clear();
    try {
      const { error: authError } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: fullName } }
      });
      if (authError) throw authError;
      setSuccess('Account created! Verify your email then sign in.');
      setTab(0);
    } catch (e) {
      const msg = e.message || '';
      if (/rate.limit|over_email_send_rate_limit/i.test(msg)) {
        setError('Too many attempts. Please wait a few minutes before trying again.');
      } else if (msg.includes('already')) {
        setError('Email already registered.');
      } else {
        setError(msg || 'Registration failed.');
      }
    } finally { setLoading(false); }
  };

  // ── Forgot Password ────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email first.'); return; }
    setLoading(true);
    clear();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSuccess('Reset link sent! Check your inbox.');
    } catch (e) { setError(e.message || 'Failed to send reset link.'); }
    finally { setLoading(false); }
  };

  const TABS = ['Sign In', 'Register', '📱 OTP'];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Background glow */}
      <View style={styles.bgGlow} />
      <View style={styles.bgGrid} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo + Title */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoRing}>
            <Image source={require('../../logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>NEXORA <Text style={{ color: COLORS.primary }}>AI</Text></Text>
          <Text style={styles.subtitle}>AI-POWERED PHISHING DETECTION</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          {/* Tabs */}
          <View style={styles.tabRow}>
            {TABS.map((t, i) => (
              <TouchableOpacity key={i} style={[styles.tabBtn, tab === i && styles.tabBtnActive]} onPress={() => { setTab(i); clear(); }}>
                <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Google Sign-In (shown on Sign In + Register tabs) */}
          {tab !== 2 && (
            <>
              <TouchableOpacity
                style={[styles.googleBtn, googleLoading && { opacity: 0.6 }]}
                onPress={async () => {
                  setGoogleLoading(true);
                  clear();
                  try {
                    const redirectTo = makeRedirectUri({ scheme: 'nexoraai' });
                    const { data, error } = await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: {
                        redirectTo,
                        skipBrowserRedirect: true,
                      },
                    });
                    if (error) throw error;
                    if (data?.url) {
                      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
                      if (result.type === 'success' && result.url) {
                        // Supabase returns tokens in hash fragment — convert # to ? for parsing
                        const urlWithQuery = result.url.replace('#', '?');
                        const parsed = Linking.parse(urlWithQuery);
                        const access_token = parsed.queryParams?.access_token;
                        const refresh_token = parsed.queryParams?.refresh_token;
                        if (access_token && refresh_token) {
                          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token,
                            refresh_token,
                          });
                          if (sessionError) throw sessionError;
                          // onAuthStateChange in App.js will handle navigation automatically
                        } else {
                          // Fallback: try getSessionFromUrl
                          try {
                            await supabase.auth.getSessionFromUrl({ url: urlWithQuery });
                          } catch {}
                        }
                      }
                    }
                  } catch (e) {
                    setError(e.message || 'Google Sign-In failed. Please try email login.');
                  } finally {
                    setGoogleLoading(false);
                  }
                }}
                activeOpacity={0.8}
                disabled={googleLoading}
              >
                {googleLoading
                  ? <ActivityIndicator color={COLORS.textPrimary} size="small" />
                  : <>
                      <Text style={styles.googleIcon}>G</Text>
                      <Text style={styles.googleText}>Continue with Google</Text>
                    </>
                }
              </TouchableOpacity>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          )}

          {/* ── Sign In Form ── */}
          {tab === 0 && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>EMAIL ADDRESS</Text>
                <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={t => { setEmail(t); clear(); }} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={isPasswordHidden} value={password} onChangeText={t => { setPassword(t); clear(); }} />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setIsPasswordHidden(v => !v)}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>{isPasswordHidden ? '👁️' : '🙈'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}

              <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleSignIn} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color={COLORS.bg} size="small" /> : <Text style={styles.primaryBtnText}>SIGN IN SECURELY</Text>}
              </TouchableOpacity>

              {error ? <Text style={styles.signInErrorText}>{error}</Text> : null}

              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotLink}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Register Form ── */}
          {tab === 1 && (
            <View style={styles.form}>
              {[
                { label: 'FULL NAME',  value: fullName, set: setFullName, placeholder: 'Your full name', type: 'default' },
                { label: 'EMAIL',      value: email,    set: setEmail,    placeholder: 'you@example.com', type: 'email-address' },
                { label: 'PASSWORD',   value: password, set: setPassword, placeholder: 'Min. 6 chars', secure: true },
                { label: 'CONFIRM PW', value: confirmPassword, set: setConfirmPassword, placeholder: 'Repeat password', secure: true },
              ].map(({ label, value, set, placeholder, type, secure }) => (
                <View key={label} style={styles.inputGroup}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={COLORS.textMuted}
                    keyboardType={type || 'default'} autoCapitalize="none"
                    secureTextEntry={!!secure} value={value} onChangeText={t => { set(t); clear(); }} />
                </View>
              ))}

              {error   ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
              {success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}

              <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color={COLORS.bg} size="small" /> : <Text style={styles.primaryBtnText}>CREATE ACCOUNT</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── OTP Placeholder ── */}
          {tab === 2 && (
            <View style={[styles.form, { alignItems: 'center', paddingVertical: 20 }]}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>📱</Text>
              <Text style={[styles.label, { fontSize: 16, letterSpacing: 0 }]}>Phone OTP Login</Text>
              <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 22, fontSize: 14 }}>
                OTP-based phone login is coming soon.{'\n'}Use email login in the meantime.
              </Text>
              <View style={[styles.primaryBtn, { marginTop: 28, opacity: 0.5, backgroundColor: COLORS.surface }]}>
                <Text style={[styles.primaryBtnText, { color: COLORS.textMuted }]}>COMING SOON</Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Trust indicators */}
        <View style={styles.trustRow}>
          {['Supabase Secured', 'End-to-End Encrypted', 'Zero-Knowledge'].map(t => (
            <Text key={t} style={styles.trustText}>✦ {t}</Text>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  bgGlow:       { position: 'absolute', top: -100, alignSelf: 'center', width: 400, height: 400, borderRadius: 200, backgroundColor: '#00F5FF', opacity: 0.04 },
  bgGrid:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.03 },
  scrollContent:{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 60 },

  header:       { alignItems: 'center', marginBottom: 40 },
  logoRing:     { width: 100, height: 100, borderRadius: 28, backgroundColor: 'rgba(0,245,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...SHADOWS.premium },
  logo:         { width: 70, height: 70 },
  title:        { fontSize: 30, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 2 },
  subtitle:     { fontSize: 11, color: COLORS.textMuted, marginTop: 6, fontWeight: '700', letterSpacing: 3 },

  card:         { backgroundColor: COLORS.surface, borderRadius: 28, padding: 28, borderWidth: 1, borderColor: 'rgba(0,245,255,0.12)', ...SHADOWS.premium },

  tabRow:       { flexDirection: 'row', backgroundColor: COLORS.bgDark, borderRadius: 14, padding: 4, marginBottom: 24, gap: 4 },
  tabBtn:       { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  tabBtnActive: { backgroundColor: 'rgba(0,245,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)' },
  tabText:      { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  tabTextActive:{ color: '#00F5FF' },

  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: COLORS.bgDark, borderRadius: 16, height: 54, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  googleIcon:   { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleText:   { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText:  { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 2 },

  form:         { gap: 0 },
  inputGroup:   { marginBottom: 20 },
  label:        { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, marginBottom: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
  inputRow:     { flexDirection: 'row', alignItems: 'center' },
  input:        { backgroundColor: COLORS.bgDark, borderRadius: 14, paddingHorizontal: 18, height: 56, fontSize: 15, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(0,245,255,0.1)' },
  eyeBtn:       { position: 'absolute', right: 16, padding: 8 },

  errorBox:     { backgroundColor: 'rgba(255,61,87,0.1)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,61,87,0.2)' },
  errorText:    { color: '#FF3D57', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  successBox:   { backgroundColor: 'rgba(0,230,118,0.1)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,230,118,0.2)' },
  successText:  { color: '#00E676', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  primaryBtn:   { backgroundColor: '#00F5FF', borderRadius: 16, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8, ...SHADOWS.premium },
  btnDisabled:  { opacity: 0.6 },
  primaryBtnText:{ color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  signInErrorText: { color: '#FF3D57', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 12 },

  forgotLink:   { alignItems: 'center', marginTop: 16 },
  forgotText:   { color: '#00F5FF', fontSize: 13, fontWeight: '700' },

  trustRow:     { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 36, flexWrap: 'wrap' },
  trustText:    { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.5 },
});
