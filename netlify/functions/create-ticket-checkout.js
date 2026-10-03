const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

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
    const {
      eventId,
      eventName,
      lineItems,    // array of { id, name, price, quantity } — one entry per ticket category
      fanId,        // optional — guests can purchase without logging in
      fanEmail,     // optional — pre-fills email for logged-in fans
      successUrl,   // optional override
      cancelUrl,    // optional override
      // Legacy single-category fields — still accepted for backward compatibility
      ticketPrice,
      quantity,
      categoryName,
      categoryPrice,
    } = JSON.parse(event.body)

    if (!eventId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required field: eventId' }) }
    }

    // ── Build line items ────────────────────────────────────────────────────
    // New multi-category path: lineItems array
    // Legacy path: single categoryName/categoryPrice/quantity
    let stripeLineItems = []
    let ticketCategoriesMeta = []   // stored in metadata for webhook
    let totalQty = 0

    if (Array.isArray(lineItems) && lineItems.length > 0) {
      // Multi-category path
      for (const li of lineItems) {
        const qty = Math.min(10, Math.max(1, parseInt(li.quantity) || 1))
        const unitPrice = parseFloat(li.price)
        if (!unitPrice || qty < 1) continue

        const lineName = `${eventName} — ${li.name}`
        stripeLineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: lineName,
              description: `Ticket purchase for ${eventName} on Coveted Stage`,
            },
            unit_amount: Math.round(unitPrice * 100),
          },
          quantity: qty,
        })
        ticketCategoriesMeta.push({ name: li.name, price: unitPrice, quantity: qty })
        totalQty += qty
      }
    } else {
      // Legacy single-category path
      const unitPrice = parseFloat(categoryPrice || ticketPrice || 0)
      const qty = Math.min(10, Math.max(1, parseInt(quantity) || 1))
      if (!unitPrice) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing ticket price' }) }
      }
      const lineName = categoryName ? `${eventName} — ${categoryName}` : `Ticket: ${eventName}`
      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: lineName,
            description: `Ticket purchase for ${eventName} on Coveted Stage`,
          },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: qty,
      })
      ticketCategoriesMeta.push({ name: categoryName || 'General Admission', price: unitPrice, quantity: qty })
      totalQty = qty
    }

    if (stripeLineItems.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No valid ticket quantities selected' }) }
    }

    // ── Stripe Checkout session ─────────────────────────────────────────────
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      phone_number_collection: { enabled: true },
      line_items: stripeLineItems,
      metadata: {
        event_id: eventId,
        fan_id: fanId || '',
        quantity: String(totalQty),
        type: 'ticket_purchase',
        // JSON array so the webhook can insert one row per category with exact amounts
        ticket_categories: JSON.stringify(ticketCategoriesMeta),
      },
      // {CHECKOUT_SESSION_ID} is replaced by Stripe at redirect time
      success_url: (successUrl || `${process.env.URL || 'https://covetedstage.com'}/success?ticket=1&event=${eventId}`) + '&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || `${process.env.URL || 'https://covetedstage.com'}`,
    }

    // Pre-fill email only when we have it (logged-in fans)
    if (fanEmail) {
      sessionParams.customer_email = fanEmail
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    console.error('Ticket checkout error:', err.message)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
