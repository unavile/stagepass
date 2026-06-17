// netlify/functions/create-class-checkout.js
// Creates a Stripe recurring subscription checkout for an Always-On class tier

const Stripe = require('stripe')

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { eventId, eventName, tier, tierPrice, fanId, fanEmail } = JSON.parse(event.body)

    if (!eventId || !tier || !tierPrice || !fanEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // ── Find or create customer ────────────────────────────────────────────
    const existingCustomers = await stripe.customers.list({ email: fanEmail, limit: 1 })
    let customer = existingCustomers.data.length > 0
      ? existingCustomers.data[0]
      : await stripe.customers.create({ email: fanEmail, metadata: { fan_id: fanId } })

    // ── Find or create price for this tier ────────────────────────────────
    const existingPrices = await stripe.prices.list({ active: true, limit: 100 })
    let price = existingPrices.data.find(
      p => p.metadata?.event_id === eventId &&
           p.metadata?.tier === String(tier) &&
           p.unit_amount === Math.round(tierPrice * 100) &&
           p.recurring?.interval === 'month'
    )

    if (!price) {
      const product = await stripe.products.create({
        name: `${eventName} — ${tier} Classes/Month`,
        metadata: { event_id: eventId, tier: String(tier) },
      })
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(tierPrice * 100),
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { event_id: eventId, tier: String(tier) },
      })
    }

    // ── Create checkout session ────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer.id,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${process.env.URL}/success?event=${eventId}&tier=${tier}`,
      cancel_url: `${process.env.URL}/`,
      metadata: {
        fan_id: fanId,
        event_id: eventId,
        tier: String(tier),
        type: 'class_registration',
      },
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    console.error('Class checkout error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
