// Genera il PDF della firma NDA. jsPDF viene caricato con import dinamico
// (mai import ESM statico: in CRA un import statico di jspdf causa errori di build).
const MARGIN = 20;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function formatDate(value) {
  if (!value) return "—";
  const d = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
}

// Scrive una riga markdown gestendo titoli (#, ##, ###) e grassetto (**testo**).
function writeMarkdownLine(doc, line, y) {
  const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
  if (headingMatch) {
    const size = { "#": 15, "##": 13, "###": 12 }[headingMatch[1]];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(headingMatch[2], CONTENT_WIDTH);
    wrapped.forEach((w) => { doc.text(w, MARGIN, y); y += size * 0.5; });
    doc.setFontSize(10);
    return y + 2;
  }

  if (!line.trim()) return y + 4;

  const fullBold = line.match(/^\*\*(.*)\*\*$/);
  if (fullBold) {
    doc.setFont("helvetica", "bold");
    const wrapped = doc.splitTextToSize(fullBold[1], CONTENT_WIDTH);
    wrapped.forEach((w) => { doc.text(w, MARGIN, y); y += 5; });
    doc.setFont("helvetica", "normal");
    return y;
  }

  // Grassetto inline: se il segmento intero entra in larghezza, alterna i font;
  // altrimenti ricade su testo semplice (senza marcatori) andando a capo.
  const segments = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  const plain = segments.map((s) => s.replace(/\*\*/g, "")).join("");
  doc.setFont("helvetica", "normal");
  if (doc.getTextWidth(plain) <= CONTENT_WIDTH) {
    let x = MARGIN;
    segments.forEach((seg) => {
      const isBold = /^\*\*[^*]+\*\*$/.test(seg);
      const text = seg.replace(/\*\*/g, "");
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.text(text, x, y);
      x += doc.getTextWidth(text);
    });
    doc.setFont("helvetica", "normal");
    return y + 5;
  }
  const wrapped = doc.splitTextToSize(plain, CONTENT_WIDTH);
  wrapped.forEach((w) => { doc.text(w, MARGIN, y); y += 5; });
  return y;
}

export async function generateNdaPdf({
  nome, cognome, codiceFiscale, email, tipo, uid, ndaVersion, acceptedAt, testoMarkdown,
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Accordo di Riservatezza (NDA)", MARGIN, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const anagrafica = [
    `Nome: ${nome || "—"}`,
    `Cognome: ${cognome || "—"}`,
    `Codice Fiscale: ${codiceFiscale || "—"}`,
    `Email: ${email || "—"}`,
    `Tipo: ${tipo || "—"}`,
  ];
  anagrafica.forEach((line) => { doc.text(line, MARGIN, y); y += 5.5; });
  y += 4;

  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  const lines = (testoMarkdown || "").split("\n");
  for (const line of lines) {
    if (y > pageHeight - MARGIN - 15) { doc.addPage(); y = MARGIN; }
    y = writeMarkdownLine(doc, line, y);
  }

  // Footer con metadati di firma
  const addFooter = () => {
    const footerY = pageHeight - 12;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Firmato il ${formatDate(acceptedAt)} — Versione NDA: ${ndaVersion || "—"} — UID: ${uid || "—"}`,
      MARGIN, footerY
    );
    doc.setTextColor(0);
  };
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter();
  }

  const fileName = `NDA_${(cognome || "utente").replace(/\s+/g, "_")}_${(nome || "").replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}
