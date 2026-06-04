const https = require('https')

function dailyRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const options = {
      hostname: 'api.daily.co',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      }
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
        catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.write(data)
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

  try {
    const { roomName, isOwner, userName } = JSON.parse(event.body)

    console.log('Creating token for room:', roomName, 'isOwner:', isOwner)

    const result = await dailyRequest('/v1/meeting-tokens', {
      properties: {
        room_name: roomName,
        is_owner: isOwner,
        user_name: userName,
        enable_screenshare: isOwner,       // only creators can screenshare
        start_video_off: !isOwner,         // fans join with camera off
        start_audio_off: !isOwner,         // fans join with mic off
        exp: Math.floor(Date.now() / 1000) + 86400,
        // Explicitly grant fans permission to receive all media tracks.
        // Without this, owner_only_broadcast may not deliver the creator's
        // video and audio to non-owner participants, causing a black screen.
        ...(isOwner ? {} : {
          permissions: {
            hasPresence: true,
            canSend: false,
            canReceive: { base: 'all' },
          }
        }),
      }
    })

    console.log('Token API response status:', result.status)

    if (result.status !== 200) {
      throw new Error(result.data.error || `Daily API error: ${result.status}`)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token: result.data.token })
    }
  } catch (err) {
    console.error('Token error:', err.message)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}