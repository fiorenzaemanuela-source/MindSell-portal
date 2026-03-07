const fs = require('fs');
const path = 'src/App.js';
let c = fs.readFileSync(path, 'utf8');
let changes = 0;

// ── 1. Aggiorna BachecaStudente per aggiungere reply ────────────
const OLD1 = `  const [annunci, setAnnunci] = useState([]);
  const [thread, setThread] = useState([]);
  const [testo, setTesto] = useState("");
  const [file, setFile] = useState(null);
  const [invio, setInvio] = useState(false);
  const bottomRef = useRef(null);`;

const NEW1 = `  const [annunci, setAnnunci] = useState([]);
  const [thread, setThread] = useState([]);
  const [testo, setTesto] = useState("");
  const [file, setFile] = useState(null);
  const [invio, setInvio] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const bottomRef = useRef(null);`;

if (c.includes(OLD1)) { c = c.replace(OLD1, NEW1); changes++; console.log('✅ 1. replyTo state added'); }
else console.log('❌ 1. not found');

// ── 2. Aggiorna invia per includere replyTo ─────────────────────
const OLD2 = `    await addDoc(collection(db, "domande"), {
      testo: testo.trim(), fileUrl, fileName,
      studentName, studentUid: uid, isCoach: false,
      ts: serverTimestamp()
    });
    setTesto(""); setFile(null); setInvio(false);`;

const NEW2 = `    await addDoc(collection(db, "domande"), {
      testo: testo.trim(), fileUrl, fileName,
      studentName, studentUid: uid, isCoach: false,
      replyTo: replyTo ? { id: replyTo.id, testo: replyTo.testo, autore: replyTo.isCoach ? "Coach" : replyTo.studentName } : null,
      ts: serverTimestamp()
    });
    setTesto(""); setFile(null); setReplyTo(null); setInvio(false);`;

if (c.includes(OLD2)) { c = c.replace(OLD2, NEW2); changes++; console.log('✅ 2. replyTo in invia added'); }
else console.log('❌ 2. invia not found');

// ── 3. Aggiunge pulsante reply su ogni messaggio ─────────────────
const OLD3 = `                {msg.testo && <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{msg.testo}</div>}
                {msg.fileUrl && (
                  <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "6px 12px", color: C.text, textDecoration: "none", fontSize: 13 }}>
                    📎 {msg.fileName || "Allegato"}
                  </a>
                )}`;

const NEW3 = `                {msg.replyTo && (
                  <div style={{ borderLeft: \`3px solid \${C.muted}\`, paddingLeft: 8, marginBottom: 4, opacity: 0.6, fontSize: 12, color: C.muted }}>
                    ↩ <strong>{msg.replyTo.autore}</strong>: {msg.replyTo.testo?.slice(0,80)}{msg.replyTo.testo?.length>80?"...":""}
                  </div>
                )}
                {msg.testo && <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{msg.testo}</div>}
                {msg.fileUrl && (
                  <a href={msg.fileUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "6px 12px", color: C.text, textDecoration: "none", fontSize: 13 }}>
                    📎 {msg.fileName || "Allegato"}
                  </a>
                )}
                <button onClick={() => { setReplyTo(msg); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginTop: 3, padding: "2px 6px", borderRadius: 4, fontFamily: "inherit" }}>↩ Rispondi</button>`;

if (c.includes(OLD3)) { c = c.replace(OLD3, NEW3); changes++; console.log('✅ 3. Reply button + quote added'); }
else console.log('❌ 3. msg content not found');

// ── 4. Aggiunge anteprima reply nell'input ──────────────────────
const OLD4 = `        {file && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.surface, borderRadius: 8, padding: "6px 10px" }}>
            <span style={{ fontSize: 13 }}>📎 {file.name}</span>
            <button onClick={() => setFile(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, marginLeft: "auto" }}>✕</button>
          </div>
        )}`;

const NEW4 = `        {replyTo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.surface, borderRadius: 8, padding: "6px 10px", borderLeft: \`3px solid \${C.green}\` }}>
            <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>↩ Risposta a <strong>{replyTo.isCoach ? "Coach" : replyTo.studentName}</strong>: {replyTo.testo?.slice(0,60)}{replyTo.testo?.length>60?"...":""}</span>
            <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        )}
        {file && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.surface, borderRadius: 8, padding: "6px 10px" }}>
            <span style={{ fontSize: 13 }}>📎 {file.name}</span>
            <button onClick={() => setFile(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, marginLeft: "auto" }}>✕</button>
          </div>
        )}`;

if (c.includes(OLD4)) { c = c.replace(OLD4, NEW4); changes++; console.log('✅ 4. Reply preview in input added'); }
else console.log('❌ 4. file preview not found');

// ── 5. Aggiorna AdminBacheca per rispondere inline con reply ─────
const OLD5 = `          {d.risposta ? (
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
          )}`;

const NEW5 = `          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <input value={risposte[d.id] || ""} onChange={e => setRisposte(p => ({ ...p, [d.id]: e.target.value }))}
                onKeyDown={e => { if(e.key==="Enter") rispondi(d); }}
                placeholder={d.risposta ? "Aggiorna risposta..." : "Scrivi la risposta..."}
                style={{ flex: 1, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={() => rispondi(d)} style={{ background: C.green, border: "none", color: "#000", borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {d.risposta ? "Aggiorna" : "Rispondi"}
              </button>
            </div>
            {d.risposta && (
              <div style={{ background: C.green + "11", border: \`1px solid \${C.green}33\`, borderRadius: 10, padding: "10px 14px", marginTop: 8 }}>
                <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 }}>✅ Risposta inviata</div>
                <div style={{ fontSize: 13 }}>{d.risposta}</div>
              </div>
            )}`;

if (c.includes(OLD5)) { c = c.replace(OLD5, NEW5); changes++; console.log('✅ 5. AdminBacheca reply always visible'); }
else console.log('❌ 5. admin reply section not found');

fs.writeFileSync(path, c, 'utf8');
console.log(`\nDone! ${changes} changes applied`);
