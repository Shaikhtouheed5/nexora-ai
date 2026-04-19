/**
 * src/data/quizzes/day-2.js
 * Password Security — 10 questions
 */

export const day2Quiz = {
  lessonId: 'day-2',
  category: 'PASSWORD SECURITY',
  questions: [
    {
      id: 1,
      question: 'Which of the following is the strongest password?',
      options: [
        'password123',
        'MyDog2019',
        'P@ssw0rd',
        'xK#9mQ$vL2!eRw7n',
      ],
      correctIndex: 3,
      explanation:
        'A strong password is long (16+ characters), random, and mixes uppercase, lowercase, numbers, and special characters. "xK#9mQ$vL2!eRw7n" has no dictionary words, no personal info, and is generated randomly — making it exponentially harder to crack than the others.',
    },
    {
      id: 2,
      question: 'What is a credential stuffing attack?',
      options: [
        'Physically stealing a device to access saved passwords',
        'Using leaked username/password pairs from one breach to log in to other services',
        'Brute-forcing a password by trying every possible combination',
        'Tricking a user into typing their password on a fake website',
      ],
      correctIndex: 1,
      explanation:
        'Credential stuffing exploits password reuse. Attackers take billions of leaked credentials from past breaches (available on dark-web markets) and automatically try them against other sites. If you use the same password on multiple services, one breach compromises them all.',
    },
    {
      id: 3,
      question: 'Why should you never reuse the same password across multiple sites?',
      options: [
        'It makes passwords harder to remember',
        'If one site is breached, all your other accounts become vulnerable',
        'Websites automatically detect and block repeated passwords',
        'Password managers do not support reused passwords',
      ],
      correctIndex: 1,
      explanation:
        'Password reuse is one of the most dangerous security habits. If an attacker obtains your credentials from one leaked database, they will systematically try that exact username/password combination across email providers, banks, and social media — a process called credential stuffing.',
    },
    {
      id: 4,
      question: 'What is the primary purpose of a password manager?',
      options: [
        'To share passwords securely with family members',
        'To generate and store unique, complex passwords for every account',
        'To reset forgotten passwords automatically',
        'To scan websites for phishing before entering credentials',
      ],
      correctIndex: 1,
      explanation:
        'A password manager generates and stores a different, cryptographically strong password for every account you have. You only need to remember one master password. This eliminates reuse and ensures every password is long and random — things humans are notoriously bad at doing manually.',
    },
    {
      id: 5,
      question: 'What is a brute-force attack on passwords?',
      options: [
        'Guessing a password by watching someone type',
        'Systematically trying every possible character combination until the password is found',
        'Social engineering a helpdesk agent to reveal a password',
        'Intercepting network traffic to capture a password in transit',
      ],
      correctIndex: 1,
      explanation:
        'In a brute-force attack, software automatically tries every possible combination of characters. Short passwords (under 8 characters) can be cracked in seconds with modern hardware. Adding length is far more effective than complexity: "correct horse battery staple" (28 chars) beats "P@ss1!" (6 chars) every time.',
    },
    {
      id: 6,
      question: 'Which multi-factor authentication (MFA) method is considered the most secure?',
      options: [
        'One-time code sent via SMS',
        'Security key (hardware token like YubiKey)',
        'Security question (e.g., mother\'s maiden name)',
        'Email verification link',
      ],
      correctIndex: 1,
      explanation:
        'Hardware security keys use public-key cryptography and are phishing-resistant — they only work on the legitimate domain they were registered with. SMS codes can be intercepted via SIM-swapping attacks. Security questions are often guessable from social media. Email links depend on email account security.',
    },
    {
      id: 7,
      question: 'What is a dictionary attack in the context of password cracking?',
      options: [
        'An attack targeting multilingual users',
        'Trying passwords from a pre-built list of common words and known passwords',
        'Decrypting stolen passwords using the attacker\'s own dictionary file',
        'A phishing attack disguised as a language-learning app',
      ],
      correctIndex: 1,
      explanation:
        'Dictionary attacks use pre-compiled wordlists containing millions of common passwords, words, and variations (like "passw0rd" or "admin123"). They are far faster than brute-force because most users choose predictable passwords. Adding deliberate randomness makes your password resistant to dictionary attacks.',
    },
    {
      id: 8,
      question: 'An employee receives a call from "IT support" asking for their password to fix an account issue. What should they do?',
      options: [
        'Provide it — IT support always needs access to fix issues',
        'Give a temporary password and then change it afterward',
        'Refuse — legitimate IT staff never need your password',
        'Ask the caller to email the request first',
      ],
      correctIndex: 2,
      explanation:
        'Legitimate IT and security professionals never need your password to do their job — they have administrative tools that bypass user credentials. Asking for a password is a major red flag for a vishing (voice phishing) attack. Always refuse and report the call to your actual IT department.',
    },
    {
      id: 9,
      question: 'How does salting a password hash improve security?',
      options: [
        'It encrypts the password before it reaches the server',
        'It adds a random value to each password before hashing, making precomputed rainbow-table attacks useless',
        'It automatically increases the password length to meet complexity requirements',
        'It blocks brute-force attempts by locking accounts after failed logins',
      ],
      correctIndex: 1,
      explanation:
        'A salt is a unique random string added to a password before hashing. Even if two users have identical passwords, their hashes will differ. This defeats rainbow-table attacks, where attackers precompute hashes for millions of common passwords. Without salts, leaked hash databases can be cracked offline at massive scale.',
    },
    {
      id: 10,
      question: 'Which practice MOST effectively protects an account if its password is leaked?',
      options: [
        'Using a password over 20 characters long',
        'Changing the password every 30 days',
        'Enabling multi-factor authentication (MFA)',
        'Using a different browser for sensitive sites',
      ],
      correctIndex: 2,
      explanation:
        'MFA adds a second verification layer that an attacker cannot bypass even with the correct password. A leaked password alone is useless if the attacker also needs a hardware key or one-time code from your device. Regular password rotation is less effective unless combined with MFA — and a 20-character password is still useless once leaked.',
    },
  ],
};
