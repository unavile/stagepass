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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const { eventId, eventName, startTime, durationMinutes } = JSON.parse(event.body)

    console.log('Creating Daily room for event:', eventName)
    console.log('DAILY_API_KEY exists:', !!process.env.DAILY_API_KEY)

    const expiry = Math.floor(Date.now() / 1000) + (durationMinutes * 60) + (7 * 24 * 60 * 60) // expires 7 days from now

    const result = await dailyRequest('/v1/rooms', {
      name: `stagepass-${eventId}`,
      privacy: 'private',
      properties: {
        start_audio_off: false,
        start_video_off: false,
        enable_chat: true,
        enable_screenshare: true,
        exp: expiry,
        eject_at_room_exp: true,
      }
    })

    console.log('Daily API response status:', result.status)
    console.log('Daily API response:', JSON.stringify(result.data))

    if (result.status !== 200) {
      throw new Error(result.data.error || `Daily API error: ${result.status}`)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        roomUrl: result.data.url,
        roomName: result.data.name
      })
    }
  } catch (err) {
    console.error('Create room error:', err.message)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}