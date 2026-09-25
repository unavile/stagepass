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
    // fanId and fanEmail are optional — guests can purchase without logging in
    // categoryName and categoryPrice are used when ticket categories are configured
    const {
      eventId,
      eventName,
      ticketPrice,
      quantity,
      fanId,
      fanEmail,
      categoryName,   // e.g. "General Admission" — optional
      categoryPrice,  // per-ticket price for this category — optional, falls back to ticketPrice
      successUrl,     // optional override (e.g. event landing page URL)
      cancelUrl,      // optional override
    } = JSON.parse(event.body)

    if (!eventId || (!ticketPrice && !categoryPrice)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const qty = Math.min(10, Math.max(1, parseInt(quantity) || 1))
    const unitPrice = categoryPrice || ticketPrice
    const lineItemName = categoryName ? `${eventName} — ${categoryName}` : `Ticket: ${eventName}`

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      phone_number_collection: { enabled: true },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: lineItemName,
            description: `Ticket purchase for ${eventName} on Coveted Stage`,
          },
          unit_amount: Math.round(parseFloat(unitPrice) * 100),
        },
        quantity: qty,
      }],
      metadata: {
        event_id: eventId,
        fan_id: fanId || '',          // empty string for guests
        quantity: String(qty),
        type: 'ticket_purchase',
        ticket_category: categoryName || '',
      },
      success_url: successUrl || `${process.env.URL || 'https://covetedstage.com'}/success?ticket=1&event=${eventId}`,
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
