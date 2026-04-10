import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── DARK MODE PALETTE (current) ──
const DARK_COLORS = {
    bg: '#0F172A',
    bgDark: '#020617',
    surface: '#1E293B',
    surfaceLight: '#334155',
    primary: '#38BDF8',
    primaryDark: '#0EA5E9',
    primaryLight: 'rgba(56, 189, 248, 0.1)',
    glassBg: 'rgba(15, 23, 42, 0.65)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    glassBgLight: 'rgba(255, 255, 255, 0.05)',
    glassHighlight: 'rgba(255, 255, 255, 0.04)',
    glassShadow: 'rgba(0, 0, 0, 0.5)',
    safe: '#10B981',
    safeLight: 'rgba(16, 185, 129, 0.1)',
    suspicious: '#F59E0B',
    suspiciousLight: 'rgba(245, 158, 11, 0.1)',
    malicious: '#EF4444',
    maliciousLight: 'rgba(239, 68, 68, 0.1)',
    caution: '#F97316',
    cautionLight: 'rgba(249, 115, 22, 0.1)',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textWhite: '#FFFFFF',
    border: '#334155',
    borderLight: '#1E293B',
};

// ── LIGHT MODE PALETTE ──
const LIGHT_COLORS = {
    bg: '#F1F5F9',
    bgDark: '#E2E8F0',
    surface: '#FFFFFF',
    surfaceLight: '#F8FAFC',
    primary: '#0EA5E9',
    primaryDark: '#0284C7',
    primaryLight: 'rgba(14, 165, 233, 0.08)',
    glassBg: 'rgba(255, 255, 255, 0.65)',
    glassBorder: 'rgba(0, 0, 0, 0.08)',
    glassBgLight: 'rgba(0, 0, 0, 0.02)',
    glassHighlight: 'rgba(255, 255, 255, 0.8)',
    glassShadow: 'rgba(0, 0, 0, 0.12)',
    safe: '#059669',
    safeLight: 'rgba(5, 150, 105, 0.08)',
    suspicious: '#D97706',
    suspiciousLight: 'rgba(217, 119, 6, 0.08)',
    malicious: '#DC2626',
    maliciousLight: 'rgba(220, 38, 38, 0.08)',
    caution: '#EA580C',
    cautionLight: 'rgba(234, 88, 12, 0.08)',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textWhite: '#FFFFFF',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem('app_theme').then(saved => {
            if (saved === 'light') setIsDark(false);
        });
    }, []);

    const toggleTheme = async () => {
        const next = !isDark;
        setIsDark(next);
        await AsyncStorage.setItem('app_theme', next ? 'dark' : 'light');
    };

    const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}

export { DARK_COLORS, LIGHT_COLORS };
