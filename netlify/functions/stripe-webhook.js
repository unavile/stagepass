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

async function sbUpsert(table, data, onConflict) {
  const url = onConflict
    ? `${SB_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`
    : `${SB_URL}/rest/v1/${table}`
  const res = await fetch(url, {
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

    // ── Donation ───────────────────────────────────────────────────────────
    if (session.metadata?.type === 'donation') {
      const { creator_id, fan_id, creator_name } = session.metadata
      const amountDollars = (session.amount_total / 100).toFixed(2)
      console.log('Donation received — creator:', creator_id, 'amount: $' + amountDollars)

      // Send thank-you email to fan via Resend
      try {
        const fanEmail = session.customer_details?.email
        if (fanEmail && process.env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Coveted Stage <hello@covetedstage.com>',
              to: fanEmail,
              subject: `Thank you for supporting ${creator_name}!`,
              html: `
                <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
                  <div style="font-size: 28px; color: #c9a84c; margin-bottom: 8px;">Coveted Stage</div>
                  <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
                  <h2 style="font-size: 22px; color: #f4f0e8; margin-bottom: 12px;">Thank you for your support! 💛</h2>
                  <p style="color: #9a9690; line-height: 1.7;">
                    Your donation of <strong style="color: #c9a84c;">$${amountDollars}</strong> to
                    <strong style="color: #f4f0e8;">${creator_name}</strong> has been received.
                    Your generosity helps creators like ${creator_name} continue making amazing content.
                  </p>
                  <p style="color: #9a9690; line-height: 1.7;">
                    You can keep following ${creator_name} and discover more creators at
                    <a href="https://covetedstage.com" style="color: #c9a84c;">covetedstage.com</a>.
                  </p>
                  <hr style="border: none; border-top: 1px solid #333; margin: 28px 0;" />
                  <div style="font-size: 11px; color: #555; font-family: monospace; letter-spacing: 0.1em;">
                    COVETED STAGE · THE STAGE IS YOURS
                  </div>
                </div>
              `,
            }),
          })
          console.log('Donation thank-you email sent to:', fanEmail)
        }
      } catch (emailErr) {
        console.error('Donation email error:', emailErr.message)
        // Don't fail the webhook if email fails
      }

      return { statusCode: 200, body: JSON.stringify({ received: true }) }
    }

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
        }, 'event_id,fan_id')
        await sbUpsert('rsvps', { event_id, fan_id }, 'event_id,fan_id')
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
      }, 'fan_id,creator_id')
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
