// netlify/functions/create-donation-checkout.js
// Creates a Stripe checkout for a fan-specified one-time donation to a creator
// Sends a thank-you email to the fan via the stripe-webhook on completion

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
    const { creatorId, creatorName, fanId, fanEmail, amountCents } = JSON.parse(event.body)

    if (!creatorId || !creatorName || !fanId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    // amountCents is passed from the fan's chosen amount — minimum $1
    const amount = Math.max(Math.round(amountCents || 500), 100)

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const baseUrl = process.env.URL || 'https://covetedstage.com'

    // Create or retrieve Stripe customer
    let customer
    if (fanEmail) {
      const existing = await stripe.customers.list({ email: fanEmail, limit: 1 })
      customer = existing.data.length > 0
        ? existing.data[0]
        : await stripe.customers.create({ email: fanEmail, metadata: { fan_id: fanId } })
    }

    const sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Support ${creatorName} on Coveted Stage`,
            description: `One-time donation to ${creatorName}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'donation',
        creator_id: creatorId,
        fan_id: fanId,
        creator_name: creatorName,
      },
      success_url: `${baseUrl}/success?donation=1&creator=${creatorId}`,
      cancel_url: `${baseUrl}/`,
    }

    if (customer) sessionParams.customer = customer.id

    const session = await stripe.checkout.sessions.create(sessionParams)

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
