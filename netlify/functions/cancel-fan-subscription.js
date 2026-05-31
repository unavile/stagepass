// netlify/functions/cancel-fan-subscription.js
// Cancels a fan's subscription in Supabase using service role key
// Required because fan RLS policies may block direct PATCH on subscriptions table

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { fanId, creatorId } = JSON.parse(event.body)

    if (!fanId || !creatorId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fanId or creatorId' }) }
    }

    const sbUrl = process.env.SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const res = await fetch(
      `${sbUrl}/rest/v1/subscriptions?fan_id=eq.${fanId}&creator_id=eq.${creatorId}&status=eq.active`,
      {
        method: 'PATCH',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Subscription cancel failed:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: `DB update failed: ${err}` }) }
    }

    console.log('Subscription cancelled in DB — fan:', fanId, 'creator:', creatorId)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }

  } catch (err) {
    console.error('cancel-fan-subscription error:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
