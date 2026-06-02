import { useState, useEffect } from "react";

// ─────────────────────────────────────────────
// MOCK: sostituire con dati reali da Firestore
// ─────────────────────────────────────────────
const MOCK_USER = {
  nome: "Antonio",
  cognome: "Nicolò",
  ruolo: "studente", // "studente" | "procacciatore"
  referral: true,    // flag Firestore: mostra sezione a studenti selezionati
  livello: "Bronze",
  leadAcquisiti: 1,
};

const MOCK_LEADS = [
  {
    id: 1,
    nome: "Giulia",
    cognome: "Ferri",
    email: "giulia.ferri@email.it",
    telefono: "+39 348 111 2233",
    note: "",
    data: "18 mag 2026",
    stato: "appuntamento", // segnalato | contattato | appuntamento | proposta | acquisito | perso
  },
  {
    id: 2,
    nome: "Roberto",
    cognome: "Mancini",
    email: "r.mancini@bizmail.it",
    telefono: "",
    note: "",
    data: "3 mag 2026",
    stato: "acquisito",
  },
  {
    id: 3,
    nome: "Luca",
    cognome: "Battaglia",
    email: "l.battaglia@work.it",
    telefono: "",
    note: "",
    data: "28 apr 2026",
    stato: "perso",
  },
];

const TIERS = [
  { id: "Bronze",   emoji: "🥉", soglia: 0,  label: "Partenza",    comm: "Commissione base",        bonus: "Da definire" },
  { id: "Silver",   emoji: "🥈", soglia: 3,  label: "3 acquisiti", comm: "Commissione maggiorata",  bonus: "Da definire" },
  { id: "Gold",     emoji: "🥇", soglia: 7,  label: "7 acquisiti", comm: "Commissione premium",     bonus: "Da definire" },
  { id: "Platinum", emoji: "💎", soglia: 15, label: "15 acquisiti",comm: "Commissione top",         bonus: "Da definire" },
];

const PIPELINE = ["Segnalato", "Contattato", "Appuntamento", "Proposta", "Acquisito", "Perso"];
const PIPELINE_KEYS = ["segnalato", "contattato", "appuntamento", "proposta", "acquisito", "perso"];

const ARGOMENTI = [
  { id: 1, label: "Perché i venditori non chiudono",     prompt: "Perché il 70% dei venditori non chiude abbastanza" },
  { id: 2, label: "Trasformare i no in opportunità",     prompt: "Come trasformare i no in opportunità di vendita" },
  { id: 3, label: "Costruire fiducia col cliente",       prompt: "Il metodo MindSell per costruire fiducia con il cliente" },
  { id: 4, label: "Formazione che cambia le performance",prompt: "Perché la formazione alla vendita cambia le performance del team" },
  { id: 5, label: "Strutturare un processo vincente",    prompt: "Come strutturare un processo di vendita vincente" },
  { id: 6, label: "3 errori nella vendita consultiva",   prompt: "I 3 errori più comuni nella vendita consultiva" },
];

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
function getTierIndex(livello) {
  return TIERS.findIndex(t => t.id === livello);
}

function getNextTier(livello) {
  const idx = getTierIndex(livello);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

function getProgressPct(acquisiti, livello) {
  const next = getNextTier(livello);
  if (!next) return 100;
  const curr = TIERS[getTierIndex(livello)];
  const range = next.soglia - curr.soglia;
  const done = acquisiti - curr.soglia;
  return Math.min(100, Math.max(0, Math.round((done / range) * 100)));
}

function getPipelineIndex(stato) {
  if (stato === "perso") return 5;
  return PIPELINE_KEYS.indexOf(stato);
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function PipelineBar({ stato }) {
  const activeIdx = getPipelineIndex(stato);
  const isPerso = stato === "perso";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", width: "100%", marginTop: 8 }}>
      {PIPELINE.map((step, i) => {
        const key = PIPELINE_KEYS[i];
        const isDone = !isPerso
          ? i < activeIdx
          : i < 4; // tutti prima di perso completati
        const isActive = i === activeIdx;
        const isLast = i === PIPELINE.length - 1;
        const isWon = stato === "acquisito" && i === 4;
        const isLostDot = isPerso && i === 5;

        let dotBg = "#2a2a3a";
        let dotBorder = "#3a3a4a";
        let dotColor = "#666";
        let labelColor = "#555";

        if (isDone) { dotBg = "#1D9E75"; dotBorder = "#1D9E75"; dotColor = "#fff"; labelColor = "#1D9E75"; }
        if (isWon)  { dotBg = "#22c55e"; dotBorder = "#22c55e"; dotColor = "#fff"; labelColor = "#22c55e"; }
        if (isLostDot) { dotBg = "#ef4444"; dotBorder = "#ef4444"; dotColor = "#fff"; labelColor = "#ef4444"; }
        if (isActive && !isWon && !isLostDot) {
          dotBg = "#0d3d2e"; dotBorder = "#1D9E75"; dotColor = "#1D9E75"; labelColor = "#1D9E75";
        }

        let lineBg = "#2a2a3a";
        if (!isPerso && i < activeIdx) lineBg = "#1D9E75";
        if (isPerso && i < 4) lineBg = "#1D9E75";
        if (isPerso && i === 4) lineBg = "#2a2a3a";

        return (
          <div key={key} style={{ display: "flex", alignItems: "flex-start", flex: isLast ? "0 0 auto" : 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: dotBg, border: `1.5px solid ${dotBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: dotColor, fontSize: 9, flexShrink: 0, position: "relative", zIndex: 1,
              }}>
                {(isDone || isWon) && <span>✓</span>}
                {isLostDot && <span>✕</span>}
                {isActive && !isWon && !isLostDot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1D9E75", display: "block" }} />}
              </div>
              <span style={{ fontSize: 10, color: labelColor, textAlign: "center", lineHeight: 1.3, whiteSpace: "nowrap" }}>
                {step}
              </span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, display: "flex", alignItems: "flex-start", paddingTop: 10, minWidth: 4 }}>
                <div style={{ width: "100%", height: 1.5, background: lineBg }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({ lead }) {
  return (
    <div style={{
      background: "#16161f",
      border: "1px solid #2a2a3a",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#e8e8f0" }}>{lead.nome} {lead.cognome}</span>
        <span style={{ fontSize: 11, color: "#555" }}>{lead.data}</span>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>
        ✉ {lead.email}
        {lead.telefono && <span> · ☎ {lead.telefono}</span>}
      </div>
      {lead.note && <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{lead.note}</div>}
      <PipelineBar stato={lead.stato} />
      {lead.stato === "acquisito" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#0d2e1a", border: "1px solid #1D9E75", color: "#4ade80", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, marginTop: 8 }}>
          ● Commissione attiva
        </div>
      )}
      {lead.stato === "perso" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#2a0f0f", border: "1px solid #7f1d1d", color: "#f87171", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, marginTop: 8 }}>
          ✕ Lead non acquisito
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function ReferralDashboard({ uid, userData }) {
  // Dati reali da props (Firestore via App.js)
  const user = {
    nome: userData?.name?.split(" ")[0] || "",
    cognome: userData?.name?.split(" ").slice(1).join(" ") || "",
    ruolo: userData?.ruolo || "studente",
    referral: userData?.referral || false,
    livello: userData?.referralLivello || "Bronze",
    leadAcquisiti: userData?.referralAcquisiti || 0,
  };
  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState("leads");
  const [form, setForm] = useState({ nome: "", cognome: "", email: "", telefono: "", note: "" });
  const [formOk, setFormOk] = useState(false);
  const [argomento, setArgomento] = useState(null);
  const [canale, setCanale] = useState("linkedin");
  const [post, setPost] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const acquisiti = leads.filter(l => l.stato === "acquisito").length;
  const nextTier = getNextTier(user.livello);
  const progressPct = getProgressPct(acquisiti, user.livello);
  const mancano = nextTier ? nextTier.soglia - acquisiti : 0;

  const initials = userData?.name ? userData.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() : "??";

  function submitLead() {
    if (!form.nome || !form.cognome || !form.email) return;
    const oggi = new Date();
    const mesi = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
    const data = `${oggi.getDate()} ${mesi[oggi.getMonth()]} ${oggi.getFullYear()}`;
    setLeads(prev => [{
      id: Date.now(), ...form, data, stato: "segnalato",
    }, ...prev]);
    setForm({ nome: "", cognome: "", email: "", telefono: "", note: "" });
    setFormOk(true);
    setTimeout(() => setFormOk(false), 4000);
  }

  async function generatePost() {
    if (!argomento) return;
    setGenerating(true);
    setPost("");
    const chLabel = canale === "linkedin" ? "LinkedIn" : "Instagram e Facebook";
    const tone = canale === "linkedin"
      ? "professionale, autorevole, paragrafi brevi, emoji moderati, hashtag pertinenti alla fine"
      : "diretto, coinvolgente, storytelling breve, emoji vivaci, call to action chiara, hashtag popolari alla fine";
    const prompt = `Sei un copywriter esperto di formazione commerciale. Scrivi un post ${chLabel} per promuovere MindSell Academy, una scuola italiana di vendita professionale.\n\nArgomento: ${argomento.prompt}\nTono: ${tone}\n\nIl post deve:\n- Aprire con un hook forte che ferma lo scroll\n- Sviluppare il tema in modo concreto e utile\n- Concludere con una call to action verso academy.mindsell.it\n- Essere pronto alla pubblicazione senza titoli o note aggiuntive\n\nScrivi solo il testo del post.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      setPost(data.content?.[0]?.text || "Errore nella generazione. Riprova.");
    } catch {
      setPost("Errore di connessione. Riprova.");
    }
    setGenerating(false);
  }

  function copyPost() {
    navigator.clipboard.writeText(post).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // Stili comuni dark
  const S = {
    page: { background: "#0e0e16", minHeight: "100vh", padding: "0 24px 40px", fontFamily: "'DM Sans', sans-serif", color: "#e8e8f0" },
    card: { background: "#13131e", border: "1px solid #1e1e2e", borderRadius: 12 },
    input: {
      background: "#0e0e16", border: "1px solid #2a2a3a", borderRadius: 8,
      padding: "9px 12px", fontSize: 14, color: "#e8e8f0", fontFamily: "inherit", width: "100%", outline: "none",
    },
    label: { fontSize: 12, color: "#666", fontWeight: 500, marginBottom: 4, display: "block" },
    btnGreen: {
      background: "linear-gradient(135deg, #1D9E75, #157a5a)", color: "#fff", border: "none",
      borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 7,
    },
    btnGhost: {
      background: "transparent", color: "#888", border: "1px solid #2a2a3a",
      borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 6,
    },
    secTitle: { fontSize: 11, fontWeight: 500, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 },
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={S.page}>

        {/* ── TOPBAR ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#fff",
            }}>{initials}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#e8e8f0" }}>{userData?.name || "Utente"}</div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {user.ruolo === "procacciatore" ? "Procacciatore MindSell" : "MindSell Academy"}
              </div>
            </div>
          </div>
          <div style={{
            background: "#0d2e1a", border: "1px solid #1D9E75", color: "#4ade80",
            fontSize: 11, fontWeight: 500, padding: "4px 12px", borderRadius: 20,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span>🏅</span> Referral Program
          </div>
        </div>

        {/* ── HERO BANNER ── */}
        <div style={{
          background: "linear-gradient(135deg, #0a2e22 0%, #0d1f2d 100%)",
          border: "1px solid #1a3a2a", borderRadius: 14, padding: "24px 28px", marginBottom: 16,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", right: -30, top: -30, width: 180, height: 180, borderRadius: "50%", background: "#1D9E75", opacity: 0.08 }} />
          <div style={{ position: "absolute", right: 60, bottom: -50, width: 120, height: 120, borderRadius: "50%", background: "#4ade80", opacity: 0.05 }} />
          <div style={{ fontSize: 11, fontWeight: 500, color: "#1D9E75", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
            ↑ Referral Program
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", margin: "0 0 6px", position: "relative" }}>
            Ciao, {user.nome} 👋
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, maxWidth: 420, margin: 0, position: "relative" }}>
            Ogni contatto che porti vale. Più lead acquisiti, più sali di livello — e più guadagni.
          </p>
        </div>

        {/* ── STATS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { icon: "👥", val: leads.length, label: "Lead segnalati" },
            { icon: "✅", val: acquisiti, label: "Lead acquisiti" },
            { icon: "🏅", val: user.livello, label: "Livello attuale" },
          ].map((s, i) => (
            <div key={i} style={{ ...S.card, padding: "14px 16px" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0d2e1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#e8e8f0", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── BONUS ALERT ── */}
        {nextTier && mancano > 0 && (
          <div style={{ background: "#0d2e1a", border: "1px solid #1a4a2a", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚡</span>
            <p style={{ fontSize: 13, color: "#4ade80", lineHeight: 1.5, margin: 0 }}>
              <strong>Sei a {mancano} lead acquisiti dal livello {nextTier.id}.</strong>{" "}
              Salendo sbloccherai una commissione più alta e un bonus aggiuntivo.
            </p>
          </div>
        )}

        {/* ── LEVEL PROGRESS ── */}
        <div style={{ ...S.card, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#555" }}>Livello attuale</span>
              <div style={{ background: "#1a1200", border: "1px solid #5c3d00", color: "#f59e0b", fontSize: 12, fontWeight: 500, padding: "3px 12px", borderRadius: 20 }}>
                🥉 {user.livello}
              </div>
            </div>
            {nextTier && <span style={{ fontSize: 12, color: "#555" }}>Prossimo: {nextTier.id} — {nextTier.soglia} acquisiti</span>}
          </div>
          <div style={{ height: 5, background: "#1e1e2e", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #1D9E75, #4ade80)", borderRadius: 3, transition: "width .6s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#444" }}>
            <span>{acquisiti} acquisito{acquisiti !== 1 ? "i" : ""}</span>
            {nextTier && <span>{nextTier.soglia} per {nextTier.id}</span>}
          </div>
        </div>

        {/* ── TIERS GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
          {TIERS.map(t => {
            const isActive = t.id === user.livello;
            return (
              <div key={t.id} style={{
                ...S.card,
                padding: "12px 10px", textAlign: "center",
                border: isActive ? "1px solid #1D9E75" : "1px solid #1e1e2e",
                background: isActive ? "#0d2e1a" : "#13131e",
              }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{t.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#e8e8f0", marginBottom: 3 }}>{t.id}</div>
                <div style={{ fontSize: 11, color: isActive ? "#1D9E75" : "#444", marginBottom: 8, fontWeight: isActive ? 500 : 400 }}>
                  {isActive ? "Livello attuale" : t.label}
                </div>
                <div style={{ fontSize: 11, background: "rgba(29,158,117,.15)", color: "#1D9E75", padding: "3px 6px", borderRadius: 20, marginBottom: 4 }}>{t.comm}</div>
                <div style={{ fontSize: 11, background: "#1a1a2a", color: "#555", padding: "3px 6px", borderRadius: 20, border: "1px dashed #2a2a3a" }}>Bonus: {t.bonus}</div>
              </div>
            );
          })}
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 4, background: "#0e0e16", border: "1px solid #1e1e2e", borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {[{ id: "leads", label: "👥 I miei lead" }, { id: "post", label: "✏️ Post da pubblicare" }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: "8px 12px", fontSize: 13, fontWeight: 500, textAlign: "center",
              cursor: "pointer", borderRadius: 7, border: "none",
              background: activeTab === tab.id ? "#1a1a2a" : "transparent",
              color: activeTab === tab.id ? "#e8e8f0" : "#555",
              transition: "all .15s",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ══ PANEL: LEADS ══ */}
        {activeTab === "leads" && (
          <>
            {/* Form segnalazione */}
            <div style={{ ...S.card, padding: "18px 20px", marginBottom: 14 }}>
              <div style={S.secTitle}>Segnala un contatto</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {[
                  { key: "nome", label: "Nome", placeholder: "Mario" },
                  { key: "cognome", label: "Cognome", placeholder: "Rossi" },
                  { key: "email", label: "Email", placeholder: "mario@esempio.it" },
                  { key: "telefono", label: "Telefono", placeholder: "+39 333 000 0000" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={S.label}>{f.label}</label>
                    <input
                      style={S.input}
                      placeholder={f.placeholder}
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={S.label}>Note (facoltativo)</label>
                  <textarea
                    style={{ ...S.input, height: 64, resize: "none" }}
                    placeholder="Es. titolare PMI, settore servizi, vuole strutturare un team commerciale..."
                    value={form.note}
                    onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  />
                </div>
              </div>
              <button style={S.btnGreen} onClick={submitLead}>
                <span>↑</span> Invia segnalazione
              </button>
              {formOk && (
                <div style={{ background: "#0d2e1a", border: "1px solid #1D9E75", color: "#4ade80", borderRadius: 8, padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  ✓ Segnalazione inviata! Ti aggiorneremo sullo stato.
                </div>
              )}
            </div>

            {/* Lista lead */}
            <div style={{ ...S.card, padding: "18px 20px" }}>
              <div style={S.secTitle}>Stato avanzamento</div>
              {leads.length === 0 && (
                <p style={{ fontSize: 14, color: "#444", textAlign: "center", padding: "24px 0" }}>Nessun lead ancora. Inizia a segnalare!</p>
              )}
              {leads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
            </div>
          </>
        )}

        {/* ══ PANEL: POST ══ */}
        {activeTab === "post" && (
          <div style={{ ...S.card, padding: "18px 20px" }}>
            <div style={S.secTitle}>Scegli un argomento</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
              {ARGOMENTI.map(a => (
                <button key={a.id} onClick={() => setArgomento(a)} style={{
                  padding: "9px 12px", fontSize: 13, textAlign: "left", lineHeight: 1.4,
                  border: `1px solid ${argomento?.id === a.id ? "#1D9E75" : "#2a2a3a"}`,
                  borderRadius: 8, cursor: "pointer",
                  background: argomento?.id === a.id ? "#0d2e1a" : "#0e0e16",
                  color: argomento?.id === a.id ? "#4ade80" : "#888",
                  fontWeight: argomento?.id === a.id ? 500 : 400,
                  fontFamily: "inherit",
                }}>{a.label}</button>
              ))}
            </div>

            <div style={S.secTitle}>Canale</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[{ id: "linkedin", label: "🔗 LinkedIn" }, { id: "instagram", label: "📸 Instagram / Facebook" }].map(ch => (
                <button key={ch.id} onClick={() => setCanale(ch.id)} style={{
                  padding: "6px 14px", fontSize: 13, borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${canale === ch.id ? "#1D9E75" : "#2a2a3a"}`,
                  background: canale === ch.id ? "#0d2e1a" : "#0e0e16",
                  color: canale === ch.id ? "#4ade80" : "#555",
                  fontWeight: canale === ch.id ? 500 : 400,
                }}>{ch.label}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <button style={S.btnGreen} onClick={generatePost} disabled={generating}>
                {generating ? "⏳" : "✨"} {generating ? "Generazione..." : "Genera post"}
              </button>
              {post && !generating && (
                <button style={S.btnGhost} onClick={generatePost}>↺ Rigenera</button>
              )}
            </div>

            <div style={{
              background: "#0e0e16", border: "1px solid #2a2a3a", borderRadius: 8,
              padding: "14px 16px", fontSize: 14, lineHeight: 1.7, color: post ? "#e8e8f0" : "#444",
              minHeight: 110, whiteSpace: "pre-wrap", marginBottom: 10,
              fontStyle: post ? "normal" : "italic",
            }}>
              {generating
                ? "Generazione in corso..."
                : post || "Seleziona un argomento e premi \"Genera post\" per creare il testo."}
            </div>

            {post && !generating && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button style={S.btnGhost} onClick={copyPost}>📋 Copia testo</button>
                {copied && <span style={{ fontSize: 12, color: "#4ade80" }}>✓ Copiato!</span>}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
