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

// ── Fee helper ────────────────────────────────────────────────────────────────
async function calcFees(stripe, gross, paymentIntentId) {
  const PLATFORM_RATE = 0.10
  let stripeFee = parseFloat((gross * 0.029 + 0.30).toFixed(2))

  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
      })
      const bt = pi.latest_charge?.balance_transaction
      if (bt && bt.fee != null) {
        stripeFee = parseFloat((bt.fee / 100).toFixed(2))
      }
    } catch (e) {
      console.warn('Could not fetch balance_transaction, using estimate:', e.message)
    }
  }

  const platformFee = parseFloat((gross * PLATFORM_RATE).toFixed(2))
  const netAmount   = parseFloat((gross - platformFee - stripeFee).toFixed(2))
  return { stripeFee, platformFee, netAmount }
}

// ── Add-to-calendar HTML block ────────────────────────────────────────────────
function calendarBlock(eventDate, startTime, eventName, venue, sessionId) {
  if (!eventDate) return ''
  const rawDate  = eventDate.replace(/-/g, '')
  const rawTime  = (startTime || '00:00:00').replace(/:/g, '').slice(0, 6)
  const startHr  = parseInt(rawTime.slice(0, 2), 10)
  const endHr    = String((startHr + 2) % 24).padStart(2, '0')
  const endTime  = endHr + rawTime.slice(2)

  const gcal = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
    action:   'TEMPLATE',
    text:     eventName,
    dates:    `${rawDate}T${rawTime}/${rawDate}T${endTime}`,
    location: venue || '',
    details:  `Your ticket to ${eventName} on Coveted Stage`,
  }).toString()

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Coveted Stage//EN',
    'BEGIN:VEVENT',
    `UID:${sessionId}@covetedstage.com`,
    `DTSTART:${rawDate}T${rawTime}`,
    `DTEND:${rawDate}T${endTime}`,
    `SUMMARY:${eventName}`,
    `LOCATION:${venue || ''}`,
    `DESCRIPTION:Your ticket to ${eventName} on Coveted Stage`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const ics = encodeURIComponent(icsLines)

  return `
    <div style="text-align: center; margin: 20px 0 28px;">
      <p style="color: #555; font-size: 12px; margin: 0 0 10px; font-family: monospace; letter-spacing: 0.1em; text-transform: uppercase;">Add to Calendar</p>
      <a href="${gcal}" target="_blank"
         style="display: inline-block; margin: 0 5px; padding: 9px 18px; background: #4285F4; color: #fff; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px; font-family: monospace;">
        📅 Google Calendar
      </a>
      <a href="data:text/calendar;charset=utf-8,${ics}"
         style="display: inline-block; margin: 0 5px; padding: 9px 18px; background: #444; color: #fff; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px; font-family: monospace;">
        📥 Apple / Outlook
      </a>
    </div>`
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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
      const grossAmount   = session.amount_total / 100
      const amountDollars = grossAmount.toFixed(2)
      const { stripeFee, platformFee, netAmount } = await calcFees(stripe, grossAmount, session.payment_intent)

      try {
        await sbUpsert('donations', {
          creator_id,
          fan_id:            fan_id || null,
          stripe_session_id: session.id,
          amount:            grossAmount,
          stripe_fee:        stripeFee,
          platform_fee:      platformFee,
          net_amount:        netAmount,
          status:            'paid',
          donor_email:       session.customer_details?.email || null,
          donor_name:        session.customer_details?.name  || null,
        }, 'stripe_session_id')
        console.log(`Donation recorded — gross: $${grossAmount}, stripe: $${stripeFee}, platform: $${platformFee}, net: $${netAmount}`)
      } catch (donErr) {
        console.error('Donation upsert error:', donErr.message)
      }
      console.log('Donation received — creator:', creator_id, 'amount: $' + amountDollars)

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
      }

      return { statusCode: 200, body: JSON.stringify({ received: true }) }
    }

    // ── Class registration ────────────────────────────────────────────────
    if (session.metadata?.type === 'class_registration') {
      const { event_id, fan_id, tier } = session.metadata
      console.log('Class registration — event:', event_id, 'fan:', fan_id, 'tier:', tier)

      try {
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
          let classStripeFee = null, classPlatformFee = null, classNet = null
          if (session.amount_total) {
            const classGross = session.amount_total / 100
            ;({ stripeFee: classStripeFee, platformFee: classPlatformFee, netAmount: classNet } =
              await calcFees(stripe, classGross, session.payment_intent))
          }

          await sbUpsert('class_registrations', {
            event_id,
            fan_id,
            tier: parseInt(tier),
            fan_email: session.customer_details?.email,
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
            status: 'active',
            stripe_fee:   classStripeFee,
            platform_fee: classPlatformFee,
            net_amount:   classNet,
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
      const { event_id, fan_id, quantity, ticket_categories: ticketCategoriesJson } = session.metadata
      const fanIdOrNull = fan_id && fan_id.trim() !== '' ? fan_id : null
      const totalQty = parseInt(quantity) || 1

      let ticketCategories = []
      try {
        ticketCategories = JSON.parse(ticketCategoriesJson || '[]')
      } catch (_) {}
      if (!ticketCategories.length) {
        ticketCategories = [{
          name: session.metadata.ticket_category || 'General Admission',
          price: session.amount_total / 100 / totalQty,
          quantity: totalQty,
        }]
      }

      const buyerName  = session.customer_details?.name  || null
      const buyerEmail = session.customer_details?.email || null
      const buyerPhone = session.customer_details?.phone || null

      console.log('Ticket purchase — event:', event_id, 'fan:', fanIdOrNull || 'guest', 'total qty:', totalQty, 'categories:', ticketCategories.length)

      const ticketGross = session.amount_total / 100
      const { stripeFee: totalStripeFee, platformFee: totalPlatformFee } =
        await calcFees(stripe, ticketGross, session.payment_intent)

      try {
        for (const cat of ticketCategories) {
          const catQty    = parseInt(cat.quantity) || 1
          const catGross  = parseFloat((parseFloat(cat.price) * catQty).toFixed(2))
          const share = ticketGross > 0 ? catGross / ticketGross : 1 / ticketCategories.length
          const catStripeFee   = parseFloat((totalStripeFee   * share).toFixed(2))
          const catPlatformFee = parseFloat((totalPlatformFee * share).toFixed(2))
          const catNet         = parseFloat((catGross - catStripeFee - catPlatformFee).toFixed(2))

          const sessionCatId = ticketCategories.length > 1
            ? `${session.id}__${cat.name.replace(/\s+/g, '_').toLowerCase()}`
            : session.id

          await sbUpsert('ticket_purchases', {
            event_id,
            fan_id:            fanIdOrNull,
            stripe_session_id: sessionCatId,
            amount:            catGross,
            stripe_fee:        catStripeFee,
            platform_fee:      catPlatformFee,
            net_amount:        catNet,
            quantity:          catQty,
            status:            'paid',
            buyer_name:        buyerName,
            buyer_email:       buyerEmail,
            buyer_phone:       buyerPhone,
            ticket_category:   cat.name,
          }, 'stripe_session_id')
          console.log(`Ticket row — category: ${cat.name}, qty: ${catQty}, gross: $${catGross}, stripe: $${catStripeFee}, platform: $${catPlatformFee}, net: $${catNet}`)
        }

        if (fanIdOrNull) {
          await sbUpsert('rsvps', { event_id, fan_id: fanIdOrNull }, 'event_id,fan_id')
        }
      } catch (err) {
        console.error('Ticket purchase error:', err.message)
        return { statusCode: 500, body: err.message }
      }

      // Send ticket confirmation email to buyer
      if (buyerEmail && process.env.RESEND_API_KEY) {
        try {
          let eventName  = 'the event'
          let eventSlug  = ''
          let eventDate  = ''
          let eventVenue = ''
          let rawEventDate  = ''
          let rawStartTime  = ''

          try {
            const evRes = await fetch(
              `${SB_URL}/rest/v1/events?id=eq.${event_id}&select=name,slug,event_date,start_time,venue`,
              { headers: sbHeaders() }
            )
            const evData = await evRes.json()
            if (Array.isArray(evData) && evData[0]) {
              eventName     = evData[0].name  || eventName
              eventSlug     = evData[0].slug  || ''
              eventVenue    = evData[0].venue || ''
              rawEventDate  = evData[0].event_date  || ''
              rawStartTime  = evData[0].start_time  || ''
              if (evData[0].event_date) {
                const [y, m, d] = evData[0].event_date.split('-').map(Number)
                const dateObj  = new Date(y, m - 1, d)
                const dayName  = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
                const monthDay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                if (evData[0].start_time) {
                  const [h, min] = evData[0].start_time.split(':').map(Number)
                  const ampm   = h >= 12 ? 'PM' : 'AM'
                  const h12    = h % 12 || 12
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
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(session.id)}&bgcolor=ffffff&color=111111&margin=8`

          const ticketRowsHtml = ticketCategories.map(cat => {
            const catTotal = (parseFloat(cat.price) * parseInt(cat.quantity)).toFixed(2)
            return `
              <tr>
                <td style="padding: 8px 0; color: #9a9690; border-bottom: 1px solid #222;">${cat.name}</td>
                <td style="padding: 8px 0; color: #9a9690; text-align: center; border-bottom: 1px solid #222;">${cat.quantity}</td>
                <td style="padding: 8px 0; color: #9a9690; text-align: right; border-bottom: 1px solid #222; font-family: monospace;">$${parseFloat(cat.price).toFixed(2)}</td>
                <td style="padding: 8px 0; color: #c9a84c; text-align: right; border-bottom: 1px solid #222; font-family: monospace; font-weight: 700;">$${catTotal}</td>
              </tr>
            `
          }).join('')

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Coveted Stage <hello@covetedstage.com>',
              to: buyerEmail,
              subject: `Your ${totalQty > 1 ? totalQty + ' tickets' : 'ticket'} for ${eventName} ${totalQty > 1 ? 'are' : 'is'} confirmed! 🎟`,
              html: `
                <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
                  <div style="font-size: 28px; color: #c9a84c; margin-bottom: 8px;">Coveted Stage</div>
                  <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;" />
                  <h2 style="font-size: 22px; color: #f4f0e8; margin-bottom: 12px;">You're going! 🎉</h2>
                  <p style="color: #9a9690; line-height: 1.7;">
                    Hi ${buyerName || 'there'},<br/><br/>
                    Your tickets for <strong style="color: #f4f0e8;">${eventName}</strong> have been confirmed.
                  </p>

                  ${eventDate  ? `<p style="color: #9a9690; line-height: 1.7;">📅 ${eventDate}</p>`  : ''}
                  ${eventVenue ? `<p style="color: #9a9690; line-height: 1.7;">📍 ${eventVenue}</p>` : ''}

                  ${calendarBlock(rawEventDate, rawStartTime, eventName, eventVenue, session.id)}

                  <!-- Itemized ticket breakdown -->
                  <div style="margin: 24px 0; padding: 20px 24px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.25); border-radius: 10px;">
                    <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.18em; color: #c9a84c; margin-bottom: 12px;">ORDER SUMMARY</div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                      <thead>
                        <tr>
                          <th style="text-align: left; color: #555; font-size: 11px; font-weight: 400; padding-bottom: 6px; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">TICKET TYPE</th>
                          <th style="text-align: center; color: #555; font-size: 11px; font-weight: 400; padding-bottom: 6px; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">QTY</th>
                          <th style="text-align: right; color: #555; font-size: 11px; font-weight: 400; padding-bottom: 6px; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">PRICE</th>
                          <th style="text-align: right; color: #555; font-size: 11px; font-weight: 400; padding-bottom: 6px; border-bottom: 1px solid #333; font-family: monospace; letter-spacing: 0.1em;">SUBTOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${ticketRowsHtml}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colspan="3" style="padding: 10px 0 0; color: #c9a84c; font-family: monospace; font-size: 11px; letter-spacing: 0.1em;">TOTAL PAID</td>
                          <td style="padding: 10px 0 0; text-align: right; color: #c9a84c; font-family: monospace; font-weight: 700; font-size: 16px;">$${ticketGross.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

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
                      One scan covers all tickets in this order.
                    </p>
                  </div>

                  <!-- Booking reference -->
                  <div style="margin: 28px 0; padding: 20px 24px; background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.25); border-radius: 10px;">
                    <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.18em; color: #c9a84c; margin-bottom: 8px;">BOOKING REFERENCE</div>
                    <div style="font-family: monospace; font-size: 13px; color: #f4f0e8; word-break: break-all;">${session.id}</div>
                  </div>

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
      let subStripeFee = null, subPlatformFee = null, subNet = null
      if (session.amount_total) {
        const subGross = session.amount_total / 100
        ;({ stripeFee: subStripeFee, platformFee: subPlatformFee, netAmount: subNet } =
          await calcFees(stripe, subGross, session.payment_intent))
      }

      await sbUpsert('subscriptions', {
        fan_id,
        creator_id,
        stripe_subscription_id: session.subscription,
        status: 'active',
        stripe_fee:   subStripeFee,
        platform_fee: subPlatformFee,
        net_amount:   subNet,
      }, 'fan_id,creator_id')
      console.log(`Subscription created — stripe: $${subStripeFee}, platform: $${subPlatformFee}, net: $${subNet}`)
    } catch (err) {
      console.error('Subscription upsert error:', err.message)
      return { statusCode: 500, body: err.message }
    }
  }

  // ── invoice.payment_succeeded ─────────────────────────────────────────────
  if (stripeEvent.type === 'invoice.payment_succeeded') {
    const invoice = stripeEvent.data.object

    if (invoice.billing_reason === 'subscription_create') {
      console.log('Skipping initial invoice — handled by checkout.session.completed')
      return { statusCode: 200, body: JSON.stringify({ received: true }) }
    }

    const stripeSubscriptionId = invoice.subscription
    const grossAmount = invoice.amount_paid / 100
    const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null
    const periodEnd   = invoice.period_end   ? new Date(invoice.period_end   * 1000).toISOString() : null

    const { stripeFee, platformFee, netAmount } = await calcFees(stripe, grossAmount, invoice.payment_intent)

    console.log(`Invoice paid — sub: ${stripeSubscriptionId}, gross: $${grossAmount}, stripe: $${stripeFee}, platform: $${platformFee}, net: $${netAmount}`)

    let fan_id = null, creator_id = null, subscription_type = 'creator'
    let event_id = null

    try {
      const subRes = await fetch(
        `${SB_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${stripeSubscriptionId}&select=fan_id,creator_id`,
        { headers: sbHeaders() }
      )
      const subs = await subRes.json()
      if (Array.isArray(subs) && subs[0]) {
        fan_id     = subs[0].fan_id
        creator_id = subs[0].creator_id
        subscription_type = 'creator'
      }

      if (!fan_id) {
        const crRes = await fetch(
          `${SB_URL}/rest/v1/class_registrations?stripe_subscription_id=eq.${stripeSubscriptionId}&select=fan_id,event_id`,
          { headers: sbHeaders() }
        )
        const crs = await crRes.json()
        if (Array.isArray(crs) && crs[0]) {
          fan_id            = crs[0].fan_id
          event_id          = crs[0].event_id
          subscription_type = 'class'
        }
      }
    } catch (lookupErr) {
      console.error('Subscription lookup error:', lookupErr.message)
    }

    try {
      await sbUpsert('subscription_payments', {
        stripe_subscription_id: stripeSubscriptionId,
        stripe_invoice_id:      invoice.id,
        fan_id,
        creator_id:        creator_id || null,
        event_id:          event_id   || null,
        subscription_type,
        gross_amount:      grossAmount,
        stripe_fee:        stripeFee,
        platform_fee:      platformFee,
        net_amount:        netAmount,
        period_start:      periodStart,
        period_end:        periodEnd,
        status:            'paid',
        paid_at:           new Date().toISOString(),
      }, 'stripe_invoice_id')
      console.log('subscription_payments record written')
    } catch (err) {
      console.error('subscription_payments upsert error:', err.message)
      return { statusCode: 500, body: err.message }
    }
  }

  // ── customer.subscription.deleted / paused ────────────────────────────────
  if (
    stripeEvent.type === 'customer.subscription.deleted' ||
    stripeEvent.type === 'customer.subscription.paused'
  ) {
    const subscription = stripeEvent.data.object
    console.log('Cancelling subscription:', subscription.id)

    try {
      await sbUpdate('subscriptions', { status: 'cancelled' }, 'stripe_subscription_id', subscription.id)
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
