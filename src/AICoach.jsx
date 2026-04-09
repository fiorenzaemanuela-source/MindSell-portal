// ─────────────────────────────────────────────────────────────────────────────
// AICoach.jsx — MindSell AI Coach
// Componente production-ready per la StudentPortal di academy.mindsell.it
//
// INSTALLAZIONE — 3 modifiche in App.js:
//
// 1. Import (in cima al file, dopo gli altri import):
//    import AICoach from "./AICoach";
//
// 2. Nell'array tabs (riga ~1455), aggiungi in fondo:
//    { id: "coach", label: "AI Coach", emoji: "🧠" },
//
// 3. Nel header <h2> (riga ~1495), aggiungi:
//    {tab==="coach"&&"AI Coach 🧠"}
//
// 4. Nel <main>, dopo il blocco {tab==="materiali"&&...}, aggiungi:
//    {tab==="coach" && <AICoach userData={localData} uid={uid} />}
//
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import {
  doc, getDoc, setDoc, collection, getDocs,
  addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, where,
} from "firebase/firestore";

// ── Design system — identico ad App.js ───────────────────────────────────────
const C = {
  green: "#6DBF3E", greenDim: "#6DBF3E22",
  blue: "#2B6CC4", blueDim: "#2B6CC422", blueLight: "#4A8FE0",
  purple: "#B44FFF", purpleDim: "#B44FFF22", purpleGlow: "#CC77FF",
  bg: "#080B10", surface: "#0E1318", card: "#121820",
  border: "#1C2530", text: "#E8EDF5", muted: "#6B7A8D", dim: "#3A4A5A",
  red: "#FF5555", teal: "#0E9E9D", tealDim: "#0E9E9D22",
  orange: "#E67E22", gold: "#D4A017",
};
const glow = (c, px = 12) => `0 0 ${px}px ${c}44, 0 0 ${px * 2}px ${c}22`;

// ── Le 5 intenzioni ───────────────────────────────────────────────────────────
const INTENTS = [
  {
    id: "analisi",
    icon: "🔍",
    label: "Analizza trattativa",
    color: C.blue,
    desc: "Analizza una conversazione o trattativa recente",
    placeholder: "Descrivi la trattativa o incolla la trascrizione...\n\nEsempio: 'Ho incontrato un cliente, 55 anni. All'inizio sembrava interessato ma quando ho parlato del prezzo ha detto che doveva pensarci...'",
    systemHint: "analisi_trattativa",
  },
  {
    id: "pitch",
    icon: "🎯",
    label: "Costruisci pitch",
    color: C.green,
    desc: "Crea un pitch personalizzato per il tuo prossimo cliente",
    placeholder: "Dimmi chi è il tuo prossimo cliente...\n\nEsempio: 'Devo incontrare il titolare di una piccola azienda, 52 anni. È già stato deluso da un fornitore precedente e ha un budget limitato.'",
    systemHint: "costruisci_pitch",
  },
  {
    id: "followup",
    icon: "📩",
    label: "Scrivi follow-up",
    color: C.teal,
    desc: "Crea il messaggio perfetto post-conversazione",
    placeholder: "Raccontami com'è andata la conversazione...\n\nEsempio: 'Ho parlato con Marco, era interessato ma preoccupato per i costi. Gli ho mostrato la proposta base e ha detto che ne avrebbe parlato con i soci.'",
    systemHint: "followup",
  },
  {
    id: "kpi",
    icon: "📊",
    label: "Revisione KPI",
    color: C.gold,
    desc: "Analizza i risultati della settimana e i tuoi pattern",
    placeholder: "Incolla i dati della tua settimana...\n\nEsempio: '8 appuntamenti, 3 chiusi. Le obiezioni più frequenti: prezzo (4 volte), ci devo pensare (3 volte). I clienti più aperti erano...'",
    systemHint: "revisione_kpi",
  },
  {
    id: "roleplay",
    icon: "🥊",
    label: "Roleplay obiezione",
    color: C.purple,
    desc: "Allenati su un'obiezione con un cliente simulato",
    placeholder: "Quale obiezione vuoi allenare?\n\nEsempio: 'Voglio allenarmi sul classico «ci devo pensare» di un cliente prudente che ha appena visto il preventivo. Puoi fare tu il cliente?'",
    systemHint: "roleplay",
  },
];

// ── Ricerca lezioni rilevanti per RAG ────────────────────────────────────────
async function searchRelevantLessons(db, userModuli, userMessage, intentHint) {
  try {
    // Opzione B: moduli completati al 100% + lezioni singole viste nei moduli in corso
    const moduliCompletati = new Set();  // moduli con tutte le lezioni a 100
    const lezionIViste = new Map();      // moduloNum -> Set di numeri lezione visti

    for (const modulo of (userModuli || [])) {
      const titleMatch = modulo.title?.match(/modulo\s*(\d+)/i);
      if (!titleMatch) continue;
      const moduloNum = parseInt(titleMatch[1]);
      const videolezioni = modulo.videolezioni || [];
      if (videolezioni.length === 0) continue;

      const tutteComplete = videolezioni.every(v => v.progress === 100);
      if (tutteComplete) {
        moduliCompletati.add(moduloNum);
      } else {
        // Modulo in corso — traccia le lezioni viste (progress 100)
        const visteIdx = new Set();
        videolezioni.forEach((v, idx) => {
          if (v.progress === 100) visteIdx.add(idx + 1); // 1-based
        });
        if (visteIdx.size > 0) lezionIViste.set(moduloNum, visteIdx);
      }
    }

    if (moduliCompletati.size === 0 && lezionIViste.size === 0) return [];

    // Recupera lezioni dalla knowledge base
    const lessonsRef = collection(db, "courses", "percorso-vendita", "lessons");
    const snap = await getDocs(lessonsRef);
    const lessons = [];
    snap.forEach(d => {
      const data = d.data();
      if (moduliCompletati.has(data.modulo_num)) {
        // Modulo completato — includi tutte le sue lezioni
        lessons.push({ ...data, _fonte: "modulo_completo" });
      } else if (lezionIViste.has(data.modulo_num)) {
        // Modulo in corso — includi solo lezioni viste
        const visteIdx = lezionIViste.get(data.modulo_num);
        if (visteIdx.has(data.lezione_num)) {
          lessons.push({ ...data, _fonte: "lezione_vista" });
        }
      }
    });

    if (lessons.length === 0) return [];

    // Calcola rilevanza per messaggio + intent
    const queryWords = (userMessage + " " + intentHint).toLowerCase()
      .match(/\b[a-zàèéìòùì]{4,}\b/g) || [];

    const scored = lessons.map(lesson => {
      let score = 0;
      const allText = (lesson.titolo + " " + lesson.tags?.join(" ") + " " + lesson.parole_chiave?.join(" ")).toLowerCase();
      for (const word of queryWords) {
        if (allText.includes(word)) score += 2;
      }
      // Bonus per tag che matchano l'intent
      const intentTagMap = {
        "trattativa": ["chiusura", "negoziazione", "figure-decisionali", "obiezioni"],
        "pitch": ["pitch", "script-vendita", "valore", "analisi-bisogni"],
        "followup": ["follow-up", "fiducia", "rapport"],
        "kpi": ["kpi", "obiettivi", "crescita"],
        "roleplay": ["obiezioni", "tecniche-domande", "chiusura", "neurochimica"],
      };
      const intentTags = intentTagMap[intentHint] || [];
      for (const tag of (lesson.tags || [])) {
        if (intentTags.includes(tag)) score += 3;
      }
      return { ...lesson, score };
    });

    // Ritorna top 3 più rilevanti con score > 0
    return scored
      .filter(l => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

  } catch (e) {
    console.error("Errore ricerca lezioni:", e);
    return [];
  }
}

// ── Costruisce il system prompt dinamico ──────────────────────────────────────
function buildSystemPrompt(intentHint, userData, patterns, linguistic, sessionCount, lessonsContext = [], roleplayInsights = null, noteCoachUmano = "") {
  const name = userData?.name || "lo studente";
  const firstName = name.split(" ")[0];
  const moduli = (userData?.moduli || []).map(m => m.title).filter(Boolean);
  const packages = (userData?.packages || []).map(p => p.name || p.type).filter(Boolean);
  const nSessioniLive = (userData?.packages || []).reduce((acc, p) => acc + (p.used || 0), 0);
  const plan = userData?.plan || "Percorso MindSell";

  // Determina se ha il corso AI (aggiusta questo check in base ai nomi reali)
  const hasCorsoAI = moduli.some(m =>
    m.toLowerCase().includes("ai") ||
    m.toLowerCase().includes("intelligenza") ||
    m.toLowerCase().includes("chatgpt")
  );

  // Determina se ha il percorso vendita completo
  const hasPercorsoVendita = moduli.some(m =>
    m.toLowerCase().includes("vendita") ||
    m.toLowerCase().includes("chiusura") ||
    m.toLowerCase().includes("negoziazione")
  );

  // ── Blocco 0: Cultura di base MindSell ───────────────────────────────────────
  const blocco_cultura_base = `
CULTURA DI BASE MINDSELL — MEMORIA FONDAZIONALE:
Questi sono i principi che conosci per default, indipendentemente da cosa ha acquistato lo studente.
Usali come lente di lettura in ogni conversazione.
NON approfondirli oltre questo livello se lo studente non ha completato i moduli corrispondenti —
in quel caso rimanda: "Per lavorare questo in profondità ti consiglio di affrontarlo con Emanuela nel percorso specifico."

IDENTITÀ DEL CLOSER:
- Non si vende ciò che si fa, si vende chi si è
- Il linguaggio riflette l'identità: "proverò" vs "mi occupo io", "vediamo" vs "facciamo"
- Valore oggettivo = prove, dati, risultati verificabili
- Valore soggettivo = percezione di sé, credenze limitanti vs potenzianti
- La calma non è assenza di pressione, è padronanza della mente sotto pressione

3 SISTEMI DECISIONALI (tutti gli interlocutori):
- PROFESSORE (Razionale): analizza, è lento, non decide per primo — produce cortisolo se sovraccaricato
- ARTISTA (Emotivo): sente, si connette attraverso ossitocina, risponde a storie e immagini
- GUARDIA (Primitivo): il vero decisore, agisce per sopravvivenza — attivato da dopamina e adrenalina

6 TRIGGER DEL CERVELLO PRIMITIVO:
- Auto-centratura: messaggi focalizzati sul cliente
- Contrasto: prima vs dopo, con vs senza
- Chiarezza: la complessità genera fuga
- Urgenza: reale, non artificiale
- Riprova sociale: testimonianze e numeri
- Stimoli visivi: le immagini precedono le parole

ETICA NELLA VENDITA:
- L'etica non è debolezza, è la forma più alta di leadership commerciale
- Il NO non è contro il venditore — è una reazione di difesa del cervello del cliente
- Proposta trasformativa (ponte identitario) vs informativa (menu di servizi)
- Il prezzo non si difende, si dichiara — il silenzio dopo la cifra è strategico
- Urgenza etica = costo reale del rimandare, non countdown finti
- Dire NO al cliente quando il prodotto non è adatto è un atto etico

RESILIENZA DEL CLOSER:
- Il logoramento viene dalla pressione senza decompressione, non dal lavoro
- Le 6 criticità reali: solitudine del risultato, trattative inchiudibili, peso dell'incoerenza,
  call continua nella testa, giudizio interno, assenza di riconoscimento umano
- Protocollo pre-call: respirazione 4-2-6, allineamento mentale, attivazione fisica
- Metodo RESET per i momenti di vuoto: Recupera, Espandi, Semplifica, Educa, Trasforma

CONFINI DI APPROFONDIMENTO:
- Se lo studente chiede tecniche operative specifiche non coperte dai suoi moduli completati:
  dai il principio generale (max 2-3 punti) e aggiungi:
  "Per lavorare questo in modo strutturato ti consiglio di affrontarlo con Emanuela nel percorso dedicato."
- Non sostituire mai la formazione — integra e orienta.`;

  // ── Blocco 1: Identità ──────────────────────────────────────────────────────
  const blocco_identita = `Sei MindSell AI Coach, l'assistente personale di ${name} per la vendita consultiva.
Sei stato creato da Mindsell Academy, scuola di formazione specializzata in neuroscienza applicata alla vendita.

La tua funzione è duplice:
1. EDUCATIVA — aiuti ${firstName} a interiorizzare i framework del corso attraverso la pratica e la riflessione
2. OPERATIVA — lo supporti nelle trattative reali con analisi, pitch, follow-up e allenamento

Non sei un motore di ricerca generico. Sei un coach specializzato che conosce ${name}, la sua storia sulla piattaforma, il suo settore e il suo stile.

REGOLE DI STILE:
- Parla in italiano. Tono diretto e caldo, da mentor — non da manuale aziendale.
- Scrivi testo leggibile: paragrafi brevi, frasi dirette. NIENTE simboli markdown nel testo (no ##, no **, no ---).
- Ogni concetto tecnico: spiegalo in una riga la prima volta che lo usi.
- Risposte dense ma non infinite: ${firstName} è sul campo, non in aula.
- Concludi SEMPRE con 1 azione concreta, specifica e misurabile.
- Se sbaglia qualcosa, dillo — con rispetto ma senza ammorbidire il messaggio.
- Non fingere di non sapere cose che sai sul suo profilo. Usale.`;

  // ── Blocco 2: Profilo studente ─────────────────────────────────────────────
  const blocco_profilo = `
PROFILO DI ${name.toUpperCase()}:
- Piano acquistato: ${plan}
- Moduli/percorsi: ${moduli.length > 0 ? moduli.join(", ") : "nessun modulo assegnato ancora"}
- Sessioni live effettuate: ${nSessioniLive}
- Sessioni con il coach AI: ${sessionCount}`;

  // ── Blocco 3: Framework (condizionale) ────────────────────────────────────
  const blocco_framework_base = `
FRAMEWORK APPLICATIVI — USO OPERATIVO IN SESSIONE:
NEUROCHIMICA IN TRATTATIVA:
- Ossitocina alta → fiducia e connessione → apertura al cambiamento
- Dopamina alta → motivazione → desiderio di agire ora
- Cortisolo alto → stress → chiusura difensiva — ridurlo è priorità

CHIUSURA NATURALE:
- Non si forza, si prepara nel corso di tutta la conversazione
- Non è convincere, è accompagnare il cliente verso la sua decisione
- Non è vincere sul cliente, è guidarlo con lui verso il risultato che vuole

COSTRUZIONE DEL VALORE (Value Stacking):
- Metodo: struttura testata e replicabile
- Supporto: guida continua nel percorso
- Tempo: risparmio di mesi di errori autonomi
- Risultati: casi reali e prove tangibili
Il problema "costa troppo" nasce sempre da una mancanza di valore percepito, non di budget.`;

  const blocco_framework_ai = hasCorsoAI ? `
FRAMEWORK ESCLUSIVI CORSO AI — ${name} ha acquistato il corso AI, puoi usare questi framework in piena profondità:

E.M.P.A.T.I.A.:
E = Emozione vera del cliente (non quella dichiarata)
M = Mindset da analista — osserva prima di reagire
P = Prova concreta — dati, testimonianze, esempi reali
A = Aiuto su misura — la soluzione sembra creata apposta per lui
T = Trigger decisionale — il momento in cui il cliente è pronto
I = Immagina il risultato — fai visualizzare la trasformazione
A = Azione concreta — un passo piccolo e specifico

3 BIAS COGNITIVI CHIAVE:
- CONFERMA: il cliente cerca prove di ciò che già crede
- AVVERSIONE ALLA PERDITA: il dolore di perdere pesa più del piacere di guadagnare
- ANCORAGGIO: il primo numero sentito condiziona tutta la trattativa

PROMPT ENGINEERING PER LA VENDITA: ${name} usa ChatGPT per analizzare conversazioni e costruire pitch.` : `
FRAMEWORK AI — ${name} non ha acquistato il corso AI.
Se chiede di E.M.P.A.T.I.A. o dei bias cognitivi strutturati, dai i principi generali e aggiungi:
"Per il metodo completo ti consiglio di esplorare il corso AI di Mindsell Academy o altra formazione specifica."`;

  // ── Blocco 4: Pattern comportamentali ─────────────────────────────────────
  const hasPatterns = patterns && Object.keys(patterns).some(k => patterns[k]);
  const blocco_patterns = hasPatterns ? `
PATTERN RILEVATI NELLE SESSIONI PRECEDENTI:
${patterns.figura_dominante ? `- Figura clienti prevalente: ${patterns.figura_dominante}` : ""}
${patterns.bias_ricorrente ? `- Bias più frequente nei suoi clienti: ${patterns.bias_ricorrente}` : ""}
${patterns.fase_critica ? `- Fase critica: ${patterns.fase_critica}` : ""}
${patterns.leva_efficace ? `- Leva più efficace per lui: ${patterns.leva_efficace}` : ""}
${patterns.tasso_chiusura ? `- Tasso di chiusura medio: ${patterns.tasso_chiusura}` : ""}
${patterns.obiezione_irrisolta ? `- Obiezione ricorrente non ancora risolta: ${patterns.obiezione_irrisolta}` : ""}` : "";

  // ── Blocco 5: Profilo linguistico ─────────────────────────────────────────
  const hasLinguistic = linguistic && Object.keys(linguistic).some(k =>
    linguistic[k] && (Array.isArray(linguistic[k]) ? linguistic[k].length > 0 : true)
  );
  const blocco_linguistic = hasLinguistic ? `
PROFILO LINGUISTICO E COGNITIVO:
${linguistic.stile_comunicativo ? `- Stile: ${linguistic.stile_comunicativo}` : ""}
${linguistic.stile_ragionamento ? `- Struttura del ragionamento: ${linguistic.stile_ragionamento}` : ""}
${linguistic.concetti_padroneggiati?.length ? `- Concetti padroneggiati: ${linguistic.concetti_padroneggiati.join(", ")}` : ""}
${linguistic.concetti_parziali?.length ? `- Concetti da rafforzare: ${linguistic.concetti_parziali.join(", ")}` : ""}
${linguistic.errori_concettuali?.length ? `- Errori concettuali attivi: ${linguistic.errori_concettuali.join(", ")}` : ""}

Usa questi dati per calibrare il tono, gli esempi e la profondità. Se ha già padroneggiato un concetto, non rispiegarlo — vai oltre.` : "";

  // ── Blocco 5a: Note Coach Umano ─────────────────────────────────────────────
  const blocco_note_coach = (typeof noteCoachUmano === "string" && noteCoachUmano.trim()) ? `
NOTE DEL COACH UMANO (Emanuela MindSell — osservazioni dirette sullo studente):
${noteCoachUmano.trim()}

Queste note hanno priorità alta — integrале nel tuo ragionamento e usale per personalizzare ogni risposta.` : "";

  // ── Blocco 5b: Insight Roleplay ────────────────────────────────────────────
  const hasRoleplay = roleplayInsights && roleplayInsights.length > 0;
  const blocco_roleplay = (() => {
    const parti = [];
    if (hasRoleplay) {
      const recenti = roleplayInsights.slice(0, 3);
      const tuttiPuntiForza = [...new Set(recenti.flatMap(r => r.punti_di_forza || []))].slice(0, 3);
      const tuttiErrori = [...new Set(recenti.flatMap(r => r.errori_ricorrenti || []))].slice(0, 3);
      const tutteObiezioni = [...new Set(recenti.flatMap(r => r.obiezioni_non_gestite || []))].slice(0, 3);
      const tuttiConcetti = [...new Set(recenti.flatMap(r => r.concetti_da_rinforzare || []))].slice(0, 3);
      parti.push(`ANALISI DALLE SESSIONI REALI DI ${firstName.toUpperCase()} (da trascrizioni roleplay):`);
      if (tuttiPuntiForza.length) parti.push(`PUNTI DI FORZA:\n${tuttiPuntiForza.map(p => `- ${p}`).join("\n")}`);
      if (tuttiErrori.length) parti.push(`ERRORI RICORRENTI:\n${tuttiErrori.map(p => `- ${p}`).join("\n")}`);
      if (tutteObiezioni.length) parti.push(`OBIEZIONI NON GESTITE:\n${tutteObiezioni.map(p => `- ${p}`).join("\n")}`);
      if (tuttiConcetti.length) parti.push(`CONCETTI DA RINFORZARE:\n${tuttiConcetti.map(p => `- ${p}`).join("\n")}`);
    }
    if (roleplayProgressione) {
      const p = roleplayProgressione;
      if (p.errori_persistenti?.length) parti.push(`ERRORI PERSISTENTI (presenti in più sessioni):\n${p.errori_persistenti.map(e => `- ${e}`).join("\n")}`);
      if (p.errori_superati?.length) parti.push(`ERRORI GIÀ SUPERATI (non ripetere correzioni su questi):\n${p.errori_superati.map(e => `- ${e}`).join("\n")}`);
      if (p.gap_teoria_pratica?.length) parti.push(`GAP TEORIA→PRATICA:\n${p.gap_teoria_pratica.map(e => `- ${e}`).join("\n")}`);
      if (p.transfer_riuscito?.length) parti.push(`TRANSFER RIUSCITO:\n${p.transfer_riuscito.map(e => `- ${e}`).join("\n")}`);
      if (p.focus_attuale) parti.push(`FOCUS ATTUALE: ${p.focus_attuale}`);
      if (p.score_aree) {
        const AREE_L = { chiusura: "Chiusura", gestione_obiezioni: "Obiezioni", rapport: "Rapport", struttura_pitch: "Pitch", ascolto_attivo: "Ascolto" };
        const scores = Object.entries(p.score_aree).map(([k, v]) => `${AREE_L[k] || k}: ${v.score}/100 ${v.trend}`).join(", ");
        parti.push(`SCORE: ${scores}`);
      }
    }
    if (parti.length === 0) return "";
    return "\n" + parti.join("\n\n") + "\n\nUsa questi dati per personalizzare ogni risposta. Affronta gli errori persistenti. Non rispiegare ciò che ha già superato.";
  })();

  // ── Blocco 6: Confini ─────────────────────────────────────────────────────
  // Moduli assegnati ma non ancora iniziati (0% su tutte le lezioni)
  const moduliNonIniziati = (userData?.moduli || [])
    .filter(m => !m.videolezioni?.some(v => v.progress === 100))
    .map(m => m.title);

  const blocco_confini = `
GESTIONE DEI CONFINI:
- Su argomenti coperti dai moduli COMPLETATI: risposta completa e personalizzata.
- Su argomenti dei moduli IN CORSO: usa solo concetti delle lezioni già viste dallo studente.
- Su moduli ASSEGNATI MA NON ANCORA INIZIATI (${moduliNonIniziati.length > 0 ? moduliNonIniziati.join(", ") : "nessuno"}): trattali esattamente come non acquistati — no approfondimenti.
- Su argomenti NON acquistati o moduli non iniziati: dai MAX 2 principi generali dalla cultura base, poi scrivi ESATTAMENTE: "Per approfondire questo ti consiglio di lavorarlo con Emanuela nel percorso dedicato." Non fare mai lezioni complete, nemmeno se lo studente insiste.
- Su argomenti fuori dalla vendita: "Questo esula dal mio ruolo — posso aiutarti con [area rilevante]?"`;

  // ── Blocco 7: Modalità attiva ─────────────────────────────────────────────
  const intentBlocks = {
    analisi_trattativa: `
MODALITÀ ATTIVA: ANALISI TRATTATIVA
Quando ${firstName} descrive una conversazione, produci questa analisi strutturata:
1. EMOZIONE DOMINANTE: quale emozione guidava il cliente? Come è cambiata?
2. MOMENTO DI SVOLTA: il momento esatto in cui la trattativa ha preso una piega. Cita le parole chiave se disponibili.
3. FIGURA DECISIONALE: Professore / Artista / Guardia — con evidenza dal testo.
4. BIAS ATTIVO: quale bias cognitivo era presente? Come si è manifestato?
5. VERA OBIEZIONE: sotto quella dichiarata, qual era quella reale?
6. COSA HA FUNZIONATO: 1 cosa che ${firstName} ha fatto bene, anche piccola.

AZIONE CONCRETA: 1 sola cosa da fare diversamente nel prossimo contatto.`,

    costruisci_pitch: `
MODALITÀ ATTIVA: COSTRUISCI PITCH
1. Se mancano info essenziali, fai MASSIMO 2 domande.
2. Identifica la figura decisionale probabile.
3. Costruisci il pitch con questo schema:
   CONTESTO: una frase che mostra che conosci la sua situazione
   EMOZIONE: nomina la sua preoccupazione con le sue parole
   PROVA: 1 elemento concreto (dato, caso simile, risultato misurabile)
   LEVA: il trigger giusto per la sua figura (logica / visione / sicurezza)
   PASSO: una richiesta piccola e non spaventosa
4. Max 120-150 parole. Linguaggio parlato, non da brochure.
5. Concludi con: "Vuoi che lo adatto per [scenario specifico]?"`,

    followup: `
MODALITÀ ATTIVA: FOLLOW-UP
1. Chiedi il formato se non specificato: email o WhatsApp?
2. Identifica: preoccupazione principale del cliente (con le sue parole) + emozione finale + passo successivo naturale.
3. Struttura:
   APERTURA: richiama la conversazione senza essere generico
   PONTE: collega ciò che ha detto lui alla proposta
   PASSO: proponi 1 azione piccola (non la firma, non la decisione finale)
   CHIUSURA: domanda aperta, non pressante
4. WhatsApp: max 80 parole, caldo e diretto.
   Email: max 150 parole, oggetto incluso.
5. NON usare mai: "come da accordi", "in riferimento alla nostra conversazione", "le scrivo per".`,

    revisione_kpi: `
MODALITÀ ATTIVA: REVISIONE KPI
Analizza i dati e produci:
1. PATTERN OBIEZIONI: quali si ripetono? In quale fase?
2. CONFRONTO MODALITÀ: differenza presenza vs remoto (se applicabile)
3. FASE CRITICA: dove perde più trattative?
${hasPatterns && patterns.fase_critica ? `4. CONFRONTO STORICO: confronta con il pattern registrato: "${patterns.fase_critica}"` : ""}
5. 1 CAMBIAMENTO: una sola cosa da fare diversamente. Specifica e misurabile.
Sii diretto. Non ammorbidire i dati negativi.`,

    roleplay: `
MODALITÀ ATTIVA: ROLEPLAY
Interpreta un cliente reale del tipo che ${firstName} incontra più spesso.
${hasPatterns && patterns.figura_dominante ? `Usa la figura ${patterns.figura_dominante} che è quella prevalente nei suoi clienti.` : "Chiedi quale figura vuole allenare se non specificato."}

STRUTTURA DI OGNI ROUND:
[CLIENTE] → risposta nel personaggio
[COACH] → 2 righe di feedback fuori personaggio: cosa ha funzionato, cosa migliorare
[CLIENTE] → continua

REGOLE:
- Resistenze tipiche PROFESSORE: chiede dati, mette in dubbio le cifre
- Resistenze tipiche ARTISTA: cambia argomento, non si focalizza, parla di visioni
- Resistenze tipiche GUARDIA: "ci devo pensare", chiede garanzie, confronta con altri
- Se ${firstName} applica bene i framework, mostra apertura nel personaggio
- Se sbaglia, il cliente diventa più chiuso (comportamento realistico)
INIZIO: presentati come il cliente con nome, contesto e prima obiezione.`,
  };

  // ── Blocco 8: Istruzione memoria ─────────────────────────────────────────
  const blocco_memoria = `
ISTRUZIONE DI SISTEMA — AGGIORNAMENTO MEMORIA:
Alla fine di ogni sessione significativa, se emergono dati rilevanti, includi alla fine della tua ultima risposta questo blocco JSON (racchiuso tra |||JSON_UPDATE e |||END):

|||JSON_UPDATE
{
  "session_type": "${intentHint || 'libera'}",
  "patterns_update": {
    "figura_dominante": null,
    "bias_ricorrente": null,
    "fase_critica": null,
    "leva_efficace": null,
    "obiezione_irrisolta": null
  },
  "linguistic_update": {
    "concetto_padroneggiato": null,
    "concetto_parziale": null,
    "errore_concettuale": null,
    "stile_nota": null
  },
  "insight_coach": "La cosa più importante emersa in questa sessione"
}
|||END

Compila solo i campi rilevanti per questa sessione. Lascia null quelli senza dati sufficienti.`;

  // ── Blocco lezioni rilevanti (RAG) ────────────────────────────────────────
  const blocco_lezioni = lessonsContext.length > 0 ? `
CONTENUTI DIDATTICI RILEVANTI PER QUESTA SESSIONE:
Queste sono lezioni che ${firstName} ha già studiato (o sta studiando) pertinenti alla sua domanda.

${lessonsContext.map((l, i) => {
  const stato = l._fonte === "modulo_completo" ? "✅ Modulo completato" : "📖 Lezione vista (modulo in corso)";
  return `[${stato} | Lezione: ${l.titolo} — Modulo ${l.modulo_num}]\n${l.corpo.slice(0, 800)}...`;
}).join("\n\n")}

REGOLE:
- Per lezioni di moduli completati: puoi usare i concetti in piena profondità, lo studente li conosce
- Per lezioni di moduli in corso: usa il concetto ma verifica che lo abbia capito — potrebbe non aver visto le lezioni successive
- Cita sempre la lezione esplicitamente ("come hai visto nella lezione su X...") per rinforzare l'apprendimento` : "";

  return [
    blocco_cultura_base,
    blocco_identita,
    blocco_profilo,
    blocco_framework_base,
    blocco_framework_ai,
    blocco_patterns,
    blocco_linguistic,
    blocco_note_coach,
    blocco_roleplay,
    blocco_lezioni,
    blocco_confini,
    intentBlocks[intentHint] || "",
    blocco_memoria,
  ].filter(Boolean).join("\n");
}

// ── Estrai e pulisci JSON update dalla risposta ───────────────────────────────
function extractMemoryUpdate(text) {
  const match = text.match(/\|\|\|JSON_UPDATE\s*([\s\S]*?)\|\|\|END/);
  if (!match) return { cleanText: text, update: null };
  try {
    const update = JSON.parse(match[1].trim());
    const cleanText = text.replace(/\|\|\|JSON_UPDATE[\s\S]*?\|\|\|END/g, "").trim();
    return { cleanText, update };
  } catch {
    return { cleanText: text, update: null };
  }
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "12px 16px" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: C.purple,
          animation: `msCoachPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes msCoachPulse{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ── Singolo messaggio ─────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === "user";
  const intent = INTENTS.find(i => i.id === msg.intentId);
  return (
    <div style={{
      display: "flex", gap: 10,
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
      animation: "msCoachFade .25s ease",
    }}>
      <style>{`@keyframes msCoachFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0, marginTop: 2,
          background: `linear-gradient(135deg,${C.purple},${C.blue})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, boxShadow: glow(C.purple, 6),
        }}>🧠</div>
      )}
      <div style={{
        maxWidth: "78%",
        background: isUser ? `linear-gradient(135deg,${C.blue}CC,${C.purple}99)` : C.surface,
        border: `1px solid ${isUser ? C.blue + "66" : C.border}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        padding: "12px 16px", fontSize: 13, lineHeight: 1.75, color: C.text,
        boxShadow: isUser ? glow(C.blue, 4) : "none",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {msg.content}
        {intent && !isUser && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`,
            fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>{intent.icon}</span><span>{intent.label}</span>
          </div>
        )}
      </div>
      {isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0, marginTop: 2,
          background: `linear-gradient(135deg,${C.green},${C.blue})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 11, color: "#fff",
        }}>
          {(msg.userName || "S").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ── Componente principale ─────────────────────────────────────────────────────
export default function AICoach({ userData, uid }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeIntent, setActiveIntent] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [linguistic, setLinguistic] = useState(null);
  const [roleplayInsights, setRoleplayInsights] = useState(null);
  const [roleplayProgressione, setRoleplayProgressione] = useState(null);
  const [noteCoachUmano, setNoteCoachUmano] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [recentSessions, setRecentSessions] = useState([]);
  const [isFirstSession, setIsFirstSession] = useState(false);
  const [coachReady, setCoachReady] = useState(false);
  const [showMemory, setShowMemory] = useState(true);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const currentSessionRef = useRef(null);
  const userName = userData?.name || "Studente";

  // ── Carica dati memoria da Firestore ──────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const loadCoachData = async () => {
      try {
        // Patterns
        const pSnap = await getDoc(doc(db, "aiCoach", uid, "memoria", "patterns"));
        if (pSnap.exists()) setPatterns(pSnap.data());

        // Profilo linguistico
        const lSnap = await getDoc(doc(db, "aiCoach", uid, "memoria", "linguistic"));
        if (lSnap.exists()) setLinguistic(lSnap.data());

        // Conteggio sessioni
        const metaSnap = await getDoc(doc(db, "aiCoach", uid, "memoria", "meta"));
        if (metaSnap.exists()) {
          const meta = metaSnap.data();
          setSessionCount(meta.sessioni_totali || 0);
          setIsFirstSession((meta.sessioni_totali || 0) === 0);
        } else {
          setIsFirstSession(true);
        }

        // Analisi roleplay
        const rpSnap = await getDoc(doc(db, "aiCoach", uid, "memoria", "roleplay"));
        if (rpSnap.exists()) {
          setRoleplayInsights(rpSnap.data().analisi || []);
          setRoleplayProgressione(rpSnap.data().progressione || null);
        }

        // Sessioni recenti
        const sessionsRef = collection(db, "aiCoach", uid, "sessioni");
        const q = query(sessionsRef, orderBy("creata_il", "desc"), limit(3));
        const snap = await new Promise((res) => {
          const unsub = onSnapshot(q, (s) => { res(s); unsub(); });
        });
        setRecentSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (e) {
        console.error("Errore caricamento dati coach:", e);
      } finally {
        setCoachReady(true);
      }
    };
    loadCoachData();
  }, [uid]);

  // ── Scroll automatico ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Messaggio di benvenuto prima sessione ─────────────────────────────────
  useEffect(() => {
    if (!coachReady || messages.length > 0) return;
    if (isFirstSession) {
      const moduli = (userData?.moduli || []).map(m => m.title).filter(Boolean);
      const nSessioniLive = (userData?.packages || []).reduce((a, p) => a + (p.used || 0), 0);
      const firstName = userName.split(" ")[0];

      let benvenuto = `Ciao ${firstName}. Prima di iniziare, voglio dirti una cosa.\n\n`;
      benvenuto += `Ho già letto la tua storia sulla piattaforma. `;

      if (moduli.length > 0) {
        benvenuto += `So che stai seguendo ${moduli.slice(0, 2).join(" e ")}`;
        if (moduli.length > 2) benvenuto += ` e altri ${moduli.length - 2} percorsi`;
        benvenuto += ". ";
      }

      if (nSessioniLive > 0) {
        benvenuto += `Hai già fatto ${nSessioniLive} ${nSessioniLive === 1 ? "sessione live" : "sessioni live"} — questo mi dice che prendi sul serio la pratica. Partiamo da lì.\n\n`;
      } else {
        benvenuto += `Sei all'inizio del percorso — il momento migliore per costruire le basi giuste.\n\n`;
      }

      benvenuto += `Sono qui per aiutarti sul campo, non solo in teoria. Cosa vuoi fare oggi?`;

      setMessages([{ role: "assistant", content: benvenuto }]);
    }
  }, [coachReady, isFirstSession]);

  // ── Salva sessione su Firestore ───────────────────────────────────────────
  const saveSession = useCallback(async (msgs, intentId) => {
    if (!uid || msgs.length < 2) return;
    try {
      const sessionData = {
        intent_id: intentId || "libera",
        intent_label: INTENTS.find(i => i.id === intentId)?.label || "Conversazione libera",
        n_messaggi: msgs.length,
        creata_il: serverTimestamp(),
        anteprima: msgs.find(m => m.role === "user")?.content?.slice(0, 80) || "",
      };
      const ref = await addDoc(collection(db, "aiCoach", uid, "sessioni"), sessionData);
      currentSessionRef.current = ref.id;

      // Aggiorna contatore sessioni
      const metaRef = doc(db, "aiCoach", uid, "memoria", "meta");
      const metaSnap = await getDoc(metaRef);
      const current = metaSnap.exists() ? (metaSnap.data().sessioni_totali || 0) : 0;
      await setDoc(metaRef, {
        sessioni_totali: current + 1,
        ultima_sessione: serverTimestamp(),
      }, { merge: true });
      setSessionCount(current + 1);
    } catch (e) {
      console.error("Errore salvataggio sessione:", e);
    }
  }, [uid]);

  // ── Estrai e salva memoria a fine sessione via API dedicata ─────────────
  const extractAndSaveMemory = useCallback(async (msgs, intentId) => {
    if (!uid || !msgs || msgs.length < 4) return;
    try {
      const res = await fetch("/api/coach-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, intentId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.update) return;

      const { patterns: p, linguistic: l, insight_coach, session_type } = data.update;

      if (p) {
        const filtered = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null));
        if (Object.keys(filtered).length > 0) {
          await setDoc(doc(db, "aiCoach", uid, "memoria", "patterns"), filtered, { merge: true });
          setPatterns(prev => ({ ...(prev || {}), ...filtered }));
        }
      }

      if (l) {
        const curr = linguistic || {};
        const updates = {};
        if (l.stile_comunicativo) updates.stile_comunicativo = l.stile_comunicativo;
        if (l.stile_ragionamento) updates.stile_ragionamento = l.stile_ragionamento;
        if (l.concetto_padroneggiato) updates.concetti_padroneggiati = [...(curr.concetti_padroneggiati || []), l.concetto_padroneggiato];
        if (l.concetto_parziale) updates.concetti_parziali = [...(curr.concetti_parziali || []), l.concetto_parziale];
        if (l.errore_concettuale) updates.errori_concettuali = [...(curr.errori_concettuali || []), l.errore_concettuale];
        if (Object.keys(updates).length > 0) {
          await setDoc(doc(db, "aiCoach", uid, "memoria", "linguistic"), updates, { merge: true });
          setLinguistic(prev => ({ ...(prev || {}), ...updates }));
        }
      }

      if (insight_coach && currentSessionRef.current) {
        await setDoc(
          doc(db, "aiCoach", uid, "sessioni", currentSessionRef.current),
          { insight: insight_coach, session_type },
          { merge: true }
        );
      }

    } catch (e) {
      console.error("Errore estrazione memoria:", e);
    }
  }, [uid, linguistic]);

  // ── Salva memoria quando si lascia il tab o si chiude la finestra ──────────
  useEffect(() => {
    const handleUnload = () => {
      if (messages.length >= 4) extractAndSaveMemory(messages, activeIntent?.id);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [messages, activeIntent, extractAndSaveMemory]);

  // ── Seleziona intenzione  // ── Seleziona intenzione ──────────────────────────────────────────────────
  const selectIntent = (intent) => {
    setActiveIntent(intent);
    setMessages([{
      role: "assistant",
      content: `${intent.icon} **${intent.label}**\n\n${intent.desc}.\n\nScrivi pure qui sotto — più dettagli dai, più preciso sarò.`,
    }]);
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // ── Nuova sessione ────────────────────────────────────────────────────────
  const resetChat = () => {
    // Estrai memoria dalla sessione corrente prima di resettare
    if (messages.length >= 4) {
      extractAndSaveMemory(messages, activeIntent?.id);
    }
    setMessages([]);
    setActiveIntent(null);
    setInput("");
    currentSessionRef.current = null;
  };

  // ── Invia messaggio ───────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = {
      role: "user",
      content: input.trim(),
      intentId: activeIntent?.id,
      userName,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Salva sessione alla prima risposta utente reale
    if (newMessages.filter(m => m.role === "user").length === 1) {
      saveSession(newMessages, activeIntent?.id);
      if (isFirstSession) setIsFirstSession(false);
    }

    try {
      // Cerca lezioni rilevanti (RAG)
      const relevantLessons = await searchRelevantLessons(
        db,
        userData?.moduli,
        input,
        activeIntent?.systemHint || "libera"
      );

      const systemPrompt = buildSystemPrompt(
        activeIntent?.systemHint || "libera",
        userData,
        patterns,
        linguistic,
        sessionCount,
        relevantLessons,
        roleplayInsights,
        noteCoachUmano
      );

      const apiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const rawReply = data.content?.[0]?.text || "Risposta non disponibile.";

      const cleanText = rawReply;

      setMessages(prev => [...prev, {
        role: "assistant",
        content: cleanText,
        intentId: activeIntent?.id,
      }]);

    } catch (e) {
      console.error("Errore API coach:", e);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Connessione temporaneamente non disponibile. Riprova tra un momento.",
      }]);
    }

    setLoading(false);
  };

  const isEmpty = messages.length === 0;
  const hasPatterns = patterns && Object.values(patterns).some(Boolean);
  const hasLinguistic = linguistic && Object.values(linguistic).some(v =>
    Array.isArray(v) ? v.length > 0 : Boolean(v)
  );

  if (!coachReady) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: C.muted, gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.purple, animation: "msCoachPulse 1.2s ease-in-out infinite" }} />
        <style>{`@keyframes msCoachPulse{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
        Caricamento del tuo coach...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 180px)", minHeight: 500 }}>

      {/* ── Pannello sinistro ─────────────────────────────────────────────── */}
      <div style={{
        width: 230, flexShrink: 0,
        display: "flex", flexDirection: "column", gap: 12,
        overflowY: "auto", height: "100%",
      }}>

        {/* Stato sessione */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg,${C.purple},${C.blue})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: glow(C.purple, 8),
          }}>🧠</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>AI Coach</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.green }} />
              <span style={{ fontSize: 11, color: C.green }}>Attivo</span>
              <span style={{ fontSize: 11, color: C.dim }}>·</span>
              <span style={{ fontSize: 11, color: C.muted }}>{sessionCount} sessioni</span>
            </div>
          </div>
        </div>

        {/* Memoria accumulata */}
        {(hasPatterns || hasLinguistic) && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, overflow: "hidden",
          }}>
            <div
              onClick={() => setShowMemory(v => !v)}
              style={{
                padding: "10px 16px", borderBottom: showMemory ? `1px solid ${C.border}` : "none",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", userSelect: "none",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                🧠 Cosa so di te
              </span>
              <span style={{ fontSize: 11, color: C.dim, transform: showMemory ? "rotate(180deg)" : "rotate(0)", display: "inline-block", transition: "transform .2s" }}>▾</span>
            </div>
            {showMemory && (
              <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {patterns?.figura_dominante && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Figura clienti</div>
                    <div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{patterns.figura_dominante}</div>
                  </div>
                )}
                {patterns?.fase_critica && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Punto critico</div>
                    <div style={{ fontSize: 12, color: C.orange, marginTop: 2 }}>{patterns.fase_critica}</div>
                  </div>
                )}
                {patterns?.leva_efficace && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Leva efficace</div>
                    <div style={{ fontSize: 12, color: C.green, marginTop: 2 }}>{patterns.leva_efficace}</div>
                  </div>
                )}
                {patterns?.tasso_chiusura && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Chiusura media</div>
                    <div style={{ fontSize: 12, color: C.text, marginTop: 2 }}>{patterns.tasso_chiusura}</div>
                  </div>
                )}
                {linguistic?.concetti_padroneggiati?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Padroneggiato</div>
                    <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>
                      {linguistic.concetti_padroneggiati.slice(-2).join(", ")}
                    </div>
                  </div>
                )}
                {linguistic?.concetti_parziali?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: C.muted }}>Da rafforzare</div>
                    <div style={{ fontSize: 11, color: C.orange, marginTop: 2 }}>
                      {linguistic.concetti_parziali.slice(-2).join(", ")}
                    </div>
                  </div>
                )}
                <div style={{
                  marginTop: 4, padding: "8px 10px",
                  background: C.purple + "11", border: `1px solid ${C.purple}22`,
                  borderRadius: 8, fontSize: 10, color: C.muted, lineHeight: 1.5,
                }}>
                  💡 Il coach usa questi dati per personalizzare ogni risposta.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Traguardi studente */}
        {roleplayProgressione?.traguardi?.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.purple}44`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                🏆 I tuoi traguardi
              </span>
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
              {roleplayProgressione.traguardi.slice(0, 5).map((t, i) => (
                <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: C.surface }}>
                  <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>✓ {t.titolo}</div>
                  {t.data && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{new Date(t.data).toLocaleDateString("it-IT")}</div>}
                </div>
              ))}
              {roleplayProgressione.messaggio_studente && (
                <div style={{ padding: "8px 10px", borderRadius: 8, background: C.purple + "11", marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: C.purple, fontStyle: "italic" }}>{roleplayProgressione.messaggio_studente}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessioni recenti */}
        {recentSessions.length > 0 && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                ⏱ Sessioni recenti
              </span>
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
              {recentSessions.map((s, i) => {
                const intent = INTENTS.find(int => int.id === s.intent_id);
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 8px", borderRadius: 8, background: C.surface,
                  }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{intent?.icon || "💬"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: C.text, lineHeight: 1.3 }}>
                        {s.intent_label}
                      </div>
                      {s.anteprima && (
                        <div style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.anteprima}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Moduli dello studente */}
        {userData?.moduli?.length > 0 && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, overflow: "hidden",
          }}>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                📚 I tuoi corsi
              </span>
            </div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
              {userData.moduli.map((m, i) => {
                const lezioni = m.videolezioni || [];
                const completate = lezioni.filter(v => v.progress === 100).length;
                const pct = lezioni.length > 0 ? Math.round((completate / lezioni.length) * 100) : 0;
                return (
                  <div key={i} style={{
                    padding: "6px 8px", borderRadius: 8, background: C.surface,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: C.text, fontWeight: 600, flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                        {m.emoji || "📚"} {m.title}
                      </span>
                      <span style={{ fontSize: 10, color: pct === 100 ? C.green : C.muted, flexShrink: 0, marginLeft: 6 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? C.green : C.blue, borderRadius: 2, transition: "width .4s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Area chat principale ──────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, overflow: "hidden", minWidth: 0,
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
          background: `linear-gradient(135deg,${C.purple}11,transparent)`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: `linear-gradient(135deg,${C.purple},${C.blue})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, boxShadow: glow(C.purple, 8),
            }}>🧠</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>MindSell AI Coach</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
                <span style={{ fontSize: 11, color: C.green }}>Personalizzato per {userName.split(" ")[0]}</span>
              </div>
            </div>
          </div>
          {!isEmpty && (
            <button onClick={resetChat} style={{
              background: "none", border: `1px solid ${C.border}`,
              color: C.muted, borderRadius: 8, padding: "6px 12px",
              cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            }}>↩ Nuova sessione</button>
          )}
        </div>

        {/* Corpo messaggi */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px" }}>

          {/* Stato iniziale: box intenzioni */}
          {isEmpty && (
            <div style={{ animation: "msCoachFade .4s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 8 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", margin: "0 auto 14px",
                  background: `linear-gradient(135deg,${C.purple},${C.blue})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, boxShadow: glow(C.purple, 14),
                }}>🧠</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
                  Ciao {userName.split(" ")[0]}. 👋
                </div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
                  Sono il tuo coach AI. Cosa vuoi fare oggi?
                </div>
              </div>

              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: 16, marginBottom: 20,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: C.muted,
                  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12,
                }}>Scegli un'azione</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {INTENTS.map(intent => (
                    <button
                      key={intent.id}
                      onClick={() => selectIntent(intent)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "transparent",
                        border: `1px solid ${intent.color}33`,
                        borderRadius: 10, padding: "11px 14px",
                        cursor: "pointer", textAlign: "left",
                        fontFamily: "inherit", color: C.text,
                        transition: "all .15s",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = intent.color + "11";
                        e.currentTarget.style.borderColor = intent.color + "66";
                        e.currentTarget.style.boxShadow = glow(intent.color, 4);
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = intent.color + "33";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: intent.color + "18",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16,
                      }}>{intent.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{intent.label}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{intent.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: C.muted }}>
                oppure scrivi direttamente qui sotto ↓
              </div>
            </div>
          )}

          {/* Messaggi */}
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          {loading && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg,${C.purple},${C.blue})`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}>🧠</div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "4px 16px 16px 16px" }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${C.border}`,
          background: C.surface, flexShrink: 0,
        }}>
          {activeIntent && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                padding: "3px 10px", borderRadius: 20,
                background: activeIntent.color + "18", color: activeIntent.color,
                border: `1px solid ${activeIntent.color}33`,
              }}>
                {activeIntent.icon} {activeIntent.label}
              </span>
              <button onClick={resetChat} style={{
                background: "none", border: "none", color: C.muted,
                cursor: "pointer", fontSize: 11, fontFamily: "inherit",
              }}>✕ cambia</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                activeIntent
                  ? activeIntent.placeholder.split("\n\n")[0]
                  : "Scrivi al tuo coach... (Invio per inviare, Shift+Invio per andare a capo)"
              }
              rows={3}
              style={{
                flex: 1, background: C.card, border: `1px solid ${C.border}`,
                color: C.text, borderRadius: 10, padding: "10px 14px",
                fontSize: 13, fontFamily: "inherit", lineHeight: 1.6,
                outline: "none", resize: "none", transition: "border-color .15s",
              }}
              onFocus={e => e.target.style.borderColor = C.purple + "88"}
              onBlur={e => e.target.style.borderColor = C.border}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: input.trim() && !loading
                  ? `linear-gradient(135deg,${C.purple},${C.blue})`
                  : C.dim,
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                fontSize: 18, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: input.trim() && !loading ? glow(C.purple, 8) : "none",
                transition: "all .2s",
              }}
            >↑</button>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: C.dim, textAlign: "center" }}>
            AI Coach · sessioni salvate in automatico · {sessionCount} in memoria
          </div>
        </div>
      </div>
    </div>
  );
}
