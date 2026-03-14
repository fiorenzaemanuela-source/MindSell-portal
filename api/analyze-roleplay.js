const { google } = require("googleapis");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { docUrl, docId } = req.body;
  if (!docUrl && !docId) return res.status(400).json({ error: "docUrl o docId richiesto" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const googleCredentials = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY mancante" });
  if (!googleCredentials) return res.status(500).json({ error: "GOOGLE_SERVICE_ACCOUNT mancante" });

  try {
    // Estrai ID dal URL se necessario
    let fileId = docId;
    if (!fileId && docUrl) {
      const match = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (!match) return res.status(400).json({ error: "URL Google Doc non valido" });
      fileId = match[1];
    }

    // Leggi il documento Google — gestisce JSON con o senza escape
    let credentials;
    try {
      credentials = JSON.parse(googleCredentials);
    } catch (e) {
      // Prova a decodificare se è stato encodato
      credentials = JSON.parse(Buffer.from(googleCredentials, 'base64').toString('utf8'));
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/documents.readonly"],
    });
    const docsClient = google.docs({ version: "v1", auth });
    const doc = await docsClient.documents.get({ documentId: fileId });

    // Estrai testo
    const content = doc.data.body?.content || [];
    const lines = [];
    for (const el of content) {
      if (!el.paragraph) continue;
      const text = el.paragraph.elements?.map(e => e.textRun?.content || "").join("").replace(/\n$/, "").trim();
      if (text) lines.push(text);
    }
    const trascrizione = lines.join("\n");

    if (trascrizione.length < 100) {
      return res.status(400).json({ error: "Documento troppo corto o vuoto" });
    }

    // Analisi via Anthropic
    const systemPrompt = `Sei un coach esperto di vendita. Analizzi trascrizioni di roleplay di studenti di vendita.
Il tuo compito è estrarre insight pratici e precisi dalla trascrizione.
Rispondi ONLY con JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.`;

    const userPrompt = `Analizza questa trascrizione di roleplay di vendita ed estrai insight strutturati.

TRASCRIZIONE:
${trascrizione.slice(0, 8000)}

Rispondi con questo schema JSON esatto:
{
  "data_analisi": "${new Date().toISOString()}",
  "titolo": "titolo descrittivo breve della sessione roleplay",
  "contesto": "descrizione in 1-2 righe del tipo di trattativa simulata",
  "punti_di_forza": [
    "cosa fa bene lo studente — specifico e concreto"
  ],
  "errori_ricorrenti": [
    "errore specifico osservato — con esempio dalla trascrizione"
  ],
  "pattern_comportamentali": [
    "pattern comportamentale osservato — specifico"
  ],
  "obiezioni_non_gestite": [
    "obiezione che lo studente non ha saputo gestire"
  ],
  "concetti_da_rinforzare": [
    "concetto del corso che deve approfondire"
  ],
  "raccomandazione_coach": "la cosa più importante su cui lavorare nelle prossime sessioni — max 2 righe"
}

REGOLE:
- Ogni array deve avere 2-4 elementi massimo
- Solo dati con evidenza reale nella trascrizione
- Linguaggio diretto e pratico, non generico`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const analisi = JSON.parse(clean);

    res.status(200).json({ analisi, doc_id: fileId });

  } catch (err) {
    console.error("analyze-roleplay error:", err);
    res.status(500).json({ error: err.message });
  }
};
