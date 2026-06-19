import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { generateNdaPdf } from "./ndaPdf";

const GREEN = "#6AB309";
const BLUE = "#045FA5";

function formatDate(value) {
  if (!value) return "—";
  const d = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
}

export default function StudentDocumenti({ uid }) {
  const [firma, setFirma] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "ndaFirme", uid));
        setFirma(snap.exists() ? snap.data() : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const handleDownload = async () => {
    if (!firma) return;
    setDownloading(true);
    try {
      const versSnap = await getDoc(doc(db, "ndaVersioni", firma.ndaVersion));
      await generateNdaPdf({
        ...firma,
        testoMarkdown: versSnap.exists() ? versSnap.data().testo || "" : "",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <p style={{ color: "#6B7A8D", fontSize: 13 }}>Caricamento...</p>;

  if (!firma) {
    return <p style={{ color: "#6B7A8D", fontSize: 13 }}>Nessun documento NDA trovato.</p>;
  }

  return (
    <div style={{ background: "#121820", border: "1px solid #1C2530", borderRadius: 16, padding: 24, maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>📄</span>
        <h3 style={{ margin: 0, fontSize: 16, color: "#E8EDF5" }}>Accordo di Riservatezza (NDA)</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#C8D6E5", marginBottom: 20 }}>
        <span><strong>Stato:</strong> <span style={{ color: GREEN, fontWeight: 700 }}>✔ Firmato</span></span>
        <span><strong>Data accettazione:</strong> {formatDate(firma.acceptedAt)}</span>
        <span><strong>Versione:</strong> {firma.ndaVersion}</span>
      </div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{
          padding: "10px 20px", borderRadius: 10, border: "none",
          background: `linear-gradient(90deg, ${GREEN}, ${BLUE})`,
          color: "#fff", fontWeight: 700, fontSize: 13, cursor: downloading ? "not-allowed" : "pointer",
          fontFamily: "inherit", opacity: downloading ? 0.7 : 1,
        }}
      >
        {downloading ? "Generazione..." : "⬇ Scarica PDF"}
      </button>
    </div>
  );
}
