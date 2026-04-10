import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Production Render URLs
const SCANNER_API_BASE = 'https://nexora-scanner.onrender.com';
const EDU_API_BASE = 'https://phishguard-1-8y86.onrender.com';

// Use SCANNER_API_BASE for scanning, EDU_API_BASE for everything else
const API_BASE = EDU_API_BASE;

const SCAN_CACHE_KEY = 'phishguard_scan_cache';

// Helper to get token
const getToken = async () => {
    if (Platform.OS === 'web') {
        return localStorage.getItem('jwt_token');
    }
    return await AsyncStorage.getItem('jwt_token');
};

const setToken = async (token) => {
    if (Platform.OS === 'web') {
        localStorage.setItem('jwt_token', token);
    } else {
        await AsyncStorage.setItem('jwt_token', token);
    }
};

const removeToken = async () => {
    if (Platform.OS === 'web') {
        localStorage.removeItem('jwt_token');
    } else {
        await AsyncStorage.removeItem('jwt_token');
    }
};

// Caching Helpers
const getCache = async () => {
    try {
        const cached = await AsyncStorage.getItem(SCAN_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch (e) {
        return {};
    }
};

const saveToCache = async (key, result) => {
    try {
        const cache = await getCache();
        cache[key] = { result, timestamp: Date.now() };
        await AsyncStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('Failed to save to cache:', e);
    }
};

const getFromCache = async (key) => {
    const cache = await getCache();
    return cache[key]?.result || null;
};

export const api = {
    // Generic Helpers
    async get(endpoint, options = {}) {
        const token = await getToken();
        // Route requests: advice and others to EDU, except if explicitly for scanner (though scanner doesn't have many GETs)
        const base = endpoint.startsWith('/scan') ? SCANNER_API_BASE : EDU_API_BASE;
        let url = `${base}${endpoint}`;

        if (options.params) {
            const query = new URLSearchParams(options.params).toString();
            url += `?${query}`;
        }

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) throw new Error("Unauthorized");
        return res.json();
    },

    async post(endpoint, body) {
        const token = await getToken();
        const base = endpoint.startsWith('/scan') ? SCANNER_API_BASE : EDU_API_BASE;
        const res = await fetch(`${base}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body),
        });
        if (res.status === 401) throw new Error("Unauthorized");
        return res.json();
    },

    // Auth (Edu Service)
    async login(email, password) {
        const res = await fetch(`${EDU_API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');
        await setToken(data.access_token);
        return data.user;
    },

    async signup(email, password) {
        const res = await fetch(`${EDU_API_BASE}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Signup failed');
        return data;
    },

    async logout() {
        await removeToken();
    },

    // Features
    async scanMessage(message) {
        // 1. Check Cache
        const cacheKey = message.trim();
        const cachedResult = await getFromCache(cacheKey);
        if (cachedResult) {
            console.log('📦 Scan Result found in cache');
            return cachedResult;
        }

        const token = await getToken();
        const res = await fetch(`${SCANNER_API_BASE}/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message }),
        });
        if (res.status === 401) throw new Error("Unauthorized");
        const raw = await res.text();
        let result;
        try { result = JSON.parse(raw); } catch { throw new Error('Server error: ' + raw.slice(0, 100)); }

        // 2. Save to Cache
        await saveToCache(cacheKey, result);
        return result;
    },

    /**
     * Scan arbitrary text for phishing patterns (used by TextScannerScreen).
     * Calls the new /api/scan/text endpoint on the scanner backend.
     * Returns: { riskLevel: 'SAFE'|'SUSPICIOUS'|'MALICIOUS', score: 0-100, reasons: string[] }
     */
    async scanText(text) {
        const token = await getToken();
        const res = await fetch(`${SCANNER_API_BASE}/scan/text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text }),
        });
        if (res.status === 401) throw new Error('Unauthorized');
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch { throw new Error('Server error: ' + raw.slice(0, 100)); }
        if (!res.ok) throw new Error(data.detail || `Scan failed (${res.status})`);
        return data;
    },

    /**
     * Alias for getLesson — used by web LessonView which calls getLessonDetail.
     */
    async getLessonDetail(id, lang = 'en') {
        return this.getLesson(id, lang);
    },

    async getQuiz(lang = 'en') {
        const res = await fetch(`${EDU_API_BASE}/quiz?lang=${lang}`);
        return res.json();
    },

    async getDailyQuiz(lang = 'en') {
        const token = await getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${EDU_API_BASE}/quiz/daily?lang=${lang}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch daily quiz');
        return res.json();
    },

    async submitQuiz(answers, userId, quizType = "daily", quizId = null) {
        const token = await getToken();
        const res = await fetch(`${EDU_API_BASE}/quiz/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                answers,
                user_id: userId,
                quiz_type: quizType,
                quiz_id: quizId
            }),
        });
        return res.json();
    },

    async getLeaderboard() {
        try {
            const token = await getToken();
            const res = await fetch(`${EDU_API_BASE}/leaderboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                console.warn('Leaderboard response not OK:', res.status);
                return { top_users: [], user_rank: null };
            }
            return await res.json();
        } catch (e) {
            console.error('getLeaderboard error:', e);
            return { top_users: [], user_rank: null };
        }
    },

    async getProfile() {
        const token = await getToken();
        const res = await fetch(`${EDU_API_BASE}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) throw new Error("Unauthorized");
        return res.json();
    },

    async getHistory() {
        const token = await getToken();
        const res = await fetch(`${EDU_API_BASE}/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return [];
        return res.json();
    },

    async scanBatch(messages) {
        try {
            const token = await getToken();

            // Optimization: Filter out already cached messages
            const cache = await getCache();
            const results = [];
            const toScan = [];

            messages.forEach(msg => {
                const key = msg.body?.trim() || msg.message?.trim() || '';
                if (cache[key]) {
                    results.push({ ...cache[key].result, id: msg.id || cache[key].result.id });
                } else {
                    toScan.push(msg);
                }
            });

            if (toScan.length === 0) {
                console.log(`📦 Batch Scan: All ${messages.length} messages found in cache`);
                return { results, stats: this._calculateBatchStats(results) };
            }

            console.log(`🚀 Batch Scan: Scanning ${toScan.length} new messages, ${results.length} from cache`);

            const res = await fetch(`${SCANNER_API_BASE}/scan-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ messages: toScan }),
            });

            if (!res.ok) {
                console.warn('scanBatch response not OK:', res.status);
                return { results, stats: this._calculateBatchStats(results) };
            }

            const raw = await res.text();
            let scanData;
            try { scanData = JSON.parse(raw); } catch { throw new Error('Server error: ' + raw.slice(0, 100)); }
            const newResults = scanData.results || [];

            // Save new results to cache
            for (const r of newResults) {
                const key = r.body?.trim() || '';
                if (key) await saveToCache(key, r);
                results.push(r);
            }

            return { results, stats: scanData.stats || this._calculateBatchStats(results) };
        } catch (e) {
            console.error('scanBatch error:', e);
            return { results: [], stats: { total: 0, safe: 0, caution: 0, suspicious: 0, malicious: 0 } };
        }
    },

    async awardXp(xp_amount, reason = 'general') {
        try {
            const token = await getToken();
            await fetch(`${EDU_API_BASE}/leaderboard/award-xp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ xp_amount, reason }),
            });
        } catch (e) {
            console.warn('awardXp failed (non-critical):', e);
        }
    },

    _calculateBatchStats(results) {
        return {
            total: results.length,
            safe: results.filter(r => r.classification === 'Safe').length,
            caution: results.filter(r => r.classification === 'Caution').length,
            suspicious: results.filter(r => r.classification === 'Suspicious').length,
            malicious: results.filter(r => r.classification === 'Malicious').length,
        };
    },

    async getMessageAdvice(message, classification, lang = 'en') {
        try {
            const token = await getToken();
            const res = await fetch(`${EDU_API_BASE}/advice/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message, classification, lang }),
            });
            if (!res.ok) {
                console.warn('getMessageAdvice failed:', res.status);
                return [];
            }
            return await res.json();
        } catch (e) {
            console.error('getMessageAdvice error:', e);
            return [];
        }
    },

    // Academy (Edu Service)
    async getLessons(lang = 'en') {
        const token = await getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${EDU_API_BASE}/lessons?lang=${lang}`, { headers });
        if (!res.ok) return [];
        return res.json();
    },

    async getLesson(id, lang = 'en') {
        const token = await getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${EDU_API_BASE}/lessons/${id}?lang=${lang}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch lesson');
        return res.json();
    },

    async completeLesson(id) {
        const token = await getToken();
        const res = await fetch(`${EDU_API_BASE}/lessons/${id}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to complete lesson');
        return res.json();
    },

    async getActivity() {
        const token = await getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${EDU_API_BASE}/activity`, { headers });
        if (!res.ok) return [];
        return res.json();
    },
};
