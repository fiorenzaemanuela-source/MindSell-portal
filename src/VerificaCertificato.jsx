import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import logoUrl from "./assets/Logo_Academy.png";

const GREEN = "#6AB309";
const BLUE = "#045FA5";
const BG = "#080B10";
const SURFACE = "#0E1318";
const CARD = "#121820";
const BORDER = "#1C2530";
const TEXT = "#E8EDF5";
const MUTED = "#6B7A8D";

function formatData(raw) {
  if (!raw) return "—";
  let date;
  if (raw?.toDate) {
    date = raw.toDate();
  } else if (typeof raw === "string" || typeof raw === "number") {
    date = new Date(raw);
  } else {
    return String(raw);
  }
  if (isNaN(date.getTime())) return String(raw);
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

export default function VerificaCertificato() {
  const rawSegment = window.location.pathname.split("/verifica/")[1] ?? "";
  const id = decodeURIComponent(rawSegment.replace(/\/$/, "")).trim();

  const [stato, setStato] = useState("loading"); // loading | invalido | nonEsiste | valido
  const [cert, setCert] = useState(null);

  useEffect(() => {
    if (!id) {
      setStato("invalido");
      return;
    }
    getDoc(doc(db, "certificati", id))
      .then((snap) => {
        if (!snap.exists()) {
          setStato("nonEsiste");
        } else {
          setCert(snap.data());
          setStato("valido");
        }
      })
      .catch(() => setStato("nonEsiste"));
  }, [id]);

  return (
    <div style={{
      minHeight: "100vh",
      background: BG,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      padding: "24px 16px",
    }}>
      {/* Logo */}
      <img
        src={logoUrl}
        alt="MindSell Academy"
        style={{ height: 64, objectFit: "contain", marginBottom: 32 }}
        onError={(e) => { e.target.style.display = "none"; }}
      />

      {stato === "loading" && (
        <div style={{ color: MUTED, fontSize: 16, letterSpacing: 0.5 }}>
          Verifica in corso…
        </div>
      )}

      {stato === "invalido" && (
        <Card>
          <Icon>❌</Icon>
          <Title>Certificato non trovato</Title>
          <Desc>L'ID fornito non è valido. Controlla il link e riprova.</Desc>
        </Card>
      )}

      {stato === "nonEsiste" && (
        <Card>
          <Icon>❌</Icon>
          <Title color="#FF5555">Certificato non valido o inesistente</Title>
          <Desc>Non è stato trovato nessun certificato con questo identificativo nel registro MindSell Academy.</Desc>
        </Card>
      )}

      {stato === "valido" && cert && (
        <Card>
          <Icon>✅</Icon>
          <Title color={GREEN}>Certificato valido</Title>
          <Divider />
          <Row label="Intestatario" value={cert.nomeStudente} />
          <Row label="Corso" value={cert.corso} />
          <Row label="Data di rilascio" value={formatData(cert.dataRilascio)} />
          <Row label="ID Credenziale" value={cert.idCredenziale} mono />
        </Card>
      )}

      {/* Footer link */}
      <a
        href="https://academy.mindsell.it"
        style={{
          marginTop: 32,
          color: MUTED,
          fontSize: 13,
          textDecoration: "none",
          borderBottom: `1px solid ${BORDER}`,
          paddingBottom: 1,
        }}
      >
        academy.mindsell.it
      </a>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 16,
      padding: "40px 36px",
      width: "100%",
      maxWidth: 480,
      textAlign: "center",
      boxShadow: `0 24px 64px rgba(0,0,0,0.6)`,
    }}>
      {children}
    </div>
  );
}

function Icon({ children }) {
  return <div style={{ fontSize: 48, marginBottom: 12 }}>{children}</div>;
}

function Title({ children, color = TEXT }) {
  return (
    <div style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Desc({ children }) {
  return (
    <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, margin: "8px 0 0" }}>
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div style={{
      height: 1,
      background: `linear-gradient(90deg, transparent, ${BLUE}66, ${GREEN}66, transparent)`,
      margin: "20px 0",
    }} />
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
      textAlign: "left",
    }}>
      <span style={{ color: MUTED, fontSize: 13, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{
        color: TEXT,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: mono ? "monospace" : "inherit",
        wordBreak: "break-all",
        textAlign: "right",
      }}>
        {value || "—"}
      </span>
    </div>
  );
}
