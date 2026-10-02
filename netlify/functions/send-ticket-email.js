const { Resend } = require('resend')

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { sessionId, eventName, eventDate, eventVenue, eventSlug, fanEmail } = JSON.parse(event.body)

    if (!sessionId || !fanEmail || !eventSlug) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const ticketUrl = `https://covetedstage.com/${eventSlug}/ticket?session_id=${encodeURIComponent(sessionId)}`
    const bookingRef = sessionId.replace('cs_live_', '').replace('cs_test_', '').slice(0, 16).toUpperCase()

    await resend.emails.send({
      from: 'Coveted Stage Tickets <tickets@covetedstage.com>',
      to: fanEmail,
      subject: `Your ticket to ${eventName} 🎭`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#faf8f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:16px;border:1.5px solid #ede8df;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#111;padding:24px 32px;text-align:center;">
              <div style="font-family:Georgia,serif;font-size:13px;color:#888;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px;">Coveted Stage</div>
              <div style="font-family:Georgia,serif;font-size:22px;color:#f0ebe0;font-weight:700;">Your Ticket</div>
            </td>
          </tr>

          <!-- Event info -->
          <tr>
            <td style="padding:28px 32px 20px;">
              <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#111;margin-bottom:12px;">${eventName}</div>
              ${eventDate ? `<div style="font-size:14px;color:#555;margin-bottom:6px;">📅 ${eventDate}</div>` : ''}
              ${eventVenue ? `<div style="font-size:14px;color:#555;margin-bottom:6px;">📍 ${eventVenue}</div>` : ''}
              <div style="font-size:12px;color:#999;font-family:monospace;margin-top:10px;padding:8px 12px;background:#f5f3ef;border-radius:6px;display:inline-block;">
                Ref: ${bookingRef}
              </div>
            </td>
          </tr>

          <!-- QR code -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <div style="background:#e8f7ee;border:1.5px solid #b2dfc5;border-radius:12px;padding:24px;display:inline-block;">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(sessionId)}&bgcolor=e8f7ee&color=1a7a44&margin=4"
                  width="180"
                  height="180"
                  alt="Ticket QR Code"
                  style="display:block;border-radius:8px;"
                />
                <div style="font-family:monospace;font-size:10px;color:#5aaa7a;letter-spacing:0.12em;margin-top:10px;text-transform:uppercase;">Ticket QR Code</div>
              </div>
              <div style="font-size:12px;color:#888;margin-top:12px;line-height:1.6;">
                Show this QR code at the door for entry.<br>
                Screenshot this email or save your ticket link below.
              </div>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:0 32px 28px;text-align:center;">
              <a href="${ticketUrl}" style="display:inline-block;background:#7c5cbf;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-family:monospace;font-size:13px;font-weight:700;letter-spacing:0.12em;">
                🎟 VIEW MY TICKET →
              </a>
              <div style="font-size:11px;color:#aaa;margin-top:10px;">
                Bookmark this link to access your ticket anytime
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5f3ef;border-top:1.5px solid #ede8df;padding:16px 32px;text-align:center;">
              <div style="font-size:11px;color:#aaa;letter-spacing:0.12em;font-family:monospace;">
                COVETED STAGE · THE STAGE IS YOURS ·
                <a href="https://covetedstage.com" style="color:#999;text-decoration:none;">covetedstage.com</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    })

    return { statusCode: 200, headers, body: JSON.stringify({ sent: true }) }
  } catch (err) {
    console.error('send-ticket-email error:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
