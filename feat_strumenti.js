const fs = require('fs');
const path = 'src/App.js';
let c = fs.readFileSync(path, 'utf8');
let changes = 0;

// ── 1. Aggiungi tab Strumenti nel sidebar studente ───────────────
const OLD1 = `    { id: "materiali", label: "Materiali", emoji: "📎" },\r\n  ];`;
const NEW1 = `    { id: "materiali", label: "Materiali", emoji: "📎" },\r\n    { id: "strumenti", label: "Strumenti", emoji: "⚙️" },\r\n  ];`;
if (c.includes(OLD1)) { c = c.replace(OLD1, NEW1); changes++; console.log('✅ 1. Tab Strumenti aggiunto'); }
else console.log('❌ 1. tabs not found');

// ── 2. Aggiungi render Strumenti nel StudentPortal ───────────────
const OLD2 = `        {tab===\"materiali\" && <MaterialiStudente uid={uid} moduli={data?.moduli||[]} />}`;
const NEW2 = `        {tab===\"materiali\" && <MaterialiStudente uid={uid} moduli={data?.moduli||[]} />}\r\n        {tab===\"strumenti\" && <SetupStrumenti studentName={data?.name||""} />}`;
if (c.includes(OLD2)) { c = c.replace(OLD2, NEW2); changes++; console.log('✅ 2. Render Strumenti aggiunto'); }
else console.log('❌ 2. materiali render not found');

// ── 3. Aggiungi TOOLS, DEVICES e SetupStrumenti prima di MaterialiStudente ──
const ANCHOR = 'function MaterialiStudente(';
if (!c.includes(ANCHOR)) { console.log('❌ 3. anchor not found'); process.exit(1); }

const SETUP_COMP = `const TOOLS = [
  { id: "google", emoji: "📄", name: "Google Documenti & Fogli", tag: "FACILE", tagColor: "#6DBF3E", url: "https://docs.google.com", urlLabel: "docs.google.com", cost: "Completamente gratuito", costNote: "Nessun piano a pagamento necessario", description: "Strumenti Google per creare documenti e fogli di calcolo. Li userai per la Libreria Prompt e la Mini-Dashboard KPI. Se hai già Gmail, hai già accesso.", steps: [{ text: "Verifica di avere un account Google — se hai Gmail, sei già a posto." }, { text: "Apri docs.google.com per i documenti e sheets.google.com per i fogli.", link: "https://docs.google.com" }, { text: "Crea un documento 'Libreria Prompt MindSell' con 5 sezioni: Analisi Conversazioni, Pitch, Obiezioni, Follow-up, KPI." }, { text: "Crea un foglio 'Dashboard KPI MindSell' con 7 colonne: Data, Prospect, B2B/B2C, Remoto/Presenza, Emozione, Obiezione, Esito." }] },
  { id: "chatgpt", emoji: "🤖", name: "ChatGPT", tag: "FACILE", tagColor: "#6DBF3E", url: "https://chat.openai.com", urlLabel: "chat.openai.com", cost: "Piano gratuito disponibile", costNote: "Plus 20€/mese per uso intensivo", description: "Il motore AI principale del corso. Lo usi per analizzare conversazioni, costruire pitch personalizzati e fare call review. Il piano gratuito è sufficiente per iniziare.", steps: [{ text: "Vai su chat.openai.com e clicca 'Sign up'.", link: "https://chat.openai.com" }, { text: "Registrati con la tua email oppure tramite Google." }, { text: "Verifica l'email se richiesto e completa la registrazione." }, { text: "Inizia subito — nessuna installazione, funziona nel browser." }] },
  { id: "otter", emoji: "🎙️", name: "Otter.ai", tag: "MEDIO", tagColor: "#E67E22", url: "https://otter.ai", urlLabel: "otter.ai", cost: "Piano gratuito: 300 min/mese", costNote: "Pro 16€/mese per uso intensivo", description: "Trascrive automaticamente le tue chiamate in testo. Si collega a Zoom, Google Meet e Teams. La trascrizione è disponibile subito dopo la chiamata.", steps: [{ text: "Vai su otter.ai e crea un account gratuito.", link: "https://otter.ai" }, { text: "Dopo il login vai su 'Apps' nel menu a sinistra." }, { text: "Cerca Zoom o Google Meet, clicca 'Connect' e autorizza l'accesso." }, { text: "Test: avvia una chiamata di prova. Otter parte automaticamente." }, { text: "Dopo la chiamata: 'My Conversations' → clicca → Ctrl+A → copia in ChatGPT." }, { text: "Per vendita in presenza: installa l'app Otter sul telefono e usa 'Import'." }] },
  { id: "hubspot", emoji: "📋", name: "HubSpot Free", tag: "MEDIO", tagColor: "#E67E22", url: "https://www.hubspot.com/it", urlLabel: "hubspot.com/it", cost: "Completamente gratuito — nessun limite di tempo", costNote: "Nessuna carta di credito", description: "CRM gratuito e permanente. Lo usi per conservare le note emotive sui prospect, impostare promemoria e costruire la memoria del cliente.", steps: [{ text: "Vai su hubspot.com/it e clicca 'Inizia gratis'.", link: "https://www.hubspot.com/it" }, { text: "Durante la configurazione rispondi liberamente a settore e dimensione." }, { text: "Vai su 'Contatti' → 'Crea contatto' per il tuo primo prospect." }, { text: "Nella scheda contatto usa 'Note' per salvare: Emozione | Bias attivo | Leva." }, { text: "Per promemoria: scheda contatto → Attività → Crea attività → Promemoria." }, { text: "Ignora Pipeline e Deal per ora — non servono per questo corso." }, { text: "Scarica l'app HubSpot sul telefono per le note post-visita in presenza." }] },
  { id: "make", emoji: "⚡", name: "Make (ex Integromat)", tag: "AVANZATO", tagColor: "#B44FFF", optional: true, url: "https://www.make.com", urlLabel: "make.com", cost: "Piano gratuito: 1.000 operazioni/mese", costNote: "Sezione opzionale — configura dopo gli altri", description: "Strumento di automazione che collega app diverse. Salta questa sezione se sei all'inizio — è la parte opzionale del Modulo 5.", steps: [{ text: "Vai su make.com e crea un account gratuito.", link: "https://www.make.com" }, { text: "Clicca 'Create a new scenario' in alto a destra." }, { text: "Clicca '+' → cerca 'Otter.ai' → trigger 'New Conversation' → connetti il tuo account." }, { text: "Aggiungi blocco: '+' → 'Gmail' → 'Send an Email'. Imposta destinatario e corpo {{transcript}}." }, { text: "Clicca 'Run once' per testare. Se funziona, attiva lo scenario." }] },
];

const DEVICES = [
  { name: "Smartphone + Otter.ai", price: "Gratis", note: "Ideale per iniziare. Posiziona il telefono sul tavolo durante la consulenza. Registra e trascrive automaticamente." },
  { name: "Olympus WS-853", price: "€60–80", note: "Registratore compatto, ottima qualità voce, batteria lunga, trasferimento via USB." },
  { name: "Sony ICD-UX570", price: "€70–90", note: "Design sottile, qualità eccellente. Importa l'audio in Otter per la trascrizione." },
  { name: "Zoom H1n", price: "€110–140", note: "Qualità professionale. Il massimo della chiarezza per le trascrizioni AI." },
];

function SetupStrumenti({ studentName }) {
  const [checked, setChecked] = useState(() => Object.fromEntries(TOOLS.map(t => [t.id, []])));
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
  const totalSteps = TOOLS.reduce((a, t) => a + t.steps.length, 0);
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
          system: \`Sei l'assistente AI del corso MindSell Academy, specializzato in vendita emotiva e strumenti AI. Stai aiutando lo studente \${studentName || "uno studente"} con la configurazione degli strumenti del corso. Gli strumenti del corso sono: Google Documenti/Fogli (per Libreria Prompt e Dashboard KPI), ChatGPT (motore AI principale), Otter.ai (trascrizione chiamate), HubSpot Free (CRM), Make/Integromat (automazione, opzionale). Rispondi in italiano, in modo conciso e pratico. Se non sai qualcosa di specifico sul corso, guida lo studente in modo generale.\`,
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
      {/* Header progress */}
      <div style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 14, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>⚙️ Setup Strumenti del Corso</div>
          <div style={{ fontSize: 13, color: C.muted }}>Configura tutti gli strumenti per iniziare il percorso</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.green }}>{totalPct}%</div>
          <div style={{ fontSize: 11, color: C.muted }}>completato</div>
        </div>
      </div>

      {/* Tool cards */}
      {TOOLS.map(tool => {
        const p = pct(tool);
        const isOpen = open === tool.id;
        return (
          <div key={tool.id} style={{ background: C.card, border: \`1px solid \${isOpen ? C.purple+"66" : C.border}\`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
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
              <div style={{ textAlign: "center", minWidth: 40 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: p === 100 ? C.green : C.text }}>{p}%</div>
              </div>
              <span style={{ color: C.muted, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <div style={{ borderTop: \`1px solid \${C.border}\`, padding: "16px 20px" }}>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>{tool.description}</p>
                <a href={tool.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "6px 14px", color: C.blue, textDecoration: "none", fontSize: 12, marginBottom: 16 }}>🔗 {tool.urlLabel}</a>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tool.steps.map((step, i) => (
                    <div key={i} onClick={() => toggle(tool.id, i)} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: checked[tool.id].includes(i) ? C.green+"11" : C.surface, border: \`1px solid \${checked[tool.id].includes(i) ? C.green+"44" : C.border}\` }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: \`2px solid \${checked[tool.id].includes(i) ? C.green : C.muted}\`, background: checked[tool.id].includes(i) ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
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

      {/* Dispositivi */}
      <div style={{ background: C.card, border: \`1px solid \${C.border}\`, borderRadius: 14, marginTop: 8, overflow: "hidden" }}>
        <div style={{ background: \`linear-gradient(135deg,#0E9E9D18,transparent)\`, borderBottom: \`1px solid \${C.border}\`, padding: "16px 20px", borderLeft: \`4px solid #0E9E9D\`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>🎙️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Dispositivi di Registrazione — Vendita in Presenza</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Per chi incontra i clienti di persona</div>
          </div>
        </div>
        <div style={{ margin: "14px 20px 4px", padding: "12px 16px", background: C.red+"0D", border: \`1px solid \${C.red}44\`, borderRadius: 10, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 13, color: "#E57373", lineHeight: 1.65, margin: 0 }}><strong>Obbligo GDPR:</strong> in Italia registrare una conversazione richiede il consenso esplicito. Prima di registrare: <em>"Ti dispiace se registro questa conversazione? Mi serve per migliorare il mio servizio."</em></p>
        </div>
        <div style={{ padding: "12px 20px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {DEVICES.map((d, i) => (
            <div key={i} style={{ background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, marginRight: 8 }}>{d.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#D4A017", background: "#D4A01722", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{d.price}</span>
              </div>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, margin: 0 }}>{d.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Assistant */}
      <div style={{ marginTop: 20, background: C.card, border: \`1px solid \${C.purple}44\`, borderRadius: 14, overflow: "hidden" }}>
        <div onClick={() => setAiOpen(!aiOpen)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: \`linear-gradient(135deg,\${C.purple}11,transparent)\` }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.purpleGlow }}>Assistente AI del Corso</div>
            <div style={{ fontSize: 12, color: C.muted }}>Hai domande sulla configurazione? Chiedi qui</div>
          </div>
          <span style={{ color: C.muted, fontSize: 12 }}>{aiOpen ? "▲" : "▼"}</span>
        </div>
        {aiOpen && (
          <div style={{ borderTop: \`1px solid \${C.border}\` }}>
            <div style={{ height: 300, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {aiMessages.length === 0 && (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 80 }}>
                  Ciao {studentName?.split(" ")[0] || ""}! 👋 Chiedi qualsiasi cosa sulla configurazione degli strumenti.
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", background: msg.role === "user" ? C.purple+"33" : C.surface, border: \`1px solid \${msg.role === "user" ? C.purple+"44" : C.border}\`, borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.5, color: C.text }}>
                    {msg.role === "assistant" && <div style={{ fontSize: 11, color: C.purpleGlow, fontWeight: 700, marginBottom: 4 }}>🤖 Assistente</div>}
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: C.muted }}>⏳ Sto pensando...</div>
                </div>
              )}
              <div ref={aiBottomRef} />
            </div>
            <div style={{ borderTop: \`1px solid \${C.border}\`, padding: "12px 16px", display: "flex", gap: 8 }}>
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
                placeholder="Es: Come collego Otter a Zoom?"
                style={{ flex: 1, background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}
                style={{ background: C.purple, border: "none", color: "#fff", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: aiLoading || !aiInput.trim() ? 0.5 : 1 }}>
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

`;

c = c.replace(ANCHOR, SETUP_COMP + ANCHOR);
changes++;
console.log('✅ 3. SetupStrumenti + TOOLS + DEVICES aggiunti');

fs.writeFileSync(path, c, 'utf8');
console.log(\`\nDone! \${changes} changes applied\`);
