export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, subject, htmlContent, senderName } = req.body

  if (!to || !subject || !htmlContent) {
    return res.status(400).json({ error: 'Parametri mancanti: to, subject, htmlContent' })
  }

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'BREVO_API_KEY non configurata' })
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: senderName || 'Mindsell Academy',
          email: 'info@mindsell.it',
        },
        to: to,
        subject: subject,
        htmlContent: htmlContent,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Errore Brevo' })
    }

    return res.status(200).json({ success: true, messageId: data.messageId })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
