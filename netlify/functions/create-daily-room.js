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

    // Create a Daily room for this event
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: `stagepass-${eventId}`,
        privacy: 'private',
        properties: {
          start_audio_off: false,
          start_video_off: false,
          enable_chat: true,
          enable_screenshare: true,
          max_participants: 200,
          exp: Math.floor(new Date(startTime).getTime() / 1000) + (durationMinutes * 60) + 3600, // expires 1hr after event ends
          eject_at_room_exp: true,
        }
      })
    })

    const room = await response.json()

    if (!response.ok) {
      throw new Error(room.error || 'Failed to create Daily room')
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ roomUrl: room.url, roomName: room.name })
    }
  } catch (err) {
    console.error('Create room error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    }
  }
}