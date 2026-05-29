// netlify/functions/send-welcome-email.js
// Sends a branded welcome email via Resend after new account creation

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { email, displayName, role, userId } = JSON.parse(event.body)

    if (!email || !displayName || !role) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) }
    }

    const resendKey = process.env.RESEND_API_KEY
    const sbUrl = process.env.SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const isCreator = role === 'creator'

    // ── Confirm email server-side after successful Resend delivery ──────
    // This replaces Supabase's own confirmation email flow entirely
    // Gate: if Resend rejects the email → account gets deleted below
    // Gate: if Resend succeeds → email is confirmed here, creator can log in

    const subject = isCreator
      ? `Welcome to Coveted Stage, ${displayName}! 🎙`
      : `Welcome to Coveted Stage, ${displayName}! 🎧`

    const html = isCreator ? `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
        <div style="font-family: Georgia, serif; font-size: 28px; color: #c9a84c; margin-bottom: 8px;">Coveted Stage</div>
        <div style="font-size: 11px; color: #555; letter-spacing: 0.2em; margin-bottom: 32px;">YOUR STAGE. YOUR FANS. YOUR REVENUE.</div>

        <h2 style="font-size: 22px; color: #f4f0e8; margin-bottom: 12px;">Welcome, ${displayName}! 🎙</h2>
        <p style="color: #9a9690; font-size: 14px; line-height: 1.7; margin-bottom: 20px;">
          Your creator account is ready. You're now part of a platform built exclusively for performing artists — 
          where you keep <strong style="color: #c9a84c;">85% of every subscription</strong>, connect directly with your fans, 
          and host live virtual and in-person events.
        </p>

        <div style="background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.2); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #c9a84c; letter-spacing: 0.15em; margin-bottom: 12px;">GET STARTED</div>
          <div style="color: #9a9690; font-size: 13px; line-height: 1.9;">
            ✦ Complete your profile — add a bio, photo and subscription price<br>
            ✦ Create your first post or event<br>
            ✦ Share your page: <span style="color: #c9a84c;">covetedstage.com/[yourhandle]</span><br>
            ✦ Invite your fans to subscribe
          </div>
        </div>

        <a href="https://covetedstage.com/creator" style="display: inline-block; background: #c9a84c; color: #080808; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; letter-spacing: 0.08em; margin-bottom: 28px;">
          GO TO MY CREATOR PORTAL →
        </a>

        <p style="color: #444; font-size: 12px; line-height: 1.7; border-top: 1px solid #1a1a1a; padding-top: 20px; margin-top: 8px;">
          Questions? Reply to this email or visit <a href="https://covetedstage.com" style="color: #c9a84c;">covetedstage.com</a><br>
          Coveted Stage — built for performers, by people who love live art.
        </p>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #09090b; color: #f4f0e8;">
        <div style="font-family: Georgia, serif; font-size: 28px; color: #c9a84c; margin-bottom: 8px;">Coveted Stage</div>
        <div style="font-size: 11px; color: #555; letter-spacing: 0.2em; margin-bottom: 32px;">DISCOVER. SUPPORT. EXPERIENCE.</div>

        <h2 style="font-size: 22px; color: #f4f0e8; margin-bottom: 12px;">Welcome, ${displayName}! 🎧</h2>
        <p style="color: #9a9690; font-size: 14px; line-height: 1.7; margin-bottom: 20px;">
          Your fan account is ready. Coveted Stage is where you get closer to the artists you love — 
          exclusive content, live virtual events, and a direct connection that no social media algorithm can interrupt.
        </p>

        <div style="background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.2); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #c9a84c; letter-spacing: 0.15em; margin-bottom: 12px;">WHAT YOU CAN DO</div>
          <div style="color: #9a9690; font-size: 13px; line-height: 1.9;">
            🎵 Discover artists across Music, Dance, Comedy, Modeling, Art & more<br>
            🔑 Subscribe for exclusive content and early access<br>
            🎟 Attend virtual and in-person live events<br>
            ✦ Support artists directly — 85% goes straight to them
          </div>
        </div>

        <a href="https://covetedstage.com" style="display: inline-block; background: #c9a84c; color: #080808; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 13px; letter-spacing: 0.08em; margin-bottom: 28px;">
          DISCOVER ARTISTS →
        </a>

        <p style="color: #444; font-size: 12px; line-height: 1.7; border-top: 1px solid #1a1a1a; padding-top: 20px; margin-top: 8px;">
          Questions? Visit <a href="https://covetedstage.com" style="color: #c9a84c;">covetedstage.com</a><br>
          Coveted Stage — where fans and artists connect directly.
        </p>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Coveted Stage <noreply@covetedstage.com>',
        to: email,
        subject,
        html,
      }),
    })

    const emailData = await emailRes.json().catch(() => ({}))
    console.log('Welcome email status:', emailRes.status, 'to:', email, 'role:', role)

    if (!emailRes.ok) {
      console.error('Resend error:', JSON.stringify(emailData))
      // ── Email failed — delete the unconfirmed account to prevent ghost accounts ──
      if (userId && sbUrl && sbKey) {
        try {
          const deleteRes = await fetch(`${sbUrl}/auth/v1/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
          })
          console.log('Deleted unconfirmed account:', email, 'status:', deleteRes.status)
        } catch (e) {
          console.warn('Could not delete unconfirmed account:', e.message)
        }
      }
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'invalid_email',
          message: 'That email address appears to be invalid. Please use a real email address.',
        }),
      }
    }

    // ── Confirm email server-side now that delivery succeeded ────────────
    if (userId && sbUrl && sbKey) { // confirm both fans and creators
      try {
        const confirmRes = await fetch(`${sbUrl}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${sbKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email_confirm: true }),
        })
        console.log('Email confirmed server-side, status:', confirmRes.status)
      } catch (e) {
        console.warn('Could not confirm email server-side:', e.message)
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }

  } catch (err) {
    console.error('send-welcome-email exception:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
