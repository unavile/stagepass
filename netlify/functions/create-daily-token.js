exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const { roomName, isOwner, userName } = JSON.parse(event.body)

    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: isOwner,
          user_name: userName,
          enable_screenshare: isOwner,
          start_video_off: !isOwner,
          start_audio_off: !isOwner,
          exp: Math.floor(Date.now() / 1000) + 86400, // token valid for 24hrs
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create token')
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token: data.token })
    }
  } catch (err) {
    console.error('Token error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}