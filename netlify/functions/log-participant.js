// netlify/functions/log-participant.js
//
// Logs fan/guest join and leave events for each live stream session.
// Writes to the `live_session_participants` table in Supabase using the
// service role key so it can bypass RLS.
//
// Required environment variables — set these in Netlify dashboard:
//   SUPABASE_URL         — your Supabase project URL (no VITE_ prefix — Netlify
//                          functions don't receive Vite build-time variables)
//   SUPABASE_SERVICE_KEY — your Supabase project's service_role secret key

const https = require('https')

function supabaseRequest({ method, path, body, serviceKey, supabaseUrl }) {
  return new Promise((resolve, reject) => {
    // Strip protocol and any trailing slash to get a clean hostname
    const host = supabaseUrl.replace('https://', '').replace('http://', '').replace(/\/$/, '')
    const payload = body ? JSON.stringify(body) : ''
    const options = {
      hostname: host,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }) }
        catch (e) { reject(new Error(`JSON parse error (status ${res.statusCode}): ${data}`)) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  // NOTE: use SUPABASE_URL (not VITE_SUPABASE_URL) — VITE_ prefixed vars are
  // only injected at Vite build time and are NOT available to Netlify functions.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    console.error('Missing env vars. Need SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in Netlify dashboard.')
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfiguration — missing env vars' }) }
  }

  try {
    const { action, eventId, creatorId, displayName, fanId, sessionRowId } = JSON.parse(event.body)

    console.log('log-participant called:', { action, eventId, creatorId, displayName, fanId, sessionRowId })

    // ── JOIN ─────────────────────────────────────────────────────────────────
    if (action === 'join') {
      if (!eventId || !creatorId || !displayName) {
        console.error('Missing required join fields:', { eventId, creatorId, displayName })
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields: eventId, creatorId, displayName' }) }
      }

      const result = await supabaseRequest({
        method: 'POST',
        path: '/rest/v1/live_session_participants',
        body: {
          event_id: eventId,
          creator_id: creatorId,
          display_name: displayName,
          fan_id: fanId || null,
          joined_at: new Date().toISOString(),
        },
        serviceKey,
        supabaseUrl,
      })

      console.log('Supabase insert response:', result.status, JSON.stringify(result.data))

      if (result.status !== 201) {
        throw new Error(result.data?.message || result.data?.error || `Supabase insert error ${result.status}`)
      }

      const rowId = Array.isArray(result.data) ? result.data[0]?.id : result.data?.id
      console.log(`Participant joined — event: ${eventId}, name: ${displayName}, rowId: ${rowId}`)
      return { statusCode: 200, headers, body: JSON.stringify({ rowId }) }
    }

    // ── LEAVE ────────────────────────────────────────────────────────────────
    if (action === 'leave') {
      if (!sessionRowId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing sessionRowId for leave' }) }
      }

      const result = await supabaseRequest({
        method: 'PATCH',
        path: `/rest/v1/live_session_participants?id=eq.${sessionRowId}`,
        body: { left_at: new Date().toISOString() },
        serviceKey,
        supabaseUrl,
      })

      console.log('Supabase PATCH response:', result.status)

      if (result.status !== 200 && result.status !== 204) {
        throw new Error(result.data?.message || result.data?.error || `Supabase update error ${result.status}`)
      }

      console.log(`Participant left — rowId: ${sessionRowId}`)
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown action: ${action}` }) }
  } catch (err) {
    console.error('log-participant error:', err.message)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
