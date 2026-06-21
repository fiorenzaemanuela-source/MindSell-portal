import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { signOut } from "firebase/auth";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { NDA_ACTIVE_VERSION } from "./ndaConfig";

const GREEN = "#6AB309";
const BLUE = "#045FA5";
const CF_REGEX = /^[A-Za-z0-9]{16}$/;

export default function NDAGate({ uid, email, ruolo }) {
  const [testo, setTesto] = useState("");
  const [loadingTesto, setLoadingTesto] = useState(true);
  const [errore, setErrore] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nome: "", cognome: "", codiceFiscale: "" });
  const [accettato, setAccettato] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "ndaVersioni", NDA_ACTIVE_VERSION));
        if (active) setTesto(snap.exists() ? snap.data().testo || "" : "");
      } catch {
        if (active) setErrore("Impossibile caricare il testo dell'Accordo di Riservatezza.");
      } finally {
        if (active) setLoadingTesto(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const cfValida = CF_REGEX.test(form.codiceFiscale.trim());
  const formValido = form.nome.trim() && form.cognome.trim() && cfValida && accettato;

  const handleSubmit = async () => {
    if (!formValido || submitting) return;
    setSubmitting(true);
    setErrore("");
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "ndaFirme", uid), {
        uid,
        nome: form.nome.trim(),
        cognome: form.cognome.trim(),
        codiceFiscale: form.codiceFiscale.trim().toUpperCase(),
        email: email || "",
        tipo: ruolo || "studente",
        ndaVersion: NDA_ACTIVE_VERSION,
        acceptedAt: serverTimestamp(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
      batch.set(doc(db, "studenti", uid), {
        ndaAccepted: true,
        ndaVersion: NDA_ACTIVE_VERSION,
      }, { merge: true });
      await batch.commit();
      // Lo unsubscribe onSnapshot in App.js riceve l'aggiornamento e smonta il gate.
    } catch {
      setErrore("Errore durante il salvataggio. Riprova.");
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#080B10", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000, fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ background: "#0E1318", border: `1px solid ${BLUE}55`, borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: `0 0 30px ${BLUE}33` }}>
        <div style={{ padding: "22px 28px", borderBottom: "1px solid #1C2530", background: `linear-gradient(90deg, ${GREEN}22, ${BLUE}22)`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#E8EDF5" }}>Accordo di Riservatezza (NDA)</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6B7A8D" }}>Per accedere alla piattaforma è necessario accettare l'Accordo di Riservatezza.</p>
          </div>
          <button
            onClick={() => signOut(auth)}
            style={{
              background: "none", border: "none", color: "#6B7A8D", fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", padding: 0, textDecoration: "underline",
            }}
          >
            Esci
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          {loadingTesto ? (
            <p style={{ color: "#6B7A8D", fontSize: 13 }}>Caricamento testo NDA...</p>
          ) : (
            <div style={{ color: "#C8D6E5", fontSize: 13, lineHeight: 1.6 }}>
              <ReactMarkdown>{testo || "Testo dell'Accordo non disponibile."}</ReactMarkdown>
            </div>
          )}

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1C2530", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <input
                placeholder="Nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                style={inputStyle()}
              />
              <input
                placeholder="Cognome"
                value={form.cognome}
                onChange={(e) => setForm({ ...form, cognome: e.target.value })}
                style={inputStyle()}
              />
            </div>
            <input
              placeholder="Codice Fiscale (16 caratteri)"
              value={form.codiceFiscale}
              maxLength={16}
              onChange={(e) => setForm({ ...form, codiceFiscale: e.target.value.toUpperCase() })}
              style={inputStyle(form.codiceFiscale && !cfValida ? "#FF5555" : undefined)}
            />
            {form.codiceFiscale && !cfValida && (
              <span style={{ fontSize: 12, color: "#FF5555" }}>Il Codice Fiscale deve avere 16 caratteri alfanumerici.</span>
            )}

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#C8D6E5", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={accettato}
                onChange={(e) => setAccettato(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: GREEN }}
              />
              Ho letto e accetto l'Accordo di Riservatezza.
            </label>

            {errore && <span style={{ fontSize: 12, color: "#FF5555" }}>{errore}</span>}
          </div>
        </div>

        <div style={{ padding: "18px 28px", borderTop: "1px solid #1C2530" }}>
          <button
            onClick={handleSubmit}
            disabled={!formValido || submitting}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
              background: formValido && !submitting ? `linear-gradient(90deg, ${GREEN}, ${BLUE})` : "#1C2530",
              color: formValido && !submitting ? "#fff" : "#6B7A8D",
              fontWeight: 700, fontSize: 14, cursor: formValido && !submitting ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            {submitting ? "Salvataggio..." : "Accetta e prosegui"}
          </button>
        </div>
      </div>
    </div>
  );
}

function inputStyle(borderColor) {
  return {
    flex: 1, padding: "10px 14px", borderRadius: 10,
    border: `1px solid ${borderColor || "#1C2530"}`,
    background: "#121820", color: "#E8EDF5", fontSize: 13, fontFamily: "inherit",
  };
}
