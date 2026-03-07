const fs = require('fs');
const path = 'src/App.js';
let c = fs.readFileSync(path, 'utf8');

// Find the start of the return in SetupStrumenti
const returnStart = c.indexOf('  return (\n    <div style={{ maxWidth: 720');
const returnStartCRLF = c.indexOf('  return (\r\n    <div style={{ maxWidth: 720');
const start = returnStart !== -1 ? returnStart : returnStartCRLF;

if (start === -1) {
  console.log('❌ return not found');
  // Try to find it differently
  const i = c.indexOf('maxWidth: 720, margin: "0 auto"');
  console.log('maxWidth at:', i);
  console.log(JSON.stringify(c.substring(i-20, i+50)));
  process.exit(1);
}

// Find the end: "}\n\nfunction MaterialiStudente"
const endMarker = 'function MaterialiStudente(';
const end = c.indexOf(endMarker, start);
if (end === -1) { console.log('❌ end not found'); process.exit(1); }

// Go back from end to find the closing "}\n\n" of SetupStrumenti
let closingBrace = c.lastIndexOf('\n}\n', end);
if (closingBrace === -1) closingBrace = c.lastIndexOf('\r\n}\r\n', end);
console.log('start:', start, 'closingBrace:', closingBrace, 'end:', end);

// Extract everything before the return and after the function closing
const before = c.substring(0, start);
const after = c.substring(end);

const newReturn = `  return (
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

          {TOOLS.map(tool => {
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

          <div style={{ marginTop: 20, background: C.card, border: "1px solid " + C.purple + "44", borderRadius: 14, overflow: "hidden", display: guida.aiEnabled ? "block" : "none" }}>
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

`;

c = before + newReturn + after;
fs.writeFileSync(path, c);
console.log('Done! Return section rewritten cleanly');
