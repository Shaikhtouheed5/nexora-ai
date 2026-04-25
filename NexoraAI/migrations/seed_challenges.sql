-- Seed: 10 daily challenges
-- Types: scan (4), quiz (4), scenario (2) — all difficulties covered

INSERT INTO public.challenges (title, description, type, difficulty, xp_reward)
VALUES
    (
        'Suspicious Bank SMS',
        'You receive this message: "URGENT: Your SBI account has been temporarily blocked. Verify your KYC immediately at http://sbi-kyc-update.xyz or your account will be closed within 24 hours." Scan this text and identify the threat indicators.',
        'scan',
        'easy',
        10
    ),
    (
        'Shortened URL Trap',
        'A WhatsApp contact forwards a message: "Congratulations! You have been selected for a free Jio recharge. Claim now: https://bit.ly/jio-free-5gb". Scan the message. What makes this a high-risk phishing attempt?',
        'scan',
        'medium',
        25
    ),
    (
        'CEO Wire Transfer Request',
        'You receive an email from ceo@company-corp.net (your CEO''s real domain is company.com): "I''m in a board meeting and can''t call. Please wire ₹4,50,000 to this vendor account immediately — I''ll explain later. Keep this confidential." Scan and classify this business email compromise attempt.',
        'scan',
        'hard',
        50
    ),
    (
        'Fake Job Offer',
        'A recruiter messages you on LinkedIn: "We found your profile impressive! Remote job, ₹80,000/month. No experience needed. Click here to apply: http://hirejobs-india.tk/apply and submit your Aadhaar and PAN card to complete registration." Scan this message for credential-harvesting signals.',
        'scan',
        'medium',
        25
    ),
    (
        'Phishing Red Flags Quiz',
        'Which THREE of the following are reliable red flags that an email is a phishing attempt? (A) The sender''s display name matches your bank but the actual address is support@bank-alerts.ru (B) The email uses your first name in the greeting (C) There is extreme urgency: "Act within 2 hours or lose access" (D) Links show a different domain when you hover over them (E) The email contains the bank''s official logo.',
        'quiz',
        'easy',
        10
    ),
    (
        'Spot the Spoofed URL',
        'A user clicks a link in an email. Which of these URLs is the legitimate HDFC Bank login page? (A) https://hdfcbank.com/login (B) https://hdfc-bank-login.com/secure (C) https://login.hdfcbank.com.verify-account.net (D) https://hdfcb4nk.com/netbanking. Explain why each fake URL uses a specific deception technique.',
        'quiz',
        'medium',
        25
    ),
    (
        'Social Engineering Vectors',
        'An attacker wants to gain access to an employee''s corporate account without any malware. Rank these social engineering techniques from most to least effective, and explain the psychological principle each exploits: (1) Pretexting as IT support (2) Tailgating into a secure office (3) Sending a USB drive labelled "Salary Data Q4" to the car park (4) Spear-phishing with the target''s manager''s name.',
        'quiz',
        'hard',
        50
    ),
    (
        'Two-Factor Authentication Bypass',
        'An attacker already has your password. Which attack successfully bypasses SMS-based two-factor authentication? (A) Brute-forcing the 6-digit OTP (B) SIM-swapping your mobile number to their device (C) Replaying an expired OTP token (D) SQL injection on the login form. Explain why SMS OTP is considered a weak second factor.',
        'quiz',
        'medium',
        25
    ),
    (
        'The IT Help Desk Call',
        'You are working from home. You receive a call: "Hi, this is Rahul from IT support. We detected unusual login activity on your account from an overseas IP. To secure your account right now, I need to verify your identity — please share your employee ID and current VPN password, and I''ll reset it immediately." What do you do, and what social engineering principle is the caller exploiting?',
        'scenario',
        'easy',
        10
    ),
    (
        'Insider Threat: The Urgent Email',
        'You are the finance manager. At 6 PM on a Friday, you receive an email from your CFO''s exact address: "We are closing a confidential acquisition tonight. Legal requires an immediate ₹12 lakh transfer to the escrow account below before midnight. Do not discuss this with anyone — regulatory sensitivity. Wire details attached." Your CFO is travelling and is unreachable by phone. Walk through every verification step you take before deciding whether to act.',
        'scenario',
        'hard',
        50
    );
