const crypto = require('crypto')

// Cash / check concession orders. No payment is taken online: the order is
// saved as 'awaiting_payment', the buyer gets an itemized email, and pays at
// the stand. Prices are always read from the database, never the browser.

const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAX_QTY_PER_ITEM = 20
const METHOD_LABEL = { cash: 'Cash', check: 'Check' }

function sbHeaders(extra = {}) {
  return { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...extra }
}
async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders() })
  if (!res.ok) throw new Error(`Supabase read failed: ${await res.text()}`)
  return res.json()
}

// e.g. C-7F3KQ2 — no 0/O/1/I to avoid misreading at the stand
function newOrderNumber() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(6)
  return 'C-' + Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildEmailHtml({ buyerName, eventName, eventVenue, orderNumber, items, total, method }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(orderNumber)}&bgcolor=ffffff&color=111111&margin=8`
  const payableTo = process.env.CHECK_PAYABLE_TO
  const howToPay = method === 'check'
    ? `Please bring a check for <strong style="color: #f4f0e8;">$${total.toFixed(2)}</strong>${payableTo ? ` made payable to <strong style="color: #f4f0e8;">${esc(payableTo)}</strong>` : ''} and hand it over at the concessions stand.`
    : `Please pay <strong style="color: #f4f0e8;">$${total.toFixed(2)}</strong> in cash at the concessions stand when you collect your order.`

  const rowsHtml = ['Snacks', 'Beverages'].map(cat => {
    const rows = items.filter(i => i.category === cat)
    if (!rows.length) return ''
    return `
      <tr><td colspan="4" style="padding: 12px 0 4px; color: #c9a84c; font-family: monospace; font-size: 10px; letter-spacing: 0.18em;">${cat.toUpperCase()}</td></tr>
      ${rows.map(r => `
      <tr>
        <td style="padding: 8px 0; color: #9a9690; border-bottom: 1px solid #222;">${esc(r.name)}</td>
        <td style="padding: 8px 0; color: #9a9690; text-align: center; border-bottom: 1px solid #222;">${r.quantity}</td>
        <td style="padding: 8px 0; color: #9a9690; text-align: right; border-bottom: 1px solid #222; font-family: monospace;">$${r.unit_price.toFixed(2)}</td>
        <td style="padding: 8px 0; color: #c9a84c; text-align: right; border-bottom: 1px solid #222; font-family: monospace; font-weight: 700;">$${r.subtotal.toFixed(2)}</td>
      </tr>`).join('')}`
  }).join('')

  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
      <div style="font-size: 28px; color: #c9a84c; margin-bottom: 8px;">Coveted Stage</div>
      <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
      <h2 style="font-size: 22px; color: #f4f0e8; margin-bottom: 12px;">Your order is placed! 🍿</h2>
      <p style="color: #9a9690; line-height: 1.7;">
        Hi ${esc(buyerName || 'there')},<br/><br/>
        Thanks for your concessions order at <strong style="color: #f4f0e8;">${esc(eventName)}</strong>.
        Show your order number or the QR code below at the concessions stand.
      </p>
      ${eventVenue ? `<p style="color: #9a9690; line-height: 1.7;">📍 ${esc(eventVenue)}</p>` : ''}

      <div style="margin: 24px 0; padding: 18px 24px; background: rgba(229,85,85,0.08); border: 1px solid rgba(229,85,85,0.35); border-radius: 10px;">
        <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.18em; color: #e88; margin-bottom: 8px;">PAYMENT DUE AT THE STAND · ${METHOD_LABEL[method].toUpperCase()}</div>
        <div style="color: #9a9690; line-height: 1.7; font-size: 14px;">${howToPay}</div>
      </div>

      <div style="margin: 24px 0; padding: 18px 24px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.25); border-radius: 10px; text-align: center;">
        <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.18em; color: #c9a84c; margin-bottom: 6px;">ORDER NUMBER</div>
        <div style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 0.12em; color: #f4f0e8;">${orderNumber}</div>
      </div>

      <div style="margin: 24px 0; padding: 20px 24px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.25); border-radius: 10px;">
        <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.18em; color: #c9a84c; margin-bottom: 6px;">ORDER SUMMARY</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr>
              <th style="text-align: left; color: #555; font-size: 11px; font-weight: 400; padding: 6px 0; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">ITEM</th>
              <th style="text-align: center; color: #555; font-size: 11px; font-weight: 400; padding: 6px 0; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">QTY</th>
              <th style="text-align: right; color: #555; font-size: 11px; font-weight: 400; padding: 6px 0; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">PRICE</th>
              <th style="text-align: right; color: #555; font-size: 11px; font-weight: 400; padding: 6px 0; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 12px 0 0; color: #c9a84c; font-family: monospace; font-size: 11px; letter-spacing: 0.1em;">TOTAL DUE (${METHOD_LABEL[method].toUpperCase()})</td>
              <td style="padding: 12px 0 0; text-align: right; color: #c9a84c; font-family: monospace; font-weight: 700; font-size: 16px;">$${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="margin: 28px 0; text-align: center;">
        <div style="display: inline-block; padding: 16px; background: #111; border: 1px solid rgba(201,168,76,0.3); border-radius: 12px;">
          <img src="${qrUrl}" width="180" height="180" alt="Order QR Code" style="display: block; border-radius: 8px;" />
          <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.15em; color: #c9a84c; margin-top: 10px;">ORDER QR CODE</div>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #333; margin: 28px 0;" />
      <div style="font-size: 11px; color: #555; font-family: monospace; letter-spacing: 0.1em;">
        COVETED STAGE · THE STAGE IS YOURS
      </div>
    </div>`
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) })

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' })

  try {
    const { eventSlug, items, paymentMethod, buyerName, buyerEmail, buyerPhone, fanId } = JSON.parse(event.body || '{}')

    if (!eventSlug || !/^[a-z0-9-]+$/.test(eventSlug)) return reply(400, { error: 'Missing or invalid event.' })
    if (!METHOD_LABEL[paymentMethod]) return reply(400, { error: 'Choose cash or check.' })

    const name  = String(buyerName  || '').trim().slice(0, 100)
    const email = String(buyerEmail || '').trim().toLowerCase().slice(0, 200)
    const phone = String(buyerPhone || '').trim().slice(0, 30)
    if (!name) return reply(400, { error: 'Please enter your name.' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Please enter a valid email address.' })
    if (!Array.isArray(items) || items.length === 0) return reply(400, { error: 'No items selected.' })

    // ── Event and current menu ───────────────────────────────────────────
    const events = await sbGet(`events?slug=eq.${encodeURIComponent(eventSlug)}&select=id,name,slug,venue`)
    if (!Array.isArray(events) || events.length === 0) return reply(404, { error: 'Event not found.' })
    const ev = events[0]

    const menu = await sbGet(
      `concession_items?event_slug=eq.${encodeURIComponent(eventSlug)}&is_available=eq.true&select=id,name,category,price`
    )
    const menuById = Object.fromEntries((menu || []).map(m => [m.id, m]))

    const lines = []
    let totalCents = 0
    for (const sel of items) {
      const qty = Math.min(MAX_QTY_PER_ITEM, Math.max(0, parseInt(sel?.quantity) || 0))
      if (qty < 1) continue
      const m = menuById[sel?.id]
      if (!m) {
        return reply(409, { error: 'Some items in your order are no longer available. Please refresh the menu and try again.' })
      }
      const unitCents = Math.round(parseFloat(m.price) * 100)
      lines.push({
        name: m.name, category: m.category, quantity: qty,
        unit_price: unitCents / 100, subtotal: (unitCents * qty) / 100,
      })
      totalCents += unitCents * qty
    }
    if (lines.length === 0) return reply(400, { error: 'No items selected.' })
    const total = totalCents / 100

    // ── Save order ───────────────────────────────────────────────────────
    const orderNumber = newOrderNumber()
    const insRes = await fetch(`${SB_URL}/rest/v1/concession_orders`, {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify({
        stripe_session_id: null,
        order_number:   orderNumber,
        event_id:       String(ev.id),
        event_slug:     ev.slug,
        fan_id:         fanId || null,
        buyer_name:     name,
        buyer_email:    email,
        buyer_phone:    phone || null,
        items:          lines,
        amount:         total,
        payment_method: paymentMethod,
        status:         'awaiting_payment',
      }),
    })
    if (!insRes.ok) throw new Error(`Supabase insert failed: ${await insRes.text()}`)
    const [saved] = await insRes.json()
    console.log(`Concession ${paymentMethod} order saved: ${orderNumber} — $${total.toFixed(2)}`)

    // ── Email (an order is still valid if the email fails) ───────────────
    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Coveted Stage <hello@covetedstage.com>',
            to: email,
            subject: `Your concessions order ${orderNumber} for ${ev.name} — pay $${total.toFixed(2)} at the stand`,
            html: buildEmailHtml({
              buyerName: name, eventName: ev.name, eventVenue: ev.venue,
              orderNumber, items: lines, total, method: paymentMethod,
            }),
          }),
        })
        if (res.ok) console.log('Concession offline email sent to:', email)
        else console.error('Concession offline email FAILED:', res.status, await res.text())
      } catch (e) {
        console.error('Concession offline email error:', e.message)
      }
    }

    return reply(200, { orderId: saved.id, orderNumber })
  } catch (err) {
    console.error('Concessions offline order error:', err.message)
    return reply(500, { error: 'Could not place your order. Please try again.' })
  }
}
