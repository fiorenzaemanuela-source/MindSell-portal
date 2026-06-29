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

**Deploy workflow:** `git checkout main && git merge dev && git push origin main && git checkout dev`

## Architecture

**Stack:** React 19 (Create React App), Firebase (Auth + Firestore + Storage), Anthropic Claude API, Google Calendar API, EmailJS.

### Frontend — `src/`

`src/App.js` is a single large file (~4500 lines) containing all React components. Components are separated by `// ═══` banners:

- `App` — root router: renders `VerificaCertificato` (public, no auth) if path starts with `/verifica/`, otherwise `LoginPage`, `AdminPanel`, or `StudentPortal` based on auth state and email
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

`src/AttestatoNext.jsx` — attestato di completamento per il percorso Next. Calcola idoneità (tutti i moduli corsoId===NEXT_ID al 100%), mostra pulsanti "Scarica attestato" e "Aggiungi a LinkedIn". Emette uno snapshot immutabile in `certificati/{idCredenziale}` (idempotente). Accetta prop `onAttestatoDaScaricare(bool)` per gestire il banner/pallino NEW nel portale studente.

`src/utils/generaAttestatoNext.js` — generatore PDF jsPDF (import dinamico, A4 landscape, 2 pagine). Pagina 1 = attestato con firma. Pagina 2 = dettaglio moduli + sessioni. In fondo a entrambe le pagine: riga `ID credenziale: ... | Verifica su https://academy.mindsell.it/verifica/{id}`. Esporta anche `linkedinAddUrl` (include `certUrl` per il profilo LinkedIn).

`src/VerificaCertificato.jsx` — pagina pubblica di verifica certificato, accessibile senza autenticazione su `/verifica/:id`. Legge `certificati/{id}` e mostra nomeStudente, corso, dataRilascio, idCredenziale. Il cortocircuito in `App()` la renderizza prima di qualsiasi gate auth/NDA.

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
| `corsi/{corsoId}` | Course metadata: `nome`, `rilascioAttivo` (bool). NEXT_ID = `R7JAQBrnmnSXFC9ew9QW` |
| `certificati/{idCredenziale}` | Snapshot immutabile: uid, nomeStudente, corso, corsoId, dataRilascio, idCredenziale, moduli, sessioni. Pubblica in lettura per verifica |
| `aiCoach/{uid}/memoria/patterns` | Behavioral patterns extracted by AI |
| `aiCoach/{uid}/memoria/linguistic` | Linguistic/cognitive profile |
| `aiCoach/{uid}/memoria/meta` | Session counts, human coach notes |
| `aiCoach/{uid}/memoria/roleplay` | Roleplay scores and progression |
| `courses/percorso-vendita/lessons` | Knowledge base for RAG (modulo_num, lezione_num, tags, parole_chiave) |
| `chat/{chatId}/messages` | Real-time admin↔student chat |
| `materiali` | Admin-uploaded files |
| `guide` | Tool guides (strumenti) |
| `libreria` | Resource library — doc: title, corsoId, ordine (Number), videolezioni. Campo `ordine` usato per ordinamento |
| `annunci` / `domande` | Bacheca board |
| `referrals` | Referral leads |
| `referralPost` / `referralBrochure` | Shared marketing content |
| `notifiche/{uid}` | Per-student notifications |
| `richieste` | Student requests/offers |
| `recensioni` | Student reviews |
| `ndaFirme/{uid}` | Firma NDA studente (dati anagrafici + timestamp) |
| `ndaVersioni/{versione}` | Testo NDA in markdown |

### Required Environment Variables (Vercel)

- `ANTHROPIC_API_KEY` — Anthropic API key
- `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_CALENDAR_ID` — Google service account for Calendar
- `GOOGLE_SERVICE_ACCOUNT` — Firebase Admin SDK credentials (JSON or base64)
- `SYNC_SECRET_TOKEN` — Auth token for the `/api/sync-sessions` cron endpoint

### Design System

Both `App.js` and `AICoach.jsx` define a local `C` object with the brand color palette (dark theme: `bg: "#080B10"`, `surface: "#0E1318"`, `card: "#121820"`). All inline styles use this palette. The `glow()` helper generates CSS `box-shadow` glow effects.

`AttestatoNext.jsx` e `VerificaCertificato.jsx` usano le costanti locali `GREEN = "#6AB309"` e `BLUE = "#045FA5"` (palette brand attestato).

### Admin Identity

`ADMIN_EMAIL = "emanuela@mindsell.it"` — the app branches on this email at root: any other authenticated user goes to `StudentPortal`. Admin riconosciuto **solo via email**, nessun custom claim Firebase. Nelle regole Firestore usare `request.auth.token.email`.

---

## Funzionalità completate e in produzione

- **Sistema CORSI:** collection `corsi` con campi `nome` e `rilascioAttivo`. Campo `corsoId` sui doc `libreria`. `NEXT_ID = "R7JAQBrnmnSXFC9ew9QW"`. Interruttore "Rilascio ON/OFF" in admin = stato del corso (ON solo quando il corso è completo). **Attualmente Next ha `rilascioAttivo: false`** in attesa del modulo 10.
- **Campo `ordine`** (Number) sui moduli libreria: input nel form admin, migrazione one-time fatta (9 moduli Next → ordine 1..9). Ordinamento moduli (admin + studente) per campo `ordine`, fallback 9999.
- **Attestato di completamento:** `src/AttestatoNext.jsx` + `src/utils/generaAttestatoNext.js` (jsPDF, import dinamico, PDF A4 landscape 2 pagine). Idoneità = studente possiede **tutti** i moduli del corso (`corsoId === NEXT_ID`) ognuno al 100%. Snapshot immutabile in `certificati/{idCredenziale}`, campo `uid` = studente. `idCredenziale = "MINDSELL-" + uid(4 char) + "-" + anno`. Emissione one-time idempotente. `verificaUrl` **ATTIVO** = `https://academy.mindsell.it/verifica/{idCredenziale}`. Ore pratica = somma sessioni (1 sessione ≈ 1 ora). Titoli moduli ripuliti del prefisso "Modulo N -" nel generatore.
- **Banner e pallino NEW:** appaiono in "I miei Corsi" se idoneo && rilascioAttivo && snapshot non esiste; spariscono dopo il download. Pattern callback `onAttestatoDaScaricare(bool)` da `AttestatoNext` a `StudentPortal`.
- **Raggruppamento moduli per corso:** lato admin (scheda gestisci studente) e lato studente ("I miei Corsi", scatole-corso sempre aperte). Sblocco per-corso (primo modulo di ogni corso sbloccato indipendentemente). Riga stato attestato per corso in admin (emesso/non emesso).
- **Pagina pubblica di verifica:** `src/VerificaCertificato.jsx`, cortocircuito in `App.js` (`if pathname startsWith "/verifica/" → render senza auth`, prima dei gate). Legge `certificati/{id}`, mostra nomeStudente/corso/dataRilascio/idCredenziale. In produzione su `https://academy.mindsell.it/verifica/:id`.
- **LinkedIn:** `linkedinAddUrl` include `certUrl` con l'URL di verifica pubblico.
- Registrazioni sessioni su Google Drive ✓
- Gate NDA per studenti e procacciatori ✓
- Sistema referral con tier Bronze→Silver→Gold→Platinum ✓
- Badge NEW su Bacheca e "I miei Corsi" ✓
- Attività studenti in dashboard admin ✓
- GitHub autenticato come `fiorenzaemanuela-source` ✓
- MCP connessi: Vercel, Google Drive, GitHub, Canva, Gamma ✓

## Vincoli critici — NON violare

- **NOTE studenti:** ancorate all'indice **originale** di `data.moduli` (chiavi tipo `"2_0"` sui dati reali). Nel raggruppamento usare sempre `idxOriginale`, MAI un indice per-gruppo. Non cambiare lo schema chiavi note.
- **Regole Firestore:** si gestiscono **esclusivamente a mano in Firebase Console**. Il file `firestore.rules` nel repo è incompleto e NON allineato alle regole reali — **non deployarlo mai**, cancellerebbe le protezioni attive.
- **Regole attive in Console (sicure):**
  - `certificati` → read `true` (pubblica per verifica); create solo dal proprietario (`auth.uid == resource.uid`); update/delete solo email admin.
  - `ndaFirme` → read proprietario o email admin; create/update solo proprietario; delete email admin.
  - `ndaVersioni` → read autenticati; write `false`.
- **App.js:** file LF. Import React destrutturati (no `React.useState`). Non usare `react-router` — il routing è basato su `window.location.pathname` e rendering condizionale.
- **Pagina pubblica `/verifica/`:** il cortocircuito in `App()` deve restare la **prima** istruzione prima di `if (loading)`, per garantire che la pagina non richieda auth.

## Da fare (non urgenti)

- Inserire modulo 10 Next (`ordine=10`), poi impostare `rilascioAttivo: true` → attiva l'attestato per gli idonei.
- Stretta regole Firestore collection `studenti` (la più sensibile: l'admin fa collection-scan e scrive su uid altrui — sessione dedicata).
- Popup "arricchisci certificato" quando si aggiungono moduli a un corso (opzionale).
- Pulizia webinar doppi (Bunny CDN vs Google Drive in videoLibrary).
- UI drag & drop riordino moduli (oggi campo numerico `ordine`; bassa priorità).
- **Strategia video:** Bunny solo per video corsi, Drive per registrazioni sessioni.
- **Automazione Meet→Drive→Firestore** pianificata via Google Apps Script.

## Key Conventions

- All UI uses inline styles (no CSS-in-JS library, no Tailwind). Style objects are passed directly.
- The secondary Firebase app (`initializeApp(firebaseConfig, "secondary")`) in `App.js` must stay — it allows the admin to create student accounts without being logged out.
- API calls to `/api/chat` and `/api/coach-memory` go through Vercel serverless functions (never directly to Anthropic from the client) to keep the API key server-side.
- The `patch-*.js` files in the root are historical one-off migration/patch scripts — they are not part of the app and can be ignored.
