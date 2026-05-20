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

    // Create or retrieve a Stripe product for this creator
    const product = await stripe.products.create({
      name: `${creatorName} — StagePass Subscription`,
    })

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(monthlyPrice * 100), // in cents
      currency: 'usd',
      recurring: { interval: 'month' },
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${process.env.URL}/success?creator=${creatorId}`,
      cancel_url: `${process.env.URL}/`,
      customer_email: fanEmail,
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