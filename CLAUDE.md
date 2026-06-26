# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server at http://localhost:3000
npm run build      # Production build → build/
npm test           # Jest watch mode
npm test -- --watchAll=false  # Single test run
```

The app is deployed on Vercel. API endpoints live in `api/` and are served as Vercel serverless functions.

## Architecture

**Stack:** React 19 (Create React App), Firebase (Auth + Firestore + Storage), Anthropic Claude API, Google Calendar API, EmailJS.

### Frontend — `src/`

`src/App.js` is a single large file (~4500 lines) containing all React components. Components are separated by `// ═══` banners:

- `App` — root router: renders `LoginPage`, `AdminPanel`, or `StudentPortal` based on auth state and email
- `LoginPage` — email/password login + password reset via Firebase Auth
- `AdminPanel` — full admin dashboard; tabs include student management, sessions, materials, libreria, bacheca, AI Coach intelligence, referral, chat, and recordings
- `StudentPortal` — student-facing portal; tabs: home, sessioni, moduli, strumenti, coach (AI Coach), bacheca, referral
- `CoachIntelligencePanel` — admin view of a student's AI Coach memory (patterns, linguistic profile, progression)
- `RoleplayAnalisiList` — shows Drive recordings and their AI analysis for a student
- `SessioniCalendario` — fetches and displays booked sessions from Google Calendar via `/api/calendar`
- `MaterialiStudente` — student file upload/download with Firebase Storage
- `BachecaStudente` — Q&A board (announcements + questions)
- `ChatWidget` — real-time admin↔student chat via Firestore
- `AdminReferral`, `AdminGuide`, `AdminMateriali`, `AdminBacheca`, `AdminChat` — dedicated admin panels

`src/AICoach.jsx` — the student-facing AI Coach component. It has 5 intents (analisi trattativa, costruisci pitch, scrivi follow-up, revisione KPI, roleplay obiezione). Uses a RAG system: fetches relevant lessons from `courses/percorso-vendita/lessons` based on student module progress, then sends to `/api/chat`. After each session, calls `/api/coach-memory` to extract and persist behavioral patterns.

`src/ReferralDashboard.jsx` — referral system with tier progression (Bronze→Silver→Gold→Platinum), pipeline tracking per lead, and brochure/post sharing.

`src/firebase.js` — Firebase client initialization (exports `auth`, `db`). A secondary Firebase app instance is created in `App.js` for admin operations that create students without changing the admin's own auth session.

### Backend — `api/` (Vercel serverless functions)

| File | Purpose |
|---|---|
| `api/chat.js` | Proxies requests to Anthropic API (`claude-haiku-4-5-20251001`) |
| `api/coach-memory.js` | Post-session analysis: extracts behavioral patterns + linguistic profile and persists to `aiCoach/{uid}/memoria/` |
| `api/analyze-roleplay.js` | Reads Google Docs session transcripts, scores roleplay performance across 5 areas, updates `aiCoach/{uid}/memoria/roleplay` |
| `api/sync-sessions.js` | Cron-triggered (nightly via cron-job.org): counts Google Calendar sessions per student and updates Firestore |
| `api/calendar.js` | Returns calendar events for a student email (future or past) |
| `api/send-email.js` | Sends emails via EmailJS |

### Firestore Collections

| Collection | Contents |
|---|---|
| `studenti/{uid}` | Student profile, plan, moduli + progress, packages, referral data |
| `aiCoach/{uid}/memoria/patterns` | Behavioral patterns extracted by AI |
| `aiCoach/{uid}/memoria/linguistic` | Linguistic/cognitive profile |
| `aiCoach/{uid}/memoria/meta` | Session counts, human coach notes |
| `aiCoach/{uid}/memoria/roleplay` | Roleplay scores and progression |
| `courses/percorso-vendita/lessons` | Knowledge base for RAG (modulo_num, lezione_num, tags, parole_chiave) |
| `chat/{chatId}/messages` | Real-time admin↔student chat |
| `materiali` | Admin-uploaded files |
| `guide` | Tool guides (strumenti) |
| `libreria` | Resource library |
| `annunci` / `domande` | Bacheca board |
| `referrals` | Referral leads |
| `referralPost` / `referralBrochure` | Shared marketing content |
| `notifiche/{uid}` | Per-student notifications |
| `richieste` | Student requests/offers |
| `recensioni` | Student reviews |

### Required Environment Variables (Vercel)

- `ANTHROPIC_API_KEY` — Anthropic API key
- `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_CALENDAR_ID` — Google service account for Calendar
- `GOOGLE_SERVICE_ACCOUNT` — Firebase Admin SDK credentials (JSON or base64)
- `SYNC_SECRET_TOKEN` — Auth token for the `/api/sync-sessions` cron endpoint

### Design System

Both `App.js` and `AICoach.jsx` define a local `C` object with the brand color palette (dark theme: `bg: "#080B10"`, `surface: "#0E1318"`, `card: "#121820"`). All inline styles use this palette. The `glow()` helper generates CSS `box-shadow` glow effects.

### Admin Identity

`ADMIN_EMAIL = "emanuela@mindsell.it"` — the app branches on this email at root: any other authenticated user goes to `StudentPortal`.

## Stato attuale

- Registrazioni sessioni migrate da Bunny a Google Drive ✓
- Componente `SessionRecordings` già implementato ✓
- GitHub autenticato come `fiorenzaemanuela-source` ✓
- MCP connessi: Vercel, Google Drive, GitHub, Canva, Gamma ✓
- **Prossime priorità:** sistemare pagine mancanti (Leads, Login, AuthContext)
- **Strategia video:** Bunny solo per video corsi, Drive per registrazioni sessioni
- **Automazione Meet→Drive→Firestore** pianificata via Google Apps Script

## Key Conventions

- All UI uses inline styles (no CSS-in-JS library, no Tailwind). Style objects are passed directly.
- The secondary Firebase app (`initializeApp(firebaseConfig, "secondary")`) in `App.js` must stay — it allows the admin to create student accounts without being logged out.
- API calls to `/api/chat` and `/api/coach-memory` go through Vercel serverless functions (never directly to Anthropic from the client) to keep the API key server-side.
- The `patch-*.js` files in the root are historical one-off migration/patch scripts — they are not part of the app and can be ignored.
