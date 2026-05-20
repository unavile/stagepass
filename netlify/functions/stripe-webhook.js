const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let stripeEvent
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return { statusCode: 400, body: `Webhook error: ${err.message}` }
  }

  console.log('Stripe event type:', stripeEvent.type)

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    console.log('Session metadata:', JSON.stringify(session.metadata))
    console.log('Session subscription:', session.subscription)

    const { fan_id, creator_id } = session.metadata

    if (!fan_id || !creator_id) {
      console.error('Missing metadata - fan_id:', fan_id, 'creator_id:', creator_id)
      return { statusCode: 400, body: 'Missing metadata' }
    }

    console.log('Upserting subscription for fan:', fan_id, 'creator:', creator_id)

    const { data, error } = await supabase
      .from('subscriptions')
      .upsert({
        fan_id,
        creator_id,
        stripe_subscription_id: session.subscription,
        status: 'active',
      }, { onConflict: 'fan_id,creator_id' })

    console.log('Upsert result - data:', JSON.stringify(data), 'error:', JSON.stringify(error))

    if (error) {
      console.error('Supabase upsert error:', error.message, error.details, error.hint)
      return { statusCode: 500, body: `Database error: ${error.message}` }
    }

    console.log('Subscription created successfully')
  }

  if (stripeEvent.type === 'customer.subscription.deleted' ||
      stripeEvent.type === 'customer.subscription.paused') {
    const subscription = stripeEvent.data.object
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('stripe_subscription_id', subscription.id)

    if (error) {
      console.error('Cancel subscription error:', error.message)
      return { statusCode: 500, body: `Database error: ${error.message}` }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}