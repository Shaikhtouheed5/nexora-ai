/**
 * src/data/quizzes/day-1.js
 * Introduction to Phishing — 10 questions
 */

export const day1Quiz = {
  lessonId: 'day-1',
  category: 'INTRODUCTION TO PHISHING',
  questions: [
    {
      id: 1,
      question: 'What is phishing?',
      options: [
        'A type of outdoor sport involving fishing rods',
        'A cyberattack that uses fake emails to steal sensitive data',
        'A software tool used for network scanning',
        'A method to speed up internet connections',
      ],
      correctIndex: 1,
      explanation:
        'Phishing is a cyberattack where criminals impersonate trusted entities via fake emails, messages, or websites to trick victims into revealing sensitive data like passwords or credit card numbers. The name is a play on "fishing" — attackers cast a wide net hoping someone takes the bait.',
    },
    {
      id: 2,
      question: 'Which of the following is a common sign of a phishing email?',
      options: [
        'The email comes from a known colleague',
        'The email has proper grammar and no urgency',
        "The sender address has a misspelled domain like 'paypa1.com'",
        'The email was sent during business hours',
      ],
      correctIndex: 2,
      explanation:
        "Phishers often register domains that look almost identical to real ones — swapping letters (paypa1.com instead of paypal.com) or adding words (paypal-secure.com). Always inspect the full sender address carefully before clicking any link or attachment.",
    },
    {
      id: 3,
      question:
        'What should you do if you receive a suspicious email asking for your password?',
      options: [
        'Reply with your password to verify your identity',
        'Click the link to see if it\'s real',
        'Delete it and report it to your IT team',
        'Forward it to your friends to warn them',
      ],
      correctIndex: 2,
      explanation:
        'Legitimate organisations never ask for your password via email. Clicking a link, even just to "check", can silently load malware or phishing pages. Reporting it to IT allows security teams to block the sender and protect the whole organisation.',
    },
    {
      id: 4,
      question: 'Phishing attacks most commonly arrive via:',
      options: [
        'Physical mail',
        'Email',
        'Phone calls only',
        'Bluetooth connections',
      ],
      correctIndex: 1,
      explanation:
        'Email remains the number-one delivery channel for phishing because it is cheap, scalable, and allows attackers to craft convincing imitations of trusted brands. While SMS phishing (smishing) and voice phishing (vishing) also exist, email is far more prevalent.',
    },
    {
      id: 5,
      question: "What is 'spear phishing'?",
      options: [
        'A fishing technique used in rivers',
        'A random mass phishing email sent to millions',
        'A targeted phishing attack aimed at a specific person or organization',
        'A type of malware that spreads via USB',
      ],
      correctIndex: 2,
      explanation:
        'Spear phishing attacks are highly personalised — attackers research their target (LinkedIn, social media, company websites) to craft messages that appear genuinely relevant. They are far more likely to succeed than generic bulk phishing emails.',
    },
    {
      id: 6,
      question: 'Which of these URLs is most likely a phishing link?',
      options: [
        'https://google.com/accounts',
        'https://accounts.google.com',
        'https://google-accounts-verify.com',
        'https://mail.google.com',
      ],
      correctIndex: 2,
      explanation:
        'The domain google-accounts-verify.com is NOT owned by Google — the actual domain here is google-accounts-verify.com, not google.com. Attackers exploit the fact that people read URLs left-to-right and miss the real domain. Always check the root domain before the first slash.',
    },
    {
      id: 7,
      question:
        "An email says 'Your account will be SUSPENDED in 24 hours — Act NOW!' This is an example of:",
      options: [
        'A legitimate security warning',
        'A urgency tactic used in phishing attacks',
        'A standard password reset email',
        'A promotional marketing email',
      ],
      correctIndex: 1,
      explanation:
        'Creating a sense of urgency or fear is one of the oldest social engineering tricks. When you feel rushed, you are less likely to think critically. Legitimate services will never threaten immediate suspension in an unsolicited email — always verify through official channels.',
    },
    {
      id: 8,
      question: 'What does hovering over a link in an email help you do?',
      options: [
        'Download the file faster',
        'Preview the actual destination URL before clicking',
        'Automatically verify if the link is safe',
        'Report the email to spam',
      ],
      correctIndex: 1,
      explanation:
        'Hovering reveals the true destination URL in your browser\'s status bar or tooltip — the visible link text can say anything, while the actual href points somewhere completely different. If the real URL looks unfamiliar or suspicious, do not click.',
    },
    {
      id: 9,
      question:
        'Which of the following is the safest action when you receive an unexpected email with an attachment?',
      options: [
        'Open it to see what it contains',
        'Forward it to your manager first',
        'Verify with the sender via phone before opening',
        'Save it to your desktop for later',
      ],
      correctIndex: 2,
      explanation:
        'Even if the email appears to be from someone you know, their account may have been compromised. Calling the sender using a phone number you already have (not one in the email) confirms the attachment is genuine before you risk executing malicious code.',
    },
    {
      id: 10,
      question: "What is 'Business Email Compromise' (BEC)?",
      options: [
        'A software bug in email clients',
        'When an attacker impersonates an executive to trick employees into transferring money',
        'A type of email encryption standard',
        'A bulk spam campaign targeting businesses',
      ],
      correctIndex: 1,
      explanation:
        'BEC is a sophisticated scam where attackers impersonate a CEO, CFO, or trusted vendor — sometimes after compromising their actual email account — to request urgent wire transfers or sensitive data. BEC attacks cost businesses billions of dollars each year and are notoriously hard to detect.',
    },
  ],
};
