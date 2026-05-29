// netlify/functions/reset-password-admin.js
// Uses admin generate_link to get a recovery URL with correct redirect_to,
// then sends it via Resend email API

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
    const resendKey = process.env.RESEND_API_KEY

    // ── Step 1: Fetch creator's email ─────────────────────────────────────
    const userRes = await fetch(`${sbUrl}/auth/v1/admin/users/${creatorId}`, {
      method: 'GET',
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
    })
    if (!userRes.ok) {
      const err = await userRes.text()
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Could not fetch creator: ${err}` }) }
    }
    const user = await userRes.json()
    const email = user.email
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No email found for this creator' }) }

    console.log('Generating recovery link for:', email)

    // ── Step 2: Generate recovery link with correct redirect_to ───────────
    const generateRes = await fetch(`${sbUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'recovery',
        email,
        options: { redirect_to: 'https://covetedstage.com/reset-password' },
      }),
    })

    if (!generateRes.ok) {
      const err = await generateRes.json().catch(() => ({}))
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Failed to generate link: ${err.msg || err.error || 'unknown'}` }) }
    }

    const linkData = await generateRes.json()
    const actionLink = linkData.action_link || linkData.properties?.action_link
    console.log('Action link generated:', actionLink ? 'yes' : 'no')

    if (!actionLink) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'No action_link returned from Supabase' }) }
    }

    // ── Step 3: Send email via Resend ─────────────────────────────────────
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Coveted Stage <noreply@covetedstage.com>',
        to: email,
        subject: 'Reset your Coveted Stage password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
            <div style="font-size: 24px; color: #c9a84c; margin-bottom: 24px; font-family: Georgia, serif;">Coveted Stage</div>
            <h2 style="font-size: 20px; color: #f4f0e8; margin-bottom: 16px;">Reset your password</h2>
            <p style="color: #9a9690; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">
              You requested a password reset for your Coveted Stage creator account. 
              Click the button below to set a new password. This link expires in 1 hour.
            </p>
            <a href="${actionLink}" style="display: inline-block; background: #c9a84c; color: #080808; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 0.05em;">
              RESET PASSWORD
            </a>
            <p style="color: #555250; font-size: 12px; margin-top: 28px; line-height: 1.6;">
              If you didn't request this, you can safely ignore this email.<br>
              This link will expire in 1 hour.
            </p>
          </div>
        `,
      }),
    })

    console.log('Resend status:', emailRes.status)
    const emailData = await emailRes.json().catch(() => ({}))
    console.log('Resend response:', JSON.stringify(emailData))

    if (!emailRes.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: `Failed to send email: ${emailData.message || 'unknown error'}` }) }
    }

    console.log('Password reset email sent successfully to:', email)
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, email }) }

  } catch (err) {
    console.error('reset-password-admin exception:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
