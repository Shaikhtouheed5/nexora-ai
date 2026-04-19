import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Unified backend
const SCANNER_API_BASE = 'https://nexora-scanner.onrender.com';
const EDU_API_BASE = 'https://nexora-scanner.onrender.com';

const API_BASE = 'https://nexora-scanner.onrender.com';

const SCAN_CACHE_KEY = 'phishguard_scan_cache';

// Helper to get token — always uses supabase.auth.getSession() so expired
// tokens are refreshed automatically before any API call.
const getToken = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) return session.access_token;
    } catch (e) {
        console.warn('[getToken] getSession failed:', e.message);
    }
    // Raw-storage fallbacks (used if Supabase client is unavailable)
    if (Platform.OS === 'web') {
        try {
            const raw = localStorage.getItem('sb-oyvyeutjidgafipmgixz-auth-token');
            if (raw) return JSON.parse(raw).access_token;
        } catch {}
        return localStorage.getItem('jwt_token');
    }
    try {
        const raw = await AsyncStorage.getItem('sb-oyvyeutjidgafipmgixz-auth-token');
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed.access_token
                || parsed.currentSession?.access_token
                || null;
        }
    } catch {}
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

/**
 * Hardened API call — 10s timeout, full raw response logging.
 * Accepts full URL or path (prefixed with API_BASE if path).
 */
export const apiCall = async (endpoint, method = 'GET', body = null) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Support both full URLs and /path endpoints
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    try {
        const token = await getToken();
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal,
        });

        const text = await response.text();
        console.log('RAW RESPONSE:', text.slice(0, 500));

        if (!response.ok) {
            throw new Error(`API Error ${response.status}: ${text}`);
        }

        return JSON.parse(text);
    } catch (error) {
        console.error('API ERROR:', error.message);
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

/**
 * Normalize a raw backend scan result into a consistent shape for the UI.
 * Backend returns { verdict, confidence, riskLevel, flags, explanation, score }
 * UI expects { classification, confidence (0-1), body, sender, red_flags, ... }
 */
const _normalizeResult = (data, inputText = '', inputSender = '', inputDate = null) => {
    // Map lowercase verdict → capitalized classification
    const rawVerdict = (data.verdict || data.riskLevel || data.classification || '').toLowerCase();
    let classification;
    if (rawVerdict === 'malicious') classification = 'Malicious';
    else if (rawVerdict === 'suspicious') classification = 'Suspicious';
    else if (rawVerdict === 'safe') classification = 'Safe';
    else classification = data.classification || 'Unknown';

    // Normalize confidence to 0.0–1.0
    let confidence = data.confidence != null ? Number(data.confidence) : null;
    if (confidence == null) {
        const score = data.score != null ? Number(data.score) : null;
        confidence = score != null ? score / 100 : 0;
    }
    if (confidence > 1) confidence = confidence / 100; // guard against 0-100 scale
    confidence = Math.min(1, Math.max(0, confidence));

    // if backend says "safe" but confidence > 0.3, show as Suspicious
    if (classification === 'Safe' && confidence > 0.3) {
        classification = 'Suspicious';
    }

    const body = data.body || data.text || inputText || '';
    const sender = data.sender || inputSender || '';

    const normalized = {
        ...data,
        classification,
        confidence,
        risk_level: data.risk_level || data.riskLevel || (
            classification === 'Malicious' ? 'high' :
            classification === 'Suspicious' ? 'medium' : 'low'
        ),
        explanation: data.explanation || data.reason || '',
        red_flags: data.flags || data.red_flags || data.redFlags || [],
        sender,
        body,
        text: body,
        date: data.date || inputDate || new Date().toISOString(),
    };

    // Content-based override: Indian SMS phishing patterns
    const msgText = (body || inputText).toLowerCase();

    const MALICIOUS_PATTERNS = [
        /http:\/\/(?!sbi\.co\.in|hdfcbank|icicibank|axisbank|npci\.org\.in)/i,
        /your.*account.*block/i,
        /verify.*now/i,
        /click.*link/i,
        /otp.*share/i,
        /kyc.*update/i,
        /pan.*verify/i,
        /aadhar.*link/i,
        /won.*prize/i,
        /lottery.*winner/i,
        /claim.*reward/i,
        /free.*gift/i,
    ];

    const SUSPICIOUS_PATTERNS = [
        /urgent/i,
        /immediately/i,
        /expire/i,
        /suspend/i,
        /limited.*time/i,
        /act.*now/i,
        /dear.*customer.*click/i,
        /congratulations.*won/i,
        /bit\.ly|tinyurl|t\.co\/|goo\.gl/i,
        /your.*account.*debit.*suspicious/i,
        /\d{10}.*otp/i,
    ];

    const MALICIOUS_HIT = MALICIOUS_PATTERNS.some(p => p.test(msgText));
    const SUSPICIOUS_COUNT = SUSPICIOUS_PATTERNS.filter(p => p.test(msgText)).length;

    if (MALICIOUS_HIT) {
        normalized.classification = 'Malicious';
        normalized.confidence = Math.max(normalized.confidence, 0.88);
        normalized.risk_level = 'high';
    } else if (SUSPICIOUS_COUNT >= 1 ||
        (normalized.confidence > 0.25 && normalized.classification === 'Safe')) {
        normalized.classification = 'Suspicious';
        normalized.confidence = Math.max(normalized.confidence, 0.55);
        normalized.risk_level = 'medium';
    }

    // Generate human-readable explanation from detected signals
    const getExplanation = (text, classification) => {
        const reasons = [];
        if (/http:\/\//i.test(text)) reasons.push('Contains non-secure HTTP link');
        if (/urgent|immediately/i.test(text)) reasons.push('Uses urgency tactics');
        if (/block|suspend/i.test(text)) reasons.push('Threatens account suspension');
        if (/otp/i.test(text)) reasons.push('Requests OTP — banks never ask for this');
        if (/kyc|pan|aadhar/i.test(text)) reasons.push('Requests sensitive KYC details');
        if (/won|prize|lottery|reward/i.test(text)) reasons.push('Prize/lottery scam pattern');
        if (/click.*link|verify.*now/i.test(text)) reasons.push('Pressures user to click link');
        if (/bit\.ly|tinyurl/i.test(text)) reasons.push('Uses URL shortener to hide destination');
        if (reasons.length === 0 && classification !== 'Safe')
            reasons.push('Unusual patterns detected by neural analysis');
        return reasons;
    };

    const flags = getExplanation(msgText, normalized.classification);
    if (flags.length > 0) {
        normalized.red_flags = flags;
        normalized.explanation = flags.join('. ');
    }

    return normalized;
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

/**
 * Normalize scan results from the backend into a consistent format.
 * Handles both old format { riskLevel, score, reasons } and
 * new backend format { verdict, confidence, flags, explanation }.
 * Always returns { riskLevel: string, score: number (0-100), reasons: string[], explanation: string }.
 */
export const normalizeScanResult = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return { riskLevel: 'SAFE', score: 0, reasons: [], explanation: '' };
  }

  // Derive riskLevel
  const riskLevel = (raw.verdict || raw.riskLevel || 'SAFE').toUpperCase();

  // Derive score (normalize to 0-100 integer)
  let score;
  if (raw.score !== undefined && raw.score !== null) {
    const s = Number(raw.score);
    if (s > 100) {
      score = Math.round(s / 100); // e.g. 0-10000 scale
    } else if (s > 0 && s <= 1) {
      score = Math.round(s * 100); // 0.0–1.0 float
    } else {
      score = Math.round(s); // already 0-100
    }
  } else if (raw.confidence !== undefined && raw.confidence !== null) {
    score = Math.round(Number(raw.confidence) * 100);
  } else {
    // Default by risk level if no score available
    score = riskLevel === 'SAFE' ? 15 : riskLevel === 'SUSPICIOUS' ? 55 : 85;
  }
  score = Math.min(100, Math.max(0, score));

  const reasons = raw.reasons || raw.flags || [];
  const explanation = raw.explanation || '';

  return { riskLevel, score, reasons, explanation };
};

const api = {
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
            body: JSON.stringify({ text: message }),
        });
        if (res.status === 401) throw new Error("Unauthorized");
        const raw = await res.text();
        let result;
        try { result = JSON.parse(raw); } catch { throw new Error('Server error: ' + raw.slice(0, 100)); }

        // 2. Normalize and save to Cache
        const normalized = _normalizeResult(result, message, '');
        await saveToCache(cacheKey, normalized);
        return normalized;
    },

    /**
     * Scan arbitrary text for phishing patterns.
     * Returns raw backend response — call normalizeScanResult() on the result.
     */
    async scanText(text) {
        return apiCall('/scan/text', 'POST', { text });
    },

    /**
     * Alias for getLesson — used by web LessonView which calls getLessonDetail.
     */
    async getLessonDetail(id, lang = 'en') {
        return this.getLesson(id, lang);
    },

    async getQuiz(lang = 'en') {
        const res = await fetch(`${EDU_API_BASE}/edu/quiz?lang=${lang}`);
        return res.json();
    },

    async getDailyQuiz(lang = 'en') {
        const token = await getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const url = `${EDU_API_BASE}/edu/quiz/daily?lang=${lang}`;
        console.log('[getDailyQuiz] fetching:', url);
        const res = await fetch(url, { headers });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`[getDailyQuiz] HTTP ${res.status}:`, body.slice(0, 200));
            throw new Error('Failed to fetch daily quiz');
        }
        return res.json();
    },

    async submitQuiz(answers, userId, quizType = "daily", quizId = null) {
        const token = await getToken();
        const res = await fetch(`${EDU_API_BASE}/edu/quiz/score`, {
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
            const res = await fetch(`${EDU_API_BASE}/edu/leaderboard`, {
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
        const res = await fetch(`${EDU_API_BASE}/edu/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) throw new Error("Unauthorized");
        return res.json();
    },

    async getHistory() {
        const token = await getToken();
        const res = await fetch(`${EDU_API_BASE}/edu/history`, {
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

            const res = await fetch(`${SCANNER_API_BASE}/scan/scan-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: toScan.map(msg => ({
                        text: msg.body || msg.text || '',
                        sender: msg.sender || '',
                        type: 'sms',
                    })),
                }),
            });

            if (!res.ok) {
                console.warn('scanBatch response not OK:', res.status);
                return { results, stats: this._calculateBatchStats(results) };
            }

            const raw = await res.text();
            let scanData;
            try { scanData = JSON.parse(raw); } catch { throw new Error('Server error: ' + raw.slice(0, 100)); }
            const newResults = scanData.results || [];

            // Normalize and save new results to cache
            for (let i = 0; i < newResults.length; i++) {
                const src = toScan[i] || {};
                const r = _normalizeResult(
                    newResults[i],
                    src.body || src.text || '',
                    src.sender || '',
                    src.date || null,
                );
                if (src.id) r.id = src.id;
                const key = (r.body || '').trim();
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
            await fetch(`${EDU_API_BASE}/edu/leaderboard/award-xp`, {
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
            const res = await fetch(`${EDU_API_BASE}/edu/advice/message`, {
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
        const url = `${EDU_API_BASE}/edu/lessons?lang=${lang}`;
        console.log('[getLessons] fetching:', url);
        const res = await fetch(url, { headers });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`[getLessons] HTTP ${res.status}:`, body.slice(0, 200));
            return [];
        }
        return res.json();
    },

    async getLesson(id, lang = 'en') {
        const token = await getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${EDU_API_BASE}/edu/lessons/${id}?lang=${lang}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch lesson');
        return res.json();
    },

    async completeLesson(id) {
        const token = await getToken();
        const res = await fetch(`${EDU_API_BASE}/edu/lessons/${id}/complete`, {
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
        const res = await fetch(`${EDU_API_BASE}/edu/activity`, { headers });
        if (!res.ok) return [];
        return res.json();
    },
};

export default api;
