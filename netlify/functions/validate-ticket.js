const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { sessionId, eventId } = JSON.parse(event.body)

    if (!sessionId) {
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'No session ID provided' }) }
    }

    // ── Complimentary ticket (code starts with comp_) ────────────────────────
    if (sessionId.startsWith('comp_')) {
      if (!/^comp_[A-Za-z0-9]{10,40}$/.test(sessionId)) {
        return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'Invalid ticket — not found' }) }
      }
      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/comp_tickets?code=eq.${encodeURIComponent(sessionId)}&select=*`,
        { headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }
      )
      if (!res.ok) throw new Error(`Comp ticket lookup failed: ${await res.text()}`)
      const comp = (await res.json())[0]
      const deny = reason => ({ statusCode: 200, headers, body: JSON.stringify({ valid: false, reason }) })

      if (!comp) return deny('Invalid ticket — not found')
      if (comp.revoked) return deny('This complimentary ticket has been revoked')
      if (eventId && String(comp.event_id) !== String(eventId)) return deny('Ticket is for a different event')

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          customerEmail: comp.guest_email || 'N/A',
          customerName: comp.guest_name || 'N/A',
          quantity: String(comp.quantity),
          ticketCategory: comp.ticket_category || 'Complimentary',
          amountTotal: '0.00',
          currency: 'USD',
          purchasedAt: new Date(comp.created_at).toLocaleString('en-US', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York',
          }),
        }),
      }
    }

    // Retrieve the Stripe checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    })

    // Must be a completed payment
    if (session.payment_status !== 'paid') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valid: false, reason: 'Payment not completed' }),
      }
    }

    // If an eventId was passed, verify it matches the session metadata
    if (eventId && session.metadata?.event_id && session.metadata.event_id !== eventId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valid: false, reason: 'Ticket is for a different event' }),
      }
    }

    // Return key details to display on the validation screen
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        customerEmail: session.customer_details?.email || 'N/A',
        customerName: session.customer_details?.name || 'N/A',
        quantity: session.metadata?.quantity || '1',
        ticketCategory: session.metadata?.ticket_category || 'General Admission',
        amountTotal: (session.amount_total / 100).toFixed(2),
        currency: session.currency?.toUpperCase() || 'USD',
        purchasedAt: new Date(session.created * 1000).toLocaleString('en-US', {
          dateStyle: 'medium', timeStyle: 'short',
        }),
      }),
    }
  } catch (err) {
    console.error('Validate ticket error:', err.message)
    // A "No such checkout.session" error from Stripe means the ID is invalid/fake
    if (err.message?.includes('No such checkout.session')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ valid: false, reason: 'Invalid ticket — not found' }),
      }
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ valid: false, error: 'Verification failed. Please try again.' }),
    }
  }
}
