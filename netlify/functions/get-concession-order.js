const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// Returns the itemized order for the confirmation screen.
//   ?session_id=cs_...  → card order, read straight from Stripe (works even
//                         before the webhook has finished saving it)
//   ?order=<uuid>       → cash / check order, read from Supabase

const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function orderNumberFor(sessionId) {
  return 'C-' + sessionId.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) })

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }

  const qs        = event.queryStringParameters || {}
  const sessionId = qs.session_id || ''
  const orderId   = qs.order || ''
  const eventSlug = qs.event || ''

  try {
    // ── Cash / check order ───────────────────────────────────────────────
    if (orderId) {
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply(400, { error: 'Invalid order reference.' })
      const res = await fetch(
        `${SB_URL}/rest/v1/concession_orders?id=eq.${orderId}` +
        `&select=order_number,event_slug,buyer_email,items,amount,payment_method,status`,
        { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
      )
      const rows = await res.json()
      const o = Array.isArray(rows) && rows[0]
      if (!o || (eventSlug && o.event_slug !== eventSlug)) return reply(404, { error: 'Order not found.' })
      return reply(200, {
        orderNumber:   o.order_number,
        email:         o.buyer_email,
        items:         (o.items || []).map(i => ({
          name: i.name, category: i.category, quantity: i.quantity,
          unitPrice: i.unit_price, subtotal: i.subtotal,
        })),
        total:         parseFloat(o.amount),
        paymentMethod: o.payment_method,
        status:        o.status,
      })
    }

    // ── Card order ───────────────────────────────────────────────────────
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) {
      return reply(400, { error: 'Invalid order reference.' })
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.type !== 'concession_purchase' ||
        (eventSlug && session.metadata?.event_slug !== eventSlug)) {
      return reply(404, { error: 'Order not found.' })
    }
    if (session.payment_status !== 'paid') {
      return reply(402, { error: 'Payment not completed.' })
    }

    const li = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ['data.price.product'],
    })

    return reply(200, {
      orderNumber:   orderNumberFor(session.id),
      email:         session.customer_details?.email || null,
      items:         li.data.map(l => ({
        name:      l.price?.product?.metadata?.item_name || l.description,
        category:  l.price?.product?.metadata?.category || 'Snacks',
        quantity:  l.quantity,
        unitPrice: (l.price?.unit_amount || 0) / 100,
        subtotal:  (l.amount_total || 0) / 100,
      })),
      total:         (session.amount_total || 0) / 100,
      paymentMethod: 'card',
      status:        'paid',
    })
  } catch (err) {
    console.error('get-concession-order error:', err.message)
    return reply(500, { error: 'Could not load your order.' })
  }
}
