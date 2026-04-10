const SCANNER_API_BASE = "https://phishguard-2-sgzd.onrender.com";
const EDU_API_BASE = "https://phishguard-1-8y86.onrender.com";

document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('login-section');
    const scanSection = document.getElementById('scan-section');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const scanBtn = document.getElementById('scan-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const scanInput = document.getElementById('scan-input');
    const resultContainer = document.getElementById('result-container');
    const badge = document.getElementById('classification-badge');
    const confidenceText = document.getElementById('confidence-text');
    const riskFactors = document.getElementById('risk-factors');

    // Check if logged in
    const { token } = await chrome.storage.local.get(['token']);
    if (token) {
        showScanSection();
    }

    loginBtn.onclick = async () => {
        loginBtn.disabled = true;
        try {
            const res = await fetch(`${EDU_API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailInput.value, password: passInput.value })
            });
            const data = await res.json();
            if (data.access_token) {
                await chrome.storage.local.set({ token: data.access_token });
                showScanSection();
            } else {
                const err = document.getElementById('auth-error');
                err.textContent = data.detail || 'Login failed';
                err.style.display = 'block';
            }
        } catch (e) {
            const err = document.getElementById('auth-error');
            err.textContent = 'Server unreachable';
            err.style.display = 'block';
        }
        loginBtn.disabled = false;
    };

    scanBtn.onclick = async () => {
        const text = scanInput.value.trim();
        if (!text) return;

        scanBtn.disabled = true;
        resultContainer.style.display = 'block';
        badge.textContent = 'Scanning...';
        badge.className = 'badge';
        riskFactors.innerHTML = '<div class="risk-item" style="color: grey;">Analyzing payload...</div>';

        try {
            const { token, scanCache } = await chrome.storage.local.get(['token', 'scanCache']);
            const cache = scanCache || {};
            const cacheKey = text;

            let data = cache[cacheKey];

            if (data) {
                console.log('Restored scan from local storage');
            } else {
                const res = await fetch(`${SCANNER_API_BASE}/scan`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ message: text })
                });
                data = await res.json();

                // Save to cache
                cache[cacheKey] = data;
                await chrome.storage.local.set({ scanCache: cache });
            }

            badge.textContent = data.classification;
            badge.classList.add(data.classification.toLowerCase());
            confidenceText.textContent = `${(data.confidence * 100).toFixed(1)}% Confidence`;

            // Display risk factors
            let rfHtml = data.risk_factors.map(f =>
                `<div class="risk-item"><div class="risk-dot"></div><div>${f.detail}</div></div>`
            ).join('');

            riskFactors.innerHTML = rfHtml;

            // Dynamic Advice fetching
            if (data.classification !== 'Safe') {
                const adviceHtml = `<div class="risk-item" style="margin-top: 10px; font-weight: bold;">Generating defense strategy...</div>`;
                riskFactors.innerHTML = rfHtml + adviceHtml;

                try {
                    const adviceRes = await fetch(`${EDU_API_BASE}/advice/message`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ message: text, classification: data.classification, lang: 'en' })
                    });

                    if (adviceRes.ok) {
                        const adviceData = await adviceRes.json();
                        if (adviceData && adviceData.length > 0) {
                            const dynamicAdviceHtml = `
                            <div style="margin-top: 12px; border-top: 1px solid #334; padding-top: 8px;">
                                <div style="font-size: 11px; color: #8BA1C5; text-transform: uppercase; font-weight: 800; margin-bottom: 6px;">Defense Strategy</div>
                                ${adviceData.slice(0, 2).map(a => `
                                    <div class="risk-item" style="margin-bottom: 6px; align-items: flex-start;">
                                        <div class="risk-dot" style="background-color: #0EBA81; margin-top: 4px;"></div>
                                        <div>
                                            <div style="font-weight: bold; color: #FFF; font-size: 12px;">${a.title}</div>
                                            <div style="color: #8BA1C5; font-size: 11px;">${a.detail}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>`;
                            riskFactors.innerHTML = rfHtml + dynamicAdviceHtml;
                        } else {
                            riskFactors.innerHTML = rfHtml;
                        }
                    } else {
                        riskFactors.innerHTML = rfHtml;
                    }
                } catch (adviceErr) {
                    console.error("Advice fetch failed", adviceErr);
                    riskFactors.innerHTML = rfHtml;
                }
            }

        } catch (e) {
            badge.textContent = 'Error';
            confidenceText.textContent = 'Could not reach scanner';
            riskFactors.innerHTML = '';
        }
        scanBtn.disabled = false;
    };

    logoutBtn.onclick = async () => {
        await chrome.storage.local.remove(['token']);
        loginSection.style.display = 'block';
        scanSection.style.display = 'none';
        resultContainer.style.display = 'none';
    };

    function showScanSection() {
        loginSection.style.display = 'none';
        scanSection.style.display = 'block';
    }
});
