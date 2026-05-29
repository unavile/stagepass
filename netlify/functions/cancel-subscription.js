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
    const { stripeSubscriptionId } = JSON.parse(event.body)

    if (!stripeSubscriptionId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing stripeSubscriptionId' }) }
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Cancel at period end — fan keeps access until the end of the billing period
    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    console.log('Stripe subscription set to cancel at period end:', stripeSubscriptionId)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('Cancel subscription error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
