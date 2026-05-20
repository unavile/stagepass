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

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    const { fan_id, creator_id } = session.metadata

    if (fan_id && creator_id) {
      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          fan_id,
          creator_id,
          stripe_subscription_id: session.subscription,
          status: 'active',
        }, { onConflict: 'fan_id,creator_id' })

      if (error) {
        console.error('Supabase upsert error:', error.message)
        return { statusCode: 500, body: 'Database error' }
      }
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted' ||
      stripeEvent.type === 'customer.subscription.paused') {
    const subscription = stripeEvent.data.object
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('stripe_subscription_id', subscription.id)
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}