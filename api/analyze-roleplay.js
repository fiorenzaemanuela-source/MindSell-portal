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
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ── Analisi singola sessione ──────────────────────────────────────────────────
async function analizzaSingola(apiKey, trascrizione, dataOra) {
  const system = `Sei un coach esperto di vendita. Analizzi trascrizioni di sessioni di studenti.
Rispondi SOLO con JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.`;

  const user = `Analizza questa trascrizione e restituisci insight strutturati.

TRASCRIZIONE:
${trascrizione.slice(0, 8000)}

Schema JSON esatto:
{
  "data_analisi": "${dataOra}",
  "titolo": "titolo descrittivo breve della sessione",
  "contesto": "descrizione in 1-2 righe del tipo di situazione",
  "punti_di_forza": ["cosa fa bene — specifico con esempio"],
  "errori_ricorrenti": ["errore specifico con esempio dalla trascrizione"],
  "pattern_comportamentali": ["pattern osservato — specifico"],
  "obiezioni_non_gestite": ["obiezione non gestita bene"],
  "concetti_da_rinforzare": ["concetto del corso da approfondire"],
  "raccomandazione_coach": "la cosa più importante su cui lavorare — max 2 righe",
  "score_aree": {
    "chiusura": 0,
    "gestione_obiezioni": 0,
    "rapport": 0,
    "struttura_pitch": 0,
    "ascolto_attivo": 0
  }
}

REGOLE score_aree:
- Valuta ogni area da 0 a 100 basandoti SOLO su evidenze nella trascrizione
- 0-30: area critica con errori frequenti
- 31-60: area in sviluppo con alti e bassi
- 61-80: area discreta con margini di miglioramento
- 81-100: area solida
- Se un'area non è osservabile nella trascrizione, metti 50 (neutro)
- Ogni array: 2-4 elementi massimo
- Solo dati con evidenza reale`;

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
