// src/utils/generaAttestatoNext.js
// ---------------------------------------------------------------------------
// Generatore Attestato di Completamento - MindSell Academy
// PDF a 2 pagine (jsPDF). Pagina 1 = attestato + headline (100% teoria + ore pratica).
// Pagina 2 = dettaglio: moduli teorici completati + sessioni pratiche svolte.
//
// NOTE:
// - jsPDF importato in modo DINAMICO (Create React App).
// - Riceve dati gia' puliti dal chiamante. Le ore di pratica sono calcolate qui
//   dalla somma delle sessioni svolte (1 sessione ~ 1 ora).
// - I titoli dei moduli vengono ripuliti del prefisso "Modulo N - " (il numero
//   resta nel pallino verde).
// - Font core jsPDF (times/helvetica): accentate italiane ok; evitati i glifi a
//   rischio (caporali, registrato, punto medio, circa-uguale).
// ---------------------------------------------------------------------------

const PAL = {
  green:[106,179,9], blue:[4,95,165], dark:[26,39,51], gray:[107,114,128],
  lgray:[138,146,156], body:[58,70,81], bandF:[244,248,238], bandS:[227,235,214],
  sep:[217,224,200], border:[217,222,227], line:[153,163,172], white:[255,255,255]
};
const LOGO_AR = 600 / 400;     // logo ottimizzato 600x400
const FIRMA_AR = 716 / 566;    // firma su sfondo trasparente

// rimuove "Modulo 1 - ", "Modulo 2 -", "Modulo 3:" ecc. dal titolo
function pulisciTitolo(t) {
  const s = String(t || '').replace(/^\s*modulo\s*\d+\s*[-–—:.)]*\s*/i, '').trim();
  return s || String(t || '');
}

export async function generaAttestatoNext(dati) {
  const {
    nomeStudente, dataRilascio, idCredenziale,
    sessioni = [], moduli = [],
    logoDataUrl, firmaDataUrl, verificaUrl = null,
    corso = 'Next'
  } = dati;

  const orePratica = sessioni.reduce((a, s) => a + (Number(s.count) || 0), 0);
  const titoli = (Array.isArray(moduli) ? moduli : []).map(pulisciTitolo);

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const CX = W / 2;

  const setFill = c => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = c => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = c => doc.setTextColor(c[0], c[1], c[2]);
  const ctext = (x, y, s, font, style, size, c) => {
    doc.setFont(font, style); doc.setFontSize(size); setText(c);
    doc.text(s, x, y, { align: 'center' });
  };

  function frame() {
    setDraw(PAL.border); doc.setLineWidth(1); doc.rect(16, 16, W - 32, H - 32, 'S');
    setDraw(PAL.blue);   doc.setLineWidth(1.2); doc.rect(28, 28, W - 56, H - 56, 'S');
    doc.setLineWidth(0.5); doc.rect(36, 36, W - 72, H - 72, 'S');
    setDraw(PAL.green); doc.setLineWidth(3); doc.setLineCap('round');
    const x0 = 36, y0 = 36, x1 = W - 36, y1 = H - 36;
    doc.line(x0, y0 + 30, x0, y0); doc.line(x0, y0, x0 + 30, y0);
    doc.line(x1, y0 + 30, x1, y0); doc.line(x1, y0, x1 - 30, y0);
    doc.line(x0, y1 - 30, x0, y1); doc.line(x0, y1, x0 + 30, y1);
    doc.line(x1, y1 - 30, x1, y1); doc.line(x1, y1, x1 - 30, y1);
    setFill(PAL.green);
    doc.lines([[8, 8], [-8, 8], [-8, -8], [8, -8]], CX, y0 - 8, [1, 1], 'F', true);
    doc.setLineCap('butt');
  }
  function credLine(y) {
    let s = 'ID credenziale: ' + idCredenziale;
    if (verificaUrl) s += '     |     Verifica su ' + verificaUrl;
    ctext(CX, y, s, 'helvetica', 'normal', 9.5, PAL.lgray);
  }
  // fascia con celle [{num, lab}] centrata
  function band(yTop, hgt, cells) {
    const bw = 420, bx = CX - bw / 2;
    setFill(PAL.bandF); setDraw(PAL.bandS); doc.setLineWidth(1);
    doc.roundedRect(bx, yTop, bw, hgt, 8, 8, 'FD');
    const n = cells.length; if (!n) return;
    const colW = bw / n;
    setDraw(PAL.sep); doc.setLineWidth(1);
    for (let i = 1; i < n; i++) { const sx = bx + colW * i; doc.line(sx, yTop + 11, sx, yTop + hgt - 11); }
    cells.forEach((cell, i) => {
      const cx = bx + colW * (i + 0.5);
      ctext(cx, yTop + 26, String(cell.num), 'times', 'bold', 22, PAL.blue);
      ctext(cx, yTop + hgt - 11, cell.lab, 'helvetica', 'normal', 10.5, PAL.gray);
    });
  }

  // ======================= PAGINA 1 - ATTESTATO =======================
  frame();
  if (logoDataUrl) { const lw = 165, lh = lw / LOGO_AR; doc.addImage(logoDataUrl, 'PNG', CX - lw / 2, 50, lw, lh); }
  ctext(CX, 187, 'Certificato di Completamento', 'times', 'bold', 26, PAL.blue);
  setDraw(PAL.green); doc.setLineWidth(1.5); doc.line(CX - 61, 199, CX + 61, 199);
  ctext(CX, 225, 'Il presente attestato è conferito a', 'helvetica', 'normal', 13, PAL.gray);
  ctext(CX, 265, nomeStudente, 'times', 'bold', 31, PAL.dark);
  ctext(CX, 303, 'per aver completato con successo il percorso ' + corso + ',', 'helvetica', 'normal', 13, PAL.body);
  ctext(CX, 321, 'programma di formazione vendite basato sulla Metodologia MindSell', 'helvetica', 'normal', 13, PAL.body);

  band(337, 52, [
    { num: '100%', lab: 'Parte teorica completata' },
    { num: orePratica + ' ore', lab: 'Applicazione pratica' },
  ]);

  ctext(CX, 405, 'Dettaglio del percorso a pagina 2', 'helvetica', 'italic', 10, PAL.lgray);

  setDraw(PAL.green); doc.setLineWidth(2); doc.circle(CX, 473, 22, 'S');
  doc.setLineWidth(0.6); doc.circle(CX, 473, 16.5, 'S');
  doc.setLineWidth(2.2); doc.setLineCap('round'); doc.setLineJoin('round');
  doc.lines([[5, 5], [11, -12]], CX - 8, 473, [1, 1], 'S', false);
  doc.setLineCap('butt'); doc.setLineJoin('miter');
  ctext(CX, 507, 'V E R I F I C A T O', 'helvetica', 'normal', 8.5, PAL.green);

  ctext(200, 479, dataRilascio, 'times', 'normal', 13, PAL.dark);
  setDraw(PAL.line); doc.setLineWidth(0.8); doc.line(140, 489, 260, 489);
  ctext(200, 505, 'Data di rilascio', 'helvetica', 'normal', 10.5, PAL.gray);

  const sigX = 642;
  ctext(sigX, 476, 'Angelo Fiorenza', 'helvetica', 'normal', 11, PAL.dark);
  if (firmaDataUrl) { const sw = 90, sh = sw / FIRMA_AR; doc.addImage(firmaDataUrl, 'PNG', sigX - sw / 2, 411, sw, sh); }
  setDraw(PAL.line); doc.setLineWidth(0.8); doc.line(sigX - 60, 489, sigX + 60, 489);
  ctext(sigX, 505, 'MindSell Academy', 'helvetica', 'normal', 10.5, PAL.gray);

  credLine(533);
  ctext(CX, 549, 'Pagina 1 di 2', 'helvetica', 'normal', 8.5, PAL.lgray);

  // ======================= PAGINA 2 - DETTAGLIO =======================
  doc.addPage('a4', 'landscape');
  frame();
  if (logoDataUrl) { const lw = 120, lh = lw / LOGO_AR; doc.addImage(logoDataUrl, 'PNG', CX - lw / 2, 39, lw, lh); }
  ctext(CX, 143, 'Dettaglio del Percorso ' + corso, 'times', 'bold', 21, PAL.blue);
  ctext(CX, 162, 'Teoria completata e applicazione pratica', 'helvetica', 'normal', 11.5, PAL.gray);
  setDraw(PAL.green); doc.setLineWidth(1.4); doc.line(CX - 55, 172, CX + 55, 172);

  // --- parte teorica: moduli (titoli puliti) su 2 colonne ---
  ctext(CX, 192, 'PARTE TEORICA  -  MODULI COMPLETATI', 'helvetica', 'bold', 10, PAL.green);
  const n = titoli.length;
  const perCol = Math.max(1, Math.ceil(n / 2));
  const startY = 213, maxY = 325;
  const step = perCol > 1 ? Math.min(25, (maxY - startY) / (perCol - 1)) : 0;
  const cols = [{ badge: 95, text: 114 }, { badge: 455, text: 474 }];
  titoli.forEach((t, idx) => {
    const col = idx < perCol ? 0 : 1;
    const row = idx < perCol ? idx : idx - perCol;
    const y = startY + row * step;
    const { badge, text } = cols[col];
    setFill(PAL.green); doc.circle(badge, y, 9, 'F');
    setText(PAL.white); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(String(idx + 1), badge, y + 3.2, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5); setText(PAL.dark);
    doc.text(t, text, y + 4, { maxWidth: 300 });
  });

  // separatore teoria / pratica
  setDraw(PAL.sep); doc.setLineWidth(1); doc.line(180, 337, W - 180, 337);

  // --- parte pratica: sessioni svolte + totale ore ---
  ctext(CX, 357, 'PARTE PRATICA  -  SESSIONI SVOLTE', 'helvetica', 'bold', 10, PAL.green);
  band(379, 48, sessioni.map(s => ({ num: s.count, lab: s.label })));
  ctext(CX, 447, 'Totale: ' + orePratica + ' ore di applicazione pratica (stima 1 ora a sessione)', 'helvetica', 'italic', 10, PAL.gray);

  credLine(533);
  ctext(CX, 549, 'Pagina 2 di 2', 'helvetica', 'normal', 8.5, PAL.lgray);

  return doc;
}

// Helper: converte un asset importato (URL) in dataURL base64 per jsPDF.
export async function assetToDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((ok, err) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = err;
    r.readAsDataURL(blob);
  });
}

// Helper: URL "Aggiungi al profilo LinkedIn" (name = "Metodologia MindSell - <corso>")
export function linkedinAddUrl({ idCredenziale, issueYear, issueMonth, verificaUrl, corso = 'Next' }) {
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: 'Metodologia MindSell - ' + corso,
    organizationId: '112490953',
    issueYear: String(issueYear),
    issueMonth: String(issueMonth),
    certId: idCredenziale,
  });
  if (verificaUrl) params.set('certUrl', verificaUrl);
  return 'https://www.linkedin.com/profile/add?' + params.toString();
}
