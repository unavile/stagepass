// netlify/functions/create-donation-checkout.js
// Creates a Stripe checkout for a one-time donation to a creator
// Sends a thank-you email to the fan via Resend after payment

const Stripe = require('stripe')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { creatorId, creatorName, fanId, fanEmail } = JSON.parse(event.body)

    if (!creatorId || !creatorName || !fanId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const baseUrl = process.env.URL || 'https://covetedstage.com'

    // Create or retrieve Stripe customer
    const existingCustomers = await stripe.customers.list({ email: fanEmail, limit: 1 })
    const customer = existingCustomers.data.length > 0
      ? existingCustomers.data[0]
      : await stripe.customers.create({ email: fanEmail, metadata: { fan_id: fanId } })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: customer.id,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Support ${creatorName} on Coveted Stage`,
            description: `One-time donation to ${creatorName}`,
          },
          unit_amount: 500, // $5 default — fan can edit quantity at checkout
        },
        quantity: 1,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 100 },
      }],
      metadata: {
        type: 'donation',
        creator_id: creatorId,
        fan_id: fanId,
        creator_name: creatorName,
      },
      success_url: `${baseUrl}/success?donation=1&creator=${creatorId}`,
      cancel_url: `${baseUrl}/`,
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (err) {
    console.error('Donation checkout error:', err.message)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
