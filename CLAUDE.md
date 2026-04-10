# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NexoraAI/Nexify is an AI-powered phishing detection and cybersecurity education platform. It is a monorepo with four distinct apps:

- **NexoraAI_Web** — React/Vite web dashboard (lessons, quizzes, leaderboard)
- **NexoraAI_Frontend** — React Native/Expo mobile app (iOS/Android)
- **NexoraAI/** — Python FastAPI backend split into two microservices:
  - `edu/` — Education content service (port 8001)
  - `scanner/` — Phishing detection/ML service (port 8002)
- **nexora-extension** — Chrome extension (Manifest V3, no build step)

## Commands

### NexoraAI_Web (React + Vite)
```bash
cd NexoraAI_Web
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### NexoraAI_Frontend (React Native + Expo)
```bash
cd NexoraAI_Frontend
npm install
npm start          # Expo dev server (interactive)
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run web version
```

### Backend — Edu Service (FastAPI, port 8001)
```bash
cd NexoraAI/edu
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
# OR via Docker:
docker-compose up
```

### Backend — Scanner Service (FastAPI, port 8002)
```bash
cd NexoraAI/scanner
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
# OR via Docker:
docker-compose up
```

API docs available at `/docs` (Swagger) for both services.

## Architecture

### Frontend (NexoraAI_Web)
- React 19 + Vite 7 + React Router DOM 7
- Supabase JS for auth and data
- i18next for internationalization (en, de, ar, bn, and more)
- Lucide icons, Tailwind CSS

### Mobile (NexoraAI_Frontend)
- Expo 54 + Expo Router for file-based navigation
- NativeWind (Tailwind for React Native)
- Supabase JS for auth and data
- React Native Reanimated + Gesture Handler
- Expo Notifications and Auth Session

### Backend Microservices
Both services share the same patterns:
- **FastAPI** async Python 3.11
- **Supabase** for auth and PostgreSQL database
- **Redis** for caching and session management
- **JWT/JWE** (python-jose + cryptography) for token handling
- **Argon2** for password hashing

The **scanner** service additionally uses:
- XGBoost + scikit-learn (ML models for phishing detection)
- BeautifulSoup4 for URL/page scraping
- Groq API for LLM analysis

The **edu** service additionally uses:
- Groq API for AI-generated lesson content

### Database
- Supabase (PostgreSQL) — used by all apps
- SQL migrations live in `NexoraAI/` root (leaderboard views, OTP logic, schema updates)

### Chrome Extension
- Manifest V3, vanilla JS — no build step
- Load as unpacked extension in Chrome
- Entry points: `popup.html`, `popup.js`, `popup.css`

## Key Environment Variables

Each app requires its own `.env` file (not committed). Expected variables include Supabase project URL/anon key, and backend-specific keys (Groq API key, Redis URL, JWT secrets).
