const https = require('https')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function supabaseRequest(method, path, body, useServiceRole = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path}`)
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation',
      }
    }
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data)

    const req = https.request(options, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body || 'null') }) }
        catch (e) { resolve({ status: res.statusCode, data: body }) }
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const { creators } = JSON.parse(event.body)
    if (!Array.isArray(creators) || creators.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No creators provided' }) }
    }

    let created = 0
    const errors = []

    for (const creator of creators) {
      try {
        // 1. Create auth user with a temporary random password
        const tempPassword = 'StagePass' + Math.random().toString(36).slice(2, 8) + '!'
        const userRes = await supabaseRequest('POST', '/auth/v1/admin/users', {
          email: creator.email.trim(),
          password: tempPassword,
          email_confirm: true, // skip email confirmation for admin-created users
          user_metadata: {
            display_name: creator.display_name.trim(),
            handle: creator.handle.toLowerCase().trim(),
            role: 'creator',
            category: creator.category,
          }
        })

        if (userRes.status !== 200 && userRes.status !== 201) {
          errors.push(`${creator.email}: ${userRes.data?.message || userRes.data?.error || 'Failed to create user'}`)
          continue
        }

        const userId = userRes.data.id
        if (!userId) {
          errors.push(`${creator.email}: No user ID returned`)
          continue
        }

        // 2. Insert profile record
        await supabaseRequest('POST', '/rest/v1/profiles', {
          id: userId,
          role: 'creator',
          display_name: creator.display_name.trim(),
          handle: creator.handle.toLowerCase().trim(),
          bio: creator.bio?.trim() || null,
        })

        // 3. Insert creator record
        await supabaseRequest('POST', '/rest/v1/creators', {
          id: userId,
          monthly_price: parseFloat(creator.monthly_price) || 5,
          category: creator.category,
          accent_color: '#c9a84c',
        })

        // 4. Send password reset email so creator sets their own password
        await supabaseRequest('POST', '/auth/v1/admin/users/' + userId, {
          // Trigger password recovery email
        })

        // Use the recover endpoint to send reset email
        await supabaseRequest('POST', '/auth/v1/recover', {
          email: creator.email.trim(),
          gotrue_meta_security: {},
        })

        created++
        console.log(`Created creator: ${creator.email}`)

      } catch (err) {
        console.error(`Error creating ${creator.email}:`, err.message)
        errors.push(`${creator.email}: ${err.message}`)
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        created,
        errors,
        message: `${created} creator(s) created${errors.length > 0 ? `, ${errors.length} failed` : ''}.`
      })
    }
  } catch (err) {
    console.error('Bulk create error:', err.message)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}
