const Stripe = require('stripe')

// ── Native Supabase REST helpers (no JS client = no WebSocket crash) ─────────
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Prefer': 'resolution=merge-duplicates',
  }
}

async function sbUpsert(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase upsert ${table} failed: ${err}`)
  }
  return res
}

async function sbUpdate(table, data, filterCol, filterVal) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filterCol}=eq.${filterVal}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase update ${table} failed: ${err}`)
  }
  return res
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Verify Stripe signature
  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return { statusCode: 400, body: `Webhook error: ${err.message}` }
  }

  console.log('Stripe event type:', stripeEvent.type)

  // ── checkout.session.completed ─────────────────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    console.log('Session metadata:', JSON.stringify(session.metadata))

    // ── Ticket purchase ────────────────────────────────────────────────────
    if (session.metadata?.type === 'ticket_purchase') {
      const { event_id, fan_id } = session.metadata
      console.log('Ticket purchase — event:', event_id, 'fan:', fan_id)

      try {
        await sbUpsert('ticket_purchases', {
          event_id,
          fan_id,
          stripe_session_id: session.id,
          amount: session.amount_total / 100,
          status: 'paid',
        })
        await sbUpsert('rsvps', { event_id, fan_id })
        console.log('Ticket purchase + RSVP recorded')
      } catch (err) {
        console.error('Ticket purchase error:', err.message)
        return { statusCode: 500, body: err.message }
      }

      return { statusCode: 200, body: JSON.stringify({ received: true }) }
    }

    // ── Subscription purchase ──────────────────────────────────────────────
    const { fan_id, creator_id } = session.metadata || {}

    if (!fan_id || !creator_id) {
      console.error('Missing metadata — fan_id:', fan_id, 'creator_id:', creator_id)
      return { statusCode: 400, body: 'Missing metadata' }
    }

    console.log('Upserting subscription — fan:', fan_id, 'creator:', creator_id)

    try {
      await sbUpsert('subscriptions', {
        fan_id,
        creator_id,
        stripe_subscription_id: session.subscription,
        status: 'active',
      })
      console.log('Subscription created successfully')
    } catch (err) {
      console.error('Subscription upsert error:', err.message)
      return { statusCode: 500, body: err.message }
    }
  }

  // ── customer.subscription.deleted / paused ─────────────────────────────────
  if (
    stripeEvent.type === 'customer.subscription.deleted' ||
    stripeEvent.type === 'customer.subscription.paused'
  ) {
    const subscription = stripeEvent.data.object
    console.log('Cancelling subscription:', subscription.id)

    try {
      await sbUpdate('subscriptions', { status: 'cancelled' }, 'stripe_subscription_id', subscription.id)
      console.log('Subscription cancelled')
    } catch (err) {
      console.error('Cancel subscription error:', err.message)
      return { statusCode: 500, body: err.message }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
