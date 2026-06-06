// v2
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { tipo, dati } = req.body;
  if (!tipo || !dati) return res.status(400).json({ error: "Parametri mancanti" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "RESEND_API_KEY non configurata" });

  try {
    let emailData = null;

    if (tipo === "nuovo_lead") {
      const { studenteName, nome, cognome, email, telefono, note } = dati;
      emailData = {
        from: "MindSell Academy <noreply@academy.mindsell.it>",
        to: ["emanuela@mindsell.it"],
        subject: `Nuovo lead segnalato da ${studenteName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#6AB309;padding:20px 24px;border-radius:8px 8px 0 0">
              <h1 style="margin:0;font-size:20px;color:#fff">Nuovo lead ricevuto</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85)">da ${studenteName}</p>
            </div>
            <div style="padding:24px;background:#f9f9f9;border-radius:0 0 8px 8px">
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px 0;color:#666;font-size:13px;width:120px">Nome</td><td style="padding:8px 0;color:#111;font-size:14px;font-weight:600">${nome} ${cognome}</td></tr>
                <tr><td style="padding:8px 0;color:#666;font-size:13px">Email</td><td style="padding:8px 0;color:#111;font-size:14px">${email}</td></tr>
                ${telefono ? `<tr><td style="padding:8px 0;color:#666;font-size:13px">Telefono</td><td style="padding:8px 0;color:#111;font-size:14px">${telefono}</td></tr>` : ""}
                ${note ? `<tr><td style="padding:8px 0;color:#666;font-size:13px">Note</td><td style="padding:8px 0;color:#555;font-size:13px;font-style:italic">${note}</td></tr>` : ""}
              </table>
              <div style="margin-top:20px">
                <a href="https://academy.mindsell.it" style="background:#6AB309;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700">Vai al pannello admin</a>
              </div>
            </div>
          </div>
        `,
      };
    }

    if (!emailData) return res.status(400).json({ error: "Tipo non riconosciuto" });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(emailData),
    });

    const result = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: result.message || "Errore Resend" });

    return res.status(200).json({ ok: true, id: result.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
