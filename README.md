# Explainable Phishing Risk Awareness and Financial Impact Assessment System

> **Abstract** : Phishing continues to be a very common cyber attack and has a significant impact, especially on non-technical users who find it difficult to estimate the danger of a phishing attack. Though existing solutions are very keen on maximizing the accuracy of automated detection, they prove inefficient in practical implementation due to the constantly varying nature of phishing attacks and a lack of understanding between users and attacks. The current project will introduce the Phishing Risk Awareness and Impact Assessment System. This tool assesses messages and URLs for the contextual risk score (defined as Low, Medium, and High) based on observable factors such as suspicious links, inconsistencies in the sending party, urgency tactics, and the domain reputation. In contrast to other security products on the market, it also gives users an understandable description of the mail they flagged as risky. Financial and Security Impact Mapping stands out as a crucial feature as it enables a translation of phishing attacks to possible outcomes like account take over, UPI fraud, and misuse of personal data. Furthermore, user awareness risk adjustment is incorporated in this system as risk representation is adaptable without considering personal and sensitive data. As it prioritizes transparency, interpretability, and well-informed decision-making over automatic blocking, it is a useful and justifiable assistive security component for the common use.

### Project Members
1. SHAIKH TOUHEED FAROOQUE [ Team Leader ]
2. TUMBI MOHAMED HAMZA SUEB
3. ABDUL GHANI IFTIKHAR AHMAD
4. PATIL RITESH UMESH

### Project Guides
1. PROF. VIJAY SHANKER [ Primary Guide ]

### Deployment Steps
Please follow the below steps to run this project.

**Backend (FastAPI)**
1. Clone the repository: `git clone https://github.com/Shaikhtouheed5/nexora-ai`
2. Navigate to backend: `cd NexoraAI`
3. Install dependencies: `pip install -r requirements.txt`
4. Create `.env` file and add your API keys (Gemini, Groq, VirusTotal, HIBP, Supabase)
5. Start the server: `uvicorn main:app --reload`

**Web Frontend (React + Vite)**
1. Navigate to frontend: `cd NexoraAI_Web`
2. Install dependencies: `npm install`
3. Create `.env` file with Supabase and backend URL
4. Start development server: `npm run dev`

**Mobile App (React Native + Expo)**
1. Navigate to mobile: `cd NexoraAI_Frontend`
2. Install dependencies: `npm install`
3. Start Expo: `npx expo start`
4. Scan QR code with Expo Go app

**Chrome Extension**
1. Navigate to: `cd nexora-extension`
2. Open Chrome → `chrome://extensions`
3. Enable Developer Mode → Click "Load unpacked"
4. Select the `nexora-extension` folder

### Subject Details
- Class : SE (AI&DS) Div A - 2025-2026
- Subject : Mini Project (MP)
- Project Type : Mini Project

### Platform, Libraries and Frameworks used
1. [React + Vite](https://vitejs.dev) - Web Frontend
2. [React Native + Expo](https://expo.dev) - Mobile App
3. [FastAPI](https://fastapi.tiangolo.com) - Python Backend
4. [Supabase](https://supabase.com) - Authentication + PostgreSQL Database
5. [Upstash Redis](https://upstash.com) - Caching Layer
6. [Google Gemini 2.5 Pro](https://deepmind.google/technologies/gemini) - Primary LLM
7. [Groq LLaMA 3.3 70B](https://groq.com) - Secondary LLM
8. [ElevenLabs](https://elevenlabs.io) - AI Voice Tutor
9. [Google Safe Browsing API](https://safebrowsing.google.com) - URL Threat Intelligence
10. [VirusTotal API](https://virustotal.com) - File & URL Scanning
11. [Have I Been Pwned API](https://haveibeenpwned.com) - Breach Detection
12. [Chrome Extensions API](https://developer.chrome.com/docs/extensions) - Browser Extension

### Dataset Used
1. [PhishTank Dataset](https://phishtank.org) - Phishing URL samples
2. [OpenPhish Feed](https://openphish.com) - Real-time phishing intelligence
3. [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) - SMS phishing samples

### References
- [https://phishtank.org](https://phishtank.org)
- [https://openphish.com](https://openphish.com)
- [https://haveibeenpwned.com/API/v3](https://haveibeenpwned.com/API/v3)
- [https://developers.virustotal.com/reference](https://developers.virustotal.com/reference)
- [https://safebrowsing.google.com](https://safebrowsing.google.com)
- [https://archive.ics.uci.edu/dataset/228/sms+spam+collection](https://archive.ics.uci.edu/dataset/228/sms+spam+collection)
