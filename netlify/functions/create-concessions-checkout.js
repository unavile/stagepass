const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// Prices are always read from the database here, never taken from the browser.
const SB_URL   = process.env.SUPABASE_URL
const SB_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE_URL = process.env.URL || 'https://covetedstage.com'
const MAX_QTY_PER_ITEM = 20

async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase read failed: ${await res.text()}`)
  return res.json()
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
    const { eventSlug, items, fanId, fanEmail } = JSON.parse(event.body || '{}')

    if (!eventSlug || !/^[a-z0-9-]+$/.test(eventSlug)) {
      return reply(400, { error: 'Missing or invalid event.' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return reply(400, { error: 'No items selected.' })
    }

    // ── Event ────────────────────────────────────────────────────────────
    const events = await sbGet(`events?slug=eq.${encodeURIComponent(eventSlug)}&select=id,name,slug`)
    if (!Array.isArray(events) || events.length === 0) {
      return reply(404, { error: 'Event not found.' })
    }
    const ev = events[0]

    // ── Current menu (available items only) ──────────────────────────────
    const menu = await sbGet(
      `concession_items?event_slug=eq.${encodeURIComponent(eventSlug)}&is_available=eq.true&select=id,name,category,price`
    )
    const menuById = Object.fromEntries((menu || []).map(m => [m.id, m]))

    const lineItems = []
    let totalCents = 0
    let unavailable = false

    for (const sel of items) {
      const qty = Math.min(MAX_QTY_PER_ITEM, Math.max(0, parseInt(sel?.quantity) || 0))
      if (qty < 1) continue
      const m = menuById[sel?.id]
      if (!m) { unavailable = true; continue }

      const unitCents = Math.round(parseFloat(m.price) * 100)
      if (!(unitCents > 0)) { unavailable = true; continue }

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: m.name,
            description: `${m.category} · ${ev.name}`,
            // Read back by the webhook to build the itemized receipt
            metadata: { item_id: m.id, item_name: m.name, category: m.category },
          },
          unit_amount: unitCents,
        },
        quantity: qty,
      })
      totalCents += unitCents * qty
    }

    if (unavailable) {
      return reply(409, { error: 'Some items in your order are no longer available. Please refresh the menu and try again.' })
    }
    if (lineItems.length === 0) {
      return reply(400, { error: 'No items selected.' })
    }
    if (totalCents < 50) {
      return reply(400, { error: 'The minimum order is $0.50.' })
    }

    // ── Stripe Checkout session ──────────────────────────────────────────
    const pageUrl = `${SITE_URL}/${ev.slug}/concessions`
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata: {
        type: 'concession_purchase',
        event_id: String(ev.id),
        event_slug: ev.slug,
        fan_id: fanId || '',
      },
      // {CHECKOUT_SESSION_ID} is replaced by Stripe at redirect time
      success_url: `${pageUrl}?purchased=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: pageUrl,
    }
    if (fanEmail) sessionParams.customer_email = fanEmail

    const session = await stripe.checkout.sessions.create(sessionParams)
    return reply(200, { url: session.url })
  } catch (err) {
    console.error('Concessions checkout error:', err.message)
    return reply(500, { error: 'Could not start checkout. Please try again.' })
  }
}
