import { useState, useEffect } from "react";

const TIERS = [
  { id: "Bronze",   emoji: "🥉", soglia: 0,  label: "Partenza",     comm: "Commissione base",       bonus: "Da definire" },
  { id: "Silver",   emoji: "🥈", soglia: 3,  label: "3 acquisiti",  comm: "Commissione maggiorata", bonus: "Da definire" },
  { id: "Gold",     emoji: "🥇", soglia: 7,  label: "7 acquisiti",  comm: "Commissione premium",    bonus: "Da definire" },
  { id: "Platinum", emoji: "💎", soglia: 15, label: "15 acquisiti", comm: "Commissione top",         bonus: "Da definire" },
];

const PIPELINE_STEPS = [
  { key: "segnalato",    label: "Segnalato",    icon: "ti-check" },
  { key: "contattato",   label: "Contattato",   icon: "ti-phone" },
  { key: "appuntamento", label: "Appuntamento", icon: "ti-calendar" },
  { key: "proposta",     label: "Proposta",     icon: "ti-writing" },
  { key: "acquisito",    label: "Acquisito",    icon: "ti-circle-check" },
  { key: "perso",        label: "Perso",        icon: "ti-circle-x" },
];

const ARGOMENTI = [
  { id: 1, label: "Perché i venditori non chiudono",      prompt: "Perché il 70% dei venditori non chiude abbastanza" },
  { id: 2, label: "Trasformare i no in opportunità",      prompt: "Come trasformare i no in opportunità di vendita" },
  { id: 3, label: "Costruire fiducia col cliente",        prompt: "Il metodo MindSell per costruire fiducia con il cliente" },
  { id: 4, label: "Formazione che cambia le performance", prompt: "Perché la formazione alla vendita cambia le performance del team" },
  { id: 5, label: "Strutturare un processo vincente",     prompt: "Come strutturare un processo di vendita vincente" },
  { id: 6, label: "3 errori nella vendita consultiva",    prompt: "I 3 errori più comuni nella vendita consultiva" },
];

// Colori progressivi pipeline (da blu a verde)
const STEP_COLORS = [
  { bg: "#0c2a3a", border: "#185FA5", color: "#378ADD", line: "#185FA5" },
  { bg: "#0a2a30", border: "#0F6E56", color: "#1D9E75", line: "#0F6E56" },
  { bg: "#0d2e1a", border: "#1D9E75", color: "#5DCAA5", line: "#1D9E75" },
  { bg: "#0d2e1a", border: "#5DCAA5", color: "#9FE1CB", line: "#5DCAA5" },
];

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

function getPipelineActiveIndex(stato) {
  return PIPELINE_STEPS.findIndex(s => s.key === stato);
}

function PipelineBar({ stato }) {
  const activeIdx = getPipelineActiveIndex(stato);
  const isPerso = stato === "perso";
  const isAcquisito = stato === "acquisito";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
      {PIPELINE_STEPS.map((step, i) => {
        const isLast = i === PIPELINE_STEPS.length - 1;
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;

        // Dot styling
        let dotStyle = {
          width: 22, height: 22, borderRadius: "50%",
          border: "1.5px solid #2a3a4a", background: "#0E1318",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, zIndex: 1, color: "#6B7A8D",
        };

        let labelColor = "#6B7A8D";

        if (isAcquisito && i === 4) {
          dotStyle = { ...dotStyle, background: "#0d3d20", border: "1.5px solid #5DCAA5", color: "#5DCAA5" };
          labelColor = "#5DCAA5";
        } else if (isPerso && i === 5) {
          dotStyle = { ...dotStyle, background: "#2a0f0f", border: "1.5px solid #A32D2D", color: "#f87171" };
          labelColor = "#f87171";
        } else if (isActive) {
          dotStyle = { ...dotStyle, background: "#0d2e1a", border: "1.5px solid #5DCAA5", color: "#5DCAA5", boxShadow: "0 0 0 3px #1D9E7522" };
          labelColor = "#5DCAA5";
        } else if (isDone) {
          const colorIdx = Math.min(i, STEP_COLORS.length - 1);
          const c = STEP_COLORS[colorIdx];
          dotStyle = { ...dotStyle, background: c.bg, border: `1.5px solid ${c.border}`, color: c.color };
        }

        // Line color
        let lineColor = "#1C2530";
        if (isPerso && i >= activeIdx) {
          lineColor = "#A32D2D";
        } else if (isDone || (isAcquisito && i === 3)) {
          const colorIdx = Math.min(i, STEP_COLORS.length - 1);
          lineColor = STEP_COLORS[colorIdx].line;
        }

        return (
          <div key={step.key} style={{ display: "flex", alignItems: "flex-start", flex: isLast ? "0 0 auto" : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={dotStyle}>
                <i className={`ti ${step.icon}`} style={{ fontSize: 10 }} aria-hidden="true" />
              </div>
              <span style={{ fontSize: 10, color: labelColor, textAlign: "center", lineHeight: 1.3 }}>{step.label}</span>
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
  const C = {
    card: "#0E1318", border: "#1C2530", text: "#E8EDF5", muted: "#6B7A8D",
  };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{lead.nome} {lead.cognome}</span>
        <span style={{ fontSize: 11, color: C.muted }}>{lead.data}</span>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
        {lead.email}{lead.telefono && ` · ${lead.telefono}`}
        {lead.note && <><br /><span>{lead.note}</span></>}
      </div>
      <PipelineBar stato={lead.stato} />
      {lead.stato === "acquisito" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#0d2e1a", border: "1px solid #1a4a2a", color: "#4ade80", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, marginTop: 8 }}>
          <i className="ti ti-coin" style={{ fontSize: 12 }} aria-hidden="true" /> Commissione attiva
        </div>
      )}
      {lead.stato === "perso" && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#2a0f0f", border: "1px solid #7f1d1d", color: "#f87171", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, marginTop: 8 }}>
          <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true" /> Lead non acquisito
        </div>
      )}
    </div>
  );
}

export default function ReferralDashboard({ uid, userData }) {
  const C = {
    bg: "#080B10", surface: "#0E1318", card: "#121820", border: "#1C2530",
    text: "#E8EDF5", muted: "#6B7A8D", green: "#1D9E75", greenMid: "#5DCAA5",
    purple: "#7F77DD", amber: "#EF9F27",
  };

  const livello = userData?.referralLivello || "Bronze";
  const acquisiti = userData?.referralAcquisiti || 0;
  const nextTier = getNextTier(livello);
  const progressPct = getProgressPct(acquisiti, livello);
  const mancano = nextTier ? nextTier.soglia - acquisiti : 0;
  const initials = userData?.name ? userData.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "??";
  const firstName = userData?.name?.split(" ")[0] || "";

  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState("leads");
  const [form, setForm] = useState({ nome: "", cognome: "", email: "", telefono: "", note: "" });
  const [formOk, setFormOk] = useState(false);
  const [argomento, setArgomento] = useState(null);
  const [canale, setCanale] = useState("linkedin");
  const [post, setPost] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  function submitLead() {
    if (!form.nome || !form.cognome || !form.email) return;
    const oggi = new Date();
    const mesi = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
    const data = `${oggi.getDate()} ${mesi[oggi.getMonth()]} ${oggi.getFullYear()}`;
    setLeads(prev => [{ id: Date.now(), ...form, data, stato: "segnalato" }, ...prev]);
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
      setPost(data.content?.[0]?.text || "Errore. Riprova.");
    } catch { setPost("Errore di connessione. Riprova."); }
    setGenerating(false);
  }

  function copyPost() {
    if (!post) return;
    navigator.clipboard.writeText(post).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }

  const S = {
    page: { background: C.bg, minHeight: "100vh", padding: "20px 24px 40px", fontFamily: "'Segoe UI', sans-serif", color: C.text },
    card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 },
    input: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, color: C.text, fontFamily: "inherit", width: "100%", outline: "none", resize: "none" },
    label: { fontSize: 12, color: C.muted, fontWeight: 500, display: "block", marginBottom: 4 },
    secTitle: { fontSize: 11, fontWeight: 500, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 },
    btnGreen: { background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit" },
    btnGhost: { background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" },
  };

  return (
    <div style={S.page}>

      {/* HERO */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "1.75rem", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -60, top: -60, width: 240, height: 240, borderRadius: "50%", background: C.purple, opacity: 0.06 }} />
        <div style={{ position: "absolute", left: -40, bottom: -60, width: 180, height: 180, borderRadius: "50%", background: C.green, opacity: 0.06 }} />
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-trending-up" style={{ fontSize: 11 }} aria-hidden="true" /> Referral Program
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 500, color: "#fff", margin: "0 0 4px", position: "relative" }}>Ciao, {firstName} 👋</h1>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: 0, position: "relative" }}>Ogni contatto che porti vale. Più lead acquisiti, più sali di livello.</p>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { icon: "ti-users", iconColor: C.greenMid, bg: "#0d2e1a", val: leads.length, label: "Lead segnalati" },
          { icon: "ti-circle-check", iconColor: C.purple, bg: "#1e1a3a", val: acquisiti, label: "Lead acquisiti" },
          { icon: "ti-medal", iconColor: C.amber, bg: "#2a1f08", val: livello, label: "Livello attuale" },
        ].map((s, i) => (
          <div key={i} style={{ ...S.card, padding: "1rem" }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: 22, color: s.iconColor }} aria-hidden="true" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, color: s.iconColor, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ALERT */}
      {nextTier && mancano > 0 && (
        <div style={{ background: "#0d2e1a", border: "1px solid #1a4a2a", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-bolt" style={{ color: C.green, fontSize: 20, flexShrink: 0 }} aria-hidden="true" />
          <p style={{ fontSize: 13, color: "#4ade80", lineHeight: 1.5, margin: 0 }}>
            <strong>Sei a {mancano} lead acquisiti dal livello {nextTier.id}.</strong> Salendo sbloccherai commissione più alta e bonus aggiuntivo.
          </p>
        </div>
      )}

      {/* LIVELLO */}
      <div style={{ ...S.card, padding: "1.25rem", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: C.muted }}>Livello attuale</span>
            <div style={{ background: "#2a1f08", color: C.amber, fontSize: 13, fontWeight: 500, padding: "4px 14px", borderRadius: 20, border: "1px solid #5c3d00", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i className="ti ti-medal" aria-hidden="true" /> {livello}
            </div>
          </div>
          {nextTier && <span style={{ fontSize: 12, color: C.muted }}>Prossimo: {nextTier.id} — {nextTier.soglia} acquisiti</span>}
        </div>
        <div style={{ height: 8, background: "#1C2530", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: C.green, borderRadius: 4, transition: "width .6s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted }}>
          <span>{acquisiti} acquisiti</span>
          {nextTier && <span>{nextTier.soglia} per {nextTier.id}</span>}
        </div>
      </div>

      {/* TIERS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
        {TIERS.map(t => {
          const active = t.id === livello;
          return (
            <div key={t.id} style={{ background: active ? "#0d2e1a" : C.surface, border: `1px solid ${active ? C.green : C.border}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 6, lineHeight: 1 }}>{t.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 3 }}>{t.id}</div>
              <div style={{ fontSize: 11, color: active ? C.greenMid : C.muted, fontWeight: active ? 500 : 400, marginBottom: 6 }}>
                {active ? "Livello attuale" : t.label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 20, background: "rgba(29,158,117,.2)", color: C.greenMid, marginBottom: 3, display: "inline-block" }}>{t.comm}</div>
              <div style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "#1C2530", color: C.muted, border: "1px dashed #2a3a4a", display: "inline-block" }}>Bonus: {t.bonus}</div>
            </div>
          );
        })}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {[{ id: "leads", label: "I miei lead", icon: "ti-users" }, { id: "post", label: "Post da pubblicare", icon: "ti-pencil" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "7px 10px", fontSize: 13, fontWeight: 500, textAlign: "center",
            cursor: "pointer", borderRadius: 7, border: activeTab === tab.id ? `1px solid ${C.border}` : "none",
            background: activeTab === tab.id ? C.card : "transparent",
            color: activeTab === tab.id ? C.text : C.muted, fontFamily: "inherit",
          }}>
            <i className={`ti ${tab.icon}`} style={{ fontSize: 13, verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* PANEL LEADS */}
      {activeTab === "leads" && (
        <>
          <div style={{ ...S.card, padding: "1.5rem", marginBottom: 14 }}>
            <div style={S.secTitle}>Segnala un contatto</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[{ k: "nome", ph: "Mario" }, { k: "cognome", ph: "Rossi" }, { k: "email", ph: "mario@esempio.it" }, { k: "telefono", ph: "+39 333 000 0000" }].map(f => (
                <div key={f.k}>
                  <label style={S.label}>{f.k.charAt(0).toUpperCase() + f.k.slice(1)}</label>
                  <input style={S.input} placeholder={f.ph} value={form[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} />
                </div>
              ))}
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.label}>Note (facoltativo)</label>
                <textarea style={{ ...S.input, height: 60 }} placeholder="Es. titolare PMI, settore servizi..." value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
              </div>
            </div>
            <button style={S.btnGreen} onClick={submitLead}>
              <i className="ti ti-send" style={{ fontSize: 15 }} aria-hidden="true" /> Invia segnalazione
            </button>
            {formOk && (
              <div style={{ background: "#0d2e1a", border: "1px solid #1D9E75", color: "#4ade80", borderRadius: 8, padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <i className="ti ti-circle-check" style={{ fontSize: 17 }} aria-hidden="true" /> Segnalazione inviata! Ti aggiorneremo sullo stato.
              </div>
            )}
          </div>

          <div style={{ ...S.card, padding: "1.5rem" }}>
            <div style={S.secTitle}>Stato avanzamento</div>
            {leads.length === 0 && (
              <p style={{ fontSize: 14, color: C.muted, textAlign: "center", padding: "24px 0" }}>Nessun lead ancora. Inizia a segnalare!</p>
            )}
            {leads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
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
                border: `1px solid ${argomento?.id === a.id ? C.green : C.border}`,
                borderRadius: 8, cursor: "pointer",
                background: argomento?.id === a.id ? "#0d2e1a" : C.surface,
                color: argomento?.id === a.id ? C.greenMid : C.muted,
                fontWeight: argomento?.id === a.id ? 500 : 400, fontFamily: "inherit",
              }}>{a.label}</button>
            ))}
          </div>
          <div style={{ ...S.secTitle, marginBottom: 8 }}>Canale</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[{ id: "linkedin", label: "LinkedIn" }, { id: "instagram", label: "Instagram / Facebook" }].map(ch => (
              <button key={ch.id} onClick={() => setCanale(ch.id)} style={{
                padding: "6px 14px", fontSize: 13, borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${canale === ch.id ? C.green : C.border}`,
                background: canale === ch.id ? "#0d2e1a" : C.surface,
                color: canale === ch.id ? C.greenMid : C.muted, fontWeight: canale === ch.id ? 500 : 400,
              }}>{ch.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <button style={S.btnGreen} onClick={generatePost} disabled={generating}>
              <i className="ti ti-sparkles" style={{ fontSize: 15 }} aria-hidden="true" />
              {generating ? "Generazione..." : "Genera post"}
            </button>
            {post && !generating && (
              <button style={S.btnGhost} onClick={generatePost}>
                <i className="ti ti-refresh" style={{ fontSize: 14 }} aria-hidden="true" /> Rigenera
              </button>
            )}
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", fontSize: 14, lineHeight: 1.7, color: post ? C.text : C.muted, minHeight: 110, whiteSpace: "pre-wrap", marginBottom: 10, fontStyle: post ? "normal" : "italic" }}>
            {generating ? "Generazione in corso..." : post || "Seleziona un argomento e premi \"Genera post\"."}
          </div>
          {post && !generating && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={S.btnGhost} onClick={copyPost}>
                <i className="ti ti-copy" style={{ fontSize: 14 }} aria-hidden="true" /> Copia testo
              </button>
              {copied && <span style={{ fontSize: 12, color: "#4ade80" }}>✓ Copiato!</span>}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
