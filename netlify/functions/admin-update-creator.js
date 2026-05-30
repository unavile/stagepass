// netlify/functions/admin-update-creator.js
// Updates creator record using service role key to bypass RLS
// Used for suspend, resume operations from Admin Portal

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { creatorId, updates } = JSON.parse(event.body)

    if (!creatorId || !updates) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing creatorId or updates' }) }
    }

    const sbUrl = process.env.SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const res = await fetch(`${sbUrl}/rest/v1/creators?id=eq.${creatorId}`, {
      method: 'PATCH',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updates),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Creator update failed:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Update failed: ${err}` }) }
    }

    console.log('Creator updated:', creatorId, updates)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }

  } catch (err) {
    console.error('admin-update-creator error:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
