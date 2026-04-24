import { useState, useEffect, useRef } from "react";
import { auth, db, firebaseConfig } from "./firebase";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// Seconda istanza Firebase per creare studenti senza cambiare auth admin
const secondaryApp = getApps().find(a => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
const secondaryAuth = getAuth(secondaryApp);
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, getDocs, deleteDoc,
  addDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
const storage = getStorage();
import AICoach from "./AICoach";

const ADMIN_EMAIL = "emanuela@mindsell.it";

// EmailJS config
const EMAILJS_SERVICE = "service_ip0ig4p";
const EMAILJS_TEMPLATE = "template_j25nv25";
const EMAILJS_KEY = "fG6B5a_jXIsC0taYd";

const sendBookingEmail = async (studentName, sessionType, date, time, note) => {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_KEY,
        template_params: {
          nome_studente: studentName,
          tipo_sessione: sessionType,
          data: date,
          orario: time,
          note: note || "Nessuna nota",
          to_email: "emanuela@mindsell.it",
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("EmailJS error:", err);
    }
    return res.ok;
  } catch (e) { console.error("Email send failed:", e); return false; }
};

// Estrae l'URL iframe da un embed code Bunny o restituisce l'URL direttamente
function extractBunnyUrl(input) {
  if (!input) return "";
  // Se contiene src="..." estrailo
  const match = input.match(/src="([^"]+)"/);
  if (match) {
    // Rimuovi i parametri dopo il ?
    return match[1].split("?")[0];
  }
  // Altrimenti è già un URL — rimuovi comunque parametri dopo ?
  return input.split("?")[0];
}

const C = {
  green: "#6DBF3E", greenDim: "#6DBF3E22",
  blue: "#2B6CC4", blueDim: "#2B6CC422", blueLight: "#4A8FE0",
  purple: "#B44FFF", purpleDim: "#B44FFF22", purpleGlow: "#CC77FF",
  bg: "#080B10", surface: "#0E1318", card: "#121820",
  border: "#1C2530", text: "#E8EDF5", muted: "#6B7A8D", dim: "#3A4A5A",
  red: "#FF5555",
};
const glow = (c, px = 12) => `0 0 ${px}px ${c}44, 0 0 ${px * 2}px ${c}22`;

const defaultPromos = [];

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && u.email !== ADMIN_EMAIL) {
        try {
          const snap = await getDoc(doc(db, "studenti", u.uid));
          setUserData(snap.exists() ? snap.data() : {});
        } catch { setUserData({}); }
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <Splash />;
  if (!user) return <LoginPage />;
  if (user.email === ADMIN_EMAIL) return <AdminPanel adminUser={user} />;
  return <StudentPortal userData={userData} />;
}

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════
function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const login = async () => {
    if (!form.email || !form.password) { setErr("Inserisci email e password."); return; }
    setBusy(true); setErr("");
    try { await signInWithEmailAndPassword(auth, form.email, form.password); }
    catch { setErr("Email o password non corretti."); }
    setBusy(false);
  };

  const reset = async () => {
    if (!form.email) { setErr("Inserisci la tua email."); return; }
    try { await sendPasswordResetEmail(auth, form.email); setResetSent(true); setErr(""); }
    catch { setErr("Email non trovata."); }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: C.purple, opacity: 0.04, top: -100, right: -100, filter: "blur(80px)" }} />
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: C.green, opacity: 0.05, bottom: -80, left: -80, filter: "blur(60px)" }} />
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "48px 40px", width: 380, boxShadow: `0 40px 100px rgba(0,0,0,0.7),${glow(C.purple, 20)}` }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo_mindsell.png" alt="MindSell" style={{ height: 68, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
          <div style={{ fontWeight: 800, fontSize: 26, background: `linear-gradient(90deg,${C.green},${C.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginTop: 8 }}>MindSell</div>
          <p style={{ color: C.muted, fontSize: 14, margin: "4px 0 0" }}>Accedi alla tua area personale</p>
        </div>
        {resetSent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
            <p style={{ color: C.green, fontWeight: 600 }}>Email inviata!</p>
            <p style={{ color: C.muted, fontSize: 13 }}>Controlla la casella e clicca il link.</p>
            <button style={{ ...btn(C.green), width: "100%", marginTop: 16 }} onClick={() => setResetSent(false)}>Torna al login</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input style={inp(!!err)} placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} onKeyDown={e => e.key === "Enter" && login()} />
            <div style={{ position:"relative" }}>
              <input style={{ ...inp(!!err), paddingRight:44 }} placeholder="Password" type={showPw?"text":"password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} onKeyDown={e => e.key === "Enter" && login()} />
              <button style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#6B7A8D", padding:0, fontFamily:"inherit" }} onClick={()=>setShowPw(!showPw)}>{showPw?"🙈":"👁"}</button>
            </div>
            {err && <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{err}</p>}
            <button style={{ ...btn(C.green), width: "100%", opacity: busy ? 0.7 : 1, marginTop: 4 }} onClick={login} disabled={busy}>{busy ? "Accesso..." : "Accedi →"}</button>
            <button style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }} onClick={reset}>Password dimenticata?</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '\u2022 $1')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function CoachIntelligencePanel({ selected, C }) {
  const [noteCoach, setNoteCoach] = useState("");
  const [simInput, setSimInput] = useState("");
  const [simMessages, setSimMessages] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [coachIntelTab, setCoachIntelTab] = useState("visuale");
  const [coachData, setCoachData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  // Carica dati memoria coach per questo studente
  useEffect(() => {
    if (!selected?.uid) return;
    setLoadingData(true);
    import("./firebase").then(({ db }) => {
      import("firebase/firestore").then(({ doc, getDoc, collection, getDocs }) => {
        Promise.all([
          getDoc(doc(db, "aiCoach", selected.uid, "memoria", "patterns")),
          getDoc(doc(db, "aiCoach", selected.uid, "memoria", "linguistic")),
          getDoc(doc(db, "aiCoach", selected.uid, "memoria", "meta")),
          getDoc(doc(db, "aiCoach", selected.uid, "memoria", "roleplay")),
          getDoc(doc(db, "studenti", selected.uid)),
        ]).then(([pSnap, lSnap, mSnap, rpSnap, stSnap]) => {
          setCoachData({
            patterns: pSnap.exists() ? pSnap.data() : null,
            linguistic: lSnap.exists() ? lSnap.data() : null,
            meta: mSnap.exists() ? mSnap.data() : null,
            roleplay: rpSnap.exists() ? rpSnap.data() : null,
            studente: stSnap.exists() ? stSnap.data() : null,
          });
          setLoadingData(false);
        });
      });
    });
  }, [selected?.uid]);

  const tabStyle = (id) => ({
    padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
    background: coachIntelTab === id ? C.purple + "22" : "transparent",
    color: coachIntelTab === id ? C.purple : C.muted,
    border: `1px solid ${coachIntelTab === id ? C.purple + "44" : "transparent"}`,
  });

  const Section = ({ emoji, title, color, children }) => (
    <div style={{ background: C.card, border: `1px solid ${color}22`, borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{emoji} {title}</div>
      {children}
    </div>
  );

  const Row = ({ label, value }) => value ? (
    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: C.muted, minWidth: 140, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontSize: 12, color: C.text }}>{value}</span>
    </div>
  ) : null;

  const List = ({ items }) => items?.length > 0 ? (
    <div>{items.map((item, i) => <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 4, paddingLeft: 8 }}>• {item}</div>)}</div>
  ) : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Nessun dato ancora</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={tabStyle("visuale")} onClick={() => setCoachIntelTab("visuale")}>👁 Visuale</div>
        <div style={tabStyle("simulatore")} onClick={() => setCoachIntelTab("simulatore")}>🧪 Simulatore</div>
      </div>

      {coachIntelTab === "visuale" && (
        <div>
          {loadingData ? (
            <div style={{ color: C.muted, fontSize: 13 }}>Caricamento dati...</div>
          ) : !coachData ? (
            <div style={{ color: C.muted, fontSize: 13 }}>Nessun dato disponibile per questo studente.</div>
          ) : (
            <>
              {/* Profilo */}
              <Section emoji="👤" title="Profilo Studente" color={C.blue}>
                <Row label="Nome" value={selected?.name} />
                <Row label="Piano" value={selected?.plan} />
                <Row label="Sessioni AI Coach" value={coachData.meta?.sessioni_totali ? `${coachData.meta.sessioni_totali} sessioni` : "0 sessioni"} />
                <Row label="Moduli assegnati" value={selected?.moduli?.length > 0 ? selected.moduli.map(m => m.title).join(", ") : "Nessuno"} />
                <Row label="In corso" value={selected?.moduli?.filter(m => { const done = m.videolezioni?.filter(v => v.progress === 100).length || 0; return done > 0 && done < (m.videolezioni?.length || 0); }).map(m => { const done = m.videolezioni?.filter(v => v.progress === 100).length || 0; return `${m.title} (${done}/${m.videolezioni?.length})`; }).join(", ") || "—"} />
                <Row label="Moduli completati" value={
                  selected?.moduli?.filter(m => m.videolezioni?.length > 0 && m.videolezioni.every(v => v.progress === 100)).map(m => m.title).join(", ") || "Nessuno ancora"
                } />
              </Section>

              {/* Pattern comportamentali */}
              <Section emoji="🎯" title="Pattern Comportamentali" color={C.green}>
                {coachData.patterns ? (
                  <>
                    <Row label="Figura clienti prevalente" value={coachData.patterns.figura_dominante} />
                    <Row label="Bias ricorrente nei clienti" value={coachData.patterns.bias_ricorrente} />
                    <Row label="Fase critica" value={coachData.patterns.fase_critica} />
                    <Row label="Leva efficace" value={coachData.patterns.leva_efficace} />
                    <Row label="Obiezione irrisolta" value={coachData.patterns.obiezione_irrisolta} />
                  </>
                ) : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Nessun pattern rilevato ancora — servono almeno 2 sessioni coach</div>}
              </Section>

              {/* Profilo cognitivo */}
              <Section emoji="🧬" title="Profilo Cognitivo e Linguistico" color={C.purple}>
                {coachData.linguistic ? (
                  <>
                    <Row label="Stile comunicativo" value={coachData.linguistic.stile_comunicativo} />
                    <Row label="Stile ragionamento" value={coachData.linguistic.stile_ragionamento} />
                    {coachData.linguistic.concetti_padroneggiati?.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Concetti padroneggiati:</div>
                        <List items={coachData.linguistic.concetti_padroneggiati} />
                      </div>
                    )}
                    {coachData.linguistic.concetti_parziali?.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Da rafforzare:</div>
                        <List items={coachData.linguistic.concetti_parziali} />
                      </div>
                    )}
                    {coachData.linguistic.errori_concettuali?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Errori concettuali:</div>
                        <List items={coachData.linguistic.errori_concettuali} />
                      </div>
                    )}
                  </>
                ) : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Nessun profilo cognitivo ancora</div>}
              </Section>

              {/* Progressione sessioni */}
              {coachData.roleplay?.progressione && (
                <Section emoji="📈" title="Progressione Sessioni" color="#E67E22">
                  {coachData.roleplay.progressione.score_aree && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {Object.entries(coachData.roleplay.progressione.score_aree).map(([area, val]) => {
                        const labels = { chiusura: "Chiusura", gestione_obiezioni: "Obiezioni", rapport: "Rapport", struttura_pitch: "Pitch", ascolto_attivo: "Ascolto" };
                        const col = val.score >= 70 ? C.green : val.score >= 40 ? "#E67E22" : "#ff6b6b";
                        return (
                          <div key={area} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: C.muted }}>{labels[area]}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{val.score} <span style={{ fontSize: 12 }}>{val.trend}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {coachData.roleplay.progressione.errori_persistenti?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "#ff6b6b", fontWeight: 700, marginBottom: 4 }}>⚠️ Errori persistenti:</div>
                      <List items={coachData.roleplay.progressione.errori_persistenti} />
                    </div>
                  )}
                  {coachData.roleplay.progressione.errori_superati?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>✅ Errori superati:</div>
                      <List items={coachData.roleplay.progressione.errori_superati} />
                    </div>
                  )}
                  {coachData.roleplay.progressione.gap_teoria_pratica?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: "#E67E22", fontWeight: 700, marginBottom: 4 }}>📚 Gap teoria→pratica:</div>
                      <List items={coachData.roleplay.progressione.gap_teoria_pratica} />
                    </div>
                  )}
                </Section>
              )}

              {/* Note coach umano */}
              <Section emoji="✍️" title="Note Coach Umano" color={C.green}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                  Scrivi qui osservazioni, criticità e focus che vuoi che il coach AI incorpori nel ragionamento su questo studente.
                </div>
                <textarea
                  style={{ width: "100%", minHeight: 100, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.text, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
                  placeholder="Es: Michele tende a categorizzare troppo presto il cliente senza esplorare il sistema decisionale attivo. Lavorare su domande di discovery prima di qualsiasi label..."
                  value={noteCoach}
                  onChange={e => setNoteCoach(e.target.value)}
                />
                <button
                  style={{ ...{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8 } }}
                  onClick={async () => {
                    import("./firebase").then(({ db }) => {
                      import("firebase/firestore").then(({ doc, setDoc, serverTimestamp }) => {
                        setDoc(doc(db, "aiCoach", selected.uid, "memoria", "meta"), {
                          note_coach_umano: noteCoach,
                          note_aggiornate_il: serverTimestamp(),
                        }, { merge: true });
                        alert("✅ Note salvate — il coach AI le leggerà dalla prossima sessione");
                      });
                    });
                  }}
                >💾 Salva note</button>
              </Section>
            </>
          )}
        </div>
      )}

      {coachIntelTab === "simulatore" && (
        <div>
          <div style={{ background: C.card, border: `1px solid ${C.purple}33`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: C.muted }}>
            🧪 <strong style={{ color: C.purple }}>Modalità simulazione</strong> — Le risposte non vengono memorizzate e non influenzano il profilo dello studente.
          </div>

          {/* Chat simulatore */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, minHeight: 200, maxHeight: 400, overflowY: "auto", marginBottom: 12 }}>
            {simMessages.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, fontStyle: "italic", textAlign: "center", paddingTop: 60 }}>
                Scrivi un messaggio per simulare una sessione coach con {selected?.name}
              </div>
            ) : simMessages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.role === "user" ? C.blue : C.card,
                  border: `1px solid ${m.role === "user" ? C.blue + "66" : C.border}`,
                  fontSize: 13, color: C.text, lineHeight: 1.5,
                }}>
                  {m.role === "assistant"
                    ? <span dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                    : m.content}
                </div>
              </div>
            ))}
            {simLoading && (
              <div style={{ display: "flex", gap: 4, padding: 8 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.purple, animation: `msCoachPulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.text, outline: "none", fontFamily: "inherit", resize: "none", minHeight: 44 }}
              placeholder={`Simula una domanda come ${selected?.name}...`}
              value={simInput}
              onChange={e => setSimInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); document.getElementById("sim-send-btn")?.click(); }}}
              rows={2}
            />
            <button
              id="sim-send-btn"
              style={{ background: C.purple, color: "#fff", border: "none", borderRadius: 8, padding: "0 20px", fontSize: 13, fontWeight: 700, cursor: simLoading || !simInput.trim() ? "not-allowed" : "pointer", opacity: simLoading || !simInput.trim() ? 0.6 : 1 }}
              disabled={simLoading || !simInput.trim()}
              onClick={async () => {
                const msg = simInput.trim();
                setSimInput("");
                const newMessages = [...simMessages, { role: "user", content: msg }];
                setSimMessages(newMessages);
                setSimLoading(true);
                try {
                  // Carica memoria studente
                  const { db } = await import("./firebase");
                  const { doc, getDoc } = await import("firebase/firestore");
                  const [pSnap, lSnap, metaSnap, rpSnap] = await Promise.all([
                    getDoc(doc(db, "aiCoach", selected.uid, "memoria", "patterns")),
                    getDoc(doc(db, "aiCoach", selected.uid, "memoria", "linguistic")),
                    getDoc(doc(db, "aiCoach", selected.uid, "memoria", "meta")),
                    getDoc(doc(db, "aiCoach", selected.uid, "memoria", "roleplay")),
                  ]);
                  const patterns = pSnap.exists() ? pSnap.data() : null;
                  const linguistic = lSnap.exists() ? lSnap.data() : null;
                  const sessionCount = metaSnap.exists() ? (metaSnap.data().sessioni_totali || 0) : 0;
                  const noteCoachUmano = metaSnap.exists() ? metaSnap.data().note_coach_umano : null;
                  const roleplayInsights = rpSnap.exists() ? rpSnap.data().analisi : null;
                  const roleplayProgressione = rpSnap.exists() ? rpSnap.data().progressione : null;

                  // Costruisci system prompt (uguale al coach reale)
                  const name = selected.name || "lo studente";
                  const moduli = (selected.moduli || []).map(m => m.title).filter(Boolean);
                  
                  // Moduli completati, in corso, assegnati ma non iniziati
                  const moduliCompletati = (selected.moduli || [])
                    .filter(m => m.videolezioni?.length > 0 && m.videolezioni.every(v => v.progress === 100))
                    .map(m => m.title);
                  const moduliInCorso = (selected.moduli || [])
                    .filter(m => m.videolezioni?.some(v => v.progress === 100) && !m.videolezioni.every(v => v.progress === 100))
                    .map(m => {
                      const done = m.videolezioni.filter(v => v.progress === 100).length;
                      return m.title + " (" + done + "/" + m.videolezioni.length + " lezioni)";
                    });
                  const moduliNonIniziati = (selected.moduli || [])
                    .filter(m => !m.videolezioni?.some(v => v.progress === 100))
                    .map(m => m.title);

                  let systemParts = [
                    "Sei MindSell AI Coach, assistente personale di " + name + ". Modalità SIMULAZIONE ADMIN — sessione non memorizzata.",
                    "MODULI COMPLETATI (approfondisci liberamente): " + (moduliCompletati.join(", ") || "nessuno") + "\n" +
                    "MODULI IN CORSO (solo lezioni già viste): " + (moduliInCorso.join(", ") || "nessuno") + "\n" +
                    "MODULI ASSEGNATI NON ANCORA INIZIATI (trattali come non acquistati): " + (moduliNonIniziati.join(", ") || "nessuno"),
                    "REGOLA CONTENUTI: Su moduli COMPLETATI approfondisci liberamente. Su moduli IN CORSO usa solo concetti delle lezioni viste. Su moduli NON INIZIATI e argomenti non acquistati: dai max 2 principi generali dalla cultura base poi scrivi esattamente: \"Per approfondire questo ti consiglio di lavorarlo con Emanuela nel percorso dedicato.\" Non fare mai lezioni complete su moduli non iniziati o non acquistati, nemmeno se lo studente insiste.",
                    "STILE: Rispondi in italiano. Tono diretto e caldo. Paragrafi brevi. Scrivi testo leggibile senza simboli markdown. Concludi con 1 azione concreta.",
                  ];
                  if (noteCoachUmano) systemParts.push("NOTE COACH UMANO: " + noteCoachUmano);
                  if (patterns) systemParts.push("PATTERN: figura_dominante: " + (patterns.figura_dominante || "—") + " | fase_critica: " + (patterns.fase_critica || "—") + " | bias: " + (patterns.bias_ricorrente || "—"));
                  if (linguistic) systemParts.push("PROFILO COGNITIVO: stile: " + (linguistic.stile_comunicativo || "—") + " | ragionamento: " + (linguistic.stile_ragionamento || "—"));
                  if (roleplayProgressione?.errori_persistenti?.length) systemParts.push("ERRORI PERSISTENTI:\n" + roleplayProgressione.errori_persistenti.map(e => "- " + e).join("\n"));
                  if (roleplayProgressione?.focus_attuale) systemParts.push("FOCUS ATTUALE: " + roleplayProgressione.focus_attuale);

                  const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      system: systemParts.join("\n\n"),
                      messages: [...newMessages].map(m => ({ role: m.role, content: m.content })),
                    }),
                  });
                  const data = await res.json();
                  const reply = data.content?.[0]?.text || "Errore nella risposta.";
                  setSimMessages(prev => [...prev, { role: "assistant", content: reply }]);
                } catch(err) {
                  setSimMessages(prev => [...prev, { role: "assistant", content: "Errore: " + err.message }]);
                } finally {
                  setSimLoading(false);
                }
              }}
            >Invia</button>
            {simMessages.length > 0 && (
              <button
                style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 12px", fontSize: 12, color: C.muted, cursor: "pointer" }}
                onClick={() => setSimMessages([])}
              >Reset</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoleplayAnalisiList({ uid }) {
  const [analisi, setAnalisi] = useState([]);
  const [progressione, setProgressione] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!uid) return;
    import("./firebase").then(({ db }) => {
      import("firebase/firestore").then(({ doc, onSnapshot }) => {
        const ref = doc(db, "aiCoach", uid, "memoria", "roleplay");
        onSnapshot(ref, snap => {
          if (snap.exists()) {
            setAnalisi(snap.data().analisi || []);
            setProgressione(snap.data().progressione || null);
          } else {
            setAnalisi([]);
            setProgressione(null);
          }
        });
      });
    });
  }, [uid]);

  if (analisi.length === 0) return (
    <div style={{ fontSize: 13, color: "#6B7A8D", fontStyle: "italic" }}>Nessuna analisi roleplay ancora. Incolla un URL sopra per iniziare.</div>
  );

  const CP = { purple: "#B44FFF", border: "#1C2530", text: "#E8EDF5", muted: "#6B7A8D", green: "#6DBF3E", surface: "#0E1318", orange: "#E67E22", red: "#ff6b6b" };
  const AREE_LABELS = { chiusura: "Chiusura", gestione_obiezioni: "Obiezioni", rapport: "Rapport", struttura_pitch: "Pitch", ascolto_attivo: "Ascolto" };
  const TREND_COLOR = { "↑": CP.green, "↓": CP.red, "→": CP.muted };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* PANNELLO PROGRESSIONE */}
      {progressione && progressione.score_aree && (
        <div style={{ background: CP.surface, border: `1px solid ${CP.purple}44`, borderRadius: 12, padding: "16px 20px", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: CP.purple, marginBottom: 12 }}>📈 Progressione attuale</div>

          {/* Score per area */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {Object.entries(progressione.score_aree).map(([area, val]) => (
              <div key={area} style={{ background: "#0E1318", border: `1px solid ${CP.border}`, borderRadius: 8, padding: "8px 12px", minWidth: 100 }}>
                <div style={{ fontSize: 11, color: CP.muted, marginBottom: 4 }}>{AREE_LABELS[area] || area}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: val.score >= 70 ? CP.green : val.score >= 40 ? CP.orange : CP.red }}>{val.score}</div>
                  <div style={{ fontSize: 16, color: TREND_COLOR[val.trend] || CP.muted }}>{val.trend}</div>
                  {val.variazione !== 0 && <div style={{ fontSize: 10, color: val.variazione > 0 ? CP.green : CP.red }}>{val.variazione > 0 ? "+" : ""}{val.variazione}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Focus attuale */}
          {progressione.focus_attuale && (
            <div style={{ background: CP.purple + "11", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: CP.purple, marginBottom: 3 }}>🎯 FOCUS ATTUALE</div>
              <div style={{ fontSize: 12, color: CP.text }}>{progressione.focus_attuale}</div>
            </div>
          )}

          {/* Errori superati */}
          {progressione.errori_superati?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: CP.green, marginBottom: 4 }}>✅ ERRORI SUPERATI</div>
              {progressione.errori_superati.map((e, i) => <div key={i} style={{ fontSize: 11, color: CP.text, paddingLeft: 8, marginBottom: 2 }}>• {e}</div>)}
            </div>
          )}

          {/* Errori persistenti */}
          {progressione.errori_persistenti?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: CP.red, marginBottom: 4 }}>⚠️ ERRORI PERSISTENTI</div>
              {progressione.errori_persistenti.map((e, i) => <div key={i} style={{ fontSize: 11, color: CP.text, paddingLeft: 8, marginBottom: 2 }}>• {e}</div>)}
            </div>
          )}

          {/* Gap teoria/pratica */}
          {progressione.gap_teoria_pratica?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: CP.orange, marginBottom: 4 }}>📚 GAP TEORIA → PRATICA</div>
              {progressione.gap_teoria_pratica.map((e, i) => <div key={i} style={{ fontSize: 11, color: CP.text, paddingLeft: 8, marginBottom: 2 }}>• {e}</div>)}
            </div>
          )}

          {/* Traguardi */}
          {progressione.traguardi?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CP.muted, marginBottom: 4 }}>🏆 TRAGUARDI ({progressione.traguardi.length})</div>
              {progressione.traguardi.slice(0, 3).map((t, i) => (
                <div key={i} style={{ fontSize: 11, color: CP.text, paddingLeft: 8, marginBottom: 2 }}>
                  • {t.titolo} <span style={{ color: CP.muted }}>({t.data ? new Date(t.data).toLocaleDateString("it-IT") : ""})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {analisi.map((a, i) => (
        <div key={i} style={{ background: CP.surface, border: `1px solid ${CP.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(expanded === i ? null : i)}>
              <div style={{ fontWeight: 600, fontSize: 13, color: CP.text }}>{a.titolo || "Sessione " + (i+1)}</div>
              <div style={{ fontSize: 11, color: CP.muted, marginTop: 2 }}>{a.contesto?.slice(0, 80)}{a.contesto?.length > 80 ? "..." : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: CP.muted }}>{a.data_analisi ? new Date(a.data_analisi).toLocaleDateString("it-IT") : ""}</div>
              <div style={{ cursor: "pointer", color: CP.muted }} onClick={() => setExpanded(expanded === i ? null : i)}>{expanded === i ? "▲" : "▼"}</div>
              <button
                style={{ background: "transparent", border: `1px solid #ff475444`, borderRadius: 6, color: "#ff4754", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!window.confirm("Eliminare questa analisi?")) return;
                  const newAnalisi = analisi.filter((_, idx) => idx !== i);
                  // Ricalcola progressione dalle analisi rimanenti
                  let nuovaProgressione = null;
                  if (newAnalisi.length > 0) {
                    // Mantieni solo errori_superati e traguardi ancora validi
                    const erroriRimanenti = new Set(newAnalisi.flatMap(a => a.errori_ricorrenti || []));
                    const erroriSuperatiValidi = (progressione?.errori_superati || []).filter(e => !erroriRimanenti.has(e));
                    nuovaProgressione = {
                      ...(progressione || {}),
                      errori_persistenti: newAnalisi.length >= 2
                        ? newAnalisi[0]?.errori_ricorrenti?.filter(e => newAnalisi[1]?.errori_ricorrenti?.includes(e)) || []
                        : [],
                      errori_superati: erroriSuperatiValidi,
                      // Resetta score se non ci sono più analisi con progressione
                      score_aree: newAnalisi.length < 2 ? null : progressione?.score_aree || null,
                    };
                  }
                  import("./firebase").then(({ db }) => {
                    import("firebase/firestore").then(({ doc, setDoc, serverTimestamp }) => {
                      const ref = doc(db, "aiCoach", uid, "memoria", "roleplay");
                      setDoc(ref, {
                        analisi: newAnalisi,
                        progressione: nuovaProgressione,
                        aggiornato_il: serverTimestamp()
                      });
                    });
                  });
                }}
              >🗑</button>
            </div>
          </div>
          {expanded === i && (
            <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${CP.border}` }}>
              {a.argomenti_trattati?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: CP.muted, marginBottom: 6 }}>📋 ARGOMENTI TRATTATI</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {a.argomenti_trattati.map((t, j) => (
                      <span key={j} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: CP.border, color: CP.muted }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {a.progressi_osservati?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#00b894", marginBottom: 6 }}>📈 PROGRESSI OSSERVATI</div>
                  {a.progressi_osservati.map((p, j) => <div key={j} style={{ fontSize: 12, color: CP.text, marginBottom: 4, paddingLeft: 8 }}>• {p}</div>)}
                </div>
              )}
              {a.punti_di_forza?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: CP.green, marginBottom: 6 }}>✅ PUNTI DI FORZA</div>
                  {a.punti_di_forza.map((p, j) => <div key={j} style={{ fontSize: 12, color: CP.text, marginBottom: 4, paddingLeft: 8 }}>• {p}</div>)}
                </div>
              )}
              {a.errori_ricorrenti?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#ff6b6b", marginBottom: 6 }}>⚠️ ERRORI RICORRENTI</div>
                  {a.errori_ricorrenti.map((p, j) => <div key={j} style={{ fontSize: 12, color: CP.text, marginBottom: 4, paddingLeft: 8 }}>• {p}</div>)}
                </div>
              )}
              {a.criticita_sessione?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#ff4757", marginBottom: 6 }}>🎯 CRITICITÀ RILEVATE</div>
                  {a.criticita_sessione.map((p, j) => <div key={j} style={{ fontSize: 12, color: CP.text, marginBottom: 4, paddingLeft: 8, borderLeft: "2px solid #ff475744", paddingLeft: 10 }}>• {p}</div>)}
                </div>
              )}
              {a.obiezioni_non_gestite?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#E67E22", marginBottom: 6 }}>🥊 OBIEZIONI NON GESTITE</div>
                  {a.obiezioni_non_gestite.map((p, j) => <div key={j} style={{ fontSize: 12, color: CP.text, marginBottom: 4, paddingLeft: 8 }}>• {p}</div>)}
                </div>
              )}
              {a.concetti_da_rinforzare?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: CP.purple, marginBottom: 6 }}>📚 CONCETTI DA RINFORZARE</div>
                  {a.concetti_da_rinforzare.map((p, j) => <div key={j} style={{ fontSize: 12, color: CP.text, marginBottom: 4, paddingLeft: 8 }}>• {p}</div>)}
                </div>
              )}
              {a.raccomandazione_coach && (
                <div style={{ marginTop: 12, background: CP.purple + "11", border: `1px solid ${CP.purple}33`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: CP.purple, marginBottom: 4 }}>🎯 RACCOMANDAZIONE COACH</div>
                  <div style={{ fontSize: 12, color: CP.text }}>{a.raccomandazione_coach}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
function AdminPanel({ adminUser }) {
  const [section, setSection] = useState("studenti");
  const [unreadChats, setUnreadChats] = useState(0);
  const [view, setView] = useState("lista");

  // Conta chat con messaggi non letti
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "chat"), snap => {
      const count = snap.docs.filter(d => d.data().hasUnread === true).length;
      setUnreadChats(count);
    });
    return unsub;
  }, []);
  const [studenti, setStudenti] = useState([]);
  const [libreria, setLibreria] = useState([]);
  const [guide, setGuide] = useState([]);
  const [offerteGlobali, setOfferteGlobali] = useState([]);
  const [prezziSessioni, setPrezziSessioni] = useState([
    { key: "aula", tipo: "📚 Aula Didattica", prezzo: "59€", desc: "1 sessione di formazione in gruppo" },
    { key: "onetoone", tipo: "🎯 One to One", prezzo: "149€", desc: "1 sessione individuale con il coach" },
    { key: "roleplay", tipo: "🎭 Roleplay", prezzo: "149€", desc: "1 sessione di simulazione pratica" },
  ]);
  const [selected, setSelected] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [adminTab, setAdminTab] = useState("moduli");
  const [expLibMod, setExpLibMod] = useState(null);
  const [modalAcquisto, setModalAcquisto] = useState(false);
  const [expStudMod, setExpStudMod] = useState(null);
  const [modalAssegnaLezione, setModalAssegnaLezione] = useState(false);
  const [assegnaLezModIdx, setAssegnaLezModIdx] = useState(null);
  const [toast, setToast] = useState("");

  const [modalStudent, setModalStudent] = useState(false);
  const [modalModuloLib, setModalModuloLib] = useState(false);
  const [modalVideoLib, setModalVideoLib] = useState({ open: false, mIdx: null });
  const [modalAssegna, setModalAssegna] = useState(false);
  const [modalSession, setModalSession] = useState(false);
  const [modalRec, setModalRec] = useState(false);
  const [modalContent, setModalContent] = useState(false);
  const [modalPromo, setModalPromo] = useState(false);
  const [roleplayUrl, setRoleplayUrl] = useState("");
  const [roleplayLoading, setRoleplayLoading] = useState(false);
  const [roleplayError, setRoleplayError] = useState("");
  const [fPromo, setFPromo] = useState({ title: "", desc: "", price: "", badge: "", color: C.green, evergreen: true, scadenza: "" });

  const [fStudent, setFStudent] = useState({ name: "", email: "", password: "", plan: "" });
  const [fModuloLib, setFModuloLib] = useState({ title: "", emoji: "📚", descrizione: "", tipo: "modulo" });
  const [fVideoLib, setFVideoLib] = useState({ title: "", duration: "", url: "", emoji: "🎬" });
  const [fSession, setFSession] = useState({ label: "", icon: "🎯", total: 1 });
  const [fRec, setFRec] = useState({ title: "", date: "", duration: "", coach: "", url: "", tipo: "aula" });
  const [fContent, setFContent] = useState({ title: "", type: "PDF", size: "", emoji: "📄", url: "" });
  const [searchStudenti, setSearchStudenti] = useState("");
  const [selectedLibModuli, setSelectedLibModuli] = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadingData(true);
    try {
      const [snapS, snapL, snapG, snapConfig] = await Promise.all([
        getDocs(collection(db, "studenti")),
        getDocs(collection(db, "libreria")),
        getDocs(collection(db, "guide")),
        getDoc(doc(db, "config", "prezzi_sessioni")),
      ]);
      setStudenti(snapS.docs.map(d => ({ uid: d.id, ...d.data() })));
      setLibreria(snapL.docs.map(d => ({ id: d.id, ...d.data() })));
      setGuide(snapG?.docs?.map(d => ({ id: d.id, ...d.data() })) || []);
      if (snapConfig.exists() && snapConfig.data().sessioni) {
        setPrezziSessioni(snapConfig.data().sessioni);
      }
    } catch (e) { console.error(e); }
    setLoadingData(false);
  };

  const openStudent = (s) => { setSelected(JSON.parse(JSON.stringify(s))); setView("dettaglio"); setAdminTab("moduli"); };

  const saveStudent = async () => {
    try {
      const { uid, ...data } = selected;
      await setDoc(doc(db, "studenti", uid), data, { merge: true });
      await loadAll();
      showToast("✅ Salvato!");
    } catch { showToast("❌ Errore nel salvataggio."); }
  };

  const addStudent = async () => {
    if (!fStudent.name || !fStudent.email || !fStudent.password) { showToast("⚠️ Compila tutti i campi."); return; }
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, fStudent.email, fStudent.password);
      await secondaryAuth.signOut();
      await setDoc(doc(db, "studenti", cred.user.uid), {
        name: fStudent.name, plan: fStudent.plan, email: fStudent.email,
        avatar: fStudent.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        moduli: [], packages: [], recordings: [], contents: [], promos: defaultPromos,
      });
    } catch {
      await loadAll();
      setModalStudent(false);
      setFStudent({ name: "", email: "", password: "", plan: "" });
      showToast("✅ Studente creato! Rieffettua il login admin.");
      return;
    }
    await loadAll();
    setModalStudent(false);
    setFStudent({ name: "", email: "", password: "", plan: "" });
    showToast("✅ Studente creato!");
  };

  const deleteStudent = async (uid) => {
    if (!window.confirm("Eliminare questo studente?")) return;
    try { await deleteDoc(doc(db, "studenti", uid)); await loadAll(); setView("lista"); showToast("✅ Eliminato."); }
    catch { showToast("❌ Errore."); }
  };

  const addModuloLib = async () => {
    if (!fModuloLib.title) { showToast("⚠️ Inserisci un titolo."); return; }
    const id = "mod_" + Date.now();
    try {
      await setDoc(doc(db, "libreria", id), { ...fModuloLib, videolezioni: [] });
      await loadAll();
      setFModuloLib({ title: "", emoji: "📚", descrizione: "", tipo: "modulo" });
      setModalModuloLib(false);
      showToast("✅ Modulo aggiunto alla libreria!");
    } catch { showToast("❌ Errore."); }
  };

  const deleteModuloLib = async (id) => {
    if (!window.confirm("Eliminare questo modulo dalla libreria?")) return;
    try { await deleteDoc(doc(db, "libreria", id)); await loadAll(); showToast("✅ Modulo eliminato."); }
    catch { showToast("❌ Errore."); }
  };

  const addVideoLib = async () => {
    if (!fVideoLib.title) return;
    const modulo = libreria[modalVideoLib.mIdx];
    const videoToSave = { ...fVideoLib, url: extractBunnyUrl(fVideoLib.url), progress: 0 };
    const updated = { ...modulo, videolezioni: [...(modulo.videolezioni || []), videoToSave] };
    try {
      await setDoc(doc(db, "libreria", modulo.id), updated);
      await loadAll();
      setFVideoLib({ title: "", duration: "", url: "", emoji: "🎬" });
      setModalVideoLib({ open: false, mIdx: null });
      showToast("✅ Videolezione aggiunta!");
    } catch { showToast("❌ Errore."); }
  };

  const saveModuloLib = async (modulo) => {
    try {
      const { id, ...data } = modulo;
      await setDoc(doc(db, "libreria", id), data);
      // Sincronizza automaticamente tutti gli studenti che hanno questo modulo assegnato
      const studSnap = await getDocs(collection(db, "studenti"));
      const syncPromises = [];
      studSnap.forEach(studDoc => {
        const studData = studDoc.data();
        if (!studData.moduli) return;
        const moduli = studData.moduli.map(m => {
          if (m.libId !== id) return m;
          // Aggiorna titolo, emoji e videolezioni mantenendo il progresso
          const progressMap = {};
          (m.videolezioni || []).forEach((v, i) => { progressMap[i] = v.progress || 0; });
          const nuoveLezioni = (modulo.videolezioni || []).map((v, i) => ({ ...v, progress: progressMap[i] || 0 }));
          return { ...m, title: modulo.title, emoji: modulo.emoji, videolezioni: nuoveLezioni };
        });
        syncPromises.push(setDoc(doc(db, "studenti", studDoc.id), { ...studData, moduli }));
      });
      await Promise.all(syncPromises);
      await loadAll();
      showToast("✅ Modulo salvato e sincronizzato con tutti gli studenti!");
    } catch { showToast("❌ Errore."); }
  };

  const assegnaModuli = () => {
    const s = JSON.parse(JSON.stringify(selected));
    if (!s.moduli) s.moduli = [];
    const giàAssegnati = s.moduli.map(m => m.libId);
    const nuovi = libreria.filter(m => selectedLibModuli.includes(m.id) && !giàAssegnati.includes(m.id));
    nuovi.forEach(m => s.moduli.push({ libId: m.id, title: m.title, emoji: m.emoji, tipo: m.tipo || "modulo", videolezioni: (m.videolezioni || []).map(v => ({ ...v, progress: 0 })) }));
    setSelected(s);
    setSelectedLibModuli([]);
    setModalAssegna(false);
    showToast(`✅ ${nuovi.length} modulo/i assegnato/i. Ricorda di salvare!`);
  };

  const toggleLibModulo = (id) => setSelectedLibModuli(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const upd = (fn) => { const s = JSON.parse(JSON.stringify(selected)); fn(s); setSelected(s); };

  const adminNavItems = [
    { id: "moduli", label: "📚 Moduli assegnati" },
    { id: "sessioni", label: "🎯 Sessioni" },
    { id: "registrazioni", label: "⏺ Registrazioni" },
    { id: "materiali", label: "📎 Materiali" },
    { id: "guide", label: "⚙️ Guide Strumenti" },
    { id: "coach_intelligence", label: "🧠 Coach Intelligence" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',sans-serif", color: C.text }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/logo_mindsell.png" alt="" style={{ height: 30, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
          <span style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(90deg,${C.green},${C.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MindSell Admin</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 8, overflowX: "auto", maxWidth: "60vw" }}>
            {[["dashboard", "📊 Dashboard"], ["studenti", "👥 Studenti"], ["libreria", "📚 Libreria Moduli"], ["offerte", "🎁 Offerte"], ["materiali", "📎 Materiali"], ["guide", "⚙️ Guide Strumenti"], ["bacheca", "📋 Bacheca"], ["chat", "💬 Messaggi"]].map(([id, label]) => (
              <button key={id} style={{ background: section === id ? C.purpleDim : "none", border: `1px solid ${section === id ? C.purple + "66" : "transparent"}`, color: section === id ? C.purpleGlow : C.muted, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit", position: "relative" }}
                onClick={() => { setSection(id); setView("lista"); }}>{id === "chat" && unreadChats > 0 ? <span style={{ position:"relative" }}>{label}<span style={{ position:"absolute", top:-8, right:-14, background:"#FF4444", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{unreadChats}</span></span> : label}</button>
            ))}
          </div>
          {view === "dettaglio" && section === "studenti" && (
            <button style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }} onClick={() => setView("lista")}>← Tutti gli studenti</button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {toast && <span style={{ fontSize: 13, color: C.green, background: C.greenDim, padding: "6px 14px", borderRadius: 20 }}>{toast}</span>}
          <button style={{ ...btn(C.red), padding: "7px 14px", fontSize: 13 }} onClick={() => signOut(auth)}>Esci</button>
        </div>
      </div>

      <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>

        {/* CHAT */}
        {section === "dashboard" && (() => {
          const totStudenti = studenti.length;
          const attivi = studenti.filter(s => (s.moduli||[]).some(m => (m.videolezioni||[]).some(v => v.progress > 0))).length;
          const tuttiModuli = studenti.flatMap(s => s.moduli || []);
          const tutteLezioni = tuttiModuli.flatMap(m => m.videolezioni || []);
          const completate = tutteLezioni.filter(v => v.progress === 100).length;
          const totLezioni = tutteLezioni.length;
          const percCompletamento = totLezioni > 0 ? Math.round((completate / totLezioni) * 100) : 0;
          const tutteNote = studenti.flatMap(s => Object.values(s.note || {}));
          const mediaStelle = tutteNote.filter(n => n.stars > 0).length > 0
            ? (tutteNote.filter(n=>n.stars>0).reduce((a,n)=>a+n.stars,0) / tutteNote.filter(n=>n.stars>0).length).toFixed(1)
            : "—";
          const totSessioni = studenti.reduce((a,s) => a + (s.packages||[]).reduce((b,p) => b + (p.total||0), 0), 0);
          const statCards = [
            { label: "Studenti totali", value: totStudenti, icon: "👥", color: C.purple },
            { label: "Studenti attivi", value: attivi, icon: "🟢", color: C.green },
            { label: "Lezioni completate", value: `${completate}/${totLezioni}`, icon: "✅", color: C.blue },
            { label: "Completamento medio", value: `${percCompletamento}%`, icon: "📈", color: C.green },
            { label: "Valutazione media lezioni", value: mediaStelle === "—" ? "—" : `${mediaStelle} ⭐`, icon: "⭐", color: "#F9A825" },
            { label: "Note totali scritte", value: tutteNote.length, icon: "📝", color: C.purple },
            { label: "Sessioni totali acquistate", value: totSessioni, icon: "🎯", color: C.blue },
          ];
          return (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>📊 Dashboard</h2>
              <p style={{ color: C.muted, fontSize: 13, margin: "0 0 24px" }}>Panoramica generale del portale</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
                {statCards.map((s, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", borderLeft: `4px solid ${s.color}` }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px 0" }}>🎁 Richieste offerte</h3>
              <RichiesteOfferte />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>📚 Progressi per studente</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {studenti.map((s, i) => {
                  const lezioni = (s.moduli || []).flatMap(m => m.videolezioni || []);
                  const tot = lezioni.length;
                  const done = lezioni.filter(v => v.progress === 100).length;
                  const perc = tot > 0 ? Math.round((done/tot)*100) : 0;
                  const col = perc === 100 ? C.green : perc > 50 ? C.blue : C.purple;
                  return (
                    <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${col}33`, border: `2px solid ${col}55`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: col, flexShrink: 0 }}>{s.avatar || s.name?.slice(0,2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{s.plan}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <div style={{ width: 120, height: 6, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${perc}%`, background: col, borderRadius: 4 }}/>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: col, minWidth: 38 }}>{perc}%</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{done}/{tot} lezioni</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {section==="materiali" && <AdminMateriali />}
      {section==="guide" && <AdminGuide guide={guide} studenti={studenti} onRefresh={loadAll} />}
      {section==="bacheca" && <AdminBacheca />}
      {section === "chat" && <AdminChat />}


        {/* OFFERTE GLOBALI */}
        {section === "offerte" && (
          <>
            {/* Prezzi sessioni */}
            <div style={{ background: C.card, borderRadius: 16, padding: "24px 28px", marginBottom: 28, border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>💳 Prezzi Sessioni</div>
              <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Modifica e salva — si aggiornano nel modal di acquisto studenti</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {prezziSessioni.map((s, i) => (
                  <div key={s.key} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: C.text, minWidth: 200 }}>{s.tipo}</div>
                    <input style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, color: C.text, outline: "none", width: 80 }}
                      value={s.prezzo} onChange={e => setPrezziSessioni(prev => prev.map((p, j) => j === i ? { ...p, prezzo: e.target.value } : p))} />
                    <input style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 13, color: C.text, outline: "none" }}
                      value={s.desc} onChange={e => setPrezziSessioni(prev => prev.map((p, j) => j === i ? { ...p, desc: e.target.value } : p))} />
                  </div>
                ))}
              </div>
              <button style={{ ...btn(C.green), marginTop: 16 }} onClick={async () => {
                await setDoc(doc(db, "config", "prezzi_sessioni"), { sessioni: prezziSessioni });
                showToast("✅ Prezzi salvati!");
              }}>💾 Salva prezzi</button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Offerte Globali ({offerteGlobali.length})</h2>
                <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>Visibili a tutti gli studenti — quelle scadute spariscono automaticamente</p>
              </div>
              <button style={btn(C.green)} onClick={() => setModalPromo(true)}>＋ Nuova offerta</button>
            </div>
            {offerteGlobali.length === 0
              ? <EmptyState emoji="🎁" text="Nessuna offerta." sub="Aggiungi la prima offerta globale." />
              : offerteGlobali.map((o, idx) => {
                const isScaduta = !o.evergreen && o.scadenza && new Date(o.scadenza) < new Date();
                return (
                  <div key={o.id} style={{ background: C.card, border: `1px solid ${isScaduta ? C.dim : o.color+"44"}`, borderRadius: 14, padding: "20px 24px", marginBottom: 12, opacity: isScaduta ? 0.5 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: o.color+"22", color: o.color }}>{o.badge}</span>
                          {isScaduta && <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>● SCADUTA</span>}
                          {!o.evergreen && !isScaduta && o.scadenza && <span style={{ fontSize: 11, color: C.muted }}>Scade: {new Date(o.scadenza).toLocaleDateString("it-IT")}</span>}
                          {o.evergreen && <span style={{ fontSize: 11, color: C.green }}>✓ Evergreen</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>{o.title}</div>
                        <div style={{ fontSize: 13, color: C.muted }}>{o.desc}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ fontWeight: 800, fontSize: 22, color: o.color }}>{o.price}</span>
                        <button style={{ ...btn(C.red), padding: "7px 12px", fontSize: 13 }} onClick={async () => {
                          if (!window.confirm("Eliminare questa offerta?")) return;
                          await deleteDoc(doc(db, "offerte", o.id));
                          await loadAll();
                          showToast("✅ Offerta eliminata.");
                        }}>🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </>
        )}

        {/* LIBRERIA */}
        {section === "libreria" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Libreria Moduli ({libreria.length})</h2>
                <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>Crea qui i moduli didattici — poi assegnali agli studenti in un clic</p>
              </div>
              <button style={btn(C.green)} onClick={() => setModalModuloLib(true)}>＋ Nuovo modulo</button>
            </div>
            {loadingData ? <p style={{ color: C.muted }}>Caricamento...</p> : (
              libreria.length === 0
                ? <EmptyState emoji="📚" text="Nessun modulo in libreria." sub="Crea il primo modulo didattico." />
                : libreria.map((m, mIdx) => {
                    const col = [C.green, C.blue, C.purple][mIdx % 3];
                    const tot = m.videolezioni?.length || 0;
                    const open = expLibMod === mIdx;
                    return (
                      <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, marginBottom: 14, overflow: "hidden" }}>
                        <div style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderLeft: `4px solid ${col}` }} onClick={() => setExpLibMod(expLibMod === mIdx ? null : mIdx)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: 26 }}>{m.emoji || "📘"}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{m.title}</div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{tot} videolezioni</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: col, fontWeight: 600, background: col + "22", borderRadius: 20, padding: "3px 10px" }}>{tot} lezioni</span>
                            <span style={{ fontSize: 18, color: C.muted, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                          </div>
                        </div>
                        {open && (
                          <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 0 12px" }}>
                              <button style={{ ...btn(C.green), padding: "7px 14px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); saveModuloLib(m); }}>💾 Salva</button>
                              <button style={{ ...btn(C.blue), padding: "7px 14px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setModalVideoLib({ open: true, mIdx }); }}>＋ Videolezione</button>
                              <button style={{ ...btn(C.red), padding: "7px 12px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); deleteModuloLib(m.id); }}>🗑</button>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                              <input style={{ background: "none", border: "none", fontSize: 26, width: 38, outline: "none", fontFamily: "inherit", color: C.text }} value={m.emoji} onChange={e => { const l = [...libreria]; l[mIdx].emoji = e.target.value; setLibreria(l); }} />
                              <input style={{ background: "none", border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 15, borderRadius: 8, padding: "7px 14px", outline: "none", fontFamily: "inherit", flex: 1, boxSizing: "border-box" }} value={m.title} onChange={e => { const l = [...libreria]; l[mIdx].title = e.target.value; setLibreria(l); }} />
                            </div>
                            {tot === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Nessuna videolezione. Aggiungine una.</p>}
                            {m.videolezioni?.map((v, vIdx) => (
                              <div key={vIdx} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, background: C.border, borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{vIdx+1}</span>
                                <input style={{ background: "none", border: `1px solid ${C.border}44`, color: C.text, fontSize: 14, fontWeight: 600, width: 60, outline: "none", fontFamily: "inherit", borderRadius: 6, padding: "3px 8px" }} value={v.emoji} onChange={e => { const l = [...libreria]; l[mIdx].videolezioni[vIdx].emoji = e.target.value; setLibreria(l); }} />
                                <div style={{ flex: 1 }}>
                                  <input style={{ background: "none", border: `1px solid ${C.border}44`, color: C.text, fontSize: 14, fontWeight: 600, width: "100%", outline: "none", fontFamily: "inherit", borderRadius: 6, padding: "3px 8px", marginBottom: 3 }} value={v.title} onChange={e => { const l = [...libreria]; l[mIdx].videolezioni[vIdx].title = e.target.value; setLibreria(l); }} />
                                  <input style={{ background: "none", border: `1px solid ${C.border}44`, color: C.muted, fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", borderRadius: 6, padding: "3px 8px" }} placeholder="URL iframe Bunny es. https://iframe.mediadelivery.net/embed/..." value={extractBunnyUrl(v.url)} onChange={e => { const l = [...libreria]; l[mIdx].videolezioni[vIdx].url = e.target.value; setLibreria(l); }} />
                                </div>
                                <span style={{ color: C.muted, fontSize: 12 }}>{v.duration}</span>
                                <button style={{ background: "none", border: `1px solid ${C.green}55`, color: C.green, cursor: "pointer", fontSize: 11, borderRadius: 6, padding: "3px 7px", marginRight: 4, fontFamily: "inherit" }} onClick={() => saveModuloLib(libreria[mIdx])}>💾</button>
                                <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }} onClick={() => { const l = [...libreria]; l[mIdx].videolezioni.splice(vIdx, 1); setLibreria(l); saveModuloLib(l[mIdx]); }}>🗑</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                })
            )}
          </>
        )}

        {/* STUDENTI LISTA */}
        {section === "studenti" && view === "lista" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Studenti ({studenti.length})</h2>
              <button style={btn(C.green)} onClick={() => { setFStudent({ name: "", email: "", password: "", plan: "" }); setModalStudent(true); }}>＋ Nuovo studente</button>
            </div>
            <input style={{ width:"100%", padding:"10px 16px", borderRadius:10, border:`1px solid ${C.border}`, background:C.surface, color:C.text, fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:12 }} placeholder="🔍 Cerca per nome o email..." value={searchStudenti} onChange={e=>setSearchStudenti(e.target.value)} />
            {loadingData ? <p style={{ color: C.muted }}>Caricamento...</p> : (
              studenti.length === 0
                ? <EmptyState emoji="👤" text="Nessuno studente." sub="Aggiungi il primo studente." />
                : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {studenti.filter(s => !searchStudenti || (s.name||"").toLowerCase().includes(searchStudenti.toLowerCase()) || (s.email||"").toLowerCase().includes(searchStudenti.toLowerCase())).map(s => (
                    <div key={s.uid} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${C.green},${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>{s.avatar || "?"}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                          <div style={{ fontSize: 13, color: C.muted }}>{s.email} · {s.plan}</div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>📚 {s.moduli?.length || 0} moduli · 🎯 {s.packages?.length || 0} tipi sessione</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...btn(C.blue), padding: "8px 18px", fontSize: 13 }} onClick={() => openStudent(s)}>Gestisci →</button>
                        <button style={{ ...btn(C.red), padding: "8px 12px", fontSize: 13 }} onClick={() => deleteStudent(s.uid)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
            )}
          </>
        )}

        {/* STUDENTE DETTAGLIO */}
        {section === "studenti" && view === "dettaglio" && selected && (
          <>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "22px 28px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg,${C.green},${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#fff" }}>{selected.avatar}</div>
                <div>
                  <input style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 18, fontWeight: 700, color: C.text, width: 280, outline: "none", fontFamily: "inherit" }} value={selected.name || ""} onChange={e => upd(s => s.name = e.target.value)} title="Modifica nome" />
                  <input style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 13, color: C.muted, width: 320, outline: "none", fontFamily: "inherit", display: "block", marginTop: 4 }} placeholder="Piano / percorso" value={selected.plan || ""} onChange={e => upd(s => s.plan = e.target.value)} title="Modifica piano" />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 12px" }}>
                    <span style={{ fontSize: 12, color: C.muted }}>⚙️ Accesso Strumenti</span>
                    <div onClick={() => upd(s => s.strumenti = !s.strumenti)} style={{ width: 36, height: 20, borderRadius: 10, background: selected.strumenti ? C.green : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: selected.strumenti ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: selected.strumenti ? C.green : C.muted, fontWeight: 700 }}>{selected.strumenti ? "ON" : "OFF"}</span>
                    <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>🧠 AI Coach</span>
                    <div onClick={() => upd(s => s.aiCoach = !s.aiCoach)} style={{ width: 36, height: 20, borderRadius: 10, background: selected.aiCoach ? C.purple : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 2, left: selected.aiCoach ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: selected.aiCoach ? C.purple : C.muted, fontWeight: 700 }}>{selected.aiCoach ? "ON" : "OFF"}</span>
                  </div>
                  <input style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 12, color: C.muted, width: 280, outline: "none", fontFamily: "inherit", display: "block", marginTop: 4 }} placeholder="Email" value={selected.email || ""} onChange={e => upd(s => s.email = e.target.value)} title="Modifica email" />
                </div>
              </div>
              <button style={{ ...btn(C.green), padding: "11px 28px" }} onClick={saveStudent}>💾 Salva tutto</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
              {adminNavItems.map(n => (
                <button key={n.id} style={{ background: adminTab === n.id ? C.purpleDim : C.card, border: `1px solid ${adminTab === n.id ? C.purple + "66" : C.border}`, color: adminTab === n.id ? C.purpleGlow : C.muted, borderRadius: 10, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit" }} onClick={() => setAdminTab(n.id)}>
                  {n.label}
                </button>
              ))}
            </div>

            {/* MODULI ASSEGNATI */}
            {adminTab === "moduli" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Moduli assegnati</h3>
                    <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>Scegli dalla libreria quali moduli può vedere questo studente</p>
                  </div>
                  <button style={btn(C.green)} onClick={() => { setSelectedLibModuli([]); setModalAssegna(true); }}>＋ Assegna dalla libreria</button>
                </div>
                {(!selected.moduli || selected.moduli.length === 0)
                  ? <EmptyState emoji="📚" text="Nessun modulo assegnato." sub="Clicca '+ Assegna dalla libreria' per aggiungere moduli." />
                  : selected.moduli.map((m, mIdx) => {
                    const col = [C.green, C.blue, C.purple][mIdx % 3];
                    const tot = m.videolezioni?.length || 0;
                    const done = m.videolezioni?.filter(v => v.progress === 100).length || 0;
                    const openM = expStudMod === mIdx;
                    return (
                      <div key={mIdx} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
                        <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderLeft: `4px solid ${col}` }} onClick={() => setExpStudMod(openM ? null : mIdx)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 22 }}>{m.emoji}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{m.title}</div>
                              <div style={{ fontSize: 12, color: C.muted }}>{done}/{tot} lezioni completate</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: col, fontWeight: 600, background: col + "22", borderRadius: 20, padding: "3px 10px" }}>{tot} lezioni</span>
                            <button style={{ ...btn(C.red), padding: "5px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); upd(s => s.moduli.splice(mIdx, 1)); }}>Rimuovi</button>
                            <span style={{ fontSize: 18, color: C.muted, transform: openM ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                          </div>
                        </div>
                        {openM && m.videolezioni?.map((v, vIdx) => (
                          <div key={vIdx} style={{ background: C.surface, borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 16 }}>{v.emoji || "🎬"}</span>
                            <div style={{ flex: 1, fontSize: 14, color: C.text }}>{v.title}</div>
                            <span style={{ color: C.muted, fontSize: 12 }}>{v.duration}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: C.muted, fontSize: 12 }}>%</span>
                              <input style={{ ...inp(), width: 60, padding: "4px 8px", textAlign: "center" }} type="number" min={0} max={100} value={v.progress || 0} onChange={e => upd(s => s.moduli[mIdx].videolezioni[vIdx].progress = Number(e.target.value))} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                }
              </div>
            )}

            {/* SESSIONI */}
            {adminTab === "sessioni" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Sessioni individuali</h3>
                    <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>Roleplay, One to One, Aule — personalizzate per questo studente</p>
                  </div>
                  <button style={btn(C.green)} onClick={() => setModalSession(true)}>＋ Aggiungi tipo sessione</button>
                </div>
                {(!selected.packages || selected.packages.length === 0)
                  ? <EmptyState emoji="🎯" text="Nessuna sessione." sub="Aggiungi i pacchetti acquistati da questo studente." />
                  : selected.packages.map((p, idx) => {
                    const col = [C.green, C.blue, C.purple][idx % 3];
                    return (
                      <div key={idx} style={{ background: C.card, border: `1px solid ${col}44`, borderRadius: 14, padding: "20px 22px", marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input style={{ background: "none", border: "none", fontSize: 22, width: 34, outline: "none", fontFamily: "inherit" }} value={p.icon} onChange={e => upd(s => s.packages[idx].icon = e.target.value)} />
                            <input style={inp()} value={p.label} onChange={e => upd(s => s.packages[idx].label = e.target.value)} />
                          </div>
                          <button style={{ ...btn(C.red), padding: "7px 12px", fontSize: 13 }} onClick={() => upd(s => s.packages.splice(idx, 1))}>🗑</button>
                        </div>
                        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: C.muted, fontSize: 13 }}>Totale acquistate:</span>
                            <input style={{ ...inp(), width: 70, textAlign: "center" }} type="number" min={0} value={p.total} onChange={e => upd(s => s.packages[idx].total = Math.max(s.packages[idx].used, Number(e.target.value)))} />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: C.muted, fontSize: 13 }}>Utilizzate:</span>
                            <input style={{ ...inp(), width: 70, textAlign: "center" }} type="number" min={0} max={p.total} value={p.used} onChange={e => upd(s => s.packages[idx].used = Math.max(0, Math.min(s.packages[idx].total, Number(e.target.value))))} />
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 26, color: col }}>{p.total - p.used} <span style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>rimaste</span></div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                          {Array.from({ length: p.total }).map((_, i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 4, background: i < p.used ? C.dim : col, maxWidth: 40 }} />)}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}

            {modalAcquisto && (
          <Modal onClose={()=>setModalAcquisto(false)} title="💳 Acquista sessioni">
            <p style={{ color:C.muted, fontSize:13, marginBottom:16 }}>Scegli il tipo di sessione e procedi con il bonifico. Dopo il pagamento avvisa il coach via chat.</p>
            {[
              ...prezziSessioni,
            ].map((s,i)=>(
              <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{s.tipo}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.desc}</div>
                  </div>
                  <div style={{ fontWeight:800, fontSize:22, color:C.green }}>{s.prezzo}</div>
                </div>
              </div>
            ))}
            <div style={{ background:C.purpleDim, border:`1px solid ${C.purple}44`, borderRadius:12, padding:"16px", marginTop:8 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>🏦 Dati per il bonifico</div>
              {[
                ["Intestatario","Angelo Fiorenza"],
                ["IBAN","LT153250039188228137"],
                ["BIC","CHASDEFX"],
                ["Causale",`Sessioni ${data.name||""}`],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:12, color:C.muted }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:600, fontFamily:"monospace", color:C.text, userSelect:"all", cursor:"text" }}>{v}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize:12, color:C.muted, marginTop:10, textAlign:"center" }}>Dopo il pagamento invia la ricevuta via chat 💬</p>
          </Modal>
        )}

        {/* REGISTRAZIONI */}
            {adminTab === "registrazioni" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Registrazioni live</h3>
                  <button style={btn(C.green)} onClick={() => setModalRec(true)}>＋ Aggiungi registrazione</button>
                </div>
                {(!selected.recordings || selected.recordings.length === 0)
                  ? <EmptyState emoji="⏺" text="Nessuna registrazione." sub="Aggiungi le sessioni live registrate." />
                  : selected.recordings.map((r, idx) => (
                    <div key={idx} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <input style={{ background: "none", border: "none", color: C.text, fontWeight: 700, fontSize: 15, width: "100%", outline: "none", fontFamily: "inherit" }} value={r.title} onChange={e => upd(s => s.recordings[idx].title = e.target.value)} />
                        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                          {[["coach", "Coach"], ["date", "Data"], ["duration", "Durata"], ["url", "URL iframe Bunny"]].map(([f, ph]) => (
                            <input key={f} style={{ ...inp(), padding: "4px 8px", fontSize: 12, width: f === "url" ? 220 : 120 }} placeholder={ph} value={r[f]} onChange={e => upd(s => s.recordings[idx][f] = e.target.value)} />
                          ))}
                        </div>
                      </div>
                      <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 18 }} onClick={() => upd(s => s.recordings.splice(idx, 1))}>🗑</button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* MATERIALI */}
            {adminTab === "materiali" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Materiali condivisi</h3>
                  <button style={btn(C.green)} onClick={() => setModalContent(true)}>＋ Aggiungi materiale</button>
                </div>
                {(!selected.contents || selected.contents.length === 0)
                  ? <EmptyState emoji="📎" text="Nessun materiale." sub="Aggiungi PDF e risorse per questo studente." />
                  : selected.contents.map((c, idx) => (
                    <div key={idx} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{c.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <input style={{ background: "none", border: "none", color: C.text, fontWeight: 600, fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit" }} value={c.title} onChange={e => upd(s => s.contents[idx].title = e.target.value)} />
                        <input style={{ background: "none", border: "none", color: C.muted, fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit" }} placeholder="URL Google Drive" value={c.url} onChange={e => upd(s => s.contents[idx].url = e.target.value)} />
                      </div>
                      <button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 18 }} onClick={() => upd(s => s.contents.splice(idx, 1))}>🗑</button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* GUIDE STRUMENTI */}
            {adminTab === "guide" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>⚙️ Guide Strumenti assegnate</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Scegli quali guide strumenti può vedere questo studente</div>
                  </div>
                </div>
                {guide.length === 0 ? (
                  <div style={{ color: C.muted, fontSize: 13 }}>Nessuna guida creata. Vai su ⚙️ Guide Strumenti per crearne una.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {guide.map(g => {
                      const assegnata = (selected.guide || []).includes(g.id);
                      return (
                        <div key={g.id} onClick={() => upd(s => { const curr = s.guide || []; s.guide = curr.includes(g.id) ? curr.filter(x => x !== g.id) : [...curr, g.id]; })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: assegnata ? C.green + "11" : C.surface, border: "1px solid " + (assegnata ? C.green + "44" : C.border), borderRadius: 12, cursor: "pointer" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + (assegnata ? C.green : C.muted), background: assegnata ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {assegnata && <span style={{ color: "#000", fontSize: 12, fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 20 }}>{g.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{g.titolo}</div>
                            {g.descrizione && <div style={{ fontSize: 12, color: C.muted }}>{g.descrizione}</div>}
                            <div style={{ fontSize: 11, color: g.aiEnabled ? C.purpleGlow : C.muted, marginTop: 2 }}>{g.aiEnabled ? "🤖 AI attivo" : "🤖 AI disattivo"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* OFFERTE */}
            {adminTab === "coach_intelligence" && (
              <>
              {/* Analisi Sessioni */}
              <div style={{ background: C.card, borderRadius: 16, padding: "24px 28px", marginBottom: 24, border: `1px solid ${C.purple}44` }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 16 }}>🧠 Analisi Sessioni</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Carica appunti Gemini, trascrizioni o report NotebookLM di qualsiasi sessione</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <input
                    style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text, outline: "none", fontFamily: "inherit" }}
                    placeholder="Incolla URL Google Doc (appunti Gemini, trascrizione, NotebookLM...)..."
                    value={roleplayUrl}
                    onChange={e => { setRoleplayUrl(e.target.value); setRoleplayError(""); }}
                  />
                  <button
                    style={{ ...btn(C.purple), opacity: roleplayLoading ? 0.6 : 1, cursor: roleplayLoading ? "wait" : "pointer", whiteSpace: "nowrap" }}
                    disabled={roleplayLoading || !roleplayUrl.trim()}
                    onClick={async () => {
                      setRoleplayLoading(true);
                      setRoleplayError("");
                      try {
                        const { db } = await import("./firebase");
                        const { doc, setDoc, getDoc, serverTimestamp } = await import("firebase/firestore");
                        const roleplayRef = doc(db, "aiCoach", selected.uid, "memoria", "roleplay");
                        const existing = await getDoc(roleplayRef);
                        const analisiEsistenti = existing.exists() ? (existing.data().analisi || []) : [];
                        const moduliCompletati = (selected.moduli || []).filter(m => m.videolezioni?.length > 0 && m.videolezioni.every(v => v.progress === 100)).map(m => m.title);
                        const res = await fetch("/api/analyze-roleplay", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ docUrl: roleplayUrl, analisiPrecedenti: analisiEsistenti.slice(0, 3), moduliCompletati }),
                        });
                        const data = await res.json();
                        if (!res.ok || data.error) throw new Error(data.error || "Errore API");
                        const nuovaAnalisi = { ...data.analisi, doc_id: data.doc_id };
                        analisiEsistenti.unshift(nuovaAnalisi);
                        const progressioneAggiornata = data.progressione ? {
                          ...(existing.exists() ? (existing.data().progressione || {}) : {}),
                          score_aree: data.progressione.score_progressione,
                          errori_superati: [...(existing.exists() ? (existing.data().progressione?.errori_superati || []) : []), ...(data.progressione.errori_superati || [])].filter((v, i, a) => a.indexOf(v) === i).slice(0, 10),
                          errori_persistenti: data.progressione.errori_persistenti || [],
                          traguardi: [...(existing.exists() ? (existing.data().progressione?.traguardi || []) : []), ...(data.progressione.traguardi_raggiunti || []).map(t => ({ ...t, data: new Date().toISOString() }))].slice(0, 20),
                          focus_attuale: data.progressione.focus_prossima_sessione || "",
                          messaggio_studente: data.progressione.messaggio_studente || "",
                          gap_teoria_pratica: data.progressione.gap_teoria_pratica || [],
                          transfer_riuscito: data.progressione.transfer_riuscito || [],
                          ultima_comparativa: new Date().toISOString(),
                        } : (existing.exists() ? existing.data().progressione : null);
                        await setDoc(roleplayRef, { analisi: analisiEsistenti, progressione: progressioneAggiornata, aggiornato_il: serverTimestamp() });
                        setRoleplayUrl("");
                        alert("✅ Analisi completata!" + (data.progressione ? "\n📈 Progressione aggiornata." : ""));
                      } catch (err) {
                        setRoleplayError("Errore: " + err.message);
                      } finally {
                        setRoleplayLoading(false);
                      }
                    }}
                  >{roleplayLoading ? "⏳ Analisi..." : "🔍 Analizza e salva"}</button>
                </div>
                {roleplayError && <div style={{ fontSize: 12, color: "#ff6b6b", marginBottom: 8 }}>{roleplayError}</div>}
                <RoleplayAnalisiList uid={selected.uid} />
              </div>

              <CoachIntelligencePanel
                selected={selected}
                C={C}
              />
              </>
            )}
            {adminTab === "offerte" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Offerte promozionali</h3>
                    <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>Gestisci le offerte visibili a questo studente</p>
                  </div>
                  <button style={btn(C.green)} onClick={() => setModalPromo(true)}>＋ Aggiungi offerta</button>
                </div>
                {(!selected.promos || selected.promos.length === 0)
                  ? <EmptyState emoji="🎁" text="Nessuna offerta." sub="Aggiungi offerte personalizzate per questo studente." />
                  : selected.promos.map((o, idx) => {
                    const isScaduta = !o.evergreen && o.scadenza && new Date(o.scadenza) < new Date();
                    return (
                      <div key={idx} style={{ background: C.card, border: `1px solid ${isScaduta ? C.dim : o.color+"44"}`, borderRadius: 14, padding: "18px 22px", marginBottom: 12, opacity: isScaduta ? 0.5 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: o.color+"22", color: o.color }}>{o.badge}</span>
                              {isScaduta && <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>● SCADUTA</span>}
                              {!o.evergreen && !isScaduta && o.scadenza && <span style={{ fontSize: 11, color: C.muted }}>Scade: {new Date(o.scadenza).toLocaleDateString("it-IT")}</span>}
                              {o.evergreen && <span style={{ fontSize: 11, color: C.green }}>✓ Evergreen</span>}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>{o.title}</div>
                            <div style={{ fontSize: 13, color: C.muted }}>{o.desc}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontWeight: 800, fontSize: 20, color: o.color }}>{o.price}</span>
                            <button style={{ ...btn(C.red), padding: "6px 12px", fontSize: 13 }} onClick={() => upd(s => s.promos.splice(idx, 1))}>🗑</button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}
          </>
        )}
      </div>


      {/* MODALI ADMIN */}
      {modalStudent && (
        <Modal onClose={() => setModalStudent(false)} title="👤 Nuovo studente">
          <input style={inp()} placeholder="Nome e cognome *" type="text" autoComplete="off" value={fStudent.name} onChange={e => setFStudent({...fStudent, name: e.target.value})} />
          <input style={inp()} placeholder="Email *" type="email" autoComplete="new-password" value={fStudent.email} onChange={e => setFStudent({...fStudent, email: e.target.value})} />
          <input style={inp()} placeholder="Password temporanea *" type="password" autoComplete="new-password" value={fStudent.password} onChange={e => setFStudent({...fStudent, password: e.target.value})} />
          <input style={inp()} placeholder="Piano es. Percorso Vendita Base" type="text" autoComplete="off" value={fStudent.plan} onChange={e => setFStudent({...fStudent, plan: e.target.value})} />
          <button style={{...btn(C.green),width:"100%",marginTop:8}} onClick={addStudent}>Crea studente →</button>
        </Modal>
      )}

      {modalModuloLib && (
        <Modal onClose={() => setModalModuloLib(false)} title="📚 Nuovo modulo in libreria">
          <input style={inp()} placeholder="Emoji es. 🧠" value={fModuloLib.emoji} onChange={e => setFModuloLib({...fModuloLib,emoji:e.target.value})} />
          <input style={inp()} placeholder="Titolo modulo *" value={fModuloLib.title} onChange={e => setFModuloLib({...fModuloLib,title:e.target.value})} />
          <input style={inp()} placeholder="Descrizione breve (opzionale)" value={fModuloLib.descrizione} onChange={e => setFModuloLib({...fModuloLib,descrizione:e.target.value})} />
          <select style={{...inp(),marginTop:4}} value={fModuloLib.tipo} onChange={e => setFModuloLib({...fModuloLib,tipo:e.target.value})}>
            <option value="modulo">📚 Modulo didattico (unlock sequenziale)</option>
            <option value="webinar">🎥 Webinar / Registrazione (accesso libero)</option>
          </select>
          <button style={{...btn(C.green),width:"100%",marginTop:8}} onClick={addModuloLib}>Aggiungi alla libreria →</button>
        </Modal>
      )}

      {modalVideoLib.open && (
        <Modal onClose={() => setModalVideoLib({open:false,mIdx:null})} title="🎬 Nuova videolezione">
          <input style={inp()} placeholder="Emoji es. 🎬" value={fVideoLib.emoji} onChange={e => setFVideoLib({...fVideoLib,emoji:e.target.value})} />
          <input style={inp()} placeholder="Titolo lezione *" value={fVideoLib.title} onChange={e => setFVideoLib({...fVideoLib,title:e.target.value})} />
          <input style={inp()} placeholder="Durata es. 12:30" value={fVideoLib.duration} onChange={e => setFVideoLib({...fVideoLib,duration:e.target.value})} />
          <input style={inp()} placeholder="URL iframe Bunny es. https://iframe.mediadelivery.net/embed/471466/..." value={fVideoLib.url} onChange={e => setFVideoLib({...fVideoLib,url:e.target.value})} />
          <p style={{color:C.muted,fontSize:12,margin:0}}>💡 Su Bunny → Stream → apri il video → Embed → copia il valore src dell'iframe</p>
          <button style={{...btn(C.blue),width:"100%",marginTop:8}} onClick={addVideoLib}>Aggiungi videolezione →</button>
        </Modal>
      )}

      {modalAssegna && (
        <Modal onClose={() => setModalAssegna(false)} title="📚 Assegna moduli dalla libreria">
          <p style={{color:C.muted,fontSize:13,margin:"0 0 12px"}}>Seleziona i moduli da assegnare a {selected?.name}:</p>
          {libreria.length === 0
            ? <p style={{color:C.muted}}>Nessun modulo in libreria. Creane uno prima.</p>
            : libreria.map(m => {
              const giàAssegnato = selected?.moduli?.some(sm => sm.libId === m.id);
              const selezionato = selectedLibModuli.includes(m.id);
              return (
                <div key={m.id} style={{ background: giàAssegnato ? C.greenDim : selezionato ? C.purpleDim : C.surface, border: `1px solid ${giàAssegnato ? C.green+"44" : selezionato ? C.purple+"66" : C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: giàAssegnato ? "default" : "pointer", opacity: giàAssegnato ? 0.5 : 1 }}
                  onClick={() => !giàAssegnato && toggleLibModulo(m.id)}>
                  <span style={{fontSize:22}}>{m.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{m.title}</div>
                    <div style={{fontSize:12,color:C.muted}}>{m.videolezioni?.length||0} videolezioni {giàAssegnato?"· già assegnato":""}</div>
                  </div>
                  <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${selezionato?C.purple:C.border}`,background:selezionato?C.purple:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",flexShrink:0}}>
                    {selezionato?"✓":""}
                  </div>
                </div>
              );
            })
          }
          {selectedLibModuli.length > 0 && (
            <div style={{ marginTop: 14, background: C.surface, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Come vuoi assegnare i moduli selezionati?</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...btn(C.green), flex: 1 }} onClick={assegnaModuli}>📚 Tutto il modulo</button>
                <button style={{ ...btn(C.blue), flex: 1 }} onClick={() => { setModalAssegna(false); setModalAssegnaLezione(true); }}>🎬 Scegli singola lezione</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {modalAssegnaLezione && selectedLibModuli.length > 0 && (
        <Modal onClose={() => setModalAssegnaLezione(false)} title="🎬 Scegli singola lezione">
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>Scegli quale lezione assegnare da ogni modulo selezionato:</p>
          {libreria.filter(m => selectedLibModuli.includes(m.id)).map(m => (
            <div key={m.id} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{m.emoji}</span>{m.title}
              </div>
              {(m.videolezioni || []).map((v, vIdx) => {
                const già = selected?.moduli?.some(sm => sm.libId === m.id && sm.videolezioni?.some(sv => sv.title === v.title));
                return (
                  <div key={vIdx} style={{ background: già ? C.greenDim : C.surface, border: `1px solid ${già ? C.green + "44" : C.border}`, borderRadius: 8, padding: "9px 14px", marginBottom: 5, display: "flex", alignItems: "center", gap: 10, cursor: già ? "default" : "pointer", opacity: già ? 0.6 : 1 }}
                    onClick={() => {
                      if (già) return;
                      const s = JSON.parse(JSON.stringify(selected));
                      if (!s.moduli) s.moduli = [];
                      let mod = s.moduli.find(sm => sm.libId === m.id);
                      if (!mod) { mod = { libId: m.id, title: m.title, emoji: m.emoji, tipo: m.tipo || "modulo", videolezioni: [] }; s.moduli.push(mod); }
                      mod.videolezioni.push({ ...v, progress: 0 });
                      setSelected(s);
                      showToast(`✅ Lezione aggiunta! Ricorda di salvare.`);
                    }}>
                    <span style={{ fontSize: 15 }}>{v.emoji || "🎬"}</span>
                    <div style={{ flex: 1, fontSize: 13, color: C.text }}>{v.title}</div>
                    <span style={{ fontSize: 11, color: C.muted }}>{v.duration}</span>
                    {già ? <span style={{ fontSize: 11, color: C.green }}>✓ già assegnata</span> : <span style={{ fontSize: 11, color: C.purple }}>+ aggiungi</span>}
                  </div>
                );
              })}
            </div>
          ))}
          <button style={{ ...btn(C.green), width: "100%", marginTop: 8 }} onClick={() => { setModalAssegnaLezione(false); setSelectedLibModuli([]); showToast("✅ Lezioni assegnate! Ricorda di salvare."); }}>Fatto ✓</button>
        </Modal>
      )}

      {modalSession && (
        <Modal onClose={() => setModalSession(false)} title="🎯 Nuovo tipo sessione">
          <input style={inp()} placeholder="Emoji es. 🎭" value={fSession.icon} onChange={e => setFSession({...fSession,icon:e.target.value})} />
          <input style={inp()} placeholder="Nome es. Sessioni Roleplay" value={fSession.label} onChange={e => setFSession({...fSession,label:e.target.value})} />
          <input style={inp()} placeholder="Sessioni acquistate" type="number" min={1} value={fSession.total} onChange={e => setFSession({...fSession,total:e.target.value})} />
          <button style={{...btn(C.green),width:"100%",marginTop:8}} onClick={() => {
            upd(s => { if(!s.packages)s.packages=[]; s.packages.push({...fSession,total:Number(fSession.total),used:0}); });
            setFSession({label:"",icon:"🎯",total:1}); setModalSession(false);
          }}>Aggiungi →</button>
        </Modal>
      )}

      {modalRec && (
        <Modal onClose={() => setModalRec(false)} title="⏺ Nuova registrazione">
          {[["title","Titolo"],["coach","Coach"],["date","Data es. 14 Feb 2026"],["duration","Durata es. 1:18:40"],["url","URL iframe Bunny"]].map(([k,ph]) => (
            <input key={k} style={inp()} placeholder={ph} value={fRec[k]} onChange={e => setFRec({...fRec,[k]:e.target.value})} />
          ))}
          <select style={{...inp(), color: C.text}} value={fRec.tipo||"aula"} onChange={e => setFRec({...fRec, tipo: e.target.value})}>
            <option value="aula">📚 Aule Didattiche</option>
            <option value="roleplay">🎭 Roleplay</option>
            <option value="onetoone">🎯 One to One</option>
            <option value="onboarding">🚀 Onboarding / Storage</option>
          </select>
          <button style={{...btn(C.blue),width:"100%",marginTop:8}} onClick={() => {
            upd(s => { if(!s.recordings)s.recordings=[]; s.recordings.push({...fRec, url: extractBunnyUrl(fRec.url)}); });
            setFRec({title:"",date:"",duration:"",coach:"",url:"",tipo:"aula"}); setModalRec(false);
          }}>Aggiungi →</button>
        </Modal>
      )}

      {modalPromo && (
        <Modal onClose={() => setModalPromo(false)} title="🎁 Nuova offerta">
          <input style={inp()} placeholder="Titolo es. 3 Sessioni Roleplay Extra" value={fPromo.title} onChange={e => setFPromo({...fPromo, title: e.target.value})} />
          <input style={inp()} placeholder="Descrizione breve" value={fPromo.desc} onChange={e => setFPromo({...fPromo, desc: e.target.value})} />
          <input style={inp()} placeholder="Prezzo es. € 149" value={fPromo.price} onChange={e => setFPromo({...fPromo, price: e.target.value})} />
          <input style={inp()} placeholder="Badge es. 🔥 Più richiesto" value={fPromo.badge} onChange={e => setFPromo({...fPromo, badge: e.target.value})} />
          <div style={{ display: "flex", gap: 8 }}>
            {[C.green, C.blue, C.purple].map(col => (
              <div key={col} style={{ width: 32, height: 32, borderRadius: "50%", background: col, cursor: "pointer", border: fPromo.color === col ? "3px solid #fff" : "3px solid transparent" }} onClick={() => setFPromo({...fPromo, color: col})} />
            ))}
            <span style={{ color: C.muted, fontSize: 13, alignSelf: "center", marginLeft: 8 }}>Colore</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: C.muted, fontSize: 13 }}>Tipo:</span>
            <button style={{ ...btn(fPromo.evergreen ? C.green : C.surface), padding: "7px 16px", fontSize: 13, border: `1px solid ${C.border}` }} onClick={() => setFPromo({...fPromo, evergreen: true})}>✓ Evergreen</button>
            <button style={{ ...btn(!fPromo.evergreen ? C.purple : C.surface), padding: "7px 16px", fontSize: 13, border: `1px solid ${C.border}` }} onClick={() => setFPromo({...fPromo, evergreen: false})}>📅 Con scadenza</button>
          </div>
          {!fPromo.evergreen && (
            <input style={inp()} type="date" value={fPromo.scadenza} onChange={e => setFPromo({...fPromo, scadenza: e.target.value})} />
          )}
          <button style={{...btn(C.green), width: "100%", marginTop: 8}} onClick={() => {
            upd(s => { if(!s.promos) s.promos = []; s.promos.push({...fPromo, id: Date.now()}); });
            setFPromo({ title: "", desc: "", price: "", badge: "", color: C.green, evergreen: true, scadenza: "" });
            setModalPromo(false);
          }}>Aggiungi offerta →</button>
        </Modal>
      )}

      {modalContent && (
        <Modal onClose={() => setModalContent(false)} title="📎 Nuovo materiale">
          {[["emoji","Emoji"],["title","Titolo"],["type","Tipo es. PDF"],["size","Dimensione es. 2.4 MB"],["url","URL Google Drive"]].map(([k,ph]) => (
            <input key={k} style={inp()} placeholder={ph} value={fContent[k]} onChange={e => setFContent({...fContent,[k]:e.target.value})} />
          ))}
          <button style={{...btn(C.green),width:"100%",marginTop:8}} onClick={() => {
            upd(s => { if(!s.contents)s.contents=[]; s.contents.push({...fContent}); });
            setFContent({title:"",type:"PDF",size:"",emoji:"📄",url:""}); setModalContent(false);
            try { getDocs(collection(db, "studenti")).then(snap => { snap.forEach(d => inviaNotifica(d.id, { emoji:"📎", titolo:"Nuovo materiale disponibile!", testo:"Il coach ha caricato nuovo materiale." })); }); } catch(e) {}
          }}>Aggiungi →</button>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RICHIESTE OFFERTE COMPONENT
// ═══════════════════════════════════════════════════════════════
function RichiesteOfferte() {
  const [richieste, setRichieste] = useState([]);
  useEffect(() => {
    getDocs(collection(db, "richieste")).then(snap => {
      const r = [];
      snap.forEach(d => r.push({ id: d.id, ...d.data() }));
      r.sort((a,b) => (b.ts?.seconds||0) - (a.ts?.seconds||0));
      setRichieste(r);
    });
  }, []);
  if (richieste.length === 0) return <p style={{ color: "#6B7A8D", fontSize: 13, marginBottom: 24 }}>Nessuna richiesta ancora.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
      {richieste.map((r,i) => (
        <div key={i} style={{ background: "#121820", border: "1px solid #1C2530", borderRadius: 12, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#E8EDF5" }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "#6B7A8D" }}>{r.offertaTitle} — {r.offertaPrice}</div>
          </div>
          <div style={{ fontSize: 11, color: "#6B7A8D" }}>{r.ts?.seconds ? new Date(r.ts.seconds*1000).toLocaleDateString("it-IT") : "—"}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SESSIONI CALENDARIO COMPONENT
// ═══════════════════════════════════════════════════════════════
function ModalAcquisto({ studentName, onClose }) {
  const prezzi = { aula: 59, onetoone: 149, roleplay: 149 };
  const tipi = [
    { key:"aula", label:"📚 Aula Didattica", desc:"Sessione di formazione in gruppo" },
    { key:"onetoone", label:"🎯 One to One", desc:"Sessione individuale con il coach" },
    { key:"roleplay", label:"🎭 Roleplay", desc:"Sessione di simulazione pratica" },
  ];
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState({});
  const totale = Object.entries(sel).reduce((sum,[k,q])=>sum+(prezzi[k]||0)*q,0);
  const riepilogo = Object.entries(sel).filter(([,q])=>q>0).map(([k,q])=>`${q} ${tipi.find(t=>t.key===k)?.label||k}`).join(', ');
  const cognome = (studentName||'').split(' ').slice(-1)[0];
  const causale = `${riepilogo} - ${cognome}`;
  return (
    <Modal onClose={onClose} title="💳 Acquista sessioni">
      {step===1 && (<>
        <p style={{ color:C.muted, fontSize:13, marginBottom:16 }}>Scegli il tipo e il numero di sessioni.</p>
        {tipi.map(s=>(
          <div key={s.key} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{s.label}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{s.desc} — <strong style={{color:C.green}}>{prezzi[s.key]}€/sessione</strong></div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <button onClick={()=>setSel(p=>({...p,[s.key]:Math.max(0,(p[s.key]||0)-1)}))} style={{ background:C.surface, border:`1px solid ${C.border}`, color:C.text, borderRadius:6, width:32, height:32, cursor:"pointer", fontSize:18, fontFamily:"inherit" }}>−</button>
                <span style={{ fontWeight:800, fontSize:18, minWidth:24, textAlign:"center" }}>{sel[s.key]||0}</span>
                <button onClick={()=>setSel(p=>({...p,[s.key]:(p[s.key]||0)+1}))} style={{ background:C.green+"22", border:`1px solid ${C.green}55`, color:C.green, borderRadius:6, width:32, height:32, cursor:"pointer", fontSize:18, fontFamily:"inherit" }}>+</button>
              </div>
            </div>
          </div>
        ))}
        {totale>0 && (
          <div style={{ marginTop:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ color:C.muted, fontSize:13 }}>Totale</span>
              <span style={{ fontWeight:800, fontSize:26, color:C.green }}>{totale}€</span>
            </div>
            <button style={{ width:"100%", background:C.green, border:"none", color:"#000", borderRadius:10, padding:"13px 0", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setStep(2)}>Procedi al pagamento →</button>
          </div>
        )}
      </>)}
      {step===2 && (<>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Riepilogo ordine</div>
          <div style={{ fontWeight:700, fontSize:14 }}>{riepilogo}</div>
          <div style={{ fontWeight:800, fontSize:30, color:C.green, marginTop:4 }}>{totale}€</div>
        </div>
        <div style={{ background:C.purpleDim, border:`1px solid ${C.purple}44`, borderRadius:12, padding:"16px", marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>🏦 Dati per il bonifico</div>
          {[["Intestatario","Angelo Fiorenza"],["IBAN","LT153250039188228137"],["BIC","CHASDEFX"],["Importo",totale+"€"],["Causale",causale]].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.border}33` }}>
              <span style={{ fontSize:12, color:C.muted, flexShrink:0 }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:C.text, userSelect:"all", cursor:"text", textAlign:"right", marginLeft:12 }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize:13, color:C.muted, textAlign:"center", lineHeight:1.6, margin:"0 0 10px" }}>
          Dopo il pagamento invia la ricevuta su WhatsApp al numero<br/>
          <a href="https://wa.me/393513238711" target="_blank" rel="noreferrer" style={{ color:C.green, fontWeight:700, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6 }}><img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" style={{width:18,height:18}} alt="WhatsApp"/> 351 323 8711</a>
        </p>
        <button style={{ background:"none", border:`1px solid ${C.border}`, color:C.muted, borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }} onClick={()=>setStep(1)}>← Modifica selezione</button>
      </>)}
    </Modal>
  );
}

const TOOLS_AI_VENDITA = [
  { id: "google", emoji: "📄", name: "Google Documenti & Fogli", tag: "FACILE", tagColor: "#6DBF3E", url: "https://docs.google.com", cost: "Completamente gratuito", description: "Strumenti Google per creare documenti e fogli di calcolo. Li userai per la Libreria Prompt e la Mini-Dashboard KPI.", steps: [{ text: "Verifica di avere un account Google — se hai Gmail, sei già a posto." }, { text: "Apri docs.google.com per i documenti.", link: "https://docs.google.com" }, { text: "Crea un documento 'Libreria Prompt MindSell' con 5 sezioni: Analisi Conversazioni, Pitch, Obiezioni, Follow-up, KPI." }, { text: "Crea un foglio 'Dashboard KPI MindSell' con 7 colonne: Data, Prospect, B2B/B2C, Remoto/Presenza, Emozione, Obiezione, Esito." }] },
  { id: "chatgpt", emoji: "🤖", name: "ChatGPT", tag: "FACILE", tagColor: "#6DBF3E", url: "https://chat.openai.com", cost: "Piano gratuito disponibile", description: "Il motore AI principale del corso. Lo usi per analizzare conversazioni, costruire pitch personalizzati e fare call review.", steps: [{ text: "Vai su chat.openai.com e clicca 'Sign up'.", link: "https://chat.openai.com" }, { text: "Registrati con la tua email oppure tramite Google." }, { text: "Verifica l'email se richiesto e completa la registrazione." }, { text: "Inizia subito — nessuna installazione, funziona nel browser." }] },
  { id: "otter", emoji: "🎙️", name: "Otter.ai", tag: "MEDIO", tagColor: "#E67E22", url: "https://otter.ai", cost: "Piano gratuito: 300 min/mese", description: "Trascrive automaticamente le tue chiamate in testo. Si collega a Zoom, Google Meet e Teams.", steps: [{ text: "Vai su otter.ai e crea un account gratuito.", link: "https://otter.ai" }, { text: "Dopo il login vai su 'Apps' nel menu a sinistra." }, { text: "Cerca Zoom o Google Meet, clicca 'Connect' e autorizza l'accesso." }, { text: "Test: avvia una chiamata di prova. Otter parte automaticamente." }, { text: "Dopo la chiamata: 'My Conversations' → clicca → Ctrl+A → copia in ChatGPT." }, { text: "Per vendita in presenza: installa l'app Otter sul telefono e usa 'Import'." }] },
  { id: "hubspot", emoji: "📋", name: "HubSpot Free", tag: "MEDIO", tagColor: "#E67E22", url: "https://www.hubspot.com/it", cost: "Completamente gratuito", description: "CRM gratuito e permanente. Lo usi per conservare le note emotive sui prospect, impostare promemoria e costruire la memoria del cliente.", steps: [{ text: "Vai su hubspot.com/it e clicca 'Inizia gratis'.", link: "https://www.hubspot.com/it" }, { text: "Vai su 'Contatti' → 'Crea contatto' per il tuo primo prospect." }, { text: "Nella scheda contatto usa 'Note' per salvare: Emozione | Bias attivo | Leva." }, { text: "Per promemoria: scheda contatto → Attività → Crea attività → Promemoria." }, { text: "Scarica l'app HubSpot sul telefono per le note post-visita in presenza." }] },
  { id: "make", emoji: "⚡", name: "Make (ex Integromat)", tag: "AVANZATO", tagColor: "#B44FFF", optional: true, url: "https://www.make.com", cost: "Piano gratuito: 1.000 operazioni/mese", description: "Strumento di automazione. Salta questa sezione se sei all'inizio — è la parte opzionale del Modulo 5.", steps: [{ text: "Vai su make.com e crea un account gratuito.", link: "https://www.make.com" }, { text: "Clicca 'Create a new scenario' in alto a destra." }, { text: "Clicca '+' → cerca 'Otter.ai' → trigger 'New Conversation'." }, { text: "Aggiungi blocco Gmail → 'Send an Email'. Imposta il corpo con la trascrizione." }, { text: "Clicca 'Run once' per testare. Se funziona, attiva lo scenario." }] },
];

const DEVICES = [
  { name: "Smartphone + Otter.ai", price: "Gratis", note: "Ideale per iniziare. Posiziona il telefono sul tavolo. Registra e trascrive automaticamente." },
  { name: "Olympus WS-853", price: "€60–80", note: "Registratore compatto, ottima qualità voce, batteria lunga." },
  { name: "Sony ICD-UX570", price: "€70–90", note: "Design sottile, qualità eccellente. Importa l'audio in Otter per la trascrizione." },
  { name: "Zoom H1n", price: "€110–140", note: "Qualità professionale. Il massimo della chiarezza per le trascrizioni AI." },
];

const TOOLS_CONFIGS = {
  "ai_vendita": { label: "🤖 AI nella Vendita", tools: TOOLS_AI_VENDITA },
};

function SetupStrumenti({ studentName, guideIds }) {
  const [guideData, setGuideData] = useState([]);
  const [guidaAttiva, setGuidaAttiva] = useState(null);

  useEffect(() => {
    if (!guideIds || guideIds.length === 0) return;
    Promise.all(guideIds.map(id => getDoc(doc(db, "guide", id)))).then(docs => {
      const loaded = docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
      setGuideData(loaded);
      if (loaded.length > 0) setGuidaAttiva(loaded[0].id);
    });
  }, [guideIds]);

  if (!guideIds || guideIds.length === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚙️</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nessuna guida assegnata</div>
        <div style={{ fontSize: 13, color: C.muted }}>Il coach non ha ancora assegnato guide strumenti al tuo percorso.</div>
      </div>
    );
  }

  const guida = guideData.find(g => g.id === guidaAttiva);
  const [checked, setChecked] = useState(() => Object.fromEntries(TOOLS_AI_VENDITA.map(t => [t.id, []])));
  const [open, setOpen] = useState("google");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef(null);

  const toggle = (toolId, stepIdx) => setChecked(prev => {
    const cur = prev[toolId];
    const next = cur.includes(stepIdx) ? cur.filter(i => i !== stepIdx) : [...cur, stepIdx];
    return { ...prev, [toolId]: next };
  });

  const pct = tool => Math.round((checked[tool.id].length / tool.steps.length) * 100);
  const totalSteps = TOOLS_AI_VENDITA.reduce((a, t) => a + t.steps.length, 0);
  const totalChecked = Object.values(checked).reduce((a, v) => a + v.length, 0);
  const totalPct = Math.round((totalChecked / totalSteps) * 100);

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput.trim() };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiInput("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: (guida?.aiPrompt || "Sei l'assistente AI del corso MindSell Academy.") + " Rispondi SOLO a domande riguardanti gli strumenti e i contenuti di questa guida del corso. Se ti vengono poste domande su argomenti non correlati alla guida, rispondi gentilmente che puoi aiutare solo con gli strumenti e i contenuti del corso. Rispondi sempre in italiano, in modo conciso e pratico.",
          messages: newMessages
        })
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Mi dispiace, non ho ricevuto una risposta. Riprova.";
      setAiMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch(e) {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Errore di connessione. Riprova tra qualche secondo." }]);
    }
    setAiLoading(false);
  };

  useEffect(() => { aiBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {guideData.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {guideData.map(g => (
            <button key={g.id} onClick={() => setGuidaAttiva(g.id)}
              style={{ background: guidaAttiva === g.id ? C.purpleDim : C.card, border: "1px solid " + (guidaAttiva === g.id ? C.purple + "66" : C.border), color: guidaAttiva === g.id ? C.purpleGlow : C.muted, borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: guidaAttiva === g.id ? 700 : 400 }}>
              {g.emoji} {g.titolo}
            </button>
          ))}
        </div>
      )}
      {!guida && <div style={{ color: C.muted, fontSize: 13 }}>Caricamento...</div>}
      {guida && (
        <div>
        <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>⚙️ Setup Strumenti del Corso</div>
          <div style={{ fontSize: 13, color: C.muted }}>Configura tutti gli strumenti per iniziare il percorso</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>{totalPct}%</div>
          <div style={{ fontSize: 11, color: C.muted }}>completato</div>
        </div>
      </div>

      {(TOOLS_CONFIGS[guida?.tipo]?.tools || TOOLS_AI_VENDITA).map(tool => {
        const p = pct(tool);
        const isOpen = open === tool.id;
        return (
          <div key={tool.id} style={{ background: C.card, border: "1px solid " + (isOpen ? C.purple + "66" : C.border), borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
            <div onClick={() => setOpen(isOpen ? null : tool.id)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 24 }}>{tool.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{tool.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: tool.tagColor + "22", color: tool.tagColor }}>{tool.tag}</span>
                  {tool.optional && <span style={{ fontSize: 10, color: C.muted, padding: "2px 7px", borderRadius: 5, background: C.surface }}>OPZIONALE</span>}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{tool.cost}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: p === 100 ? C.green : C.text, minWidth: 40, textAlign: "center" }}>{p}%</div>
              <span style={{ color: C.muted, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <div style={{ borderTop: "1px solid " + C.border, padding: "16px 20px" }}>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>{tool.description}</p>
                <a href={tool.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "6px 14px", color: C.blue, textDecoration: "none", fontSize: 12, marginBottom: 16 }}>🔗 {tool.url}</a>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tool.steps.map((step, i) => (
                    <div key={i} onClick={() => toggle(tool.id, i)} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: checked[tool.id].includes(i) ? C.green + "11" : C.surface, border: "1px solid " + (checked[tool.id].includes(i) ? C.green + "44" : C.border) }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid " + (checked[tool.id].includes(i) ? C.green : C.muted), background: checked[tool.id].includes(i) ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        {checked[tool.id].includes(i) && <span style={{ color: "#000", fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 13, color: checked[tool.id].includes(i) ? C.text : C.muted, lineHeight: 1.5, textDecoration: checked[tool.id].includes(i) ? "line-through" : "none" }}>{step.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, marginTop: 8, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg,#0E9E9D18,transparent)", borderBottom: "1px solid " + C.border, padding: "16px 20px", borderLeft: "4px solid #0E9E9D", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🎙️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Dispositivi di Registrazione — Vendita in Presenza</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Per chi incontra i clienti di persona</div>
          </div>
        </div>
        <div style={{ margin: "14px 20px 4px", padding: "12px 16px", background: C.red + "0D", border: "1px solid " + C.red + "44", borderRadius: 10, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 13, color: "#E57373", lineHeight: 1.65, margin: 0 }}><strong>Obbligo GDPR:</strong> in Italia registrare una conversazione richiede il consenso esplicito. Prima di registrare: <em>"Ti dispiace se registro questa conversazione?"</em></p>
        </div>
        <div style={{ padding: "12px 20px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {DEVICES.map((d, i) => (
            <div key={i} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, marginRight: 8 }}>{d.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4A017", background: "#D4A01722", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{d.price}</span>
              </div>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, margin: 0 }}>{d.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, background: C.card, border: "1px solid " + C.purple + "44", borderRadius: 14, overflow: "hidden", display: guida?.aiEnabled ? "block" : "none" }}>
        <div onClick={() => setAiOpen(!aiOpen)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg," + C.purple + "11,transparent)" }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.purpleGlow }}>Assistente AI del Corso</div>
            <div style={{ fontSize: 12, color: C.muted }}>Hai domande sulla configurazione? Chiedi qui</div>
          </div>
          <span style={{ color: C.muted, fontSize: 12 }}>{aiOpen ? "▲" : "▼"}</span>
        </div>
        {aiOpen && (
          <div style={{ borderTop: "1px solid " + C.border }}>
            <div style={{ height: 300, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {aiMessages.length === 0 && (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 80 }}>
                  Ciao {studentName ? studentName.split(" ")[0] : ""}! 👋 Chiedi qualsiasi cosa sulla configurazione degli strumenti.
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", background: msg.role === "user" ? C.purple + "33" : C.surface, border: "1px solid " + (msg.role === "user" ? C.purple + "44" : C.border), borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.5, color: C.text }}>
                    {msg.role === "assistant" && <div style={{ fontSize: 11, color: C.purpleGlow, fontWeight: 700, marginBottom: 4 }}>🤖 Assistente</div>}
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.muted }}>⏳ Sto pensando...</div>
                </div>
              )}
              <div ref={aiBottomRef} />
            </div>
            <div style={{ borderTop: "1px solid " + C.border, padding: "12px 16px", display: "flex", gap: 8 }}>
              <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendAiMessage(); } }}
                placeholder="Es: Come collego Otter a Zoom?"
                style={{ flex: 1, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}
                style={{ background: C.purple, border: "none", color: "#fff", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: aiLoading || !aiInput.trim() ? 0.5 : 1 }}>→</button>
            </div>
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
}

function MaterialiStudente({ uid, moduli }) {
  const [materiali, setMateriali] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "materiali"), orderBy("ts", "desc")), snap => {
      const moduliIds = (moduli || []).map(m => m.libId);
      const tutti = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const visibili = tutti.filter(m => {
        if (m.tipo === "generale") return true;
        if (m.tipo === "studente" && m.studenteUid === uid) return true;
        if (m.tipo === "modulo" && moduliIds.includes(m.moduloId)) return true;
        return false;
      });
      setMateriali(visibili);
    });
    return unsub;
  }, [uid, moduli]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 20px" }}>📎 Materiali</h3>
      {materiali.length === 0 && (
        <div style={{ background: C.card, borderRadius: 12, padding: "30px", color: C.muted, fontSize: 13, textAlign: "center" }}>
          Nessun materiale disponibile al momento.
        </div>
      )}
      {materiali.map(m => (
        <a key={m.id} href={m.fileUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10, textDecoration: "none", color: C.text }}>
          <span style={{ fontSize: 28 }}>{m.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.titolo}</div>
            {m.descrizione && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{m.descrizione}</div>}
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>📎 {m.fileName}</div>
          </div>
          <div style={{ color: C.green, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{m.isLink ? "🔗 Apri" : "⬇ Scarica"}</div>
        </a>
      ))}
    </div>
  );
}

function BachecaStudente({ uid, studentName }) {
  const [annunci, setAnnunci] = useState([]);
  const [thread, setThread] = useState([]);
  const [testo, setTesto] = useState("");
  const [file, setFile] = useState(null);
  const [invio, setInvio] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "annunci"), orderBy("ts", "desc")), snap => {
      setAnnunci(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(query(collection(db, "domande"), orderBy("ts", "asc")), snap => {
      setThread(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);

  const invia = async () => {
    if (!testo.trim() && !file) return;
    setInvio(true);
    let fileUrl = null, fileName = null;
    if (file) {
      // Upload su Firebase Storage
      try {
        const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const storage = getStorage();
        const ref = storageRef(storage, `bacheca/${Date.now()}_${file.name}`);
        await uploadBytes(ref, file);
        fileUrl = await getDownloadURL(ref);
        fileName = file.name;
      } catch(e) { console.error('Upload failed:', e); }
    }
    await addDoc(collection(db, "domande"), {
      testo: testo.trim(), fileUrl, fileName,
      linkUrl: linkUrl || null,
      studentName, studentUid: uid, isCoach: false,
      replyTo: replyTo ? { id: replyTo.id, testo: replyTo.testo, autore: replyTo.isCoach ? "Coach" : replyTo.studentName } : null,
      ts: serverTimestamp()
    });
    setTesto(""); setFile(null); setReplyTo(null); setLinkUrl(""); setInvio(false);
  };

  const isCoachMsg = (msg) => msg.isCoach === true;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 140px)" }}>
      {/* ANNUNCI */}
      {annunci.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📢 Annunci</div>
          {annunci.map(a => (
            <div key={a.id} style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, borderRadius: 12, padding: "14px 18px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{a.emoji || "📣"}</span>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{a.titolo}</span>
                <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{a.ts?.toDate?.()?.toLocaleDateString("it-IT") || ""}</span>
              </div>
              <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.6 }}>{a.testo}</p>
            </div>
          ))}
        </div>
      )}

      {/* THREAD Q&A stile Discord */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>❓ Domande & Risposte</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, paddingRight: 4 }}>
        {thread.length === 0 && (
          <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 40 }}>Nessun messaggio ancora. Fai la prima domanda! 👇</div>
        )}
        {thread.map((msg, i) => {
          const coach = isCoachMsg(msg);
          const prevMsg = thread[i - 1];
          const sameAuthor = prevMsg && isCoachMsg(prevMsg) === coach;
          return (
            <div key={msg.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: sameAuthor ? "2px 10px 2px 52px" : "10px 10px 2px 10px" }}>
              {!sameAuthor && (
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: coach ? C.green + "33" : C.purple + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, color: coach ? C.green : C.purple }}>
                  {coach ? "🎓" : (msg.studentName || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                {!sameAuthor && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: coach ? C.green : C.text }}>{coach ? "Coach" : msg.studentName}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{msg.ts?.toDate?.()?.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} {msg.ts?.toDate?.()?.toLocaleDateString("it-IT")}</span>
                  </div>
                )}
                {msg.replyTo && (
                  <div style={{ borderLeft: `3px solid ${C.muted}`, paddingLeft: 8, marginBottom: 4, opacity: 0.6, fontSize: 12, color: C.muted }}>
                    ↩ <strong>{msg.replyTo.autore}</strong>: {msg.replyTo.testo?.slice(0,80)}{msg.replyTo.testo?.length>80?"...":""}
                  </div>
                )}
                {msg.testo && <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{msg.testo}</div>}
                {msg.fileUrl && (
                  <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", color: C.text, textDecoration: "none", fontSize: 13 }}>
                    📎 {msg.fileName || "Allegato"}
                  </a>
                )}
                {msg.linkUrl && (
                  <a href={msg.linkUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", color: C.blue, textDecoration: "none", fontSize: 13 }}>
                    🔗 {msg.linkUrl.length > 50 ? msg.linkUrl.slice(0,50)+"..." : msg.linkUrl}
                  </a>
                )}
                <button onClick={() => setReplyTo(msg)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginTop: 3, padding: "2px 6px", borderRadius: 4, fontFamily: "inherit", opacity: 0.7 }}>↩ Rispondi</button>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={{ marginTop: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px" }}>
        {linkUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.surface, borderRadius: 8, padding: "6px 10px", borderLeft: `3px solid ${C.blue}` }}>
            <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>🔗 {linkUrl.slice(0,60)}{linkUrl.length>60?"...":""}</span>
            <button onClick={() => setLinkUrl("")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}
        {replyTo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.surface, borderRadius: 8, padding: "6px 10px", borderLeft: `3px solid ${C.green}` }}>
            <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>↩ <strong>{replyTo.isCoach ? "Coach" : replyTo.studentName}</strong>: {replyTo.testo?.slice(0,60)}{replyTo.testo?.length>60?"...":""}</span>
            <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}
        {file && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.surface, borderRadius: 8, padding: "6px 10px" }}>
            <span style={{ fontSize: 13 }}>📎 {file.name}</span>
            <button onClick={() => setFile(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, marginLeft: "auto" }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ cursor: "pointer", color: C.muted, fontSize: 20, flexShrink: 0, paddingBottom: 2 }}>
            📎
            <input type="file" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
          </label>
          <button onClick={() => { const url = prompt("Incolla un link (YouTube, Drive, sito...):"); if(url?.trim()) setLinkUrl(url.trim()); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer", flexShrink: 0, paddingBottom: 2 }}>🔗</button>
          <textarea
            value={testo}
            onChange={e => setTesto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); invia(); } }}
            placeholder="Scrivi una domanda... (Invio per inviare)"
            rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14, fontFamily: "inherit", resize: "none", lineHeight: 1.5 }}
          />
          <button onClick={invia} disabled={invio || (!testo.trim() && !file)}
            style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: invio ? 0.5 : 1, flexShrink: 0 }}>
            {invio ? "..." : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SessioniCalendario({ email, uid, packages = [], onPackagesUpdated }) {
  const [eventi, setEventi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getType = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('roleplay')) return 'roleplay';
    if (t.includes('aula')) return 'aula';
    if (t.includes('onboarding') || t.includes('storage')) return 'onboarding';
    return 'onetoone';
  };

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    fetch('/api/calendar?email=' + encodeURIComponent(email) + '&includePast=true')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        const all = d.events || [];
        setEventi(all);
        setLoading(false);

        // Auto-incrementa "used" per le sessioni passate
        if (uid && packages.length > 0 && onPackagesUpdated) {
          const nowCheck = new Date();
          const passate = all.filter(e => {
            const dt = e.start?.dateTime || e.start?.date;
            return dt && new Date(dt) < nowCheck;
          });
          // Conta passate per tipo (basato su titolo evento Calendar)
          const conteggioPassate = { aula: 0, roleplay: 0, onetoone: 0, onboarding: 0 };
          passate.forEach(e => { conteggioPassate[getType(e.summary)]++; });

          console.log('[MindSell] Sessioni totali da Calendar:', all.length);
          console.log('[MindSell] Sessioni passate:', passate.length, conteggioPassate);
          console.log('[MindSell] Packages studente:', packages.map(p => ({ label: p.label, used: p.used, total: p.total })));

          // Aggiorna packages — match flessibile sul label
          let aggiornato = false;
          const pkgsNew = packages.map(p => {
            const label = (p.label || '').toLowerCase();
            let tipo = null;
            if (label.includes('roleplay')) tipo = 'roleplay';
            else if (label.includes('aula') || label.includes('didatt')) tipo = 'aula';
            else if (label.includes('one') || label.includes('1to1') || label.includes('1 to 1') || label.includes('individ') || label.includes('personal') || label.includes('coaching')) tipo = 'onetoone';
            console.log('[MindSell] Package "' + p.label + '" → tipo: ' + tipo);
            if (!tipo) return p;
            const nuovoUsed = Math.min(conteggioPassate[tipo], p.total || 0);
            if (nuovoUsed !== p.used) { aggiornato = true; return { ...p, used: nuovoUsed }; }
            return p;
          });
          console.log('[MindSell] Aggiornamento necessario:', aggiornato);
          if (aggiornato) onPackagesUpdated(pkgsNew);
        }
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [email]);

  const now = new Date();
  // Mostra eventi fino a mezzanotte del giorno corrente — una sessione di oggi resta visibile tutto il giorno
  const fineGiornata = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const eventiFuturi = eventi.filter(e => {
    const dt = e.start?.dateTime || e.start?.date;
    if (!dt) return false;
    const dataEvento = new Date(dt);
    // Considera "futuro" tutto ciò che inizia oggi o dopo (anche se già passato nell'orario)
    const inizioGiornoEvento = new Date(dataEvento.getFullYear(), dataEvento.getMonth(), dataEvento.getDate());
    const inizioOggi = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return inizioGiornoEvento >= inizioOggi;
  });

  const categories = [
    { key: 'aula', label: 'Aule Didattiche', emoji: '📚', color: '#B44FFF' },
    { key: 'roleplay', label: 'Roleplay', emoji: '🎭', color: '#2B6CC4' },
    { key: 'onetoone', label: 'One to One', emoji: '🎯', color: '#6DBF3E' },
    { key: 'onboarding', label: 'Onboarding / Storage', emoji: '🚀', color: '#FF9500' },
  ];

  if (loading) return <div style={{ color: '#6B7A8D', fontSize: 14, padding: 20 }}>⏳ Caricamento sessioni...</div>;
  if (error) return <div style={{ color: '#FF5555', fontSize: 13, padding: 20 }}>❌ {error}</div>;
  if (eventiFuturi.length === 0) return <EmptyState emoji="🎯" text="Nessuna sessione futura." sub="Prenota una sessione dal tuo pacchetto." />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {categories.map(cat => {
        const eventiCat = eventiFuturi.filter(e => getType(e.summary) === cat.key);
        return (
          <div key={cat.key} style={{ background: '#0E1318', border: `1px solid ${cat.color}44`, borderTop: `3px solid ${cat.color}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1C2530', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{cat.emoji}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#E8EDF5' }}>{cat.label}</div>
                <div style={{ fontSize: 12, color: cat.color }}>{eventiCat.length} sessioni in programma</div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
              {eventiCat.length === 0
                ? <div style={{ color: '#6B7A8D', fontSize: 13, padding: '8px 0' }}>Nessuna sessione programmata</div>
                : eventiCat.map((ev, i) => {
                    const s = ev.start && ev.start.dateTime ? new Date(ev.start.dateTime) : null;
                    const en = ev.end && ev.end.dateTime ? new Date(ev.end.dateTime) : null;
                    const meetUrl = ev.hangoutLink || (ev.conferenceData && ev.conferenceData.entryPoints && (ev.conferenceData.entryPoints.find(ep => ep.entryPointType === 'video') || {}).uri);
                    return (
                      <div key={i} style={{ background: '#121820', border: `1px solid ${cat.color}22`, borderRadius: 10, padding: '12px 14px' }}>
                        {s && <div style={{ fontSize: 13, fontWeight: 700, color: '#E8EDF5', marginBottom: 4 }}>📅 {s.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</div>}
                        {s && <div style={{ fontSize: 12, color: '#6B7A8D', marginBottom: meetUrl ? 8 : 0 }}>⏰ {s.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} – {en ? en.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}</div>}
                        {meetUrl && <a href={meetUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: cat.color + '22', border: '1px solid ' + cat.color + '55', color: cat.color, borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>▶ Entra</a>}
                      </div>
                    );
                  })
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICHE COMPONENT
// ═══════════════════════════════════════════════════════════════
function NotificheBell({ uid }) {
  const [notifiche, setNotifiche] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "studenti", uid, "notifiche"), orderBy("ts", "desc"));
    const unsub = onSnapshot(q, snap => {
      const n = [];
      snap.forEach(d => n.push({ id: d.id, ...d.data() }));
      setNotifiche(n);
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const nonLette = notifiche.filter(n => !n.letta).length;

  const segnaLette = async () => {
    const batch = notifiche.filter(n => !n.letta);
    for (const n of batch) {
      await setDoc(doc(db, "studenti", uid, "notifiche", n.id), { ...n, letta: true });
    }
  };

  const toggleImportante = async (n) => {
    await setDoc(doc(db, "studenti", uid, "notifiche", n.id), { ...n, importante: !n.importante });
  };

  // Auto-cancella notifiche > 7 giorni non importanti
  useEffect(() => {
    if (!notifiche.length) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    notifiche.forEach(n => {
      if (!n.importante && n.ts?.seconds && n.ts.seconds * 1000 < cutoff) {
        deleteDoc(doc(db, "studenti", uid, "notifiche", n.id));
      }
    });
  }, [notifiche, uid]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen(!open); if (!open) segnaLette(); }} style={{ background: "none", border: "1px solid #1C2530", borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontSize: 18, position: "relative", color: "#E8EDF5" }}>
        🔔
        {nonLette > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#FF4444", color: "#fff", borderRadius: "50%", fontSize: 10, fontWeight: 800, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>{nonLette}</span>}
      </button>
      {open && (
        <div style={{ position: "fixed", top: 64, right: 20, width: 400, background: "#0E1318", border: "1px solid #1C2530", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 9999, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #1C2530", fontWeight: 800, fontSize: 14, color: "#E8EDF5" }}>🔔 Notifiche</div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {notifiche.length === 0
              ? <div style={{ padding: 20, color: "#6B7A8D", fontSize: 13, textAlign: "center" }}>Nessuna notifica</div>
              : notifiche.map((n, i) => (
                <div key={i} style={{ padding: "12px 18px", borderBottom: "1px solid #1C2530", background: n.letta ? "transparent" : "#1C2530", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{n.emoji || "🔔"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#E8EDF5", marginBottom: 2 }}>{n.titolo}</div>
                    <div style={{ fontSize: 12, color: "#6B7A8D" }}>{n.testo}</div>
                    {n.ts?.seconds && <div style={{ fontSize: 11, color: "#3D4F61", marginTop: 4 }}>{new Date(n.ts.seconds * 1000).toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
                  </div>
                  <button onClick={(e)=>{ e.stopPropagation(); toggleImportante(n); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:15, padding:0, flexShrink:0, opacity: n.importante ? 1 : 0.25, color: n.importante ? "#FFD700" : "#999" }} title={n.importante ? "Rimuovi importanza" : "Segna come importante"}>⭐</button>
                  {!n.letta && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6DBF3E", flexShrink: 0, marginTop: 4 }} />}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// helper per inviare notifica a uno studente
async function inviaNotifica(uid, { emoji, titolo, testo, importante = false }) {
  await addDoc(collection(db, "studenti", uid, "notifiche"), {
    emoji, titolo, testo, letta: false, importante, ts: serverTimestamp()
  });
}

// ═══════════════════════════════════════════════════════════════
// SESSIONI CALENDARIO COMPONENT
// ═══════════════════════════════════════════════════════════════
// STUDENT PORTAL
// ═══════════════════════════════════════════════════════════════
function StudentPortal({ userData }) {
  const [tab, setTab] = useState("moduli");
  const uid = auth.currentUser?.uid;
  const [showPromo, setShowPromo] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [bookPkg, setBookPkg] = useState(null);
  const [bookConfirmed, setBookConfirmed] = useState(false);
  const [activeRec, setActiveRec] = useState(null);
  const [bookForm, setBookForm] = useState({ date: "", time: "", note: "" });
  const [expandedModulo, setExpandedModulo] = useState(null);
  const [modalAcquisto, setModalAcquisto] = useState(false);
  const [localData, setLocalData] = useState(() => userData || null);
  const [studentToast, setStudentToast] = useState("");
  const [noteModal, setNoteModal] = useState(null); // { mIdx, vIdx, v }
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState("yellow");
  const [noteStars, setNoteStars] = useState(0);
  const [localNote, setLocalNote] = useState(userData?.note || {});

  const showToast = (msg) => { setStudentToast(msg); setTimeout(() => setStudentToast(""), 3000); };

  // Sync localData when userData changes from parent
  useEffect(() => { if (userData) setLocalData(userData); }, [userData]);

  const getNota = (mIdx, vIdx) => {
    return localNote?.[mIdx + "_" + vIdx] || null;
  };

  const saveNota = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const ref = doc(db, "studenti", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const d = snap.data();
      const note = { ...(d.note || {}) };
      const key = noteModal.mIdx + "_" + noteModal.vIdx;
      if (noteText.trim()) {
        note[key] = { text: noteText, color: noteColor, stars: noteStars, title: noteModal.v.title, moduloTitle: userData?.moduli?.[noteModal.mIdx]?.title || "" };
      } else {
        delete note[key];
      }
      await setDoc(ref, { ...d, note });
      setLocalNote({...note});
      setNoteModal(null);
      showToast("✅ Nota salvata!");
    } catch(e) { showToast("❌ Errore salvataggio nota."); }
  };

  const exportPDF = () => {
    const note = localNote || {};
    const moduli = userData?.moduli || [];
    let html = `<html><head><meta charset='utf-8'><style>body{font-family:Arial,sans-serif;padding:40px;color:#222;max-width:800px;margin:0 auto}h1{color:#1a1a2e;border-bottom:3px solid #6DBF3E;padding-bottom:10px}h2{color:#2B6CC4;margin-top:30px}h3{color:#555;margin:16px 0 6px}.nota{padding:16px;border-radius:10px;margin:10px 0;border-left:4px solid #ccc}.yellow{background:#FFFDE7;border-color:#F9A825}.green{background:#E8F5E9;border-color:#43A047}.pink{background:#FCE4EC;border-color:#E91E63}.stars{color:#F9A825;font-size:18px}.empty{color:#999;font-style:italic}</style></head><body>`;
    html += `<h1>📝 Le mie Note — ${userData?.name || ""}</h1>`;
    let hasNote = false;
    moduli.forEach((m, mIdx) => {
      const noteModulo = (m.videolezioni || []).map((v, vIdx) => ({ v, vIdx, nota: note[mIdx + "_" + vIdx] })).filter(x => x.nota);
      if (noteModulo.length === 0) return;
      hasNote = true;
      html += `<h2>📚 ${m.title}</h2>`;
      noteModulo.forEach(({ v, vIdx, nota }) => {
        const stars = nota.stars > 0 ? "⭐".repeat(nota.stars) : "";
        html += `<h3>${vIdx+1}. ${(v.title||"").replace(/^lezione\s*/i,"")} ${stars}</h3>`;
        html += `<div class='nota ${nota.color}'>${nota.text.replace(/\n/g,"<br>")}</div>`;
      });
    });
    if (!hasNote) html += "<p class='empty'>Nessuna nota ancora.</p>";
    html += "</body></html>";
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const data = localData || userData || {};

  // Segna video come completato al 100% su Firestore
  const markVideoComplete = async (videoUrl) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const ref = doc(db, 'studenti', uid);
      const docSnap = await getDoc(ref);
      if (!docSnap.exists()) return;
      const studentData = docSnap.data();
      let updated = false;
      const moduli = (studentData.moduli || []).map(m => ({
        ...m,
        videolezioni: (m.videolezioni || []).map(v => {
          const vUrl = (v.url || '').split('?')[0];
          const targetUrl = (videoUrl || '').split('?')[0];
          if (vUrl === targetUrl && v.progress !== 100) {
            updated = true;
            return { ...v, progress: 100 };
          }
          return v;
        })
      }));
      if (updated) {
        // Feedback immediato UI
        setActiveVideo(prev => prev ? { ...prev, progress: 100 } : null);
        setLocalData(prev => ({ ...(prev || studentData), moduli }));
        showToast('✅ Lezione completata!');
        // Salvataggio in background
        setDoc(ref, { ...studentData, moduli }).catch(e => console.error('Errore salvataggio:', e));
        inviaNotifica(uid, { emoji:"🎉", titolo:"Lezione completata!", testo:"Ottimo lavoro! Hai completato una lezione del tuo percorso." }).catch(()=>{});
      }
    } catch(e) { console.error('Errore salvataggio progresso:', e); }
  };

  // Ascolta eventi Bunny via postMessage per completamento automatico
  useEffect(() => {
    const handleMessage = (e) => {
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg && (msg.event === 'ended' || msg.event === 'finish')) {
          if (activeVideo?.url) markVideoComplete(activeVideo.url);
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeVideo]);

  
  const initials = data.name?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase() || "MS";

  useEffect(() => {
    const t = setTimeout(() => setShowPromo(true), 3500);
    return () => clearTimeout(t);
  }, []);

  const tabs = [
    { id: "moduli", label: "I miei Corsi", emoji: "▶" },
    { id: "sessioni", label: "Le mie Sessioni", emoji: "◈" },
    { id: "bacheca", label: "Bacheca", emoji: "📋" },
    { id: "registrazioni", label: "Registrazioni", emoji: "⏺" },
    { id: "materiali", label: "Materiali", emoji: "📎" },
    ...((data?.guide?.length > 0 || data?.strumenti) ? [{ id: "strumenti", label: "Strumenti", emoji: "⚙️" }] : []),
    ...(data?.aiCoach ? [{ id: "coach", label: "AI Coach", emoji: "🧠" }] : []),
  ];

  return (
    <div className="ms-layout" style={{ display:"flex", minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',sans-serif", color:C.text, maxWidth:"100vw", overflowX:"hidden" }}>
      <GlobalStyle />
      <aside className="ms-sidebar" style={{ width:248, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"24px 0", position:"sticky", top:0, height:"100vh" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 20px 24px", borderBottom:`1px solid ${C.border}` }}>
            <img src="/logo_mindsell.png" alt="MindSell" style={{ height:70, objectFit:"contain" }} onError={e=>e.target.style.display="none"} />
            <div>
              <div style={{ fontWeight:800, fontSize:17, background:`linear-gradient(90deg,${C.green},${C.blue})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>MindSell</div>
              <div style={{ fontSize:10, color:C.muted }}>Academy</div>
            </div>
          </div>
          <div className="ms-user-info" style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:`1px solid ${C.border}`, marginBottom:12 }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:`linear-gradient(135deg,${C.green},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, color:"#fff", flexShrink:0 }}>{initials}</div>
            <div style={{ overflow:"hidden" }}>
              <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{data.name||"Studente"}</div>
              <div style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{data.plan||""}</div>
            </div>
          </div>
          <nav className="ms-nav" style={{ padding:"0 10px", display:"flex", flexDirection:"column", gap:3, overflowX:"auto" }}>
            {tabs.map(t => (
              <button key={t.id} style={{ display:"flex", alignItems:"center", gap:10, background:tab===t.id?C.purpleDim:"none", border:tab===t.id?`1px solid ${C.purple}44`:"1px solid transparent", color:tab===t.id?C.purpleGlow:C.muted, padding:"10px 14px", borderRadius:10, cursor:"pointer", fontSize:14, textAlign:"left", fontFamily:"inherit", boxShadow:tab===t.id?glow(C.purple,6):"none" }} onClick={()=>setTab(t.id)}>
                <span style={{ fontSize:13, width:16 }}>{t.emoji}</span>{t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="ms-sidebar-bottom" style={{ padding:"0 10px", display:"flex", flexDirection:"column", gap:8 }}>
          <button style={{ background:`linear-gradient(135deg,${C.green},${C.blue})`, border:"none", borderRadius:10, color:"#fff", padding:"11px 14px", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }} onClick={()=>setShowPromo(true)}>✦ Offerte per te</button>
          <a href="https://www.google.com/search?client=ms-android-samsung-ss&hs=xzxU&sca_esv=c6b7077b8ab86951&hl=it-IT&cs=0&sxsrf=ANbL-n6Ux6ZpU3R5vG0ZBmpqhRGv4HD5MA:1775120442587&q=recensioni+di+mindsell.academy&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOf6rRF0ZkcFdJQ8vNOXTuwRtcBtqPXf0PaTaxjrjdTLygfAxjlGMn_LHXzgSrHAHAWpYqEuxMrg0sJYVgOxRjYh_fhW1vANSvUwKzN_T3VLA0tKo-g%3D%3D&sa=X&ved=2ahUKEwiHraf75s6TAxXMxQIHHRUiHZkQ9qsLegQIHBAJ&biw=384&bih=699&dpr=2.81" target="_blank" rel="noreferrer" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:C.card, border:`1px solid ${C.green}44`, borderRadius:10, padding:"10px 14px", cursor:"pointer", textDecoration:"none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/><path fill="#FBBC05" d="M24 46c5.5 0 10.5-1.9 14.3-5l-6.6-5.4C29.7 37 27 38 24 38c-6.1 0-11.3-4.1-13.1-9.7l-7 5.4C7.5 41.8 15.2 46 24 46z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-1 2.8-2.8 5.1-5.2 6.6l6.6 5.4C41.4 37.3 45 31.2 45 24c0-1.3-.2-2.7-.5-4z"/></svg>
              <span style={{ fontSize:11, fontWeight:700, color:C.text }}>Lascia la tua recensione</span>
            </div>
            <div style={{ fontSize:16, letterSpacing:3, color:"#FBBC05", lineHeight:1 }}>★★★★★</div>
          </a>
          <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:C.card, border:`1px solid ${C.purple}44`, borderRadius:10, padding:"10px 14px", cursor:"pointer", color:C.text, fontSize:11, fontWeight:700 }}>
            🎬 Carica video recensione
            <input type="file" accept="video/*" style={{ display:"none" }} onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              if (file.size > 200 * 1024 * 1024) { alert("Il video non può superare i 200MB"); return; }
              const toastEl = document.createElement("div");
              toastEl.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1C2530;color:#E8EDF5;padding:10px 20px;border-radius:10px;z-index:9999;font-size:13px;";
              toastEl.textContent = "⏳ Caricamento video in corso...";
              document.body.appendChild(toastEl);
              try {
                const { ref: sRef, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
                const { storage } = await import("./firebase");
                const path = `recensioni/${uid}_${Date.now()}_${file.name}`;
                const fileRef = sRef(storage, path);
                await new Promise((res, rej) => {
                  const task = uploadBytesResumable(fileRef, file);
                  task.on("state_changed", null, rej, () => res());
                });
                const url = await getDownloadURL(fileRef);
                const { db } = await import("./firebase");
                const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
                await addDoc(collection(db, "recensioni"), {
                  uid, nome: data?.name || "", videoUrl: url, storagePath: path, ts: serverTimestamp()
                });
                toastEl.textContent = "✅ Video caricato! Grazie per la recensione.";
                setTimeout(() => document.body.removeChild(toastEl), 3000);
              } catch(err) {
                toastEl.textContent = "❌ Errore caricamento: " + err.message;
                setTimeout(() => document.body.removeChild(toastEl), 4000);
              }
              e.target.value = "";
            }} />
          </label>
          <button style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:10, color:C.muted, padding:"10px 14px", cursor:"pointer", fontSize:13, fontFamily:"inherit" }} onClick={()=>signOut(auth)}>Esci</button>
        </div>
      </aside>

      <main className="ms-main" style={{ flex:1, padding:"36px 40px", overflowY: tab==="coach" ? "hidden" : "auto", overflowX:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
          <div>
            <h2 style={{ fontSize:24, fontWeight:800, margin:0, letterSpacing:"-0.5px" }}>
              {tab==="moduli"&&"I miei Corsi 🧠"}{tab==="sessioni"&&"Le mie Sessioni 🎯"}
              {tab==="registrazioni"&&"Registrazioni Live ⏺"}{tab==="materiali"&&"Materiali Condivisi 📎"}{tab==="coach"&&"AI Coach 🧠"}
            </h2>
            <p style={{ color:C.muted, fontSize:13, margin:"4px 0 0" }}>{new Date().toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <NotificheBell uid={uid} />
            <button style={{ background:`linear-gradient(135deg,${C.purple},${C.blue})`, border:"none", borderRadius:10, color:"#fff", padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit", whiteSpace:"nowrap" }} onClick={()=>setShowPromo(true)}>✦ Scopri le offerte</button>
          </div>
        </div>

        {/* MODULI — accordion */}
        {tab==="moduli" && (
          (!data.moduli||data.moduli.length===0)
            ?<EmptyState emoji="🎓" text="Il tuo percorso verrà attivato presto." sub="Torna qui dopo l'attivazione del coach."/>
            :data.moduli.map((m,mIdx)=>{
              const col=[C.green,C.blue,C.purple][mIdx%3];
              const tot=m.videolezioni?.length||0;
              const done=m.videolezioni?.filter(v=>v.progress===100).length||0;
              const open=expandedModulo===mIdx;
              const sbloccatoMod = m.tipo === "webinar" || mIdx===0 || (data.moduli[mIdx-1]?.videolezioni||[]).every(v=>v.progress===100);
              return(
                <div key={mIdx} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, marginBottom:14, overflow:"hidden" }}>
                  <div style={{ padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:sbloccatoMod?"pointer":"not-allowed", borderLeft:`4px solid ${sbloccatoMod?col:C.muted}`, opacity:sbloccatoMod?1:0.5 }} onClick={()=>{ if(sbloccatoMod) setExpandedModulo(open?null:mIdx); }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:26 }}>{m.emoji}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:16 }}>{m.title}</div>
                        <div style={{ fontSize:13, color:C.muted }}>{done}/{tot} lezioni completate</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:70, height:4, background:C.border, borderRadius:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${tot?(done/tot)*100:0}%`, background:col }}/>
                      </div>
                      <span style={{ color:C.muted }}>{open?"▲":"▼"}</span>
                    </div>
                  </div>
                  {open&&m.videolezioni?.map((v,vIdx)=>{
                    const completata = v.progress === 100;
                    console.log('modulo:', m.title, 'tipo:', m.tipo);
const sbloccata = m.tipo === "webinar" || vIdx === 0 || m.videolezioni[vIdx-1]?.progress === 100;
                    const bgColor = completata ? `${C.green}11` : C.surface;
                    const borderColor = completata ? `${C.green}44` : C.border;
                    return (
                    <div key={vIdx} style={{ padding:"14px 20px", borderTop:`1px solid ${borderColor}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:bgColor, cursor:sbloccata?"pointer":"not-allowed", opacity:sbloccata?1:0.45 }} onClick={()=>{ if(sbloccata) setActiveVideo({...v,color:col}); else showToast("⚠️ Completa prima la lezione precedente!"); }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                        <div style={{ width:30, height:30, background:completata?`${C.green}22`:`${col}22`, border:`1px solid ${completata?C.green:col}55`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>
                          {completata ? "✓" : (v.emoji||"🎬")}
                        </div>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:14, display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:completata?C.green:col, background:completata?`${C.green}22`:`${col}22`, borderRadius:4, padding:"1px 6px", flexShrink:0 }}>{vIdx+1}</span>
                            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:completata?C.green:C.text }}>{(v.title||"").replace(/^lezione\s*/i,"")}</span>
                          </div>
                          {v.duration && isNaN(Number(String(v.duration).trim())) && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{v.duration}</div>}
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0, marginLeft:12 }}>
                        <div style={{ width:56, height:3, background:C.border, borderRadius:4, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${v.progress||0}%`, background:col }}/>
                        </div>
                        <button style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, padding:"0 4px", opacity: getNota(mIdx,vIdx) ? 1 : 0.3, filter: getNota(mIdx,vIdx) ? "none" : "grayscale(1)" }} onClick={e=>{ e.stopPropagation(); const n=getNota(mIdx,vIdx); setNoteText(n?.text||""); setNoteColor(n?.color||"yellow"); setNoteStars(n?.stars||0); setNoteModal({mIdx,vIdx,v}); }} title="Note lezione">💬</button>
                        <span style={{ color:col, fontSize:13, fontWeight:600 }}>Guarda →</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              );
            })
        )}

        {/* SESSIONI */}
        {tab==="sessioni"&&(
          <div>
            <h3 style={{ fontSize:16, fontWeight:800, margin:"0 0 16px", color:C.text }}>📅 Le tue prossime sessioni</h3>
            <SessioniCalendario email={data?.email||""} uid={uid} packages={data.packages || []} onPackagesUpdated={(pkgs) => { const ref = doc(db, "studenti", uid); setDoc(ref, { packages: pkgs }, { merge: true }); }} />
            <h3 style={{ fontSize:16, fontWeight:800, margin:"28px 0 16px", color:C.text }}>🎯 I tuoi pacchetti</h3>
          {(!data.packages||data.packages.length===0)
            ?<EmptyState emoji="🎯" text="Nessuna sessione disponibile." sub="Acquista un pacchetto per iniziare."/>
            :<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:20 }}>
              {data.packages.map((p,idx)=>{
                const col=[C.green,C.blue,C.purple][idx%3];
                const rem=p.total-p.used;
                return(
                  <div key={idx} style={{ background:C.card, border:`1px solid ${col}44`, borderRadius:16, padding:"24px 22px", boxShadow:glow(col,6) }}>
                    <div style={{ fontSize:34, marginBottom:10 }}>{p.icon||"🎯"}</div>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>{p.label}</div>
                    <div style={{ fontWeight:800, fontSize:34, color:col, lineHeight:1 }}>{rem}<span style={{ fontSize:13, color:C.muted, fontWeight:400 }}> rimaste</span></div>
                    <div style={{ display:"flex", gap:6, margin:"14px 0 8px" }}>
                      {Array.from({length:p.total}).map((_,i)=><div key={i} style={{ flex:1, height:6, borderRadius:4, background:i<p.used?C.dim:col, maxWidth:40 }}/>)}
                    </div>
                    <p style={{ fontSize:12, color:C.muted, marginBottom:14 }}>{p.used} su {p.total} utilizzate</p>
                    <button style={{ width:"100%", background:`${col}22`, border:`1px solid ${col}66`, color:col, borderRadius:10, padding:"11px 0", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }} onClick={()=>{setBookPkg({...p,color:col});setBookConfirmed(false);}}>📅 Prenota sessione →</button>
                  </div>
                );
              })}
              <div style={{ background:C.card, border:`1px solid ${C.green}44`, borderRadius:16, display:"flex", flexDirection:"column", alignItems:"flex-start", justifyContent:"space-between", minHeight:180, cursor:"pointer", padding:"24px 22px" }} onClick={()=>setModalAcquisto(true)}>
                <div style={{ fontSize:34, marginBottom:10 }}>➕</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Aggiungi sessioni</div>
                <div style={{ fontWeight:800, fontSize:22, color:C.green, lineHeight:1 }}>Acquista <span style={{ fontSize:13, color:C.muted, fontWeight:400 }}>ora</span></div>
                <div style={{ display:"flex", gap:6, margin:"14px 0 8px" }}>
                  {[1,2,3].map(i=><div key={i} style={{ flex:1, height:6, borderRadius:4, background:C.green+"44", maxWidth:40 }}/>)}
                </div>
                <p style={{ fontSize:12, color:C.muted, margin:0 }}>Aule · One to One · Roleplay</p>
              </div>
            </div>
          }
          </div>
        )}

        {modalAcquisto && <ModalAcquisto studentName={data?.name||""} onClose={()=>setModalAcquisto(false)} />}

        {tab==="bacheca" && <BachecaStudente uid={uid} studentName={data?.name||""} />}


        {/* REGISTRAZIONI */}
        {tab==="registrazioni"&&(
          (!data.recordings||data.recordings.length===0)
            ?<EmptyState emoji="⏺" text="Nessuna registrazione." sub="Le sessioni live registrate appariranno qui."/>
            :<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16 }}>
              {[
                { key:"aula", label:"Aule Didattiche", emoji:"📚", color:"#B44FFF" },
                { key:"roleplay", label:"Roleplay", emoji:"🎭", color:"#2B6CC4" },
                { key:"onetoone", label:"One to One", emoji:"🎯", color:"#6DBF3E" },
                { key:"onboarding", label:"Onboarding / Storage", emoji:"🚀", color:"#FF9500" },
              ].map(cat => {
                const recs = (data.recordings||[]).filter(r => (r.tipo||"aula") === cat.key);
                return (
                  <div key={cat.key} style={{ background:"#0E1318", border:`1px solid ${cat.color}44`, borderTop:`3px solid ${cat.color}`, borderRadius:16, overflow:"hidden" }}>
                    <div style={{ padding:"16px 20px", borderBottom:"1px solid #1C2530", display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:22 }}>{cat.emoji}</span>
                      <div>
                        <div style={{ fontWeight:800, fontSize:15, color:"#E8EDF5" }}>{cat.label}</div>
                        <div style={{ fontSize:12, color:cat.color }}>{recs.length} {recs.length===1?"registrazione":"registrazioni"}</div>
                      </div>
                    </div>
                    <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10, maxHeight:340, overflowY:"auto" }}>
                      {recs.length===0
                        ?<div style={{ color:"#6B7A8D", fontSize:13, padding:"8px 0" }}>Nessuna registrazione</div>
                        :recs.map((r,i)=>(
                          <div key={i} style={{ background:"#121820", border:`1px solid ${cat.color}22`, borderRadius:10, padding:"12px 14px" }}>
                            <div style={{ fontWeight:700, fontSize:14, color:"#E8EDF5", marginBottom:3 }}>{r.title}</div>
                            <div style={{ fontSize:12, color:"#6B7A8D", marginBottom:8 }}>{r.date} · {r.duration}</div>
                            <button style={{ background:cat.color+"22", border:"1px solid "+cat.color+"55", color:cat.color, borderRadius:8, padding:"5px 14px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setActiveRec(r)}>▶ Guarda</button>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
        )}

        {/* MATERIALI */}
        {tab==="materiali" && <MaterialiStudente uid={uid} moduli={data?.moduli||[]} />}
        {tab==="strumenti" && <SetupStrumenti studentName={data?.name||""} guideIds={data?.guide||[]} />}
        {tab==="coach" && <AICoach userData={localData} uid={uid} />}
      </main>

      {/* ── VIDEO MODAL con player Bunny integrato ── */}
      {noteModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }} onClick={()=>setNoteModal(null)}>
          <div style={{ background:"#1a2030", border:"1px solid #2a3545", borderRadius:20, width:"100%", maxWidth:520, padding:28, position:"relative" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 4px", fontSize:16, color:"#E8EDF5" }}>📝 Note — {(noteModal.v.title||"").replace(/^leziones*/i,"")}</h3>
            <p style={{ color:"#6B7A8D", fontSize:12, margin:"0 0 16px" }}>I tuoi appunti personali su questa lezione</p>
            {/* Stelle */}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
              <span style={{ fontSize:12, color:"#6B7A8D" }}>Valutazione:</span>
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ fontSize:22, cursor:"pointer", opacity: s<=noteStars?1:0.3 }} onClick={()=>setNoteStars(s===noteStars?0:s)}>⭐</span>
              ))}
            </div>
            {/* Colore evidenziatore */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <span style={{ fontSize:12, color:"#6B7A8D" }}>Colore:</span>
              {[["yellow","#FFFDE7","#F9A825"],["green","#E8F5E9","#43A047"],["pink","#FCE4EC","#E91E63"]].map(([key,bg,border]) => (
                <div key={key} onClick={()=>setNoteColor(key)} style={{ width:28, height:28, borderRadius:6, background:bg, border:`3px solid ${noteColor===key?border:"transparent"}`, cursor:"pointer" }}/>
              ))}
            </div>
            {/* Area testo */}
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Scrivi i tuoi appunti qui..." style={{ width:"100%", minHeight:140, padding:"12px 14px", borderRadius:10, border:"1px solid #2a3545", background: noteColor==="yellow"?"#FFFDE744": noteColor==="green"?"#E8F5E944":"#FCE4EC44", color:"#E8EDF5", fontSize:14, fontFamily:"inherit", resize:"vertical", outline:"none", boxSizing:"border-box" }}/>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16 }}>
              <button style={{ background:"none", border:"1px solid #2a3545", color:"#6B7A8D", borderRadius:8, padding:"8px 18px", cursor:"pointer", fontFamily:"inherit", fontSize:13 }} onClick={()=>setNoteModal(null)}>Annulla</button>
              <button style={{ background:"#6DBF3E22", border:"1px solid #6DBF3E55", color:"#6DBF3E", borderRadius:8, padding:"8px 18px", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }} onClick={saveNota}>💾 Salva nota</button>
            </div>
          </div>
        </div>
      )}
      {studentToast && (
        <div style={{ position:"fixed", bottom:30, left:"50%", transform:"translateX(-50%)", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 24px", fontSize:14, fontWeight:600, color:C.text, zIndex:999, boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}>{studentToast}</div>
      )}
      {activeVideo && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }} onClick={()=>setActiveVideo(null)}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, width:"100%", maxWidth:860, position:"relative", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
            <button style={{ position:"absolute", top:14, right:14, background:"rgba(0,0,0,0.6)", border:`1px solid ${C.border}`, color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:14, fontFamily:"inherit", zIndex:10 }} onClick={()=>setActiveVideo(null)}>✕</button>
            {/* Player Bunny iframe */}
            <div style={{ position:"relative", paddingTop:"56.25%", background:"#000" }}>
              <iframe
                src={extractBunnyUrl(activeVideo.url) + '?enablejsapi=1'}
                style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }}
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
                allowFullScreen
                title={activeVideo.title}
              />
            </div>
            {/* Info lezione */}
            <div style={{ padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:C.text }}>{activeVideo.title}</h3>
                <p style={{ color:C.muted, fontSize:13, margin:"4px 0 0" }}>Durata: {activeVideo.duration}</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:100, height:4, background:C.border, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${activeVideo.progress||0}%`, background:activeVideo.color }}/>
                </div>
                <span style={{ color:C.muted, fontSize:12 }}>{activeVideo.progress||0}%</span>
                {activeVideo.progress !== 100 && (
                  <button style={{ background:C.green+"22", border:`1px solid ${C.green}55`, color:C.green, borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }} onMouseDown={()=>markVideoComplete(activeVideo.url)}>✓ Segna completata</button>
                )}
                {activeVideo.progress === 100 && (
                  <span style={{ color:C.green, fontSize:13, fontWeight:700 }}>✓ Completata!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTRAZIONE MODAL con player Bunny ── */}
      {activeRec && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }} onClick={()=>setActiveRec(null)}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, width:"100%", maxWidth:860, position:"relative", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
            <button style={{ position:"absolute", top:14, right:14, background:"rgba(0,0,0,0.6)", border:`1px solid ${C.border}`, color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:14, fontFamily:"inherit", zIndex:10 }} onClick={()=>setActiveRec(null)}>✕</button>
            <div style={{ position:"relative", paddingTop:"56.25%", background:"#000" }}>
              <iframe
                src={extractBunnyUrl(activeRec.url)}
                style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }}
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
                allowFullScreen
                title={activeRec.title}
              />
            </div>
            <div style={{ padding:"20px 24px" }}>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:C.text }}>{activeRec.title}</h3>
              <p style={{ color:C.muted, fontSize:13, margin:"4px 0 0" }}>{activeRec.coach} · {activeRec.date} · {activeRec.duration}</p>
            </div>
          </div>
        </div>
      )}

      {/* BOOK MODAL */}
      {bookPkg&&!bookConfirmed&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }} onClick={()=>setBookPkg(null)}>
          <div style={{ background:"#0E1318", border:`1px solid ${bookPkg.color}44`, borderRadius:20, width:"100%", maxWidth:920, height:"88vh", position:"relative", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"16px 24px", borderBottom:"1px solid #1C2530", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16, color:"#E8EDF5" }}>📅 Prenota — {bookPkg.label}</div>
                <div style={{ fontSize:12, color:"#6B7A8D", marginTop:2 }}>Scegli data e orario disponibile</div>
              </div>
              <button style={{ background:"none", border:"1px solid #1C2530", color:"#E8EDF5", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontFamily:"inherit", fontSize:13 }} onClick={()=>setBookPkg(null)}>✕ Chiudi</button>
            </div>
            <iframe
              src={(bookPkg.label||"").toLowerCase().includes("roleplay")
                ? "https://cal.com/mindsell-aule-bovx1o/roleplay-settimanali"
                : "https://cal.com/mindsell-aule-bovx1o/one-to-one"}
              style={{ flex:1, border:"none", width:"100%", background:"#fff" }}
              title="Prenota sessione"
            />
          </div>
        </div>
      )}
      {bookPkg&&bookConfirmed&&(
        <Modal onClose={()=>{setBookPkg(null);setBookConfirmed(false);setBookForm({date:"",time:"",note:""});}}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
            <h3 style={mTitle}>Richiesta inviata!</h3>
            <p style={{ color:C.muted }}>Hai richiesto una sessione di <strong>{bookPkg?.label}</strong>.</p>
            <p style={{ color:C.muted, fontSize:13 }}>Riceverai una conferma via email entro 24 ore.</p>
            <button style={{...btn(C.green),width:"100%",marginTop:16}} onClick={()=>{setBookPkg(null);setBookConfirmed(false);setBookForm({date:"",time:"",note:""});}}>Chiudi</button>
          </div>
        </Modal>
      )}

      {/* CHAT WIDGET */}
      <ChatWidget studentUid={auth.currentUser?.uid} studentName={data.name||"Studente"} />

      {/* PROMO */}
      {showPromo&&(
        <Modal onClose={()=>setShowPromo(false)}>
          <div style={{ textAlign:"center", marginBottom:18 }}>
            <div style={{ color:C.purple, letterSpacing:6, fontSize:13 }}>✦ ✦ ✦</div>
            <h3 style={{ fontSize:20, fontWeight:800, margin:"8px 0 4px", background:`linear-gradient(90deg,${C.green},${C.purple})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Offerte per te, {data.name?.split(" ")[0]}</h3>
            <p style={{ color:C.muted, fontSize:13, margin:0 }}>Potenzia il tuo percorso MindSell</p>
          </div>
          {(data.promos||defaultPromos).filter(o => o.evergreen !== false || !o.scadenza || new Date(o.scadenza) >= new Date()).map(o=>(
            <div key={o.id} style={{ background:C.surface, border:`1px solid ${o.color}44`, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, background:o.color+"22", color:o.color, display:"inline-block", marginBottom:5 }}>{o.badge}</span>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:2 }}>{o.title}</div>
                  <div style={{ fontSize:13, color:C.muted }}>{o.desc}</div>
                </div>
                <div style={{ fontWeight:800, fontSize:19, color:o.color, whiteSpace:"nowrap" }}>{o.price}</div>
              </div>
              <button style={{ marginTop:10, background:`${o.color}22`, border:`1px solid ${o.color}66`, color:o.color, borderRadius:8, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"inherit" }} onClick={async()=>{
                try {
                  const uid = auth.currentUser?.uid;
                  if (!uid) return;
                  await addDoc(collection(db, "richieste"), {
                    uid, name: data.name, email: data.email,
                    offertaId: o.id, offertaTitle: o.title, offertaPrice: o.price,
                    ts: serverTimestamp()
                  });
                  showToast("✅ Richiesta inviata! Ti contatteremo presto.");
                  setShowPromo(false);
                } catch(e) { showToast("❌ Errore nell'invio."); }
              }}>Sono interessato →</button>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// CHAT — componente flottante studente
// ═══════════════════════════════════════════════════════════════
function ChatWidget({ studentUid, studentName }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const bottomRef = useState(null);

  useEffect(() => {
    if (!studentUid) return;
    const q = query(collection(db, "chat", studentUid, "messages"), orderBy("ts", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      if (!open) {
        const newUnread = msgs.filter(m => m.from === "coach" && !m.read).length;
        setUnread(newUnread);
      }
    });
    return unsub;
  }, [studentUid, open]);

  useEffect(() => {
    if (open && unread > 0) {
      // Marca come letti
      messages.filter(m => m.from === "coach" && !m.read).forEach(m => {
        setDoc(doc(db, "chat", studentUid, "messages", m.id), { ...m, read: true });
      });
      setUnread(0);
    }
  }, [open]);

  const send = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, "chat", studentUid, "messages"), {
      text: text.trim(), from: "student", ts: serverTimestamp(), read: false,
    });
    // Aggiorna lastMessage per admin
    await setDoc(doc(db, "chat", studentUid), {
      studentName, lastMessage: text.trim(), lastTs: serverTimestamp(), hasUnread: true,
    }, { merge: true });
    setText("");
  };

  return (
    <>
      {/* Icona flottante */}
      <div style={{ position:"fixed", bottom:16, right:16, zIndex:200 }}>
        {open ? (
          <div style={{ width:340, height:480, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, display:"flex", flexDirection:"column", boxShadow:`0 20px 60px rgba(0,0,0,0.8),${glow(C.purple,16)}` }}>
            {/* Header chat */}
            <div style={{ padding:"14px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:C.surface, borderRadius:"20px 20px 0 0" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${C.green},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff" }}>👩‍💼</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:C.text }}>Coach Emanuela</div>
                  <div style={{ fontSize:11, color:C.green }}>● Online</div>
                </div>
              </div>
              <button style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }} onClick={()=>setOpen(false)}>✕</button>
            </div>
            {/* Messaggi */}
            <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign:"center", color:C.muted, fontSize:13, marginTop:40 }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
                  Scrivi un messaggio al tuo coach!
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} style={{ display:"flex", justifyContent: m.from === "student" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth:"80%", background: m.from === "student" ? C.purple : C.surface, border:`1px solid ${m.from === "student" ? C.purple+"66" : C.border}`, borderRadius: m.from === "student" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding:"10px 14px", fontSize:13, color:C.text, lineHeight:1.4 }}>
                    {m.text}
                    {m.ts && <div style={{ fontSize:10, color: m.from === "student" ? "rgba(255,255,255,0.5)" : C.muted, marginTop:4, textAlign: m.from === "student" ? "right" : "left" }}>{new Date(m.ts.seconds ? m.ts.seconds*1000 : m.ts).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>}
                  </div>
                </div>
              ))}
              <div ref={r => { if(r) r.scrollIntoView({behavior:"smooth"}); }} />
            </div>
            {/* Input */}
            <div style={{ padding:"12px 14px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <input style={{ ...inp(), flex:1, padding:"10px 14px", fontSize:13 }} placeholder="Scrivi un messaggio..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} />
              <button style={{ ...btn(C.purple), padding:"10px 16px", fontSize:16 }} onClick={send}>↑</button>
            </div>
          </div>
        ) : (
          <button style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},${C.blue})`, border:"none", cursor:"pointer", fontSize:24, boxShadow:glow(C.purple,16), position:"relative" }} onClick={()=>setOpen(true)}>
            💬
            {unread > 0 && (
              <div style={{ position:"absolute", top:-4, right:-4, width:20, height:20, borderRadius:"50%", background:C.red, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff" }}>{unread}</div>
            )}
          </button>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHAT ADMIN — pannello messaggi
// ═══════════════════════════════════════════════════════════════
function AdminGuide({ guide, studenti, onRefresh }) {
  const [form, setForm] = useState({ titolo: "", descrizione: "", emoji: "⚙️", tipo: "ai_vendita", aiEnabled: false, aiPrompt: "" });
  const [editId, setEditId] = useState(null);
  const [assegnaGuida, setAssegnaGuida] = useState(null);
  const [loading, setLoading] = useState(false);

  const salva = async () => {
    if (!form.titolo.trim()) { alert("Inserisci un titolo"); return; }
    setLoading(true);
    if (editId) {
      await setDoc(doc(db, "guide", editId), { ...form, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, "guide"), { ...form, createdAt: serverTimestamp() });
    }
    setForm({ titolo: "", descrizione: "", emoji: "⚙️", aiEnabled: false, aiPrompt: "" });
    setEditId(null);
    setLoading(false);
    onRefresh();
  };

  const elimina = async (id) => {
    if (!window.confirm("Eliminare questa guida?")) return;
    await deleteDoc(doc(db, "guide", id));
    onRefresh();
  };

  const toggleAssegna = async (studenteUid, guidaId) => {
    const studente = studenti.find(s => s.uid === studenteUid);
    if (!studente) return;
    const guideAttuali = studente.guide || [];
    const nuove = guideAttuali.includes(guidaId)
      ? guideAttuali.filter(g => g !== guidaId)
      : [...guideAttuali, guidaId];
    await setDoc(doc(db, "studenti", studenteUid), { ...studente, guide: nuove });
    onRefresh();
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 800 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>⚙️ Guide Strumenti</h2>

      {/* Form nuova guida */}
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: "20px 24px", marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{editId ? "✏️ Modifica guida" : "➕ Nuova guida"}</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
            style={{ width: 50, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "8px", color: C.text, fontSize: 18, textAlign: "center", fontFamily: "inherit" }} />
          <input value={form.titolo} onChange={e => setForm(p => ({ ...p, titolo: e.target.value }))}
            placeholder="Titolo della guida (es. AI Sales Tools - Corso Base)"
            style={{ flex: 1, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 14, fontFamily: "inherit" }} />
        </div>
        <select value={form.tipo||"ai_vendita"} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
            style={{ width: "100%", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", marginBottom: 8 }}>
            {Object.entries(TOOLS_CONFIGS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <textarea value={form.descrizione} onChange={e => setForm(p => ({ ...p, descrizione: e.target.value }))}
          placeholder="Descrizione della guida..."
          rows={2}
          style={{ width: "100%", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 10 }} />

        {/* Toggle AI */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: form.aiEnabled ? 10 : 0 }}>
          <span style={{ fontSize: 13, color: C.muted }}>🤖 Assistente AI</span>
          <div onClick={() => setForm(p => ({ ...p, aiEnabled: !p.aiEnabled }))} style={{ width: 36, height: 20, borderRadius: 10, background: form.aiEnabled ? C.purple : C.border, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: form.aiEnabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 11, color: form.aiEnabled ? C.purpleGlow : C.muted, fontWeight: 700 }}>{form.aiEnabled ? "ON" : "OFF"}</span>
        </div>
        {form.aiEnabled && (
          <textarea value={form.aiPrompt} onChange={e => setForm(p => ({ ...p, aiPrompt: e.target.value }))}
            placeholder="Prompt di sistema per l'assistente AI (es. Sei l'assistente del corso MindSell Base. Aiuta lo studente con...)"
            rows={3}
            style={{ width: "100%", background: C.surface, border: "1px solid " + C.purple + "44", borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginTop: 10 }} />
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={salva} disabled={loading}
            style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {loading ? "Salvando..." : editId ? "Aggiorna" : "Crea guida"}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ titolo: "", descrizione: "", emoji: "⚙️", aiEnabled: false, aiPrompt: "" }); }}
              style={{ background: "none", border: "1px solid " + C.border, color: C.muted, borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Annulla
            </button>
          )}
        </div>
      </div>

      {/* Lista guide */}
      {guide.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Nessuna guida creata ancora.</div>}
      {guide.map(g => (
        <div key={g.id} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 24 }}>{g.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{g.titolo}</div>
              {g.descrizione && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{g.descrizione}</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                {g.aiEnabled ? <span style={{ color: C.purpleGlow }}>🤖 AI attivo</span> : <span>🤖 AI disattivo</span>}
                {" · "}
                {studenti.filter(s => (s.guide || []).includes(g.id)).length} studenti assegnati
              </div>
            </div>
            <button onClick={() => { setEditId(g.id); setForm({ titolo: g.titolo, descrizione: g.descrizione || "", emoji: g.emoji, aiEnabled: g.aiEnabled || false, aiPrompt: g.aiPrompt || "" }); }}
              style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✏️</button>
            <button onClick={() => setAssegnaGuida(assegnaGuida === g.id ? null : g.id)}
              style={{ background: C.purple + "22", border: "1px solid " + C.purple + "44", color: C.purpleGlow, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              👥 Assegna
            </button>
            <button onClick={() => elimina(g.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>🗑</button>
          </div>
          {assegnaGuida === g.id && (
            <div style={{ borderTop: "1px solid " + C.border, padding: "14px 20px" }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Clicca uno studente per assegnare/rimuovere la guida:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {studenti.map(s => {
                  const assegnato = (s.guide || []).includes(g.id);
                  return (
                    <button key={s.uid} onClick={() => toggleAssegna(s.uid, g.id)}
                      style={{ background: assegnato ? C.green + "22" : C.surface, border: "1px solid " + (assegnato ? C.green + "66" : C.border), color: assegnato ? C.green : C.muted, borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: assegnato ? 700 : 400 }}>
                      {assegnato ? "✓ " : ""}{s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminMateriali() {
  const [materiali, setMateriali] = useState([]);
  const [studenti, setStudenti] = useState([]);
  const [libreria, setLibreria] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState({ titolo: "", descrizione: "", tipo: "generale", studenteUid: "", moduloId: "", emoji: "📄" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "materiali"), orderBy("ts", "desc")), snap => {
      setMateriali(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    getDocs(collection(db, "studenti")).then(snap => setStudenti(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
    getDocs(collection(db, "libreria")).then(snap => setLibreria(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return u1;
  }, []);

  const uploadFile = async (file) => {
    if (!file || !form.titolo.trim()) { alert("Inserisci un titolo prima di caricare il file"); return; }
    setUploading(true); setProgress(0);
    const ref = storageRef(storage, `materiali/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(ref, file);
    task.on("state_changed",
      snap => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      err => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, "materiali"), {
          titolo: form.titolo.trim(),
          descrizione: form.descrizione.trim(),
          emoji: form.emoji,
          tipo: form.tipo,
          studenteUid: form.tipo === "studente" ? form.studenteUid : null,
          moduloId: form.tipo === "modulo" ? form.moduloId : null,
          fileName: file.name,
          fileUrl: url,
          storagePath: `materiali/${Date.now()}_${file.name}`,
          ts: serverTimestamp()
        });
        setForm({ titolo: "", descrizione: "", tipo: "generale", studenteUid: "", moduloId: "", emoji: "📄" });
        setUploading(false); setProgress(0);
      }
    );
  };

  const apriModifica = (m) => {
    setEditId(m.id);
    setEditForm({
      titolo: m.titolo || "",
      descrizione: m.descrizione || "",
      emoji: m.emoji || "📄",
      tipo: m.tipo || "generale",
      studentiUids: m.studentiUids?.length ? m.studentiUids : (m.studenteUid ? [m.studenteUid] : []),
      moduloId: m.moduloId || ""
    });
  };

  const salvaModifica = async () => {
    if (!editId || !editForm) return;
    await updateDoc(doc(db, "materiali", editId), {
      titolo: editForm.titolo.trim(),
      descrizione: editForm.descrizione.trim(),
      emoji: editForm.emoji,
      tipo: editForm.tipo,
      studenteUid: editForm.tipo === "studente" && editForm.studentiUids.length > 0 ? editForm.studentiUids[0] : null,
      studentiUids: editForm.tipo === "studente" ? editForm.studentiUids : [],
      moduloId: editForm.tipo === "modulo" ? editForm.moduloId : null,
    });
    setEditId(null); setEditForm(null);
  };

  const toggleStudente = (uid) => {
    setEditForm(prev => ({
      ...prev,
      studentiUids: prev.studentiUids.includes(uid)
        ? prev.studentiUids.filter(u => u !== uid)
        : [...prev.studentiUids, uid]
    }));
  };

  const elimina = async (m) => {
    if (!window.confirm("Eliminare questo materiale?")) return;
    try { await deleteObject(storageRef(storage, m.storagePath)); } catch(e) {}
    await deleteDoc(doc(db, "materiali", m.id));
  };

  const tipoLabel = (m) => {
    if (m.tipo === "studente") {
      const uids = m.studentiUids?.length ? m.studentiUids : (m.studenteUid ? [m.studenteUid] : []);
      if (uids.length === 0) return "👤 Nessuno";
      if (uids.length === 1) { const s = studenti.find(s => s.uid === uids[0]); return `👤 ${s?.name || uids[0]}`; }
      return `👥 ${uids.length} studenti`;
    }
    if (m.tipo === "modulo") { const mod = libreria.find(l => l.id === m.moduloId); return `📚 ${mod?.title || m.moduloId}`; }
    return "🌐 Tutti";
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 800 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>📎 Materiali</h2>

      {/* Form upload */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 32 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>⬆️ Carica nuovo materiale</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
            style={{ width: 50, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px", color: C.text, fontSize: 18, textAlign: "center", fontFamily: "inherit" }} />
          <input value={form.titolo} onChange={e => setForm(p => ({ ...p, titolo: e.target.value }))}
            placeholder="Titolo del materiale"
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 14, fontFamily: "inherit" }} />
        </div>
        <input value={form.descrizione} onChange={e => setForm(p => ({ ...p, descrizione: e.target.value }))}
          placeholder="Descrizione (opzionale)"
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value, studenteUid: "", moduloId: "" }))}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", flex: 1 }}>
            <option value="generale">🌐 Tutti gli studenti</option>
            <option value="studente">👤 Studente specifico</option>
            <option value="modulo">📚 Modulo specifico</option>
          </select>
          {form.tipo === "studente" && (
            <select value={form.studenteUid} onChange={e => setForm(p => ({ ...p, studenteUid: e.target.value }))}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", flex: 1 }}>
              <option value="">Scegli studente...</option>
              {studenti.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
            </select>
          )}
          {form.tipo === "modulo" && (
            <select value={form.moduloId} onChange={e => setForm(p => ({ ...p, moduloId: e.target.value }))}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", flex: 1 }}>
              <option value="">Scegli modulo...</option>
              {libreria.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.title}</option>)}
            </select>
          )}
        </div>
        <input value={form.url || ""} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
          placeholder="Oppure incolla un link (YouTube, Drive, sito...)"
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />
        {uploading ? (
          <div style={{ background: C.surface, borderRadius: 8, padding: "12px", marginTop: 4 }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Caricamento in corso... {progress}%</div>
            <div style={{ background: C.border, borderRadius: 4, height: 6 }}>
              <div style={{ background: C.green, height: 6, borderRadius: 4, width: `${progress}%`, transition: "width 0.3s" }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📎 Scegli file e carica
              <input type="file" style={{ display: "none" }} onChange={e => uploadFile(e.target.files[0])} />
            </label>
            {form.url?.trim() && (
              <button onClick={async () => {
                if (!form.titolo.trim()) { alert("Inserisci un titolo"); return; }
                await addDoc(collection(db, "materiali"), {
                  titolo: form.titolo.trim(), descrizione: form.descrizione.trim(), emoji: form.emoji,
                  tipo: form.tipo, studenteUid: form.tipo === "studente" ? form.studenteUid : null,
                  moduloId: form.tipo === "modulo" ? form.moduloId : null,
                  fileUrl: form.url.trim(), fileName: null, storagePath: null, isLink: true,
                  ts: serverTimestamp()
                });
                setForm({ titolo: "", descrizione: "", tipo: "generale", studenteUid: "", moduloId: "", emoji: "🔗", url: "" });
              }} style={{ background: C.blue, border: "none", color: "#fff", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🔗 Salva link</button>
            )}
          </div>
        )}
      </div>

      {/* Lista materiali */}
      {materiali.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Nessun materiale caricato ancora.</div>}
      {materiali.map(m => (
        <div key={m.id}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: editId === m.id ? 0 : 8, display: "flex", alignItems: "center", gap: 14, borderBottomLeftRadius: editId === m.id ? 0 : 12, borderBottomRightRadius: editId === m.id ? 0 : 12 }}>
            <span style={{ fontSize: 24 }}>{m.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.titolo}</div>
              {m.descrizione && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{m.descrizione}</div>}
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{tipoLabel(m)} · {m.fileName}</div>
            </div>
            <a href={m.fileUrl} target="_blank" rel="noreferrer" style={{ color: C.green, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>{m.isLink ? "🔗 Apri" : "⬇ Scarica"}</a>
            <button onClick={() => apriModifica(m)} style={{ background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 18 }} title="Modifica">✏️</button>
            <button onClick={() => elimina(m)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>🗑</button>
          </div>
          {editId === m.id && editForm && (
          <div style={{ marginTop: 10, padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: C.text }}>✏️ Modifica materiale</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={editForm.emoji} onChange={e => setEditForm(p => ({ ...p, emoji: e.target.value }))}
                style={{ width: 44, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px", color: C.text, fontSize: 18, textAlign: "center", fontFamily: "inherit" }} />
              <input value={editForm.titolo} onChange={e => setEditForm(p => ({ ...p, titolo: e.target.value }))}
                placeholder="Titolo"
                style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 13, fontFamily: "inherit" }} />
            </div>
            <input value={editForm.descrizione} onChange={e => setEditForm(p => ({ ...p, descrizione: e.target.value }))}
              placeholder="Descrizione (opzionale)"
              style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 12, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }} />
            <select value={editForm.tipo} onChange={e => setEditForm(p => ({ ...p, tipo: e.target.value, studentiUids: [], moduloId: "" }))}
              style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 13, fontFamily: "inherit", marginBottom: 8 }}>
              <option value="generale">🌐 Tutti gli studenti</option>
              <option value="studente">👤 Studenti specifici</option>
              <option value="modulo">📚 Modulo specifico</option>
            </select>
            {editForm.tipo === "studente" && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Seleziona uno o più studenti:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {studenti.map(s => (
                    <label key={s.uid} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.text }}>
                      <input type="checkbox" checked={editForm.studentiUids.includes(s.uid)} onChange={() => toggleStudente(s.uid)} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {editForm.tipo === "modulo" && (
              <select value={editForm.moduloId} onChange={e => setEditForm(p => ({ ...p, moduloId: e.target.value }))}
                style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: C.text, fontSize: 13, fontFamily: "inherit", marginBottom: 8 }}>
                <option value="">Scegli modulo...</option>
                {libreria.map(l => <option key={l.id} value={l.id}>{l.emoji} {l.title}</option>)}
              </select>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={salvaModifica} style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✅ Salva</button>
              <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Annulla</button>
            </div>
          </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminBacheca() {
  const [annunci, setAnnunci] = useState([]);
  const [domande, setDomande] = useState([]);
  const [form, setForm] = useState({ emoji: "📣", titolo: "", testo: "" });
  const [risposte, setRisposte] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "annunci"), orderBy("ts", "desc")), snap => {
      setAnnunci(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(query(collection(db, "domande"), orderBy("ts", "desc")), snap => {
      setDomande(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, []);

  const pubblicaAnnuncio = async () => {
    if (!form.titolo.trim() || !form.testo.trim()) return;
    setLoading(true);
    await addDoc(collection(db, "annunci"), { ...form, ts: serverTimestamp() });
    setForm({ emoji: "📣", titolo: "", testo: "" });
    setLoading(false);
  };

  const eliminaAnnuncio = async (id) => {
    if (!window.confirm("Eliminare questo annuncio?")) return;
    await deleteDoc(doc(db, "annunci", id));
  };

  const rispondi = async (d) => {
    const r = risposte[d.id]?.trim();
    if (!r) return;
    await setDoc(doc(db, "domande", d.id), { ...d, risposta: r, rispostaLink: risposte[d.id+"_link"]||null, rispostaTs: serverTimestamp() });
    setRisposte(p => ({ ...p, [d.id]: "" }));
  };

  const eliminaDomanda = async (id) => {
    if (!window.confirm("Eliminare questa domanda?")) return;
    await deleteDoc(doc(db, "domande", id));
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 800 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 24px" }}>📋 Bacheca</h2>

      {/* Form nuovo annuncio */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 32 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📣 Nuovo annuncio</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
            style={{ width: 50, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px", color: C.text, fontSize: 18, textAlign: "center", fontFamily: "inherit" }} />
          <input value={form.titolo} onChange={e => setForm(p => ({ ...p, titolo: e.target.value }))}
            placeholder="Titolo annuncio"
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 14, fontFamily: "inherit" }} />
        </div>
        <textarea value={form.testo} onChange={e => setForm(p => ({ ...p, testo: e.target.value }))}
          placeholder="Testo dell'annuncio..."
          rows={3}
          style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 10 }} />
        <button onClick={pubblicaAnnuncio} disabled={loading}
          style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          {loading ? "Pubblicando..." : "Pubblica annuncio"}
        </button>
      </div>

      {/* Lista annunci */}
      {annunci.length > 0 && (<>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: C.muted }}>Annunci pubblicati</div>
        {annunci.map(a => (
          <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{a.emoji} {a.titolo}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{a.testo}</div>
            </div>
            <button onClick={() => eliminaAnnuncio(a.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>🗑</button>
          </div>
        ))}
      </>)}

      {/* Domande */}
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "32px 0 16px" }}>❓ Domande degli studenti</h3>
      {domande.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Nessuna domanda ancora.</div>}
      {domande.map(d => (
        <div key={d.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{d.studentName} · {d.ts?.toDate?.()?.toLocaleDateString("it-IT") || ""}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{d.testo}</div>
            </div>
            <button onClick={() => eliminaDomanda(d.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>🗑</button>
          </div>
          {d.risposta ? (
            <div style={{ background: C.green + "11", border: `1px solid ${C.green}33`, borderRadius: 10, padding: "10px 14px", marginTop: 12 }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>✅ Risposta inviata</div>
              <div style={{ fontSize: 13 }}>{d.risposta}</div>
              {d.rispostaLink && <a href={d.rispostaLink} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:6, color:C.blue, fontSize:13 }}>🔗 {d.rispostaLink.slice(0,50)}{d.rispostaLink.length>50?"...":""}</a>}
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input value={risposte[d.id] || ""} onChange={e => setRisposte(p => ({ ...p, [d.id]: e.target.value }))}
                placeholder="Scrivi la risposta..."
                style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={() => { const url = prompt("Aggiungi un link (opzionale):"); if(url) setRisposte(p=>({...p,[d.id+"_link"]:url})); }} style={{ background: C.blue, border: "none", color: "#fff", borderRadius: 8, padding: "8px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>🔗</button>
              <button onClick={() => rispondi(d)} style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Rispondi</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminChat({ selected }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [notifEmoji, setNotifEmoji] = useState("📣");
  const [notifTitolo, setNotifTitolo] = useState("");
  const [notifTesto, setNotifTesto] = useState("");
  const [notifImportante, setNotifImportante] = useState(false);
  const [notifSending, setNotifSending] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "chat"), snap => {
      setConversations(snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a,b) => (b.lastTs?.seconds||0) - (a.lastTs?.seconds||0)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    const q = query(collection(db, "chat", activeConv.uid, "messages"), orderBy("ts", "asc"));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      // Marca come letti
      msgs.filter(m => m.from === "student" && !m.read).forEach(m => {
        setDoc(doc(db, "chat", activeConv.uid, "messages", m.id), { ...m, read: true });
      });
      setDoc(doc(db, "chat", activeConv.uid), { hasUnread: false }, { merge: true });
    });
    return unsub;
  }, [activeConv]);

  const send = async () => {
    if (!text.trim() || !activeConv) return;
    await addDoc(collection(db, "chat", activeConv.uid, "messages"), {
      text: text.trim(), from: "coach", ts: serverTimestamp(), read: false,
    });
    await setDoc(doc(db, "chat", activeConv.uid), { lastMessage: text.trim(), lastTs: serverTimestamp() }, { merge: true });
    setText("");
  };

  const sendNotifica = async () => {
    if (!notifTitolo.trim() || !activeConv) return;
    setNotifSending(true);
    await inviaNotifica(activeConv.uid, {
      emoji: notifEmoji || "📣",
      titolo: notifTitolo.trim(),
      testo: notifTesto.trim(),
      importante: notifImportante,
    });
    setNotifTitolo(""); setNotifTesto(""); setNotifEmoji("📣"); setNotifImportante(false);
    setShowNotifForm(false); setNotifSending(false);
  };

  return (
    <div style={{ display:"flex", height:"calc(100vh - 58px)", background:C.bg }}>
      {/* Lista conversazioni */}
      <div style={{ width:280, borderRight:`1px solid ${C.border}`, overflowY:"auto" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}` }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>💬 Messaggi</h3>
        </div>
        {conversations.length === 0 && <p style={{ color:C.muted, fontSize:13, padding:20 }}>Nessun messaggio ancora.</p>}
        {conversations.map(c => (
          <div key={c.uid} style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, cursor:"pointer", background: activeConv?.uid === c.uid ? C.purpleDim : "none", borderLeft: c.hasUnread ? `3px solid ${C.purple}` : "3px solid transparent" }} onClick={()=>setActiveConv(c)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{c.studentName}</div>
              {c.hasUnread && <div style={{ width:8, height:8, borderRadius:"50%", background:C.purple }} />}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.lastMessage}</div>
          </div>
        ))}
      </div>
      {/* Area messaggi */}
      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        {!activeConv ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, flexDirection:"column", gap:12 }}>
            <div style={{ fontSize:40 }}>💬</div>
            <p>Seleziona una conversazione</p>
          </div>
        ) : (
          <>
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, background:C.surface, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{activeConv.studentName}</div>
              <button style={{ ...btn(showNotifForm ? C.purple : C.surface), border:`1px solid ${C.purple}66`, padding:"6px 14px", fontSize:12 }} onClick={()=>setShowNotifForm(!showNotifForm)}>🔔 Notifica</button>
            </div>
            {showNotifForm && (
              <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, background:C.purpleDim, display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <input style={{ ...inp(), width:60, padding:"8px 10px", fontSize:13, textAlign:"center" }} placeholder="😊" value={notifEmoji} onChange={e=>setNotifEmoji(e.target.value)} maxLength={2} />
                  <input style={{ ...inp(), flex:1, padding:"8px 12px", fontSize:13 }} placeholder="Titolo notifica..." value={notifTitolo} onChange={e=>setNotifTitolo(e.target.value)} />
                </div>
                <input style={{ ...inp(), padding:"8px 12px", fontSize:13 }} placeholder="Testo (opzionale)..." value={notifTesto} onChange={e=>setNotifTesto(e.target.value)} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.text, cursor:"pointer" }}>
                    <input type="checkbox" checked={notifImportante} onChange={e=>setNotifImportante(e.target.checked)} style={{ accentColor:C.purple }} />
                    ⭐ Segna come importante
                  </label>
                  <button style={{ ...btn(C.purple), padding:"8px 16px", fontSize:13, opacity: notifSending ? 0.6 : 1 }} onClick={sendNotifica} disabled={notifSending}>{notifSending ? "Invio..." : "Invia 🔔"}</button>
                </div>
              </div>
            )}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:8 }}>
              {messages.map(m => (
                <div key={m.id} style={{ display:"flex", justifyContent: m.from === "coach" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth:"75%", background: m.from === "coach" ? C.blue : C.surface, border:`1px solid ${m.from === "coach" ? C.blue+"66" : C.border}`, borderRadius: m.from === "coach" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding:"10px 14px", fontSize:13, color:C.text, lineHeight:1.4 }}>
                    {m.text}
                    {m.ts && <div style={{ fontSize:10, color: m.from === "coach" ? "rgba(255,255,255,0.5)" : C.muted, marginTop:4, textAlign: m.from === "coach" ? "right" : "left" }}>{new Date(m.ts.seconds ? m.ts.seconds*1000 : m.ts).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>}
                  </div>
                </div>
              ))}
              <div ref={r => { if(r) r.scrollIntoView({behavior:"smooth"}); }} />
            </div>
            <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <input style={{ ...inp(), flex:1, padding:"10px 14px", fontSize:13 }} placeholder={`Rispondi a ${activeConv.studentName}...`} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} />
              <button style={{ ...btn(C.blue), padding:"10px 16px", fontSize:16 }} onClick={send}>↑</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════════════════════════

// Mobile responsive styles injected globally
function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; max-width: 100%; }
      body { overflow-x: hidden; margin: 0; width: 100%; }
      html { overflow-x: hidden; }
      @media (max-width: 768px) {
        .ms-layout { flex-direction: column !important; }
        .ms-sidebar { 
          width: 100% !important; 
          height: auto !important;
          position: relative !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          padding: 0 !important;
        }
        .ms-sidebar-top {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 10px 16px !important;
          width: 100% !important;
          border-bottom: 1px solid #1C2530 !important;
        }
        .ms-nav {
          display: flex !important;
          flex-direction: row !important;
          overflow-x: auto !important;
          width: 100% !important;
          padding: 4px 8px !important;
          gap: 2px !important;
        }
        .ms-nav button {
          flex-shrink: 0 !important;
          padding: 8px 12px !important;
          font-size: 12px !important;
          border-radius: 8px !important;
        }
        .ms-sidebar-bottom { display: none !important; }
        .ms-main { padding: 16px 12px !important; overflow-x: hidden !important; }
        .ms-user-info { display: none !important; }
        .ms-header-btn { display: flex !important; }
      }
      @media (min-width: 769px) {
        .ms-layout { flex-direction: row !important; }
        .ms-sidebar { 
          width: 248px !important; 
          height: 100vh !important;
          position: sticky !important;
          top: 0 !important;
          flex-direction: column !important;
        }
        .ms-sidebar-top { display: none !important; }
        .ms-nav { flex-direction: column !important; padding: 0 10px !important; }
        .ms-sidebar-bottom { display: flex !important; }
        .ms-main { padding: 36px 40px !important; }
        .ms-header-btn { display: none !important; }
      }
    `}</style>
  );
}

function Splash() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:44, marginBottom:14 }}>🧠</div>
        <div style={{ color:C.muted, fontSize:14 }}>Caricamento...</div>
      </div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }} onMouseDown={(e) => { if(e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:32, width:"100%", maxWidth:500, position:"relative", maxHeight:"90vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:10 }} onClick={e=>e.stopPropagation()}>
        <button style={{ position:"absolute", top:14, right:14, background:C.surface, border:`1px solid ${C.border}`, color:C.muted, width:28, height:28, borderRadius:"50%", cursor:"pointer", fontSize:12, fontFamily:"inherit" }} onClick={onClose}>✕</button>
        {title&&<h3 style={{...mTitle,marginBottom:4}}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

function EmptyState({ emoji, text, sub }) {
  return (
    <div style={{ textAlign:"center", padding:"60px 20px", color:C.muted }}>
      <div style={{ fontSize:42, marginBottom:12 }}>{emoji}</div>
      <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:6 }}>{text}</div>
      <div style={{ fontSize:14 }}>{sub}</div>
    </div>
  );
}

const inp = (err) => ({
  width:"100%", background:C.surface, border:`1px solid ${err?C.red:C.border}`,
  color:C.text, borderRadius:10, padding:"11px 14px", fontSize:14,
  outline:"none", boxSizing:"border-box", fontFamily:"'Segoe UI',sans-serif",
});

const btn = (color) => ({
  background:color, color:"#fff", border:"none", borderRadius:10,
  padding:"11px 20px", fontWeight:700, fontSize:14, cursor:"pointer",
  fontFamily:"'Segoe UI',sans-serif", boxShadow:glow(color,8),
});

const mTitle = { fontSize:19, fontWeight:800, margin:"0 0 4px", color:C.text, letterSpacing:"-0.3px" };

