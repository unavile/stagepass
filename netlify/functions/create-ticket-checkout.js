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
    const { eventId, eventName, ticketPrice, fanId, fanEmail } = JSON.parse(event.body)

    if (!eventId || !ticketPrice || !fanId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: fanEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Ticket: ${eventName}`,
            description: `One-time ticket purchase for ${eventName} on Coveted Stage`,
          },
          unit_amount: Math.round(parseFloat(ticketPrice) * 100),
        },
        quantity: 1,
      }],
      metadata: {
        event_id: eventId,
        fan_id: fanId,
        type: 'ticket_purchase',
      },
      success_url: `${process.env.URL || 'https://covetedstage.com'}/success?ticket=1&event=${eventId}`,
      cancel_url: `${process.env.URL || 'https://covetedstage.com'}`,
    })

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
