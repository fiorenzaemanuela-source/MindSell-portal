import { useState, useEffect } from "react";
import {
  doc, getDoc, getDocs, collection, query, where, limit,
  setDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { generaAttestatoNext, assetToDataUrl, linkedinAddUrl } from "./utils/generaAttestatoNext";
import logoUrl from "./assets/Logo_Academy.png";
import firmaUrl from "./assets/firma_angelo.png";

const NEXT_ID = "R7JAQBrnmnSXFC9ew9QW";
const GREEN = "#6AB309";
const BLUE = "#045FA5";

function completato(m) {
  return Array.isArray(m.videolezioni) && m.videolezioni.length > 0 && m.videolezioni.every(v => v.progress === 100);
}

export default function AttestatoNext({ uid, userData, onAttestatoDaScaricare }) {
  const [stato, setStato] = useState({ loading: true, idoneo: false, rilascioAttivo: false });
  const [generando, setGenerando] = useState(false);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    if (!uid) return;
    let active = true;
    (async () => {
      try {
        const [corsoSnap, libSnap] = await Promise.all([
          getDoc(doc(db, "corsi", NEXT_ID)),
          getDocs(collection(db, "libreria")),
        ]);
        if (!active) return;

        const corsoNome = corsoSnap.exists() ? (corsoSnap.data().nome || "Next") : "Next";
        const rilascioAttivo = corsoSnap.exists() ? corsoSnap.data().rilascioAttivo !== false : true;

        const theoryLibIds = libSnap.docs
          .filter(d => d.data().corsoId === NEXT_ID)
          .map(d => d.id);

        const byLib = new Map((userData?.moduli || []).map(m => [m.libId, m]));
        const idoneo = theoryLibIds.length > 0 && theoryLibIds.every(id => {
          const m = byLib.get(id);
          return m && completato(m);
        });

        const moduli = theoryLibIds.map(id => byLib.get(id)?.title).filter(Boolean);
        const sessioni = (userData?.packages || [])
          .map(p => ({ label: p.label, count: p.used || 0 }))
          .filter(s => s.count > 0);

        setStato({ loading: false, idoneo, rilascioAttivo, corsoNome, moduli, sessioni });
        if (onAttestatoDaScaricare) {
          if (idoneo && rilascioAttivo) {
            const snapCert = await getDocs(query(
              collection(db, "certificati"),
              where("uid", "==", uid),
              where("corsoId", "==", NEXT_ID),
              limit(1)
            ));
            if (active) onAttestatoDaScaricare(snapCert.empty);
          } else {
            onAttestatoDaScaricare(false);
          }
        }
      } catch (e) {
        console.error("Errore calcolo idoneità attestato:", e);
        if (active) setStato({ loading: false, idoneo: false, rilascioAttivo: false });
      }
    })();
    return () => { active = false; };
  }, [uid, userData?.moduli, userData?.packages]);

  if (stato.loading || !stato.idoneo || !stato.rilascioAttivo) return null;

  // Riusa lo snapshot esistente per uid+corso, altrimenti lo crea una sola volta.
  const getOrCreateCertificato = async () => {
    const qExist = query(
      collection(db, "certificati"),
      where("uid", "==", uid),
      where("corsoId", "==", NEXT_ID),
      limit(1)
    );
    const snapExist = await getDocs(qExist);
    if (!snapExist.empty) {
      const d = snapExist.docs[0];
      return { id: d.id, ...d.data() };
    }

    const dataEmissione = new Date();
    const anno = dataEmissione.getFullYear();
    const idCredenziale = "MINDSELL-" + uid.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() + "-" + anno;
    const ref = doc(db, "certificati", idCredenziale);

    // Doppio controllo idempotente sul doc id stesso (oltre alla query sopra).
    const existing = await getDoc(ref);
    if (existing.exists()) return { id: ref.id, ...existing.data() };

    const data = {
      uid,
      nomeStudente: userData?.name || "",
      corso: stato.corsoNome,
      corsoId: NEXT_ID,
      dataRilascio: Timestamp.fromDate(dataEmissione),
      idCredenziale,
      moduli: stato.moduli,
      sessioni: stato.sessioni,
      emessoIl: serverTimestamp(),
    };
    await setDoc(ref, data);
    return { id: ref.id, ...data };
  };

  const formattaData = (cert) => {
    const d = cert.dataRilascio?.toDate ? cert.dataRilascio.toDate() : new Date();
    return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(d);
  };

  const handleDownload = async () => {
    setGenerando(true);
    setErrore("");
    try {
      const cert = await getOrCreateCertificato();
      const verificaUrl = `https://academy.mindsell.it/verifica/${cert.idCredenziale}`;
      const [logoDataUrl, firmaDataUrl] = await Promise.all([assetToDataUrl(logoUrl), assetToDataUrl(firmaUrl)]);
      const pdf = await generaAttestatoNext({
        nomeStudente: cert.nomeStudente,
        corso: cert.corso,
        dataRilascio: formattaData(cert),
        idCredenziale: cert.idCredenziale,
        sessioni: cert.sessioni,
        moduli: cert.moduli,
        logoDataUrl, firmaDataUrl,
        verificaUrl,
      });
      pdf.save(`Attestato_${cert.corso}_${cert.idCredenziale}.pdf`);
      onAttestatoDaScaricare?.(false);
    } catch (e) {
      console.error("Errore generazione attestato:", e);
      setErrore("Errore nella generazione del PDF. Riprova.");
    }
    setGenerando(false);
  };

  const handleLinkedin = async () => {
    setErrore("");
    try {
      const cert = await getOrCreateCertificato();
      const verificaUrl = `https://academy.mindsell.it/verifica/${cert.idCredenziale}`;
      const d = cert.dataRilascio?.toDate ? cert.dataRilascio.toDate() : new Date();
      const url = linkedinAddUrl({
        idCredenziale: cert.idCredenziale,
        issueYear: d.getFullYear(),
        issueMonth: d.getMonth() + 1,
        verificaUrl,
        corso: cert.corso,
      });
      window.open(url, "_blank");
    } catch (e) {
      console.error("Errore apertura LinkedIn:", e);
      setErrore("Errore nella preparazione del link LinkedIn. Riprova.");
    }
  };

  return (
    <div style={{ background: `linear-gradient(135deg, ${GREEN}15, ${BLUE}15)`, border: `1px solid ${GREEN}44`, borderRadius: 16, padding: "24px 28px", marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#E8EDF5", marginBottom: 4 }}>🎓 Hai completato il percorso {stato.corsoNome}!</div>
      <p style={{ fontSize: 13, color: "#6B7A8D", margin: "0 0 16px" }}>Scarica il tuo attestato di completamento oppure aggiungilo al tuo profilo LinkedIn.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleDownload}
          disabled={generando}
          style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: generando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: generando ? 0.7 : 1 }}
        >
          {generando ? "Generazione..." : "📄 Scarica attestato"}
        </button>
        <button
          onClick={handleLinkedin}
          style={{ background: BLUE, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
        >
          in Aggiungi a LinkedIn
        </button>
      </div>
      {errore && <p style={{ fontSize: 12, color: "#FF5555", margin: "10px 0 0" }}>{errore}</p>}
    </div>
  );
}
