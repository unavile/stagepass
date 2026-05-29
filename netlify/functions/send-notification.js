// netlify/functions/send-notification.js
// Called by AdminPortal to insert notifications into admin_notifications
// Uses service role key to bypass RLS

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const { creatorIds, message } = JSON.parse(event.body)

    if (!message?.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) }
    }
    if (!creatorIds?.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No recipients specified' }) }
    }

    const sbUrl = process.env.SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const inserts = creatorIds.map(creator_id => ({
      creator_id,
      message: message.trim(),
      read: false,
    }))

    const res = await fetch(`${sbUrl}/rest/v1/admin_notifications`, {
      method: 'POST',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(inserts),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Supabase insert error:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Database error: ${err}` }) }
    }

    console.log(`Notification sent to ${creatorIds.length} creator(s)`)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: creatorIds.length }),
    }
  } catch (err) {
    console.error('send-notification error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
