const { google } = require("googleapis");

// ── Aree di valutazione ───────────────────────────────────────────────────────
const AREE = ["chiusura", "gestione_obiezioni", "rapport", "struttura_pitch", "ascolto_attivo"];

// ── Helper: parse credenziali Google ─────────────────────────────────────────
function parseCredentials(raw) {
  try { return JSON.parse(raw); } catch (e) {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

// ── Helper: leggi Google Doc ──────────────────────────────────────────────────
async function readGoogleDoc(fileId, credentials) {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });
  const docsClient = google.docs({ version: "v1", auth });
  const doc = await docsClient.documents.get({ documentId: fileId });
  const lines = [];
  for (const el of doc.data.body?.content || []) {
    if (!el.paragraph) continue;
    const text = el.paragraph.elements?.map(e => e.textRun?.content || "").join("").replace(/\n$/, "").trim();
    if (text) lines.push(text);
  }
  return lines.join("\n");
}

// ── Helper: chiama Anthropic ──────────────────────────────────────────────────
async function callAnthropic(apiKey, system, user, maxTokens = 2000) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await response.json();
  const raw = data.content?.[0]?.text || "";
  // Pulizia robusta: rimuovi backtick, estrai solo il JSON
  let clean = raw.replace(/```json|```/g, "").trim();
  // Trova il primo { e l'ultimo } per estrarre solo il JSON
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(clean);
  } catch(e) {
    console.error("JSON parse error:", e.message, "Raw:", raw.slice(0, 200));
    throw new Error("Risposta AI non valida: " + e.message);
  }
}

// ── Analisi singola sessione ──────────────────────────────────────────────────
async function analizzaSingola(apiKey, trascrizione, dataOra) {
  const system = `Sei un coach esperto di vendita e formazione professionale. Analizzi documenti di sessioni con studenti — possono essere trascrizioni di roleplay, appunti di sessioni didattiche, report di coaching, analisi di trattative o qualsiasi altro tipo di contenuto formativo.
Leggi il contenuto, capisci autonomamente di cosa si tratta ed estrai tutto ciò che è rilevante per la crescita professionale dello studente.
Non presupporre il tipo di sessione — lascia che sia il contenuto a guidarti.
Rispondi SOLO con JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.`;

  const user = `Leggi questo documento relativo a una sessione con uno studente di vendita.
Capisci autonomamente di cosa si tratta ed estrai gli insight rilevanti per la sua crescita.

DOCUMENTO:
${trascrizione.slice(0, 12000)}

Schema JSON esatto:
{
  "data_analisi": "${dataOra}",
  "tipo_sessione": "roleplay|coaching|didattica|analisi_trattativa|altro — rileva autonomamente",
  "titolo": "titolo descrittivo che cattura l'essenza della sessione",
  "contesto": "descrizione in 2-3 righe di cosa è successo e qual era l'obiettivo",
  "argomenti_trattati": ["argomento specifico affrontato nella sessione"],
  "punti_di_forza": ["comportamento o competenza positiva osservata — specifico"],
  "errori_ricorrenti": ["errore o limite osservato — solo se presente nel documento"],
  "pattern_comportamentali": ["pattern comportamentale o cognitivo osservato"],
  "criticita_sessione": ["criticità specifica e concreta emersa — momento o meccanismo preciso"],
  "concetti_da_rinforzare": ["concetto o competenza su cui lavorare"],
  "progressi_osservati": ["miglioramento concreto osservato — solo se menzionato esplicitamente"],
  "raccomandazione_coach": "la cosa più importante su cui focalizzarsi — max 2 righe",
  "score_aree": {
    "chiusura": 50,
    "gestione_obiezioni": 50,
    "rapport": 50,
    "struttura_pitch": 50,
    "ascolto_attivo": 50
  }
}

REGOLE:
- Ogni array: 2-4 elementi massimo, solo con evidenza reale nel documento
- Se un area in score_aree non è osservabile lascia 50 (neutro)
- score: 0-30 critico, 31-60 in sviluppo, 61-80 discreto, 81-100 solido
- Non inventare dati non presenti
- argomenti_trattati è sempre obbligatorio`;

  return await callAnthropic(apiKey, system, user);
}

// ── Analisi comparativa (quando ci sono sessioni precedenti) ──────────────────
async function analizzaProgressione(apiKey, nuovaAnalisi, analisiPrecedenti, moduliCompletati) {
  const system = `Sei un coach esperto di vendita che valuta il progresso di uno studente nel tempo.
Rispondi SOLO con JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.`;

  const precedentiSummary = analisiPrecedenti.slice(0, 3).map((a, i) => ({
    sessione: i + 1,
    data: a.data_analisi,
    errori: a.errori_ricorrenti,
    punti_forza: a.punti_di_forza,
    obiezioni: a.obiezioni_non_gestite,
    score: a.score_aree,
  }));

  const user = `Valuta il progresso dello studente confrontando la sessione attuale con quelle precedenti.

SESSIONE ATTUALE:
${JSON.stringify(nuovaAnalisi, null, 2)}

SESSIONI PRECEDENTI (dalla più recente):
${JSON.stringify(precedentiSummary, null, 2)}

MODULI DIDATTICI COMPLETATI:
${moduliCompletati.length > 0 ? moduliCompletati.join(", ") : "nessuno ancora"}

Restituisci questo schema JSON esatto:
{
  "errori_superati": ["errore presente prima ma NON in questa sessione — solo se assente per la prima volta"],
  "errori_persistenti": ["errore presente in 2+ sessioni consecutive inclusa questa"],
  "miglioramenti_osservati": ["miglioramento concreto rispetto alle sessioni precedenti"],
  "regressioni_osservate": ["peggioramento rispetto alle sessioni precedenti, se presente"],
  "gap_teoria_pratica": ["concetto studiato nei moduli ma non ancora applicato in campo"],
  "transfer_riuscito": ["concetto studiato che lo studente sta applicando correttamente"],
  "score_progressione": {
    "chiusura": { "score": 0, "trend": "↑", "variazione": 0 },
    "gestione_obiezioni": { "score": 0, "trend": "→", "variazione": 0 },
    "rapport": { "score": 0, "trend": "↑", "variazione": 0 },
    "struttura_pitch": { "score": 0, "trend": "↓", "variazione": 0 },
    "ascolto_attivo": { "score": 0, "trend": "→", "variazione": 0 }
  },
  "traguardi_raggiunti": [
    { "titolo": "descrizione traguardo", "descrizione": "spiegazione breve" }
  ],
  "focus_prossima_sessione": "la cosa più importante su cui concentrarsi — max 2 righe",
  "messaggio_studente": "messaggio positivo per lo studente che celebra i progressi — max 1 riga, caldo e diretto"
}

REGOLE:
- trend: "↑" se migliorato, "↓" se peggiorato, "→" se stabile
- variazione: differenza numerica rispetto alla media delle sessioni precedenti (es. +12, -5, 0)
- traguardi_raggiunti: SOLO se c'è un miglioramento significativo e misurabile — può essere array vuoto
- gap_teoria_pratica: solo se ci sono moduli completati con concetti non applicati
- Sii onesto e preciso — non esagerare né minimizzare`;

  return await callAnthropic(apiKey, system, user, 2000);
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { docUrl, docId, analisiPrecedenti = [], moduliCompletati = [] } = req.body;
  if (!docUrl && !docId) return res.status(400).json({ error: "docUrl o docId richiesto" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const googleCredentials = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY mancante" });
  if (!googleCredentials) return res.status(500).json({ error: "GOOGLE_SERVICE_ACCOUNT mancante" });

  try {
    // Estrai ID dal URL
    let fileId = docId;
    if (!fileId && docUrl) {
      const match = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) return res.status(400).json({ error: "URL Google Doc non valido" });
      fileId = match[1];
    }

    // Leggi documento
    const credentials = parseCredentials(googleCredentials);
    const trascrizione = await readGoogleDoc(fileId, credentials);
    if (trascrizione.length < 100) return res.status(400).json({ error: "Documento troppo corto o vuoto" });

    const dataOra = new Date().toISOString();

    // Analisi singola sessione
    const analisi = await analizzaSingola(apiKey, trascrizione, dataOra);

    // Analisi progressione (solo se ci sono sessioni precedenti)
    let progressione = null;
    if (analisiPrecedenti.length > 0) {
      progressione = await analizzaProgressione(apiKey, analisi, analisiPrecedenti, moduliCompletati);
    }

    res.status(200).json({ analisi, progressione, doc_id: fileId });

  } catch (err) {
    console.error("analyze-roleplay error:", err);
    res.status(500).json({ error: err.message });
  }
};
