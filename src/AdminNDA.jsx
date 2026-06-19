import { useState, useEffect } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { generateNdaPdf } from "./ndaPdf";

const GREEN = "#6AB309";
const BLUE = "#045FA5";

function formatDate(value) {
  if (!value) return "—";
  const d = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", { dateStyle: "medium" });
}

export default function AdminNDA({ studenti }) {
  const [firme, setFirme] = useState({});
  const [loading, setLoading] = useState(true);
  const [downloadingUid, setDownloadingUid] = useState(null);
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroTipo, setFiltroTipo] = useState("tutti");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "ndaFirme"));
        const map = {};
        snap.docs.forEach((d) => { map[d.id] = d.data(); });
        setFirme(map);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownload = async (firma) => {
    setDownloadingUid(firma.uid);
    try {
      const versSnap = await getDoc(doc(db, "ndaVersioni", firma.ndaVersion));
      await generateNdaPdf({
        ...firma,
        testoMarkdown: versSnap.exists() ? versSnap.data().testo || "" : "",
      });
    } finally {
      setDownloadingUid(null);
    }
  };

  const righe = (studenti || [])
    .map((s) => ({ studente: s, firma: firme[s.uid] || null }))
    .filter(({ firma }) => {
      if (filtroStato === "firmato") return !!firma;
      if (filtroStato === "non_firmato") return !firma;
      return true;
    })
    .filter(({ studente, firma }) => {
      if (filtroTipo === "tutti") return true;
      return (firma?.tipo || studente.ruolo || "studente") === filtroTipo;
    });

  if (loading) return <p style={{ color: "#6B7A8D", fontSize: 13 }}>Caricamento...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>📋 NDA</h2>
      <p style={{ color: "#6B7A8D", fontSize: 13, margin: "0 0 20px" }}>Stato di firma dell'Accordo di Riservatezza per ogni account.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        <select value={filtroStato} onChange={(e) => setFiltroStato(e.target.value)} style={selectStyle()}>
          <option value="tutti">Tutti gli stati</option>
          <option value="firmato">Firmato</option>
          <option value="non_firmato">Non firmato</option>
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={selectStyle()}>
          <option value="tutti">Tutti i tipi</option>
          <option value="studente">Studente</option>
          <option value="procacciatore">Procacciatore</option>
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {righe.map(({ studente, firma }) => (
          <div key={studente.uid} style={{ background: "#121820", border: "1px solid #1C2530", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#E8EDF5" }}>
                {firma ? `${firma.nome} ${firma.cognome}` : studente.name || "—"}
              </div>
              <div style={{ fontSize: 12, color: "#6B7A8D" }}>
                {firma?.codiceFiscale || "CF non disponibile"} · {(firma?.tipo || studente.ruolo || "studente")}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#6B7A8D", minWidth: 90 }}>
              {firma ? `v${firma.ndaVersion} · ${formatDate(firma.acceptedAt)}` : "—"}
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
              background: firma ? `${GREEN}22` : "#FF555522",
              color: firma ? GREEN : "#FF5555",
            }}>
              {firma ? "✔ Firmato" : "✕ Non firmato"}
            </span>
            <button
              disabled={!firma || downloadingUid === studente.uid}
              onClick={() => handleDownload(firma)}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: firma ? `linear-gradient(90deg, ${GREEN}, ${BLUE})` : "#1C2530",
                color: firma ? "#fff" : "#6B7A8D", fontWeight: 700, fontSize: 12,
                cursor: firma ? "pointer" : "not-allowed", fontFamily: "inherit",
              }}
            >
              {downloadingUid === studente.uid ? "..." : "⬇ PDF"}
            </button>
          </div>
        ))}
        {righe.length === 0 && <p style={{ color: "#6B7A8D", fontSize: 13 }}>Nessun account corrisponde ai filtri.</p>}
      </div>
    </div>
  );
}

function selectStyle() {
  return {
    padding: "8px 14px", borderRadius: 8, border: "1px solid #1C2530",
    background: "#121820", color: "#E8EDF5", fontSize: 13, fontFamily: "inherit",
  };
}
