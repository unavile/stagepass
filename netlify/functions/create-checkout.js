const Stripe = require('stripe')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const { creatorId, creatorName, monthlyPrice, fanId, fanEmail } = JSON.parse(event.body)

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // ── Create or retrieve a Customer so Stripe reliably sends receipt emails ──
    // Search for an existing customer with this email first to avoid duplicates
    const existingCustomers = await stripe.customers.list({ email: fanEmail, limit: 1 })
    let customer
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]
    } else {
      customer = await stripe.customers.create({
        email: fanEmail,
        metadata: { fan_id: fanId },
      })
    }

    // ── Find or create a price for this creator ────────────────────────────────
    // Search for an existing active price for this creator to avoid duplicates
    const existingPrices = await stripe.prices.list({
      active: true,
      limit: 100,
    })
    let price = existingPrices.data.find(
      p => p.metadata?.creator_id === creatorId &&
           p.unit_amount === Math.round(monthlyPrice * 100) &&
           p.recurring?.interval === 'month'
    )

    if (!price) {
      // No existing price — create product + price for this creator
      const product = await stripe.products.create({
        name: `${creatorName} — Coveted Stage Subscription`,
        metadata: { creator_id: creatorId },
      })
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(monthlyPrice * 100),
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { creator_id: creatorId },
      })
    }

    // ── Create the checkout session ────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer.id,          // explicit customer = reliable receipt email
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${process.env.URL}/success?creator=${creatorId}`,
      cancel_url: `${process.env.URL}/`,
      metadata: {
        fan_id: fanId,
        creator_id: creatorId,
      },
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    console.error('Checkout error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
