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

    // If subscription not found in Stripe (already cancelled/deleted), treat as success
    // so the local cancellation flow can still complete
    if (err.code === 'resource_missing' || err.statusCode === 404 ||
        (err.message && err.message.toLowerCase().includes('no such subscription'))) {
      console.log('Subscription not found in Stripe — treating as already cancelled')
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, note: 'already_cancelled' }) }
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
