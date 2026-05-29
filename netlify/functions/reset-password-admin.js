// netlify/functions/reset-password-admin.js
// Uses Supabase Admin generateLink API to create a recovery link
// with a specific redirect_to URL, then sends it via Supabase's email

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { creatorId } = JSON.parse(event.body)
    if (!creatorId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing creatorId' }) }

    const sbUrl = process.env.SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // ── Step 1: Fetch creator's email from auth.users ─────────────────────
    const userRes = await fetch(`${sbUrl}/auth/v1/admin/users/${creatorId}`, {
      method: 'GET',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!userRes.ok) {
      const errText = await userRes.text()
      console.error('Admin user fetch failed:', errText)
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Could not fetch creator: ${errText}` }) }
    }

    const user = await userRes.json()
    const email = user.email
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No email found for this creator' }) }

    console.log('Generating recovery link for:', email)

    // ── Step 2: Generate a recovery link via admin API ────────────────────
    // This honours redirect_to reliably unlike /auth/v1/recover
    const generateRes = await fetch(`${sbUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'recovery',
        email,
        options: {
          redirect_to: 'https://covetedstage.com/reset-password',
        },
      }),
    })

    console.log('Generate link status:', generateRes.status)

    if (!generateRes.ok) {
      const errBody = await generateRes.json().catch(() => ({}))
      console.error('Generate link failed:', JSON.stringify(errBody))
      if (errBody.error_code === 'over_email_send_rate_limit' || errBody.code === 429) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Please wait a few seconds before sending another reset email.' }) }
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Failed to generate reset link: ${errBody.msg || errBody.error || 'unknown error'}` }) }
    }

    const linkData = await generateRes.json()
    console.log('Recovery link generated, action_link:', linkData.action_link ? 'present' : 'missing')

    // generate_link both generates AND sends the email via Supabase
    // The action_link in the response is the actual reset URL sent to the user
    console.log('Password reset email sent to:', email)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, email }) }

  } catch (err) {
    console.error('reset-password-admin exception:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
