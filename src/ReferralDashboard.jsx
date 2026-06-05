import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, orderBy, query, where, serverTimestamp, setDoc, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// ─── Brand Colors ───────────────────────────────────────────
const B = {
  green: "#6AB309",
  greenDark: "#4d8200",
  greenDim: "rgba(106,179,9,0.12)",
  blue: "#045FA5",
  blueDim: "rgba(4,95,165,0.12)",
  bg: "#080B10",
  surface: "#0E1318",
  card: "#131920",
  border: "#1E2A35",
  text: "#FFFFFF",
  textSoft: "#C8D6E5",
  muted: "#6B7A8D",
  amber: "#F59E0B",
  purple: "#7C3AED",
  red: "#DC2626",
};

const TIERS = [
  { id: "Bronze",   emoji: "🥉", soglia: 0,  label: "Partenza" },
  { id: "Silver",   emoji: "🥈", soglia: 3,  label: "3 acquisiti" },
  { id: "Gold",     emoji: "🥇", soglia: 7,  label: "7 acquisiti" },
  { id: "Platinum", emoji: "💎", soglia: 15, label: "15 acquisiti" },
];

const PIPELINE_STEPS = [
  { key: "segnalato",    label: "Segnalato",    icon: "✓" },
  { key: "contattato",   label: "Contattato",   icon: "📞" },
  { key: "appuntamento", label: "Appuntamento", icon: "📅" },
  { key: "proposta",     label: "Proposta",     icon: "📄" },
  { key: "acquisito",    label: "Acquisito",    icon: "✅" },
  { key: "perso",        label: "Perso",        icon: "✗" },
];

const STEP_COLORS = [
  { bg: "#0c2a3a", border: "#185FA5", color: "#378ADD", line: "#185FA5" },
  { bg: "#0a2a30", border: "#0F6E56", color: "#1D9E75", line: "#0F6E56" },
  { bg: "#0d2e1a", border: "#3a7000", color: "#6AB309", line: "#3a7000" },
  { bg: "#1a2800", border: "#6AB309", color: "#a8e040", line: "#6AB309" },
];

function getTierIndex(livello) { return TIERS.findIndex(t => t.id === livello); }
function getNextTier(livello) { const idx = getTierIndex(livello); return idx < TIERS.length - 1 ? TIERS[idx + 1] : null; }
function getProgressPct(acquisiti, livello) {
  const next = getNextTier(livello);
  if (!next) return 100;
  const curr = TIERS[getTierIndex(livello)];
  return Math.min(100, Math.max(0, Math.round(((acquisiti - curr.soglia) / (next.soglia - curr.soglia)) * 100)));
}

function PipelineBar({ stato }) {
  const activeIdx = PIPELINE_STEPS.findIndex(s => s.key === stato);
  const isPerso = stato === "perso";
  const isAcquisito = stato === "acquisito";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
      {PIPELINE_STEPS.map((step, i) => {
        const isLast = i === PIPELINE_STEPS.length - 1;
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;

        let dotStyle = { width: 22, height: 22, borderRadius: "50%", border: "1.5px solid #2a3a4a", background: "#0E1318", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, zIndex: 1, color: B.muted };
        let labelColor = B.muted;

        if (isAcquisito && i === 4) {
          dotStyle = { ...dotStyle, background: "#1a2800", border: `1.5px solid ${B.green}`, color: B.green };
          labelColor = B.green;
        } else if (isPerso && i === 5) {
          dotStyle = { ...dotStyle, background: "#2a0f0f", border: "1.5px solid #A32D2D", color: "#f87171" };
          labelColor = "#f87171";
        } else if (isActive) {
          dotStyle = { ...dotStyle, background: B.greenDim, border: `1.5px solid ${B.green}`, color: B.green, boxShadow: `0 0 0 3px ${B.greenDim}` };
          labelColor = B.green;
        } else if (isDone) {
          const c = STEP_COLORS[Math.min(i, STEP_COLORS.length - 1)];
          dotStyle = { ...dotStyle, background: c.bg, border: `1.5px solid ${c.border}`, color: c.color };
        }

        let lineColor = "#1E2A35";
        if (isPerso && i >= activeIdx) lineColor = "#A32D2D";
        else if (isDone || (isAcquisito && i === 3)) lineColor = STEP_COLORS[Math.min(i, STEP_COLORS.length - 1)].line;

        return (
          <div key={step.key} style={{ display: "flex", alignItems: "flex-start", flex: isLast ? "0 0 auto" : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={dotStyle}><span style={{ fontSize: 9 }}>{step.icon}</span></div>
              <span style={{ fontSize: 9, color: labelColor, textAlign: "center", lineHeight: 1.3 }}>{step.label}</span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, display: "flex", alignItems: "flex-start", paddingTop: 11, minWidth: 4 }}>
                <div style={{ width: "100%", height: 1.5, background: lineColor }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead }) {
  const dataStr = lead.dataCreazione?.toDate ? lead.dataCreazione.toDate().toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <div style={{ background: B.surface, border: `1px solid ${B.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: B.text }}>{lead.nome} {lead.cognome}</span>
        <span style={{ fontSize: 11, color: B.muted }}>{dataStr}</span>
      </div>
      <div style={{ fontSize: 12, color: B.textSoft, marginBottom: 10 }}>
        {lead.email}{lead.telefono && ` · ${lead.telefono}`}
        {lead.note && <><br /><span style={{ color: B.muted, fontStyle: "italic" }}>{lead.note}</span></>}
      </div>
      <PipelineBar stato={lead.stato} />
      {lead.stato === "acquisito" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: B.greenDim, border: `1px solid ${B.green}`, color: B.green, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, marginTop: 8 }}>
          💰 Commissione attiva
        </div>
      )}
      {lead.stato === "perso" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#2a0f0f", border: "1px solid #7f1d1d", color: "#f87171", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, marginTop: 8 }}>
          ✗ Lead non acquisito
        </div>
      )}
    </div>
  );
}

export default function ReferralDashboard({ uid, userData }) {
  const livello = userData?.referralLivello || "Bronze";
  const acquisiti = userData?.referralAcquisiti || 0;
  const nextTier = getNextTier(livello);
  const progressPct = getProgressPct(acquisiti, livello);
  const mancano = nextTier ? nextTier.soglia - acquisiti : 0;
  const firstName = userData?.name?.split(" ")[0] || "";

  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState("leads");
  const [form, setForm] = useState({ nome: "", cognome: "", email: "", telefono: "", note: "" });
  const [formOk, setFormOk] = useState(false);
  const [post, setPost] = useState("");
  const [argomento, setArgomento] = useState(null);
  const [canale, setCanale] = useState("linkedin");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Brochure
  const [brochure, setBrochure] = useState([]);
  const [conferme, setConferme] = useState({});
  const [brochureLoaded, setBrochureLoaded] = useState(false);
  const tutteConfermante = brochure.length === 0 ? true : brochure.filter(b => b.obbligatoria).every(b => conferme[b.id]);

  // Leads da Firestore
  useEffect(() => {
    if (!uid || uid.length < 5) return;
    let unsub = null;
    try {
      const q = query(collection(db, "referrals"), where("studenteUid", "==", uid), orderBy("dataCreazione", "desc"));
      unsub = onSnapshot(q,
        (snap) => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.warn("Referral listener error:", err.code)
      );
    } catch(e) { console.warn("Referral query error:", e); }
    return () => { if (unsub) unsub(); };
  }, [uid]);

  // Brochure da Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "referralBrochure"), snap => {
      setBrochure(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Conferme lettura da Firestore
  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      const snap = await getDoc(doc(db, "studenti", uid, "referralConferme", "letture"));
      if (snap.exists()) setConferme(snap.data());
      setBrochureLoaded(true);
    };
    load();
  }, [uid]);

  const confermaBrochure = async (brochureId) => {
    const nuove = { ...conferme, [brochureId]: new Date().toISOString() };
    setConferme(nuove);
    await setDoc(doc(db, "studenti", uid, "referralConferme", "letture"), nuove, { merge: true });
  };

  async function submitLead() {
    if (!form.nome || !form.cognome || !form.email) return;
    try {
      await addDoc(collection(db, "referrals"), {
        ...form,
        stato: "segnalato",
        dataCreazione: serverTimestamp(),
        studenteUid: uid,
        studenteName: userData?.name || "",
      });
      setForm({ nome: "", cognome: "", email: "", telefono: "", note: "" });
      setFormOk(true);
      setTimeout(() => setFormOk(false), 4000);
      // Notifica email admin
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "nuovo_lead",
          dati: { studenteName: userData?.name || "", ...form },
        }),
      }).catch(e => console.warn("Email notifica fallita:", e));
    } catch(e) { console.error("Errore salvataggio lead:", e); }
  }

  const ARGOMENTI = [
    { id: 1, label: "Perché i venditori non chiudono", prompt: "Perché il 70% dei venditori non chiude abbastanza" },
    { id: 2, label: "Trasformare i no in opportunità", prompt: "Come trasformare i no in opportunità di vendita" },
    { id: 3, label: "Costruire fiducia col cliente", prompt: "Il metodo MindSell per costruire fiducia con il cliente" },
    { id: 4, label: "Formazione che cambia le performance", prompt: "Perché la formazione alla vendita cambia le performance del team" },
    { id: 5, label: "Strutturare un processo vincente", prompt: "Come strutturare un processo di vendita vincente" },
    { id: 6, label: "3 errori nella vendita consultiva", prompt: "I 3 errori più comuni nella vendita consultiva" },
  ];

  async function generatePost() {
    if (!argomento) return;
    setGenerating(true); setPost("");
    const chLabel = canale === "linkedin" ? "LinkedIn" : "Instagram e Facebook";
    const tone = canale === "linkedin" ? "professionale, autorevole, paragrafi brevi, hashtag pertinenti alla fine" : "diretto, coinvolgente, storytelling breve, emoji vivaci, call to action chiara, hashtag popolari alla fine";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `Sei un copywriter esperto di formazione commerciale. Scrivi un post ${chLabel} per promuovere MindSell Academy.\n\nArgomento: ${argomento.prompt}\nTono: ${tone}\n\nIl post deve aprire con un hook forte, sviluppare il tema e concludere con call to action verso academy.mindsell.it. Scrivi solo il testo del post.` }] }),
      });
      const data = await res.json();
      setPost(data.content?.[0]?.text || "Errore. Riprova.");
    } catch { setPost("Errore di connessione. Riprova."); }
    setGenerating(false);
  }

  // ─── ALERT DINAMICO ──────────────────────────────────────────
  function renderAlert() {
    const tuttiPersi = leads.length > 0 && leads.every(l => l.stato === "perso");
    const platinum = livello === "Platinum";
    const inCorso = leads.filter(l => l.stato !== "perso" && l.stato !== "acquisito").length;

    if (platinum) return { emoji: "💎", color: "#c4b5fd", bg: "#1e1a3a", border: "#534AB7", msg: <><strong>Sei al livello Platinum!</strong> Hai raggiunto il massimo — grazie per il tuo impegno straordinario.</> };
    if (leads.length === 0) return { emoji: "🚀", color: B.green, bg: B.greenDim, border: B.green, msg: <><strong>Inizia ora!</strong> Segnala il tuo primo contatto e guadagna la tua prima commissione.</> };
    if (tuttiPersi) return { emoji: "💪", color: B.amber, bg: "rgba(245,158,11,0.1)", border: B.amber, msg: <><strong>Non mollare!</strong> Ogni no avvicina al prossimo sì. Segnala un nuovo contatto qualificato.</> };
    if (nextTier && mancano > 0) return { emoji: "⚡", color: B.green, bg: B.greenDim, border: B.green, msg: <><strong>Ti mancano {mancano} lead acquisiti per raggiungere il livello {nextTier.id}.</strong>{inCorso > 0 ? ` Hai ${inCorso} lead in corso — continua così!` : " Segnala nuovi contatti per salire di livello."}</> };
    return null;
  }
  const alert = renderAlert();

  const S = {
    page: { background: B.bg, minHeight: "100vh", padding: "20px 24px 40px", color: B.text },
    card: { background: B.card, border: `1px solid ${B.border}`, borderRadius: 12 },
    input: { background: B.surface, border: `1px solid ${B.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 14, color: B.text, fontFamily: "inherit", width: "100%", outline: "none", resize: "none" },
    label: { fontSize: 12, color: B.textSoft, fontWeight: 500, display: "block", marginBottom: 4 },
    secTitle: { fontSize: 11, fontWeight: 600, color: B.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 },
    btnGreen: { background: B.green, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", letterSpacing: "0.01em" },
    btnGhost: { background: "transparent", color: B.textSoft, border: `1px solid ${B.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" },
  };

  return (
    <div style={S.page}>

      {/* HERO */}
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderRadius: 14, padding: "1.75rem", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -60, top: -60, width: 240, height: 240, borderRadius: "50%", background: B.blue, opacity: 0.07 }} />
        <div style={{ position: "absolute", left: -40, bottom: -60, width: 180, height: 180, borderRadius: "50%", background: B.green, opacity: 0.08 }} />
        <div style={{ fontSize: 11, color: B.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, position: "relative" }}>↑ Referral Program</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: B.text, margin: "0 0 6px", position: "relative" }}>Ciao, {firstName} 👋</h1>
        <p style={{ fontSize: 13, color: B.textSoft, lineHeight: 1.6, margin: 0, position: "relative" }}>Ogni contatto che porti vale. Più lead acquisiti, più sali di livello.</p>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { color: B.green, border: "rgba(106,179,9,0.3)", label: "Lead segnalati", val: leads.length, icon: "👥" },
          { color: B.blue, border: "rgba(4,95,165,0.3)", label: "Lead acquisiti", val: acquisiti, icon: "🎯" },
          { color: B.amber, border: "rgba(245,158,11,0.3)", label: "Livello attuale", val: livello, icon: "🏆" },
        ].map((s, i) => (
          <div key={i} style={{ background: B.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: "1.1rem 1rem", borderLeft: `3px solid ${s.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: s.color, background: `${s.color}22`, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>attivo</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: B.textSoft, marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ALERT */}
      {alert && (
        <div style={{ background: alert.bg, border: `1px solid ${alert.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{alert.emoji}</span>
          <p style={{ fontSize: 13, color: alert.color, lineHeight: 1.5, margin: 0 }}>{alert.msg}</p>
        </div>
      )}

      {/* LIVELLO */}
      <div style={{ ...S.card, padding: "1.25rem", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: B.muted }}>Livello attuale</span>
            <div style={{ background: "rgba(245,158,11,0.15)", color: B.amber, fontSize: 13, fontWeight: 600, padding: "4px 14px", borderRadius: 20, border: "1px solid rgba(245,158,11,0.4)" }}>🏅 {livello}</div>
          </div>
          {nextTier && <span style={{ fontSize: 12, color: B.muted }}>Prossimo: {nextTier.id} — {nextTier.soglia} acquisiti</span>}
        </div>
        <div style={{ height: 8, background: "#1E2A35", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: B.green, borderRadius: 4, transition: "width .6s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: B.muted }}>
          <span>{acquisiti} acquisiti</span>
          {nextTier && <span>{nextTier.soglia} per {nextTier.id}</span>}
        </div>
      </div>

      {/* TIERS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
        {TIERS.map(t => {
          const active = t.id === livello;
          return (
            <div key={t.id} style={{ background: active ? B.greenDim : B.surface, border: `1px solid ${active ? B.green : B.border}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 6, lineHeight: 1 }}>{t.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: B.text, marginBottom: 3 }}>{t.id}</div>
              <div style={{ fontSize: 11, color: active ? B.green : B.muted, fontWeight: active ? 600 : 400, marginBottom: 8 }}>{active ? "Livello attuale" : t.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: B.greenDim, color: B.green, marginBottom: 4, display: "inline-block" }}>Comm. inclusa</div>
            </div>
          );
        })}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 4, background: B.surface, border: `1px solid ${B.border}`, borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {[{ id: "leads", label: "I miei lead" }, { id: "post", label: "Post da pubblicare" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "8px 10px", fontSize: 13, fontWeight: 600, textAlign: "center",
            cursor: "pointer", borderRadius: 7, border: activeTab === tab.id ? `1px solid ${B.border}` : "none",
            background: activeTab === tab.id ? B.card : "transparent",
            color: activeTab === tab.id ? B.text : B.muted, fontFamily: "inherit",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* PANEL LEADS */}
      {activeTab === "leads" && (
        <>
          {/* BROCHURE OBBLIGATORIE */}
          {brochureLoaded && brochure.length > 0 && (
            <div style={{ ...S.card, padding: "1.5rem", marginBottom: 14, border: `1px solid ${tutteConfermante ? B.border : B.green}` }}>
              <div style={S.secTitle}>📋 Prima di iniziare — Leggi i materiali MindSell</div>
              <p style={{ fontSize: 13, color: B.textSoft, marginBottom: 14, lineHeight: 1.6 }}>
                Per segnalare contatti qualificati è importante conoscere bene i nostri servizi. Leggi i documenti qui sotto e confermane la lettura prima di procedere.
              </p>
              {brochure.map(b => {
                const confermato = conferme[b.id];
                return (
                  <div key={b.id} style={{ background: B.surface, border: `1px solid ${confermato ? B.green : B.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: B.text, marginBottom: 2 }}>📄 {b.titolo}</div>
                      {b.descrizione && <div style={{ fontSize: 12, color: B.muted }}>{b.descrizione}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                      {b.url && (
                        <a href={b.url} target="_blank" rel="noreferrer" style={{ background: B.blueDim, color: "#60a5fa", border: "1px solid rgba(4,95,165,0.4)", borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                          📥 Scarica PDF
                        </a>
                      )}
                      {confermato ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: B.green, fontSize: 12, fontWeight: 600 }}>
                          ✅ Letto
                        </div>
                      ) : (
                        <button onClick={() => confermaBrochure(b.id)} style={{ background: B.greenDim, color: B.green, border: `1px solid ${B.green}`, borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          Ho letto e compreso
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!tutteConfermante && (
                <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: B.amber, marginTop: 8 }}>
                  ⚠️ Leggi e conferma tutti i documenti per sbloccare il form di segnalazione.
                </div>
              )}
            </div>
          )}

          {/* FORM SEGNALAZIONE */}
          <div style={{ ...S.card, padding: "1.5rem", marginBottom: 14, opacity: tutteConfermante ? 1 : 0.5, pointerEvents: tutteConfermante ? "auto" : "none" }}>
            <div style={S.secTitle}>Segnala un contatto qualificato</div>
            {brochure.length > 0 && !tutteConfermante ? null : (
              <div style={{ background: B.greenDim, border: `1px solid ${B.green}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: B.green, marginBottom: 14, lineHeight: 1.6 }}>
                💡 <strong>Importante:</strong> Segnala solo persone che hanno espresso un reale interesse per la formazione alla vendita. Contatti non qualificati rallentano il processo per tutti.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[{ k: "nome", ph: "Mario" }, { k: "cognome", ph: "Rossi" }, { k: "email", ph: "mario@esempio.it" }, { k: "telefono", ph: "+39 333 000 0000" }].map(f => (
                <div key={f.k}>
                  <label style={S.label}>{f.k.charAt(0).toUpperCase() + f.k.slice(1)}</label>
                  <input style={S.input} placeholder={f.ph} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} />
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>Note — come hai verificato l'interesse?</label>
                <textarea style={{ ...S.input, height: 70 }} placeholder="Es. mi ha chiesto info sulla formazione per il suo team di 5 venditori..." value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
              </div>
            </div>
            <button style={S.btnGreen} onClick={submitLead}>
              ➤ Invia segnalazione
            </button>
            {formOk && (
              <div style={{ background: B.greenDim, border: `1px solid ${B.green}`, color: B.green, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 12 }}>
                ✅ Segnalazione inviata! Ti aggiorneremo sullo stato del contatto.
              </div>
            )}
          </div>

          {/* LISTA LEADS */}
          <div style={{ ...S.card, padding: "1.5rem" }}>
            <div style={S.secTitle}>Stato avanzamento</div>
            {leads.length === 0 ? (
              <p style={{ fontSize: 14, color: B.muted, textAlign: "center", padding: "24px 0" }}>Nessun lead ancora. Inizia a segnalare!</p>
            ) : (
              leads.map(lead => <LeadCard key={lead.id} lead={lead} />)
            )}
          </div>
        </>
      )}

      {/* PANEL POST */}
      {activeTab === "post" && (
        <div style={{ ...S.card, padding: "1.5rem" }}>
          <div style={S.secTitle}>Scegli un argomento</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 16 }}>
            {ARGOMENTI.map(a => (
              <button key={a.id} onClick={() => setArgomento(a)} style={{
                padding: "8px 12px", fontSize: 13, textAlign: "left", lineHeight: 1.4,
                border: `1px solid ${argomento?.id === a.id ? B.green : B.border}`,
                borderRadius: 8, cursor: "pointer",
                background: argomento?.id === a.id ? B.greenDim : B.surface,
                color: argomento?.id === a.id ? B.green : B.textSoft,
                fontWeight: argomento?.id === a.id ? 600 : 400, fontFamily: "inherit",
              }}>{a.label}</button>
            ))}
          </div>
          <div style={{ ...S.secTitle, marginBottom: 8 }}>Canale</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[{ id: "linkedin", label: "LinkedIn" }, { id: "instagram", label: "Instagram / Facebook" }].map(ch => (
              <button key={ch.id} onClick={() => setCanale(ch.id)} style={{
                padding: "6px 14px", fontSize: 13, borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${canale === ch.id ? B.green : B.border}`,
                background: canale === ch.id ? B.greenDim : B.surface,
                color: canale === ch.id ? B.green : B.textSoft, fontWeight: canale === ch.id ? 600 : 400,
              }}>{ch.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <button style={S.btnGreen} onClick={generatePost} disabled={generating || !argomento}>
              ✨ {generating ? "Generazione..." : "Genera post"}
            </button>
            {post && !generating && (
              <button style={S.btnGhost} onClick={generatePost}>↺ Rigenera</button>
            )}
          </div>
          <div style={{ background: B.surface, border: `1px solid ${B.border}`, borderRadius: 8, padding: "14px 16px", fontSize: 14, lineHeight: 1.7, color: post ? B.text : B.muted, minHeight: 110, whiteSpace: "pre-wrap", marginBottom: 10, fontStyle: post ? "normal" : "italic" }}>
            {generating ? "Generazione in corso..." : post || "Seleziona un argomento e premi \"Genera post\"."}
          </div>
          {post && !generating && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={S.btnGhost} onClick={() => { navigator.clipboard.writeText(post); setCopied(true); setTimeout(() => setCopied(false), 2500); }}>
                📋 Copia testo
              </button>
              {copied && <span style={{ fontSize: 12, color: B.green, fontWeight: 600 }}>✓ Copiato!</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
