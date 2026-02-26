import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, getDocs, deleteDoc,
  addDoc, query, orderBy, onSnapshot, serverTimestamp
} from "firebase/firestore";

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

const defaultPromos = [
  { id: 1, title: "3 Sessioni Roleplay Extra", desc: "Intensifica la pratica con roleplay guidati.", price: "€ 149", badge: "🔥 Più richiesto", color: C.green },
  { id: 2, title: "Modulo Avanzato – Leadership", desc: "Sblocca il percorso su leadership e team.", price: "€ 299", badge: "✨ Nuovo", color: C.purple },
  { id: 3, title: "One to One Premium – 4 sessioni", desc: "Lavora direttamente col tuo coach.", price: "€ 399", badge: "⭐ Consigliato", color: C.blue },
];

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
          <img src="/logo_MindSell_definitivo_senza_sfondo.png" alt="MindSell" style={{ height: 68, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
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
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
function AdminPanel({ adminUser }) {
  const [section, setSection] = useState("studenti");
  const [view, setView] = useState("lista");
  const [studenti, setStudenti] = useState([]);
  const [libreria, setLibreria] = useState([]);
  const [offerteGlobali, setOfferteGlobali] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [adminTab, setAdminTab] = useState("moduli");
  const [toast, setToast] = useState("");

  const [modalStudent, setModalStudent] = useState(false);
  const [modalModuloLib, setModalModuloLib] = useState(false);
  const [modalVideoLib, setModalVideoLib] = useState({ open: false, mIdx: null });
  const [modalAssegna, setModalAssegna] = useState(false);
  const [modalSession, setModalSession] = useState(false);
  const [modalRec, setModalRec] = useState(false);
  const [modalContent, setModalContent] = useState(false);
  const [modalPromo, setModalPromo] = useState(false);
  const [fPromo, setFPromo] = useState({ title: "", desc: "", price: "", badge: "", color: C.green, evergreen: true, scadenza: "" });

  const [fStudent, setFStudent] = useState({ name: "", email: "", password: "", plan: "" });
  const [fModuloLib, setFModuloLib] = useState({ title: "", emoji: "📚", descrizione: "" });
  const [fVideoLib, setFVideoLib] = useState({ title: "", duration: "", url: "", emoji: "🎬" });
  const [fSession, setFSession] = useState({ label: "", icon: "🎯", total: 1 });
  const [fRec, setFRec] = useState({ title: "", date: "", duration: "", coach: "", url: "" });
  const [fContent, setFContent] = useState({ title: "", type: "PDF", size: "", emoji: "📄", url: "" });
  const [searchStudenti, setSearchStudenti] = useState("");
  const [selectedLibModuli, setSelectedLibModuli] = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoadingData(true);
    try {
      const [snapS, snapL] = await Promise.all([
        getDocs(collection(db, "studenti")),
        getDocs(collection(db, "libreria")),
      ]);
      setStudenti(snapS.docs.map(d => ({ uid: d.id, ...d.data() })));
      setLibreria(snapL.docs.map(d => ({ id: d.id, ...d.data() })));
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
      const cred = await createUserWithEmailAndPassword(auth, fStudent.email, fStudent.password);
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
      setFModuloLib({ title: "", emoji: "📚", descrizione: "" });
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
    nuovi.forEach(m => s.moduli.push({ libId: m.id, title: m.title, emoji: m.emoji, videolezioni: (m.videolezioni || []).map(v => ({ ...v, progress: 0 })) }));
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
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',sans-serif", color: C.text }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/logo_MindSell_definitivo_senza_sfondo.png" alt="" style={{ height: 30, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
          <span style={{ fontWeight: 800, fontSize: 18, background: `linear-gradient(90deg,${C.green},${C.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MindSell Admin</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 8, overflowX: "auto", maxWidth: "60vw" }}>
            {[["dashboard", "📊 Dashboard"], ["studenti", "👥 Studenti"], ["libreria", "📚 Libreria Moduli"], ["offerte", "🎁 Offerte"], ["chat", "💬 Messaggi"]].map(([id, label]) => (
              <button key={id} style={{ background: section === id ? C.purpleDim : "none", border: `1px solid ${section === id ? C.purple + "66" : "transparent"}`, color: section === id ? C.purpleGlow : C.muted, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}
                onClick={() => { setSection(id); setView("lista"); }}>{label}</button>
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
        {section === "chat" && <AdminChat />}


        {/* OFFERTE GLOBALI */}
        {section === "offerte" && (
          <>
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
                : libreria.map((m, mIdx) => (
                  <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
                        <input style={{ background: "none", border: "none", fontSize: 26, width: 38, outline: "none", fontFamily: "inherit", color: C.text, flexShrink: 0 }} value={m.emoji} onChange={e => { const l = [...libreria]; l[mIdx].emoji = e.target.value; setLibreria(l); }} />
                        <div style={{ flex: 1 }}>
                          <input style={{ background: "none", border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: 15, borderRadius: 8, padding: "7px 14px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }} value={m.title} onChange={e => { const l = [...libreria]; l[mIdx].title = e.target.value; setLibreria(l); }} />
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{m.videolezioni?.length || 0} videolezioni</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ ...btn(C.green), padding: "7px 14px", fontSize: 13 }} onClick={() => saveModuloLib(m)}>💾 Salva</button>
                        <button style={{ ...btn(C.blue), padding: "7px 14px", fontSize: 13 }} onClick={() => setModalVideoLib({ open: true, mIdx })}>＋ Videolezione</button>
                        <button style={{ ...btn(C.red), padding: "7px 12px", fontSize: 13 }} onClick={() => deleteModuloLib(m.id)}>🗑</button>
                      </div>
                    </div>
                    {m.videolezioni?.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>Nessuna videolezione. Aggiungine una.</p>}
                    {m.videolezioni?.map((v, vIdx) => (
                      <div key={vIdx} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, background: C.border, borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{vIdx+1}</span>
                        <input style={{ background: "none", border: `1px solid ${C.border}44`, color: C.text, fontSize: 14, fontWeight: 600, width: 160, outline: "none", fontFamily: "inherit", borderRadius: 6, padding: "3px 8px" }} value={v.emoji} onChange={e => { const l = [...libreria]; l[mIdx].videolezioni[vIdx].emoji = e.target.value; setLibreria(l); }} />
                        <div style={{ flex: 1 }}>
                          <input style={{ background: "none", border: `1px solid ${C.border}44`, color: C.text, fontSize: 14, fontWeight: 600, width: "100%", outline: "none", fontFamily: "inherit", borderRadius: 6, padding: "3px 8px", marginBottom: 3 }} value={v.title} onChange={e => { const l = [...libreria]; l[mIdx].videolezioni[vIdx].title = e.target.value; setLibreria(l); }} />
                          <input style={{ background: "none", border: `1px solid ${C.border}44`, color: C.muted, fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", borderRadius: 6, padding: "3px 8px" }} placeholder="URL iframe Bunny es. https://iframe.mediadelivery.net/embed/..." value={extractBunnyUrl(v.url)} onChange={e => { const l = [...libreria]; l[mIdx].videolezioni[vIdx].url = e.target.value; setLibreria(l); }} />
                        </div>
                        <span style={{ color: C.muted, fontSize: 12 }}>{v.duration}</span>
                        <button style={{ background: "none", border: `1px solid ${C.green}55`, color: C.green, cursor: "pointer", fontSize: 11, borderRadius: 6, padding: "3px 7px", marginRight: 4, fontFamily: "inherit" }} onClick={() => saveModuloLib(libreria[mIdx])}>💾</button><button style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }} onClick={() => { const l = [...libreria]; l[mIdx].videolezioni.splice(vIdx, 1); setLibreria(l); saveModuloLib(l[mIdx]); }}>🗑</button>
                      </div>
                    ))}
                  </div>
                ))
            )}
          </>
        )}

        {/* STUDENTI LISTA */}
        {section === "studenti" && view === "lista" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Studenti ({studenti.length})</h2>
              <button style={btn(C.green)} onClick={() => setModalStudent(true)}>＋ Nuovo studente</button>
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
                  <input style={{ background: "none", border: "none", fontSize: 18, fontWeight: 700, color: C.text, width: 280, outline: "none", fontFamily: "inherit" }} value={selected.name || ""} onChange={e => upd(s => s.name = e.target.value)} />
                  <input style={{ background: "none", border: "none", fontSize: 13, color: C.muted, width: 320, outline: "none", fontFamily: "inherit", display: "block", marginTop: 2 }} placeholder="Piano / percorso" value={selected.plan || ""} onChange={e => upd(s => s.plan = e.target.value)} />
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
                    return (
                      <div key={mIdx} style={{ background: C.card, border: `1px solid ${col}33`, borderRadius: 14, padding: "18px 22px", marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 22 }}>{m.emoji}</span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{m.title}</div>
                              <div style={{ fontSize: 12, color: C.muted }}>{m.videolezioni?.length || 0} videolezioni</div>
                            </div>
                          </div>
                          <button style={{ ...btn(C.red), padding: "6px 12px", fontSize: 13 }} onClick={() => upd(s => s.moduli.splice(mIdx, 1))}>Rimuovi</button>
                        </div>
                        {m.videolezioni?.map((v, vIdx) => (
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

            {/* OFFERTE */}
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
          {[["name","Nome e cognome *","text"],["email","Email *","email"],["password","Password temporanea *","password"],["plan","Piano es. Percorso Vendita Base","text"]].map(([k,ph,t]) => (
            <input key={k} style={inp()} placeholder={ph} type={t} value={fStudent[k]} onChange={e => setFStudent({...fStudent,[k]:e.target.value})} />
          ))}
          <button style={{...btn(C.green),width:"100%",marginTop:8}} onClick={addStudent}>Crea studente →</button>
        </Modal>
      )}

      {modalModuloLib && (
        <Modal onClose={() => setModalModuloLib(false)} title="📚 Nuovo modulo in libreria">
          <input style={inp()} placeholder="Emoji es. 🧠" value={fModuloLib.emoji} onChange={e => setFModuloLib({...fModuloLib,emoji:e.target.value})} />
          <input style={inp()} placeholder="Titolo modulo *" value={fModuloLib.title} onChange={e => setFModuloLib({...fModuloLib,title:e.target.value})} />
          <input style={inp()} placeholder="Descrizione breve (opzionale)" value={fModuloLib.descrizione} onChange={e => setFModuloLib({...fModuloLib,descrizione:e.target.value})} />
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
            <button style={{...btn(C.green),width:"100%",marginTop:12}} onClick={assegnaModuli}>Assegna {selectedLibModuli.length} modulo/i →</button>
          )}
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
          <button style={{...btn(C.blue),width:"100%",marginTop:8}} onClick={() => {
            upd(s => { if(!s.recordings)s.recordings=[]; s.recordings.push({...fRec, url: extractBunnyUrl(fRec.url)}); });
            setFRec({title:"",date:"",duration:"",coach:"",url:""}); setModalRec(false);
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
function SessioniCalendario({ email }) {
  const [eventi, setEventi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!email) return;
    setLoading(true);
    fetch('/api/calendar?email=' + encodeURIComponent(email))
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setEventi(d.events || []);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [email]);

  const getType = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('roleplay')) return 'roleplay';
    if (t.includes('aula')) return 'aula';
    return 'onetoone';
  };

  const categories = [
    { key: 'aula', label: 'Aule Didattiche', emoji: '📚', color: '#B44FFF' },
    { key: 'roleplay', label: 'Roleplay', emoji: '🎭', color: '#2B6CC4' },
    { key: 'onetoone', label: 'One to One', emoji: '🎯', color: '#6DBF3E' },
  ];

  if (loading) return <div style={{ color: '#6B7A8D', fontSize: 14, padding: 20 }}>⏳ Caricamento sessioni...</div>;
  if (error) return <div style={{ color: '#FF5555', fontSize: 13, padding: 20 }}>❌ {error}</div>;
  if (eventi.length === 0) return <EmptyState emoji="🎯" text="Nessuna sessione futura." sub="Prenota una sessione dal tuo pacchetto." />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {categories.map(cat => {
        const eventiCat = eventi.filter(e => getType(e.summary) === cat.key);
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
  const ref = React.useRef(null);

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
async function inviaNotifica(uid, { emoji, titolo, testo }) {
  await addDoc(collection(db, "studenti", uid, "notifiche"), {
    emoji, titolo, testo, letta: false, ts: serverTimestamp()
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
  const [studentToast, setStudentToast] = useState("");
  const [noteModal, setNoteModal] = useState(null); // { mIdx, vIdx, v }
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState("yellow");
  const [noteStars, setNoteStars] = useState(0);
  const [localNote, setLocalNote] = useState(userData?.note || {});

  const showToast = (msg) => { setStudentToast(msg); setTimeout(() => setStudentToast(""), 3000); };

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

  const data = userData || {};

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
        await setDoc(ref, { ...studentData, moduli });
        await inviaNotifica(uid, { emoji:"🎉", titolo:"Lezione completata!", testo:"Ottimo lavoro! Hai completato una lezione del tuo percorso." });
        setActiveVideo(prev => prev ? { ...prev, progress: 100 } : null);
        showToast('✅ Lezione completata!');
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
    { id: "registrazioni", label: "Registrazioni", emoji: "⏺" },
    { id: "materiali", label: "Materiali", emoji: "📎" },
  ];

  return (
    <div className="ms-layout" style={{ display:"flex", minHeight:"100vh", background:C.bg, fontFamily:"'Segoe UI',sans-serif", color:C.text, maxWidth:"100vw", overflowX:"hidden" }}>
      <GlobalStyle />
      <aside className="ms-sidebar" style={{ width:248, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"24px 0", position:"sticky", top:0, height:"100vh" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 20px 24px", borderBottom:`1px solid ${C.border}` }}>
            <img src="/logo_MindSell_definitivo_senza_sfondo.png" alt="" style={{ height:36, objectFit:"contain" }} onError={e=>e.target.style.display="none"} />
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
          <button style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:10, color:C.muted, padding:"10px 14px", cursor:"pointer", fontSize:13, fontFamily:"inherit" }} onClick={()=>signOut(auth)}>Esci</button>
        </div>
      </aside>

      <main className="ms-main" style={{ flex:1, padding:"36px 40px", overflowY:"auto", overflowX:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32 }}>
          <div>
            <h2 style={{ fontSize:24, fontWeight:800, margin:0, letterSpacing:"-0.5px" }}>
              {tab==="moduli"&&"I miei Corsi 🧠"}{tab==="sessioni"&&"Le mie Sessioni 🎯"}
              {tab==="registrazioni"&&"Registrazioni Live ⏺"}{tab==="materiali"&&"Materiali Condivisi 📎"}
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
              return(
                <div key={mIdx} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, marginBottom:14, overflow:"hidden" }}>
                  <div style={{ padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", borderLeft:`4px solid ${col}` }} onClick={()=>setExpandedModulo(open?null:mIdx)}>
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
                    const sbloccata = vIdx === 0 || m.videolezioni[vIdx-1]?.progress === 100;
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
            <SessioniCalendario email={data.email} />
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
              <div style={{ background:C.card, border:`2px dashed ${C.border}`, borderRadius:16, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:180, cursor:"pointer" }} onClick={()=>setShowPromo(true)}>
                <span style={{ fontSize:30, color:C.muted }}>＋</span>
                <p style={{ color:C.muted, fontSize:13, margin:8 }}>Aggiungi sessioni</p>
              </div>
            </div>
          }
          </div>
        )}

        {/* REGISTRAZIONI */}
        {tab==="registrazioni"&&(
          (!data.recordings||data.recordings.length===0)
            ?<EmptyState emoji="⏺" text="Nessuna registrazione." sub="Le sessioni live registrate appariranno qui."/>
            :<div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {data.recordings.map((r,i)=>(
                <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }} onClick={()=>setActiveRec(r)}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:44, height:44, background:C.blueDim, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>⏺</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{r.title}</div>
                      <div style={{ fontSize:13, color:C.muted }}>{r.coach} · {r.date}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    <span style={{ color:C.muted, fontSize:13 }}>{r.duration}</span>
                    <span style={{ color:C.blueLight, fontSize:13, fontWeight:600 }}>Guarda →</span>
                  </div>
                </div>
              ))}
            </div>
        )}

        {/* MATERIALI */}
        {tab==="materiali"&&(
          (!data.contents||data.contents.length===0)
            ?<EmptyState emoji="📎" text="Nessun materiale." sub="I PDF e le risorse appariranno qui."/>
            :<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:16 }}>
              {data.contents.map((c,i)=>(
                <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", gap:8 }}>
                  <div style={{ fontSize:34 }}>{c.emoji||"📄"}</div>
                  <div style={{ fontWeight:700, fontSize:14, lineHeight:1.3 }}>{c.title}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{c.type} · {c.size}</div>
                  <a href={c.url||"#"} target="_blank" rel="noreferrer" style={{ marginTop:6, background:C.greenDim, border:`1px solid ${C.green}44`, color:C.green, borderRadius:8, padding:"8px 18px", fontSize:13, fontWeight:600, textDecoration:"none" }}>↓ Scarica</a>
                </div>
              ))}
            </div>
        )}
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
                  <button style={{ background:C.green+"22", border:`1px solid ${C.green}55`, color:C.green, borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>markVideoComplete(activeVideo.url)}>✓ Segna completata</button>
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
function AdminChat({ selected }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

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
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{activeConv.studentName}</div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:8 }}>
              {messages.map(m => (
                <div key={m.id} style={{ display:"flex", justifyContent: m.from === "coach" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth:"75%", background: m.from === "coach" ? C.blue : C.surface, border:`1px solid ${m.from === "coach" ? C.blue+"66" : C.border}`, borderRadius: m.from === "coach" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding:"10px 14px", fontSize:13, color:C.text, lineHeight:1.4 }}>
                    {m.text}
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }} onClick={onClose}>
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

