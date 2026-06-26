/**
 * Migrazione una-tantum: imposta il campo "ordine" sui moduli del corso Next
 * che lo estraggono dal titolo con regex /Modulo\s+(\d+)/i.
 *
 * Uso:
 *   node migrate-ordine-next.js           → dry-run (nessuna scrittura)
 *   node migrate-ordine-next.js --commit  → scrive su Firestore
 *
 * Requisito: file mindsell-portal-9aca8ce6e9da.json nella stessa cartella.
 */

const admin = require("firebase-admin");
const serviceAccount = require("./mindsell-portal-9aca8ce6e9da.json");

const NEXT_ID = "R7JAQBrnmnSXFC9ew9QW";
const COMMIT = process.argv.includes("--commit");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("libreria").where("corsoId", "==", NEXT_ID).get();

  const toProcess = [];
  const skipped = [];

  snap.forEach(d => {
    const data = d.data();

    if (data.tipo === "webinar") {
      skipped.push({ id: d.id, title: data.title, motivo: "webinar — skip" });
      return;
    }
    if (data.ordine !== undefined) {
      skipped.push({ id: d.id, title: data.title, motivo: `ordine già presente (${data.ordine})` });
      return;
    }

    const match = (data.title || "").match(/Modulo\s+(\d+)/i);
    if (!match) {
      skipped.push({ id: d.id, title: data.title, motivo: "nessun numero trovato nel titolo" });
      return;
    }

    toProcess.push({ id: d.id, title: data.title, ordineCalcolato: parseInt(match[1], 10) });
  });

  toProcess.sort((a, b) => a.ordineCalcolato - b.ordineCalcolato);

  const col = (s, w) => String(s).substring(0, w).padEnd(w);
  const sep = "─".repeat(72);

  console.log(`\n📚 Corso Next (${NEXT_ID}) — ${COMMIT ? "⚠️  COMMIT MODE" : "DRY-RUN"}`);
  console.log(sep);
  console.log(`${col("ID", 24)} ${col("Titolo", 36)} Ordine`);
  console.log(sep);
  toProcess.forEach(r => console.log(`${col(r.id, 24)} ${col(r.title, 36)} ${r.ordineCalcolato}`));
  console.log(sep);
  console.log(`${toProcess.length} moduli da aggiornare.\n`);

  if (skipped.length > 0) {
    console.log("Saltati:");
    skipped.forEach(r => console.log(`  · ${col(r.id, 24)} ${col(r.title, 30)} [${r.motivo}]`));
    console.log();
  }

  if (!COMMIT) {
    console.log("ℹ️  DRY-RUN: nessuna scrittura. Lancia con --commit per applicare.");
    process.exit(0);
  }

  if (toProcess.length === 0) {
    console.log("Nessun documento da aggiornare.");
    process.exit(0);
  }

  const batch = db.batch();
  toProcess.forEach(r => {
    batch.update(db.collection("libreria").doc(r.id), { ordine: r.ordineCalcolato });
  });
  await batch.commit();
  console.log("✅ Scrittura completata.");
}

main().catch(e => { console.error(e); process.exit(1); });
