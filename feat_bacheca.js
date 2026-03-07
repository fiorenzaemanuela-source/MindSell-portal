const fs = require('fs');
const path = 'C:\\Users\\fiore\\mindsell-portal\\src\\App.js';
let c = fs.readFileSync(path, 'utf8');
let changes = 0;

// ── 1. Aggiungi tab Bacheca nel sidebar studente ─────────────────
const OLD1 = `    { id: "moduli", label: "I miei Corsi", emoji: "▶" },\r\n    { id: "sessioni", label: "Le mie Sessioni", emoji: "◈" },\r\n    { id: "registrazioni", label: "Registrazioni", emoji: "⏺" },\r\n    { id: "materiali", label: "Materiali", emoji: "📎" },\r\n  ];`;
const NEW1 = `    { id: "moduli", label: "I miei Corsi", emoji: "▶" },\r\n    { id: "sessioni", label: "Le mie Sessioni", emoji: "◈" },\r\n    { id: "bacheca", label: "Bacheca", emoji: "📋" },\r\n    { id: "registrazioni", label: "Registrazioni", emoji: "⏺" },\r\n    { id: "materiali", label: "Materiali", emoji: "📎" },\r\n  ];`;
if (c.includes(OLD1)) { c = c.replace(OLD1, NEW1); changes++; console.log('✅ 1. Tab Bacheca aggiunto'); }
else console.log('❌ 1. tabs not found');

// ── 2. Aggiungi sezione Bacheca nel nav admin ────────────────────
const OLD2 = `["dashboard", "📊 Dashboard"], ["studenti", "👥 Studenti"], ["libreria", "📚 Libreria Moduli"], ["offerte", "🎁 Offerte"], ["chat", "💬 Messaggi"]]`;
const NEW2 = `["dashboard", "📊 Dashboard"], ["studenti", "👥 Studenti"], ["libreria", "📚 Libreria Moduli"], ["offerte", "🎁 Offerte"], ["bacheca", "📋 Bacheca"], ["chat", "💬 Messaggi"]]`;
if (c.includes(OLD2)) { c = c.replace(OLD2, NEW2); changes++; console.log('✅ 2. Bacheca nel nav admin aggiunta'); }
else console.log('❌ 2. admin nav not found');

// ── 3. Aggiungi componente BachecaStudente prima di SessioniCalendario ──
const COMP_STUDENTE = `function BachecaStudente({ uid, studentName }) {
  const [annunci, setAnnunci] = useState([]);
  const [domande, setDomande] = useState([]);
  const [nuovaDomanda, setNuovaDomanda] = useState("");
  const [invio, setInvio] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "annunci"), orderBy("ts", "desc")), snap => {
      setAnnunci(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(query(collection(db, "domande"), orderBy("ts", "desc")), snap => {
      setDomande(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, []);

  const inviaDomanda = async () => {
    if (!nuovaDomanda.trim()) return;
    setInvio(true);
    await addDoc(collection(db, "domande"), {
      testo: nuovaDomanda.trim(),
      studentName, studentUid: uid,
      ts: serverTimestamp(), risposta: null
    });
    setNuovaDomanda("");
    setInvio(false);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 4px" }}>
      {/* ANNUNCI */}
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px", color: C.text }}>📢 Annunci</h3>
      {annunci.length === 0 && <div style={{ background: C.card, borderRadius: 12, padding: "20px", color: C.muted, fontSize: 13, marginBottom: 28 }}>Nessun annuncio al momento.</div>}
      {annunci.map(a => (
        <div key={a.id} style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>{a.emoji || "📣"}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{a.titolo}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{a.ts?.toDate?.()?.toLocaleDateString("it-IT") || ""}</div>
            </div>
          </div>
          <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.6 }}>{a.testo}</p>
        </div>
      ))}

      {/* Q&A */}
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "28px 0 16px", color: C.text }}>❓ Domande & Risposte</h3>
      <div style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 14, padding: "16px", marginBottom: 20 }}>
        <textarea
          value={nuovaDomanda}
          onChange={e => setNuovaDomanda(e.target.value)}
          placeholder="Fai una domanda al coach... (visibile a tutti gli studenti)"
          rows={3}
          style={{ width: "100%", background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
        />
        <button
          onClick={inviaDomanda}
          disabled={invio || !nuovaDomanda.trim()}
          style={{ marginTop: 10, background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: invio || !nuovaDomanda.trim() ? 0.5 : 1 }}
        >
          {invio ? "Invio..." : "Invia domanda →"}
        </button>
      </div>
      {domande.length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>Nessuna domanda ancora.</div>}
      {domande.map(d => (
        <div key={d.id} style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 14, padding: "16px 20px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: d.risposta ? 12 : 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.purple + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
              {(d.studentName || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{d.studentName} · {d.ts?.toDate?.()?.toLocaleDateString("it-IT") || ""}</div>
              <div style={{ fontSize: 14, color: C.text }}>{d.testo}</div>
            </div>
          </div>
          {d.risposta && (
            <div style={{ background: C.green + "11", border: \`1px solid \${C.green}33\`, borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 6 }}>💬 Risposta del Coach</div>
              <div style={{ fontSize: 13, color: C.text }}>{d.risposta}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

`;

const ANCHOR_COMP = `function SessioniCalendario(`;
if (c.includes(ANCHOR_COMP)) { c = c.replace(ANCHOR_COMP, COMP_STUDENTE + ANCHOR_COMP); changes++; console.log('✅ 3. BachecaStudente component added'); }
else console.log('❌ 3. SessioniCalendario anchor not found');

// ── 4. Aggiungi componente AdminBacheca prima di AdminChat ────────
const COMP_ADMIN = `function AdminBacheca() {
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
    await setDoc(doc(db, "domande", d.id), { ...d, risposta: r, rispostaTs: serverTimestamp() });
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
      <div style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 16, padding: "20px 24px", marginBottom: 32 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📣 Nuovo annuncio</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
            style={{ width: 50, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "8px", color: C.text, fontSize: 18, textAlign: "center", fontFamily: "inherit" }} />
          <input value={form.titolo} onChange={e => setForm(p => ({ ...p, titolo: e.target.value }))}
            placeholder="Titolo annuncio"
            style={{ flex: 1, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 14, fontFamily: "inherit" }} />
        </div>
        <textarea value={form.testo} onChange={e => setForm(p => ({ ...p, testo: e.target.value }))}
          placeholder="Testo dell'annuncio..."
          rows={3}
          style={{ width: "100%", background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: 10 }} />
        <button onClick={pubblicaAnnuncio} disabled={loading}
          style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          {loading ? "Pubblicando..." : "Pubblica annuncio"}
        </button>
      </div>

      {/* Lista annunci */}
      {annunci.length > 0 && (<>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: C.muted }}>Annunci pubblicati</div>
        {annunci.map(a => (
          <div key={a.id} style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 12, padding: "14px 18px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
        <div key={d.id} style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 14, padding: "16px 20px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{d.studentName} · {d.ts?.toDate?.()?.toLocaleDateString("it-IT") || ""}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{d.testo}</div>
            </div>
            <button onClick={() => eliminaDomanda(d.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>🗑</button>
          </div>
          {d.risposta ? (
            <div style={{ background: C.green + "11", border: \`1px solid \${C.green}33\`, borderRadius: 10, padding: "10px 14px", marginTop: 12 }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>✅ Risposta inviata</div>
              <div style={{ fontSize: 13 }}>{d.risposta}</div>
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input value={risposte[d.id] || ""} onChange={e => setRisposte(p => ({ ...p, [d.id]: e.target.value }))}
                placeholder="Scrivi la risposta..."
                style={{ flex: 1, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={() => rispondi(d)} style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Rispondi</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

`;

const ANCHOR_ADMIN = `function AdminChat(`;
if (c.includes(ANCHOR_ADMIN)) { c = c.replace(ANCHOR_ADMIN, COMP_ADMIN + ANCHOR_ADMIN); changes++; console.log('✅ 4. AdminBacheca component added'); }
else console.log('❌ 4. AdminChat anchor not found');

// ── 5. Aggiungi tab bacheca nel render studente ──────────────────
const OLD5 = `        {/* REGISTRAZIONI */}\r\n        {tab===\"registrazioni\"`;
const NEW5 = `        {tab===\"bacheca\" && <BachecaStudente uid={uid} studentName={data?.name||""} />}\r\n\r\n        {/* REGISTRAZIONI */}\r\n        {tab===\"registrazioni\"`;
if (c.includes(OLD5)) { c = c.replace(OLD5, NEW5); changes++; console.log('✅ 5. BachecaStudente render added'); }
else console.log('❌ 5. REGISTRAZIONI anchor not found');

// ── 6. Aggiungi sezione bacheca nel render admin ─────────────────
const OLD6 = `{section===\"chat\" && <AdminChat`;
const NEW6 = `{section===\"bacheca\" && <AdminBacheca />}\r\n      {section===\"chat\" && <AdminChat`;
if (c.includes(OLD6)) { c = c.replace(OLD6, NEW6); changes++; console.log('✅ 6. AdminBacheca render added'); }
else console.log('❌ 6. AdminChat render not found');

fs.writeFileSync(path, c, 'utf8');
console.log(`\nDone! ${changes} changes applied`);
