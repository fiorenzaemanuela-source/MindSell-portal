export default async function handler(req, res) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email mancante" });

  try {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    // JWT token per Google
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const unsigned = `${encode(header)}.${encode(payload)}`;

    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(unsigned);
    const signature = sign.sign(privateKey, "base64url");
    const jwt = `${unsigned}.${signature}`;

    // Ottieni access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return res.status(500).json({ error: "Token fallito", detail: tokenData });

    // Fetch eventi futuri
    const now2 = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${now2}&singleEvents=true&orderBy=startTime&maxResults=50`;
    const eventsRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const eventsData = await eventsRes.json();

    // Filtra eventi dove l'email dello studente è partecipante
    const filtered = (eventsData.items || []).filter(e =>
      (e.attendees || []).some(a => a.email?.toLowerCase() === email.toLowerCase())
    );

    res.status(200).json({ events: filtered });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
