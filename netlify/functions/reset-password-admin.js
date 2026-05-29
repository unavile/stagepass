// netlify/functions/reset-password-admin.js
// Fetches creator email via service role and sends password reset

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

    // Fetch the creator's email from auth.users via service role
    const userRes = await fetch(`${sbUrl}/auth/v1/admin/users/${creatorId}`, {
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
      }
    })

    if (!userRes.ok) {
      const err = await userRes.text()
      console.error('Failed to fetch user:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Could not find creator account' }) }
    }

    const user = await userRes.json()
    const email = user.email

    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No email found for this creator' }) }

    // Send password reset email via Supabase auth recover endpoint
    const resetRes = await fetch(`${sbUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': sbKey,
        'Authorization': `Bearer ${sbKey}`,
      },
      body: JSON.stringify({
        email,
        gotrue_meta_security: {},
        redirect_to: 'https://covetedstage.com/reset-password',
      }),
    })

    if (!resetRes.ok) {
      const err = await resetRes.text()
      console.error('Reset email failed:', err)
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send reset email' }) }
    }

    console.log('Password reset email sent to:', email)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, email }) }

  } catch (err) {
    console.error('reset-password-admin error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
