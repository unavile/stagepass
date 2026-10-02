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

    // ── Class registration ────────────────────────────────────────────────
    if (session.metadata?.type === 'class_registration') {
      const { event_id, fan_id, tier } = session.metadata
      console.log('Class registration — event:', event_id, 'fan:', fan_id, 'tier:', tier)

      try {
        // Check for existing row (reactivate if cancelled)
        const existingRes = await fetch(
          `${SB_URL}/rest/v1/class_registrations?event_id=eq.${event_id}&fan_id=eq.${fan_id}`,
          { headers: sbHeaders() }
        )
        const existing = await existingRes.json()

        if (Array.isArray(existing) && existing.length > 0) {
          await sbUpdate('class_registrations', {
            status: 'active',
            tier: parseInt(tier),
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
            cancelled_at: null,
          }, 'event_id,fan_id', `${event_id}&fan_id=eq.${fan_id}`)
        } else {
          await sbUpsert('class_registrations', {
            event_id,
            fan_id,
            tier: parseInt(tier),
            fan_email: session.customer_details?.email,
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
            status: 'active',
          }, 'event_id,fan_id')
        }
        console.log('Class registration recorded')
      } catch (err) {
        console.error('Class registration error:', err.message)
        return { statusCode: 500, body: err.message }
      }

      return { statusCode: 200, body: JSON.stringify({ received: true }) }
    }

    // ── Ticket purchase ────────────────────────────────────────────────────
    if (session.metadata?.type === 'ticket_purchase') {
      const { event_id, fan_id, quantity, ticket_category } = session.metadata
      // fan_id is empty string for guests — treat as null
      const fanIdOrNull = fan_id && fan_id.trim() !== '' ? fan_id : null
      const qty = parseInt(quantity) || 1

      // Capture buyer details from Stripe customer_details
      const buyerName  = session.customer_details?.name  || null
      const buyerEmail = session.customer_details?.email || null
      const buyerPhone = session.customer_details?.phone || null

      console.log('Ticket purchase — event:', event_id, 'fan:', fanIdOrNull || 'guest', 'qty:', qty, 'buyer:', buyerEmail)

      try {
        // Use stripe_session_id as the unique conflict key so guest purchases
        // (which have no fan_id) can be upserted safely.
        await sbUpsert('ticket_purchases', {
          event_id,
          fan_id:            fanIdOrNull,
          stripe_session_id: session.id,
          amount:            session.amount_total / 100,  // total paid (price × qty)
          quantity:          qty,
          status:            'paid',
          buyer_name:        buyerName,
          buyer_email:       buyerEmail,
          buyer_phone:       buyerPhone,
          ticket_category:   ticket_category || null,
        }, 'stripe_session_id')

        // Only create an RSVP row for logged-in fans (guests have no fan account)
        if (fanIdOrNull) {
          await sbUpsert('rsvps', { event_id, fan_id: fanIdOrNull }, 'event_id,fan_id')
        }

        console.log('Ticket purchase recorded')
      } catch (err) {
        console.error('Ticket purchase error:', err.message)
        return { statusCode: 500, body: err.message }
      }

      // Send ticket confirmation email to buyer
      if (buyerEmail && process.env.RESEND_API_KEY) {
        try {
          // Fetch event name and slug from Supabase for the email
          let eventName = 'the event'
          let eventSlug = ''
          let eventDate = ''
          let eventVenue = ''
          try {
            const evRes = await fetch(
              `${SB_URL}/rest/v1/events?id=eq.${event_id}&select=name,slug,event_date,start_time,venue`,
              { headers: sbHeaders() }
            )
            const evData = await evRes.json()
            if (Array.isArray(evData) && evData[0]) {
              eventName  = evData[0].name  || eventName
              eventSlug  = evData[0].slug  || ''
              eventVenue = evData[0].venue || ''
              // Format date
              if (evData[0].event_date) {
                const [y, m, d] = evData[0].event_date.split('-').map(Number)
                const dateObj = new Date(y, m - 1, d)
                const dayName  = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
                const monthDay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                if (evData[0].start_time) {
                  const [h, min] = evData[0].start_time.split(':').map(Number)
                  const ampm = h >= 12 ? 'PM' : 'AM'
                  const h12  = h % 12 || 12
                  const minStr = min === 0 ? '' : `:${String(min).padStart(2, '0')}`
                  eventDate = `${dayName}, ${monthDay} · ${h12}${minStr} ${ampm}`
                } else {
                  eventDate = `${dayName}, ${monthDay}`
                }
              }
            }
          } catch (evErr) {
            console.error('Event fetch error:', evErr.message)
          }

          const ticketUrl = eventSlug
            ? `https://covetedstage.com/${eventSlug}/ticket?session_id=${encodeURIComponent(session.id)}`
            : null
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(session.id)}&bgcolor=09090b&color=c9a84c&margin=6`

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Coveted Stage <hello@covetedstage.com>',
              to: buyerEmail,
              subject: `Your ${qty > 1 ? qty + ' tickets' : 'ticket'} for ${eventName} ${qty > 1 ? 'are' : 'is'} confirmed! 🎟`,
              html: `
                <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
                  <div style="font-size: 28px; color: #c9a84c; margin-bottom: 8px;">Coveted Stage</div>
                  <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
                  <h2 style="font-size: 22px; color: #f4f0e8; margin-bottom: 12px;">You're going! 🎉</h2>
                  <p style="color: #9a9690; line-height: 1.7;">
                    Hi ${buyerName || 'there'},<br/><br/>
                    Your ${qty > 1 ? `<strong style="color: #c9a84c;">${qty} tickets</strong>` : 'ticket'} for
                    <strong style="color: #f4f0e8;">${eventName}</strong> ${qty > 1 ? 'have' : 'has'} been confirmed.
                    Your payment of <strong style="color: #c9a84c;">$${(session.amount_total / 100).toFixed(2)}</strong>${qty > 1 ? ` (${qty} × $${(session.amount_total / 100 / qty).toFixed(2)})` : ''} was received successfully.
                  </p>

                  ${eventDate ? `<p style="color: #9a9690; line-height: 1.7;">📅 ${eventDate}</p>` : ''}
                  ${eventVenue ? `<p style="color: #9a9690; line-height: 1.7;">📍 ${eventVenue}</p>` : ''}

                  <!-- QR code -->
                  <div style="margin: 28px 0; text-align: center;">
                    <div style="display: inline-block; padding: 16px; background: #111; border: 1px solid rgba(201,168,76,0.3); border-radius: 12px;">
                      <img
                        src="${qrUrl}"
                        width="180"
                        height="180"
                        alt="Ticket QR Code"
                        style="display: block; border-radius: 8px;"
                      />
                      <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.15em; color: #c9a84c; margin-top: 10px;">TICKET QR CODE</div>
                    </div>
                    <p style="color: #555; font-size: 12px; margin-top: 12px; line-height: 1.6;">
                      Show this QR code at the door for entry.<br/>
                      Screenshot this email or use the button below to access your ticket anytime.
                    </p>
                  </div>

                  <!-- Booking reference -->
                  <div style="margin: 28px 0; padding: 20px 24px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.25); border-radius: 10px;">
                    <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.18em; color: #c9a84c; margin-bottom: 8px;">BOOKING REFERENCE</div>
                    <div style="font-family: monospace; font-size: 13px; color: #f4f0e8; word-break: break-all;">${session.id}</div>
                  </div>

                  <!-- View ticket CTA -->
                  ${ticketUrl ? `
                  <div style="text-align: center; margin: 28px 0;">
                    <a href="${ticketUrl}" style="display: inline-block; background: #c9a84c; color: #09090b; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-family: monospace; font-size: 13px; font-weight: 700; letter-spacing: 0.12em;">
                      🎟 VIEW MY TICKET →
                    </a>
                    <p style="color: #555; font-size: 11px; margin-top: 10px;">Bookmark this link to access your ticket anytime</p>
                  </div>
                  ` : ''}

                  <hr style="border: none; border-top: 1px solid #333; margin: 28px 0;" />
                  <div style="font-size: 11px; color: #555; font-family: monospace; letter-spacing: 0.1em;">
                    COVETED STAGE · THE STAGE IS YOURS
                  </div>
                </div>
              `,
            }),
          })
          console.log('Ticket confirmation email sent to:', buyerEmail)
        } catch (emailErr) {
          console.error('Ticket email error:', emailErr.message)
          // Don't fail the webhook if email fails
        }
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
      // Cancel creator subscription
      await sbUpdate('subscriptions', { status: 'cancelled' }, 'stripe_subscription_id', subscription.id)
      // Also cancel class registration if this was a class sub
      await fetch(`${SB_URL}/rest/v1/class_registrations?stripe_subscription_id=eq.${subscription.id}`, {
        method: 'PATCH',
        headers: sbHeaders(),
        body: JSON.stringify({ status: 'cancelled', cancelled_at: new Date().toISOString() }),
      })
      console.log('Subscription/registration cancelled')
    } catch (err) {
      console.error('Cancel subscription error:', err.message)
      return { statusCode: 500, body: err.message }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
