import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';

// ── FAQ Data ─────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'How does NexoraAI detect phishing messages?',
    a: 'NexoraAI uses a hybrid AI engine combining a fine-tuned machine learning model with advanced heuristic analysis. It scans message content, sender patterns, embedded links, and urgency triggers to classify threats in real time.',
  },
  {
    q: 'Is my data safe?',
    a: 'Absolutely. All data is encrypted in transit (TLS 1.3) and at rest via Supabase\'s enterprise-grade infrastructure. We never store your raw messages beyond the scan session unless you explicitly keep history enabled.',
  },
  {
    q: 'What should I do if a message is flagged as Malicious?',
    a: 'Do NOT click any links, do NOT reply, and do NOT share any personal info. Instead, mark it as spam/junk in your inbox. You can also use our "Report" feature to help improve the AI model.',
  },
  {
    q: 'How does the XP and leveling system work?',
    a: 'You earn XP by completing lessons (+50), quizzes (up to +100 based on score), identifying phishing scenarios (+25), and maintaining daily streaks. XP accumulates to unlock higher levels from Rookie to Elite.',
  },
  {
    q: 'Can I scan Telegram messages?',
    a: 'Auto-scanning is available for SMS. For Telegram, connect your account via the Connected Apps toggle. You can also copy-paste any message into the Quick Scan or Text Scanner tabs for instant analysis.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Go to the Login screen and tap "Forgot Password?" — a reset link will be sent to your registered email via Supabase Auth.',
  },
  {
    q: 'Is NexoraAI free to use?',
    a: 'Yes! NexoraAI is completely free for individual users. All scanning, learning, and gamification features are included at no cost.',
  },
];

// ── Accordion Item ────────────────────────────────────────────────────────────
function FAQItem({ item }) {
  const [open, setOpen] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.faqItem, open && styles.faqItemOpen]}
      onPress={() => setOpen(!open)}
      activeOpacity={0.8}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{item.q}</Text>
        <Text style={styles.faqChevron}>{open ? '▲' : '▼'}</Text>
      </View>
      {open && <Text style={styles.faqAnswer}>{item.a}</Text>}
    </TouchableOpacity>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function HelpCenterScreen({ user }) {
  const [contactMsg, setContactMsg] = useState('');
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);

  const handleSendMessage = async () => {
    if (!contactMsg.trim()) { Alert.alert('Empty Message', 'Please type your question or feedback.'); return; }
    setSending(true);
    try {
      // Simulate sending — in production, POST to your support API or Supabase edge function
      await new Promise(r => setTimeout(r, 1200));
      setSent(true);
      setContactMsg('');
      setTimeout(() => setSent(false), 4000);
    } catch {
      Alert.alert('Error', 'Could not send message. Please try again.');
    }
    setSending(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Help Center</Text>
        <Text style={styles.screenSubtitle}>Find answers and get support</Text>
      </View>

      {/* FAQ Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</Text>
        {FAQ.map((item, i) => (
          <FAQItem key={i} item={item} />
        ))}
      </View>

      {/* Contact Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONTACT SUPPORT</Text>
        <Text style={styles.sectionDesc}>
          Can't find what you need? Send us a message and we'll get back to you within 24 hours.
        </Text>
        <TextInput
          style={styles.contactInput}
          placeholder="Describe your issue or question..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={contactMsg}
          onChangeText={setContactMsg}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (sending || !contactMsg.trim()) && { opacity: 0.5 }]}
          onPress={handleSendMessage}
          disabled={sending || !contactMsg.trim()}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.sendBtnText}>{sent ? '✓  Sent!' : 'SEND MESSAGE'}</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Quick Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>QUICK LINKS</Text>
        {[
          { label: '📧  Email Support', action: () => Linking.openURL('mailto:support@nexoraai.app') },
          { label: '🌐  Visit Website', action: () => Linking.openURL('https://nexoraai.vercel.app') },
          { label: '🐛  Report a Bug',  action: () => Linking.openURL('mailto:bugs@nexoraai.app?subject=Bug%20Report') },
        ].map((link, i) => (
          <TouchableOpacity key={i} style={styles.linkRow} onPress={link.action} activeOpacity={0.7}>
            <Text style={styles.linkLabel}>{link.label}</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Version info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>NexoraAI v1.0.0 · Team Nexify</Text>
        <Text style={styles.footerText}>Supabase Secured · End-to-End Encrypted</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  content:     { paddingBottom: 100 },

  header:      { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  screenTitle: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary, marginBottom: 6 },
  screenSubtitle: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },

  section: {
    marginHorizontal: 20, marginBottom: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1.5, paddingHorizontal: 20,
    paddingTop: 18, paddingBottom: 8,
  },
  sectionDesc: {
    fontSize: 13, color: COLORS.textMuted, lineHeight: 20,
    paddingHorizontal: 20, paddingBottom: 16,
  },

  // FAQ
  faqItem: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  faqItemOpen: {
    backgroundColor: 'rgba(0,245,255,0.03)',
  },
  faqHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 12,
  },
  faqQuestion: {
    fontSize: 14, fontWeight: '700', color: COLORS.textPrimary,
    flex: 1, lineHeight: 21,
  },
  faqChevron: {
    fontSize: 10, color: COLORS.textMuted, marginTop: 4,
  },
  faqAnswer: {
    fontSize: 13, color: COLORS.textSecondary,
    marginTop: 12, lineHeight: 21,
  },

  // Contact
  contactInput: {
    backgroundColor: COLORS.bgDark,
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.1)',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: COLORS.textPrimary,
    minHeight: 120, marginHorizontal: 20, marginBottom: 16,
  },
  sendBtn: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: '#00F5FF', borderRadius: 16,
    height: 52, alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.premium,
  },
  sendBtnText: {
    fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1,
  },

  // Links
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  linkLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  linkArrow: { fontSize: 16, color: COLORS.textMuted },

  // Footer
  footer: {
    alignItems: 'center', paddingVertical: 32,
  },
  footerText: {
    fontSize: 11, color: COLORS.textMuted,
    fontWeight: '600', letterSpacing: 0.5, marginBottom: 4,
  },
});
