// ── Nexora AI Theme System ──
// Glass tokens optimized for both dark and light modes.
// For dynamic dark/light switching, use ThemeContext.js

export const COLORS = {
    // Core - Dark Mode Slate Theme
    bg: '#0F172A',
    bgDark: '#020617',
    surface: '#1E293B',
    surfaceLight: '#334155',

    // Primary - Refined Professional Blue
    primary: '#38BDF8',
    primaryDark: '#0EA5E9',
    primaryLight: 'rgba(56, 189, 248, 0.1)',

    // Glassmorphism - Smoked Glass (Dark)
    glassBg: 'rgba(15, 23, 42, 0.65)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    glassBgLight: 'rgba(255, 255, 255, 0.05)',
    glassHighlight: 'rgba(255, 255, 255, 0.04)',
    glassShadow: 'rgba(0, 0, 0, 0.5)',

    // Status - Professional Vibrant
    safe: '#10B981',
    safeLight: 'rgba(16, 185, 129, 0.1)',
    suspicious: '#F59E0B',
    suspiciousLight: 'rgba(245, 158, 11, 0.1)',
    malicious: '#EF4444',
    maliciousLight: 'rgba(239, 68, 68, 0.1)',
    caution: '#F97316',
    cautionLight: 'rgba(249, 115, 22, 0.1)',

    // Text - High Contrast for Dark Mode
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textWhite: '#FFFFFF',

    // Borders
    border: '#334155',
    borderLight: '#1E293B',
};

export const FONTS = {
    regular: 'System',
    medium: 'System',
    bold: 'System',
};

export const SHADOWS = {
    soft: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    premium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    glass: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 4,
    },
    smokedGlass: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 8,
    },
};

export const STATUS_CONFIG = {
    Safe: {
        color: COLORS.safe,
        bg: COLORS.safeLight,
        icon: 'shield-check',
        label: 'status_safe',
        description: 'desc_safe',
    },
    Caution: {
        color: COLORS.caution,
        bg: COLORS.cautionLight,
        icon: 'alert-circle',
        label: 'status_caution',
        description: 'desc_caution',
    },
    Suspicious: {
        color: COLORS.suspicious,
        bg: COLORS.suspiciousLight,
        icon: 'alert-triangle',
        label: 'status_suspicious',
        description: 'desc_suspicious',
    },
    Malicious: {
        color: COLORS.malicious,
        bg: COLORS.maliciousLight,
        icon: 'shield-alert',
        label: 'status_malicious',
        description: 'desc_malicious',
    },
};
