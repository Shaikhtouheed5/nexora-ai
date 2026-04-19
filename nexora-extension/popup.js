// ── Config ───────────────────────────────────────────────────────────────────
// Fix #1: Updated to NexoraAI production URL (was phishguard-*.onrender.com)
const SCANNER_API_BASE = "https://nexora-scanner.onrender.com";
const EDU_API_BASE     = "https://nexora-scanner.onrender.com";

// Fix #2: Supabase client (loaded via CDN in popup.html)
const SUPABASE_URL      = "https://oyvyeutjidgafipmgixz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dnlldXRqaWRnYWZpcG1naXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTEzNTUsImV4cCI6MjA5MDcyNzM1NX0.xrkl4iRMc7kjfOkPIZr6xF06izPr-0ysqaruAOP7kwg";
const supabaseClient    = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fix #7: Cache TTL — 30 minutes in milliseconds
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Main ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const loginSection    = document.getElementById('login-section');
    const scanSection     = document.getElementById('scan-section');
    const emailInput      = document.getElementById('email');
    const passInput       = document.getElementById('password');
    const loginBtn        = document.getElementById('login-btn');
    const scanBtn         = document.getElementById('scan-btn');
    const logoutBtn       = document.getElementById('logout-btn');
    const scanInput       = document.getElementById('scan-input');
    const resultContainer = document.getElementById('result-container');
    const badge           = document.getElementById('classification-badge');
    const riskScoreText   = document.getElementById('risk-score-text');
    const explanationText = document.getElementById('explanation-text');
    const riskFactors     = document.getElementById('risk-factors');

    // ── Check session on load ─────────────────────────────────────────────────
    const { token } = await chrome.storage.local.get(['token']);
    if (token) {
        showScanSection();
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    // Fix #2: Use Supabase signInWithPassword instead of old /auth/login endpoint
    loginBtn.onclick = async () => {
        loginBtn.disabled = true;
        const authError = document.getElementById('auth-error');
        authError.style.display = 'none';

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email:    emailInput.value.trim(),
                password: passInput.value,
            });

            if (error) {
                authError.textContent = error.message || 'Login failed';
                authError.style.display = 'block';
            } else if (data.session?.access_token) {
                await chrome.storage.local.set({ token: data.session.access_token });
                showScanSection();
            } else {
                authError.textContent = 'No session returned — try again';
                authError.style.display = 'block';
            }
        } catch (e) {
            authError.textContent = 'Server unreachable: ' + e.message;
            authError.style.display = 'block';
        }

        loginBtn.disabled = false;
    };

    // ── Scan ──────────────────────────────────────────────────────────────────
    scanBtn.onclick = async () => {
        const text = scanInput.value.trim();
        if (!text) return;

        scanBtn.disabled = true;
        resultContainer.style.display = 'block';
        badge.textContent = 'Scanning...';
        badge.className = 'badge';
        riskScoreText.textContent = '';
        explanationText.style.display = 'none';
        riskFactors.innerHTML = '<div class="risk-item" style="color: grey;">Analyzing payload...</div>';
        // Cold-start warning — shown after 5s, cleared when result arrives
        let coldStartTimer = null;

        try {
            // Always fetch a fresh (auto-refreshed) token from Supabase first.
            // Falls back to chrome.storage.local only if getSession() returns null.
            let token;
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (sessionData?.session?.access_token) {
                token = sessionData.session.access_token;
                // Keep storage in sync so other reads stay current
                await chrome.storage.local.set({ token });
            } else {
                const stored = await chrome.storage.local.get(['token']);
                token = stored.token;
            }

            if (!token) {
                badge.textContent         = 'Not logged in';
                riskScoreText.textContent = '';
                riskFactors.innerHTML     = '<div class="risk-item" style="color: var(--malicious);">Please log in to scan messages.</div>';
                scanBtn.disabled = false;
                return;
            }

            const { scanCache } = await chrome.storage.local.get(['scanCache']);
            const cache    = scanCache || {};
            const cacheKey = text;

            // Fix #7: check cache with TTL expiry (30 min)
            let data = null;
            const cached = cache[cacheKey];
            if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
                console.log('Cache hit — result is fresh');
                data = cached.result;
            }

            if (!data) {
                // 60-second timeout via AbortController (handles Render cold starts)
                const controller = new AbortController();
                const hardTimeout = setTimeout(() => controller.abort(), 60_000);

                // After 5s with no response, warn the user about cold start
                coldStartTimer = setTimeout(() => {
                    riskFactors.innerHTML =
                        '<div class="risk-item" style="color: #8BA1C5;">⏳ Waking up scanner — Render free tier may take up to 60s on first request. Please wait…</div>';
                }, 5_000);

                let res;
                try {
                    res = await fetch(`${SCANNER_API_BASE}/scan`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ content: text, content_type: "sms" }),
                        signal: controller.signal,
                    });
                } finally {
                    clearTimeout(hardTimeout);
                    clearTimeout(coldStartTimer);   // clear warning once responded
                    coldStartTimer = null;
                }

                if (!res.ok) {
                    throw new Error(`Scanner returned HTTP ${res.status}`);
                }
                data = await res.json();

                // Fix #7: Write to cache with timestamp
                cache[cacheKey] = { result: data, timestamp: Date.now() };
                await chrome.storage.local.set({ scanCache: cache });
            }

            // Normalize all result fields — backend may return numbers, nulls, or
            // different field names depending on which endpoint responded.
            const classification = String(data.classification || data.data?.riskLevel || 'Unknown');
            const riskLevel      = String(data.risk_level || data.riskLevel || data.data?.riskLevel || 'Unknown');
            const riskScore      = data.risk_score != null ? Number(data.risk_score) : (data.data?.score != null ? Number(data.data.score) : 0);
            const rawConfidence  = data.confidence != null ? Number(data.confidence) : null;
            const confidencePct  = rawConfidence != null
                ? String(Math.round((rawConfidence > 1 ? rawConfidence : rawConfidence * 100))) + '%'
                : 'N/A';
            const explanation    = data.explanation || data.reason || data.data?.explanation || 'No details available';
            const redFlags       = Array.isArray(data.red_flags) ? data.red_flags
                                 : Array.isArray(data.flags)     ? data.flags
                                 : Array.isArray(data.data?.reasons) ? data.data.reasons
                                 : [];

            // Render badge
            badge.textContent = classification.toUpperCase();
            badge.className   = 'badge ' + classification.toLowerCase().replace(/\s+/g, '-');

            // Render risk score + confidence
            riskScoreText.textContent = `Risk: ${riskLevel} • Score: ${Math.round(riskScore)}% • Confidence: ${confidencePct}`;

            // Render explanation
            explanationText.textContent = explanation;
            explanationText.style.display = 'block';

            // Render flags
            if (redFlags.length > 0) {
                riskFactors.innerHTML = redFlags.map(f =>
                    `<div class="risk-item"><div class="risk-dot"></div><div>${typeof f === 'string' ? f : (f.detail || f.reason || JSON.stringify(f))}</div></div>`
                ).join('');
            } else {
                riskFactors.innerHTML = '<div class="risk-item" style="color: grey;">No specific flags detected.</div>';
            }

            // Fetch defense advice if not safe
            if (classification.toLowerCase() !== 'safe' && classification.toLowerCase() !== 'unknown') {
                const adviceHtml = `<div class="risk-item" style="margin-top: 10px; font-weight: bold;">Generating defense strategy...</div>`;
                riskFactors.innerHTML += adviceHtml;

                try {
                    const adviceRes = await fetch(`${EDU_API_BASE}/advice/message`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ message: text, classification, lang: 'en' })
                    });

                    if (adviceRes.ok) {
                        const adviceData = await adviceRes.json();
                        const items      = Array.isArray(adviceData) ? adviceData : adviceData.advice ?? [];

                        if (items.length > 0) {
                            const currentHtml = riskFactors.innerHTML.replace(/<div class="risk-item"[^>]*>Generating.*?<\/div>/, '');
                            const adviceBlock = `
                            <div style="margin-top: 12px; border-top: 1px solid #334; padding-top: 8px;">
                                <div style="font-size: 11px; color: #8BA1C5; text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Defense Strategy</div>
                                ${items.slice(0, 2).map(a => `
                                    <div class="risk-item" style="margin-bottom: 6px; align-items: flex-start;">
                                        <div class="risk-dot" style="background-color: #0EBA81; margin-top: 4px;"></div>
                                        <div>
                                            <div style="font-weight: bold; color: #FFF; font-size: 12px;">${a.title || 'Tip'}</div>
                                            <div style="color: #8BA1C5; font-size: 11px;">${a.detail || a.description || ''}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>`;
                            riskFactors.innerHTML = currentHtml + adviceBlock;
                        } else {
                            // remove "generating" placeholder
                            riskFactors.innerHTML = riskFactors.innerHTML.replace(/<div class="risk-item"[^>]*>Generating.*?<\/div>/, '');
                        }
                    } else {
                        riskFactors.innerHTML = riskFactors.innerHTML.replace(/<div class="risk-item"[^>]*>Generating.*?<\/div>/, '');
                    }
                } catch (adviceErr) {
                    console.error("Advice fetch failed", adviceErr);
                    riskFactors.innerHTML = riskFactors.innerHTML.replace(/<div class="risk-item"[^>]*>Generating.*?<\/div>/, '');
                }
            }

        } catch (e) {
            // Clear any pending cold-start timer if an error fires early
            if (coldStartTimer) { clearTimeout(coldStartTimer); coldStartTimer = null; }

            const isTimeout = e.name === 'AbortError';
            badge.textContent         = isTimeout ? 'Timeout' : 'Error';
            riskScoreText.textContent = isTimeout
                ? 'Scanner did not respond within 60s — try again in a moment'
                : 'Could not reach scanner';
            riskFactors.innerHTML = `<div class="risk-item" style="color: var(--malicious);">${
                isTimeout ? '⏱ Request timed out. Render free tier may still be waking up — please retry.' : e.message
            }</div>`;
        }

        scanBtn.disabled = false;
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    // Fix #8: Clear ALL storage on logout (was: only removing token — scan cache persisted)
    logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut().catch(() => {});
        await chrome.storage.local.clear();        // clears token + scanCache
        loginSection.style.display = 'block';
        scanSection.style.display  = 'none';
        resultContainer.style.display = 'none';
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    function showScanSection() {
        loginSection.style.display = 'none';
        scanSection.style.display  = 'block';
    }
});
