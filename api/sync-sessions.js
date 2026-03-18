/**
 * api/sync-sessions.js — MindSell Academy
 * Sincronizza il conteggio sessioni usate da Google Calendar → Firestore
 * Chiamato da cron-job.org ogni notte
 *
 * Protezione: richiede header Authorization: Bearer SYNC_SECRET_TOKEN
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createSign } from "crypto";

// ── Init Firebase Admin ───────────────────────────────────────────────────────
function getDb() {
  if (!getApps().length) {
    let credentials;
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
    try {
      credentials = JSON.parse(raw);
    } catch {
      credentials = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    }
    initializeApp({ credential: cert(credentials) });
  }
  return getFirestore();
}

// ── Genera JWT per Google Calendar API ───────────────────────────────────────
async function getAccessToken() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(privateKey, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await tokenRes.json();
  if (!data.access_token) throw new Error("Token fallito: " + JSON.stringify(data));
  return data.access_token;
}

// ── Fetch eventi calendario per email ────────────────────────────────────────
async function fetchEventiStudente(email, accessToken) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const timeMin = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&singleEvents=true&orderBy=startTime&maxResults=500`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return (data.items || []).filter(e =>
    (e.attendees || []).some(a => a.email?.toLowerCase() === email.toLowerCase())
  );
}

// ── Rileva tipo sessione dal titolo evento ────────────────────────────────────
function getType(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("roleplay")) return "roleplay";
  if (t.includes("aula") || t.includes("didatt")) return "aula";
  if (t.includes("onboarding") || t.includes("storage")) return "onboarding";
  return "onetoone";
}

// ── Conta sessioni passate per tipo ──────────────────────────────────────────
function contaSessioniPassate(eventi) {
  const now = new Date();
  const conteggioPassate = { aula: 0, roleplay: 0, onetoone: 0, onboarding: 0 };
  eventi
    .filter(e => {
      const dt = e.start?.dateTime || e.start?.date;
      return dt && new Date(dt) < now;
    })
    .forEach(e => {
      const tipo = getType(e.summary);
      conteggioPassate[tipo]++;
    });
  return conteggioPassate;
}

// ── Aggiorna packages studente ────────────────────────────────────────────────
function aggiornaPackages(packages, conteggioPassate) {
  let aggiornato = false;
  const pkgsNew = (packages || []).map(p => {
    const label = (p.label || "").toLowerCase();
    let tipo = null;
    if (label.includes("roleplay")) tipo = "roleplay";
    else if (label.includes("aula") || label.includes("didatt")) tipo = "aula";
    else if (label.includes("one") || label.includes("1to1") || label.includes("1 to 1") ||
             label.includes("individ") || label.includes("personal") || label.includes("coaching")) tipo = "onetoone";
    else if (label.includes("onboarding") || label.includes("storage")) tipo = "onboarding";

    if (!tipo) return p;
    const nuovoUsed = Math.min(conteggioPassate[tipo] || 0, p.total || 0);
    if (nuovoUsed !== p.used) {
      aggiornato = true;
      return { ...p, used: nuovoUsed };
    }
    return p;
  });
  return { pkgsNew, aggiornato };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verifica token di sicurezza (da header o query param)
  const authHeader = req.headers.authorization || "";
  const tokenHeader = authHeader.replace("Bearer ", "");
  const tokenQuery = req.query.token || "";
  const token = tokenHeader || tokenQuery;
  if (token !== process.env.SYNC_SECRET_TOKEN) {
    return res.status(401).json({ error: "Non autorizzato" });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const risultati = { aggiornati: 0, invariati: 0, errori: 0, dettagli: [] };

  try {
    const db = getDb();
    const accessToken = await getAccessToken();

    // Carica tutti gli studenti
    const snapStudenti = await db.collection("studenti").get();
    const studenti = snapStudenti.docs.map(d => ({ uid: d.id, ...d.data() }));

    console.log(`[sync-sessions] Studenti trovati: ${studenti.length}`);

    for (const studente of studenti) {
      if (!studente.email || !studente.packages?.length) {
        risultati.invariati++;
        continue;
      }

      try {
        const eventi = await fetchEventiStudente(studente.email, accessToken);
        const conteggioPassate = contaSessioniPassate(eventi);
        const { pkgsNew, aggiornato } = aggiornaPackages(studente.packages, conteggioPassate);

        if (aggiornato) {
          await db.collection("studenti").doc(studente.uid).update({ packages: pkgsNew });
          risultati.aggiornati++;
          risultati.dettagli.push({
            nome: studente.name,
            uid: studente.uid,
            conteggio: conteggioPassate,
          });
          console.log(`[sync-sessions] Aggiornato: ${studente.name} - ${JSON.stringify(conteggioPassate)}`);
        } else {
          risultati.invariati++;
        }

        // Pausa per evitare rate limit Google
        await new Promise(r => setTimeout(r, 300));

      } catch (err) {
        console.error(`[sync-sessions] Errore su ${studente.name}: ${err.message}`);
        risultati.errori++;
      }
    }

    console.log(`[sync-sessions] Completato: ${JSON.stringify(risultati)}`);
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      ...risultati,
    });

  } catch (err) {
    console.error("[sync-sessions] Errore fatale:", err.message);
    res.status(500).json({ error: err.message });
  }
}
