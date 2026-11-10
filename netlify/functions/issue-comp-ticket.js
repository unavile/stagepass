const crypto = require('crypto')

// Issues complimentary tickets (and lists the ones already issued).
// Protected by COMP_ISSUE_PASSWORD, checked here on the server.
//
// POST { password, eventSlug, action: 'list' }
// POST { password, eventSlug, action: 'issue', guestName, guestEmail, quantity, category, note, sendEmail }
// POST { password, eventSlug, action: 'resend', id }

const SB_URL   = process.env.SUPABASE_URL
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE_URL = process.env.URL || 'https://covetedstage.com'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sbHeaders(extra = {}) {
  return { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...extra }
}
async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { ...opts, headers: sbHeaders(opts.headers) })
  if (!res.ok) throw new Error(`Supabase ${opts.method || 'GET'} ${path.split('?')[0]} failed: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

function passwordOk(given) {
  const expected = process.env.COMP_ISSUE_PASSWORD
  if (!expected || typeof given !== 'string') return false
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

// comp_ + 20 chars, no look-alike characters
function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return 'comp_' + Array.from(crypto.randomBytes(20), b => alphabet[b % alphabet.length]).join('')
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function formatEventDate(dateStr, timeStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.toLocaleDateString('en-US', { weekday: 'long' })
  const md  = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  if (!timeStr) return `${day}, ${md}`
  const [h, min] = timeStr.split(':').map(Number)
  const minStr = min === 0 ? '' : `:${String(min).padStart(2, '0')}`
  return `${day}, ${md} · ${h % 12 || 12}${minStr} ${h >= 12 ? 'PM' : 'AM'}`
}

async function sendTicketEmail(ticket, ev) {
  if (!ticket.guest_email || !process.env.RESEND_API_KEY) return false
  const ticketUrl = `${SITE_URL}/${ev.slug}/ticket?session_id=${encodeURIComponent(ticket.code)}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticket.code)}&bgcolor=ffffff&color=111111&margin=8`
  const dateDisplay = formatEventDate(ev.event_date, ev.start_time)
  const qty = ticket.quantity

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Coveted Stage <hello@covetedstage.com>',
      to: ticket.guest_email,
      subject: `Your complimentary ${qty > 1 ? qty + ' tickets' : 'ticket'} for ${ev.name} 🎟`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
          <div style="font-size: 28px; color: #c9a84c; margin-bottom: 8px;">Coveted Stage</div>
          <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
          <h2 style="font-size: 22px; color: #f4f0e8; margin-bottom: 12px;">You're invited! 🎉</h2>
          <p style="color: #9a9690; line-height: 1.7;">
            Hi ${esc(ticket.guest_name)},<br/><br/>
            You have ${qty > 1 ? `<strong style="color: #f4f0e8;">${qty} complimentary tickets</strong>` : 'a <strong style="color: #f4f0e8;">complimentary ticket</strong>'}
            for <strong style="color: #f4f0e8;">${esc(ev.name)}</strong>. We look forward to seeing you there.
          </p>
          ${dateDisplay ? `<p style="color: #9a9690; line-height: 1.7;">📅 ${esc(dateDisplay)}</p>` : ''}
          ${ev.venue ? `<p style="color: #9a9690; line-height: 1.7;">📍 ${esc(ev.venue)}</p>` : ''}

          <div style="margin: 24px 0; padding: 20px 24px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.25); border-radius: 10px;">
            <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.18em; color: #c9a84c; margin-bottom: 10px;">YOUR TICKETS</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #9a9690;">${esc(ticket.ticket_category)}</td>
                <td style="padding: 6px 0; color: #9a9690; text-align: center;">× ${qty}</td>
                <td style="padding: 6px 0; color: #c9a84c; text-align: right; font-family: monospace; font-weight: 700;">Complimentary</td>
              </tr>
            </table>
          </div>

          <div style="margin: 28px 0; text-align: center;">
            <div style="display: inline-block; padding: 16px; background: #111; border: 1px solid rgba(201,168,76,0.3); border-radius: 12px;">
              <img src="${qrUrl}" width="180" height="180" alt="Ticket QR Code" style="display: block; border-radius: 8px;" />
              <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.15em; color: #c9a84c; margin-top: 10px;">TICKET QR CODE</div>
            </div>
            <p style="color: #555; font-size: 12px; margin-top: 12px; line-height: 1.6;">
              Show this QR code at the door for entry.<br/>
              ${qty > 1 ? `One scan covers all ${qty} tickets.` : ''}
            </p>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${ticketUrl}" style="display: inline-block; background: #c9a84c; color: #09090b; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-family: monospace; font-size: 13px; font-weight: 700; letter-spacing: 0.12em;">
              🎟 VIEW MY TICKET →
            </a>
            <p style="color: #555; font-size: 11px; margin-top: 10px;">Bookmark this link to access your ticket anytime</p>
          </div>

          <hr style="border: none; border-top: 1px solid #333; margin: 28px 0;" />
          <div style="font-size: 11px; color: #555; font-family: monospace; letter-spacing: 0.1em;">
            COVETED STAGE · THE STAGE IS YOURS
          </div>
        </div>`,
    }),
  })
  if (!res.ok) {
    console.error('Comp ticket email FAILED:', res.status, await res.text())
    return false
  }
  console.log('Comp ticket email sent to:', ticket.guest_email)
  return true
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' }
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) })
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' })

  try {
    const body = JSON.parse(event.body || '{}')
    if (!process.env.COMP_ISSUE_PASSWORD) {
      return reply(500, { error: 'COMP_ISSUE_PASSWORD is not set in Netlify.' })
    }
    if (!passwordOk(body.password)) return reply(401, { error: 'Incorrect password.' })

    const slug = String(body.eventSlug || '')
    if (!/^[a-z0-9-]+$/.test(slug)) return reply(400, { error: 'Invalid event.' })
    const events = await sb(`events?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug,event_date,start_time,venue`)
    if (!events?.length) return reply(404, { error: 'Event not found.' })
    const ev = events[0]

    const action = body.action || 'list'

    // ── List ────────────────────────────────────────────────────────────
    if (action === 'list') {
      const rows = await sb(
        `comp_tickets?event_slug=eq.${encodeURIComponent(slug)}` +
        `&select=id,code,guest_name,guest_email,quantity,ticket_category,note,email_sent,revoked,created_at&order=created_at.desc`
      )
      return reply(200, { event: { name: ev.name, slug: ev.slug }, tickets: rows })
    }

    // ── Resend email ────────────────────────────────────────────────────
    if (action === 'resend') {
      const rows = await sb(`comp_tickets?id=eq.${encodeURIComponent(body.id)}&event_slug=eq.${encodeURIComponent(slug)}&select=*`)
      const t = rows?.[0]
      if (!t) return reply(404, { error: 'Ticket not found.' })
      if (!t.guest_email) return reply(400, { error: 'This ticket has no email address.' })
      const sent = await sendTicketEmail(t, ev)
      if (sent) await sb(`comp_tickets?id=eq.${t.id}`, { method: 'PATCH', body: JSON.stringify({ email_sent: true }) })
      return reply(sent ? 200 : 502, sent ? { ok: true } : { error: 'Email could not be sent.' })
    }

    // ── Issue ───────────────────────────────────────────────────────────
    if (action !== 'issue') return reply(400, { error: 'Unknown action.' })

    const guestName  = String(body.guestName  || '').trim().slice(0, 100)
    const guestEmail = String(body.guestEmail || '').trim().toLowerCase().slice(0, 200)
    const quantity   = parseInt(body.quantity, 10)
    const category   = String(body.category || 'Complimentary').trim().slice(0, 60) || 'Complimentary'
    const note       = String(body.note || '').trim().slice(0, 200)
    const sendEmail  = body.sendEmail !== false

    if (!guestName) return reply(400, { error: "Enter the guest's name." })
    if (guestEmail && !EMAIL_RE.test(guestEmail)) return reply(400, { error: 'Enter a valid email address.' })
    if (sendEmail && !guestEmail) return reply(400, { error: 'Enter an email address, or untick "Email the ticket".' })
    if (!(quantity >= 1 && quantity <= 20)) return reply(400, { error: 'Quantity must be between 1 and 20.' })

    const [ticket] = await sb('comp_tickets', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        code: newCode(), event_id: String(ev.id), event_slug: ev.slug,
        guest_name: guestName, guest_email: guestEmail || null,
        quantity, ticket_category: category, note: note || null,
      }),
    })
    console.log(`Comp ticket issued: ${ticket.code} — ${guestName} ×${quantity} for ${ev.slug}`)

    let emailSent = false
    if (sendEmail) {
      try { emailSent = await sendTicketEmail(ticket, ev) } catch (e) { console.error('Comp email error:', e.message) }
      if (emailSent) await sb(`comp_tickets?id=eq.${ticket.id}`, { method: 'PATCH', body: JSON.stringify({ email_sent: true }) })
    }

    return reply(200, {
      ticket: { ...ticket, email_sent: emailSent },
      ticketUrl: `${SITE_URL}/${ev.slug}/ticket?session_id=${encodeURIComponent(ticket.code)}`,
      emailSent,
    })
  } catch (err) {
    console.error('issue-comp-ticket error:', err.message)
    return reply(500, { error: 'Something went wrong. Please try again.' })
  }
}
