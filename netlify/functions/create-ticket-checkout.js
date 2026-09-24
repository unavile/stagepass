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
    const { eventId, eventName, ticketPrice, quantity, fanId, fanEmail } = JSON.parse(event.body)

    if (!eventId || !ticketPrice) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const qty = Math.min(10, Math.max(1, parseInt(quantity) || 1))

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      phone_number_collection: { enabled: true },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Ticket: ${eventName}`,
            description: `One-time ticket purchase for ${eventName} on Coveted Stage`,
          },
          unit_amount: Math.round(parseFloat(ticketPrice) * 100),
        },
        quantity: qty,
      }],
      metadata: {
        event_id: eventId,
        fan_id: fanId || '',   // empty string for guests (metadata values must be strings)
        quantity: String(qty), // store for webhook
        type: 'ticket_purchase',
      },
      success_url: `${process.env.URL || 'https://covetedstage.com'}/success?ticket=1&event=${eventId}`,
      cancel_url: `${process.env.URL || 'https://covetedstage.com'}`,
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
