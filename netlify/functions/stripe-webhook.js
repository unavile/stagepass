const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
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
  // Inside the checkout.session.completed handler, after the existing subscription logic:
  if (session.metadata?.type === 'ticket_purchase') {
    const { event_id, fan_id } = session.metadata
    // Record ticket purchase and auto-RSVP the fan
    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    
    await supabase.from('ticket_purchases').upsert({
      event_id,
      fan_id,
      stripe_session_id: session.id,
      amount: session.amount_total / 100,
      status: 'paid',
    }, { onConflict: 'event_id,fan_id' })

    // Auto-RSVP the fan to the event
    await supabase.from('rsvps').upsert(
      { event_id, fan_id },
      { onConflict: 'event_id,fan_id' }
    )
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