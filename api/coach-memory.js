module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const { messages, intentId } = req.body;
  if (!messages || messages.length < 2) {
    return res.status(200).json({ update: null, reason: "conversazione troppo breve" });
  }

  // Costruisce il testo della conversazione
  const conversationText = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => `${m.role === "user" ? "STUDENTE" : "COACH"}: ${m.content}`)
    .join("\n\n");

  const systemPrompt = `Sei un analista esperto di vendita. Analizzi conversazioni tra uno studente di vendita e il suo AI Coach.
Il tuo compito è estrarre pattern comportamentali e profilo linguistico dello studente dalla conversazione.

Rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.

Schema esatto da restituire:
{
  "ha_dati_sufficienti": true/false,
  "session_type": "tipo sessione rilevata",
  "patterns": {
    "figura_dominante": "Professore|Artista|Guardia|null — figura dei clienti dello studente emersa dalla conversazione",
    "bias_ricorrente": "nome bias rilevato nei suoi clienti o null",
    "fase_critica": "fase della trattativa dove lo studente ha più difficoltà o null",
    "leva_efficace": "leva che funziona meglio per questo studente o null",
    "tasso_chiusura": "percentuale o descrizione se menzionata, altrimenti null",
    "obiezione_irrisolta": "obiezione che lo studente non sa ancora gestire o null"
  },
  "linguistic": {
    "stile_comunicativo": "diretto|narrativo|analitico|frammentato o null",
    "stile_ragionamento": "intuitivo|metodico|emotivo o null",
    "concetto_padroneggiato": "un solo concetto che lo studente dimostra di aver capito bene, o null",
    "concetto_parziale": "un solo concetto che conosce ma applica in modo incompleto, o null",
    "errore_concettuale": "un solo errore di comprensione rilevato, o null"
  },
  "insight_coach": "la cosa più importante emersa in questa sessione in max 15 parole"
}

REGOLE:
- Compila solo i campi con evidenza reale nella conversazione
- Usa null per tutto ciò che non emerge chiaramente
- Se la conversazione è troppo breve o generica, imposta ha_dati_sufficienti: false
- Non inventare dati non presenti nella conversazione`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Analizza questa conversazione (tipo sessione: ${intentId || "libera"}):\n\n${conversationText}`
          }
        ]
      })
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text || "";

    // Pulizia JSON
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (!parsed.ha_dati_sufficienti) {
      return res.status(200).json({ update: null, reason: "dati insufficienti" });
    }

    res.status(200).json({ update: parsed });

  } catch (err) {
    console.error("coach-memory error:", err);
    res.status(500).json({ error: err.message });
  }
};
