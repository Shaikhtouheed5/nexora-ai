/**
 * src/data/quizzes/day-3.js
 * Social Engineering — 10 questions
 */

export const day3Quiz = {
  lessonId: 'day-3',
  category: 'SOCIAL ENGINEERING',
  questions: [
    {
      id: 1,
      question: 'What is social engineering in cybersecurity?',
      options: [
        'Engineering software to be more socially accessible',
        'Manipulating people psychologically to reveal confidential information or perform actions',
        'Designing network infrastructure for social media companies',
        'Using machine learning to analyse social media data',
      ],
      correctIndex: 1,
      explanation:
        'Social engineering attacks exploit human psychology rather than technical vulnerabilities. Instead of hacking software, attackers hack people — using trust, fear, urgency, or authority to manipulate victims into revealing passwords, clicking malicious links, or granting access.',
    },
    {
      id: 2,
      question: 'What is "pretexting" in a social engineering attack?',
      options: [
        'Sending a text message containing a malware link',
        'Creating a fabricated scenario (pretext) to gain a victim\'s trust and extract information',
        'Pre-loading fake text on a phishing website before the victim arrives',
        'Using a text-to-speech system to impersonate a bank over the phone',
      ],
      correctIndex: 1,
      explanation:
        'In pretexting, an attacker invents a believable backstory — impersonating an auditor, IT technician, or law enforcement officer — to justify their unusual request. For example: "I\'m from IT security and need your VPN credentials to fix a critical server issue affecting your account."',
    },
    {
      id: 3,
      question: 'An unknown person tailgates an employee through a secured door without using their own badge. This is called:',
      options: [
        'Shoulder surfing',
        'Baiting',
        'Tailgating (physical piggybacking)',
        'Dumpster diving',
      ],
      correctIndex: 2,
      explanation:
        'Tailgating is a physical social engineering technique where an attacker gains access to a restricted area by following an authorised person through a door before it closes. It exploits people\'s natural reluctance to confront strangers or seem rude by demanding to see a badge.',
    },
    {
      id: 4,
      question: 'Which psychological principle do most social engineering attacks exploit?',
      options: [
        'Cognitive dissonance and long-term memory',
        'Authority, urgency, scarcity, and social proof',
        'Pattern recognition and visual perception',
        'Analytical thinking and deliberate reasoning',
      ],
      correctIndex: 1,
      explanation:
        'Social engineers exploit cognitive biases: authority ("I\'m your CEO — do this now"), urgency ("Your account closes in 1 hour"), scarcity ("Only you can access this data"), and social proof ("Your colleague already did this"). These shortcuts bypass rational thinking and trigger reflexive compliance.',
    },
    {
      id: 5,
      question: 'What is "baiting" as a social engineering technique?',
      options: [
        'Sending threatening emails to provoke an emotional reaction',
        'Offering something enticing (free USB drive, download, prize) to lure victims into a trap',
        'Gradually escalating requests to normalise compliance',
        'Impersonating a trusted vendor to harvest credentials',
      ],
      correctIndex: 1,
      explanation:
        'Baiting exploits human curiosity and greed. A classic example: leaving infected USB drives labelled "Salary Confidential Q4" in a company car park. Employees who plug them in out of curiosity unknowingly execute malware. Online baiting uses fake free downloads, movies, or prizes to deliver payloads.',
    },
    {
      id: 6,
      question: 'An attacker calls an employee pretending to be from the bank\'s fraud department, asking them to "verify" their card number and CVV. This is an example of:',
      options: [
        'Smishing',
        'Vishing (voice phishing)',
        'Whaling',
        'Watering-hole attack',
      ],
      correctIndex: 1,
      explanation:
        'Vishing uses phone calls to social-engineer victims. Attackers spoof caller IDs to display legitimate bank numbers, use professional scripts, and create urgency ("fraudulent activity on your account") to pressure victims into revealing financial details. Legitimate banks never ask for your full card number or CVV over the phone.',
    },
    {
      id: 7,
      question: 'What is a "watering-hole attack"?',
      options: [
        'Poisoning a shared water supply to cause physical harm',
        'Compromising a website frequently visited by a target group to infect their devices',
        'Flooding a server with traffic to take it offline',
        'Intercepting data at a shared Wi-Fi hotspot',
      ],
      correctIndex: 1,
      explanation:
        'In a watering-hole attack, attackers identify websites frequently visited by their targets (industry forums, news sites) and inject malware. When victims visit the compromised site, their devices are infected — without any interaction from the victim. This is especially effective against well-defended organisations whose users are too security-aware to click phishing links.',
    },
    {
      id: 8,
      question: 'Which of the following BEST defends against social engineering attacks?',
      options: [
        'Installing antivirus software on all endpoints',
        'Using a firewall to block inbound connections',
        'Regular security awareness training combined with verification procedures',
        'Encrypting all internal emails',
      ],
      correctIndex: 2,
      explanation:
        'Social engineering targets humans, not machines — so technical controls alone are insufficient. Security awareness training helps employees recognise manipulation tactics, while verification procedures (e.g., calling back on a known number, two-person approval for wire transfers) ensure that even a successfully manipulated employee cannot act unilaterally.',
    },
    {
      id: 9,
      question: 'What is "whaling" in the context of social engineering?',
      options: [
        'Mass phishing campaigns targeting thousands of random users',
        'Highly targeted attacks against senior executives (CEO, CFO, board members)',
        'Attacks using oversized email attachments to crash mail servers',
        'Physical surveillance of an executive\'s travel schedule',
      ],
      correctIndex: 1,
      explanation:
        'Whaling is spear phishing aimed at high-value "big fish" — C-suite executives, board members, or wealthy individuals. Attackers invest significant research to craft highly personalised messages. Executives are prime targets because they have authority to approve large wire transfers and access to sensitive strategic information.',
    },
    {
      id: 10,
      question: 'An email from your CEO asks you to urgently wire $50,000 to a new vendor before end of day. What is the CORRECT response?',
      options: [
        'Process it immediately — the CEO is a trusted authority',
        'Reply to the email asking for more details before transferring',
        'Verify the request by calling the CEO directly on their known phone number',
        'Forward the email to finance and let them decide',
      ],
      correctIndex: 2,
      explanation:
        'This is a classic Business Email Compromise (BEC) / whaling scenario. Never act on urgent financial requests from email alone — even if the email looks completely legitimate. Always verify out-of-band using a phone number you already have (not one provided in the email). The few minutes spent on a call can prevent catastrophic financial losses.',
    },
  ],
};
