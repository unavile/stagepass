import { useEffect, useState, useCallback, useRef } from 'react'
import DailyIframe from '@daily-co/daily-js'

export default function LiveRoom({ event, profile, isCreator, onLeave }) {
  const accentColor = '#c9a84c'

  const callRef = useRef(null)
  const isJoinedRef = useRef(false)
  const joinStarted = useRef(false)
  const onLeaveRef = useRef(onLeave)
  const eventRef = useRef(event)
  const profileRef = useRef(profile)
  const isCreatorRef = useRef(isCreator)

  const [joining, setJoining] = useState(true)
  const [error, setError] = useState(null)
  const [participants, setParticipants] = useState({})
  const [localVideoTrack, setLocalVideoTrack] = useState(null)
  const [localAudioTrack, setLocalAudioTrack] = useState(null)

  useEffect(() => { onLeaveRef.current = onLeave }, [onLeave])
  useEffect(() => { eventRef.current = event }, [event])
  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { isCreatorRef.current = isCreator }, [isCreator])

  const joinRoom = useCallback(async () => {
    if (joinStarted.current) return
    joinStarted.current = true

    // Destroy any existing call instance
    try {
      const existing = DailyIframe.getCallInstance()
      if (existing) { existing.destroy() }
    } catch {}
    if (callRef.current) {
      try { callRef.current.destroy() } catch {}
      callRef.current = null
    }

    try {
      const tokenRes = await fetch('/.netlify/functions/create-daily-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: eventRef.current.daily_room_name,
          isOwner: isCreatorRef.current,
          userName: profileRef.current.display_name || 'Guest',
        })
      })
      const { token, error: tokenError } = await tokenRes.json()
      if (tokenError) throw new Error(tokenError)

      // Use createCallObject for full layout control (no prebuilt UI)
      const call = DailyIframe.createCallObject({
        audioSource: isCreatorRef.current,
        videoSource: isCreatorRef.current,
        dailyConfig: { experimentalChromeVideoMuteLightOff: true },
      })
      callRef.current = call

      // Track participant state
      const updateParticipants = () => {
        setParticipants({ ...call.participants() })
        // Update local tracks
        const local = call.participants()?.local
        if (local?.tracks?.video?.persistentTrack) {
          setLocalVideoTrack(local.tracks.video.persistentTrack)
        }
        if (local?.tracks?.audio?.persistentTrack) {
          setLocalAudioTrack(local.tracks.audio.persistentTrack)
        }
      }

      call.on('joined-meeting', () => {
        isJoinedRef.current = true
        setJoining(false)
        updateParticipants()
      })
      call.on('participant-joined', updateParticipants)
      call.on('participant-updated', updateParticipants)
      call.on('participant-left', updateParticipants)
      call.on('track-started', updateParticipants)
      call.on('left-meeting', () => {
        if (isJoinedRef.current) onLeaveRef.current()
      })
      call.on('error', (e) => {
        setError(e.errorMsg || 'Failed to join room')
        setJoining(false)
      })

      await call.join({
        url: `https://${import.meta.env.VITE_DAILY_DOMAIN}/${eventRef.current.daily_room_name}`,
        token,
        startVideoOff: !isCreatorRef.current,
        startAudioOff: !isCreatorRef.current,
      })

    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(joinRoom, 300)
    return () => {
      clearTimeout(timer)
      joinStarted.current = false
      isJoinedRef.current = false
      if (callRef.current) {
        try { callRef.current.destroy() } catch {}
        callRef.current = null
      }
    }
  }, [joinRoom])

  async function handleLeave() {
    isJoinedRef.current = false
    if (callRef.current) {
      try { await callRef.current.leave() } catch {}
      try { callRef.current.destroy() } catch {}
      callRef.current = null
    }
    onLeave()
  }

  async function handleEndForAll() {
    isJoinedRef.current = false
    if (callRef.current) {
      try {
        if (!joining) await callRef.current.sendAppMessage({ type: 'end-event' }, '*')
        await callRef.current.leave()
        callRef.current.destroy()
      } catch {}
      callRef.current = null
    }
    onLeave()
  }

  const participantCount = Object.keys(participants).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      minHeight: '100vh', background: '#080808',
      display: 'flex', flexDirection: 'column'
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60, background: '#0a0a0a',
        borderBottom: '1px solid #ffffff0a', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: accentColor }}>Coveted Stage</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444' }}>·</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#888' }}>{event.name}</span>
          {!joining && (
            <span style={{
              background: '#e8454522', color: '#e84545',
              border: '1px solid #e8454544', borderRadius: 4,
              fontSize: 10, fontWeight: 700, padding: '2px 8px',
              letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace"
            }}>● LIVE</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!joining && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#555' }}>
              👥 {participantCount} live
            </div>
          )}
          {isCreator && !joining && (
            <button onClick={handleEndForAll} style={{
              background: '#e8454518', color: '#e84545',
              border: '1px solid #e8454544', borderRadius: 6,
              padding: '6px 14px', fontFamily: "'DM Mono', monospace",
              fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em'
            }}>END FOR ALL</button>
          )}
          <button onClick={handleLeave} style={{
            background: '#ffffff0a', color: '#888',
            border: '1px solid #ffffff15', borderRadius: 6,
            padding: '6px 14px', fontFamily: "'DM Mono', monospace",
            fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em'
          }}>LEAVE</button>
        </div>
      </div>

      {/* Video area */}
      <div style={{ flex: 1, position: 'relative', background: '#080808' }}>

        {joining && !error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 20
          }}>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>
              {event.name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.2em' }}>
              JOINING LIVE ROOM...
            </div>
            <div style={{ width: 200, height: 2, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: accentColor, borderRadius: 999 }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 16
          }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: '#f0ebe0' }}>
              Couldn't join room
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#555', maxWidth: 320, textAlign: 'center' }}>
              {error}
            </div>
            <button onClick={onLeave} style={{
              background: accentColor, color: '#080808',
              border: 'none', borderRadius: 6, padding: '10px 20px',
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em'
            }}>GO BACK</button>
          </div>
        )}

        {/* Creator view: show own video full screen */}
        {!joining && !error && isCreator && (
          <VideoTile
            track={localVideoTrack}
            name={profile.display_name || 'You'}
            isLocal={true}
            accentColor={accentColor}
            fullScreen={true}
          />
        )}

        {/* Fan view: show creator's video full screen */}
        {!joining && !error && !isCreator && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {Object.values(participants).filter(p => p.owner).map(p => (
              <VideoTile
                key={p.session_id}
                track={p.tracks?.video?.persistentTrack}
                name={p.user_name || 'Creator'}
                isLocal={false}
                accentColor={accentColor}
                fullScreen={true}
              />
            ))}
            {Object.values(participants).filter(p => p.owner).length === 0 && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12
              }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>
                  Waiting for creator...
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.15em' }}>
                  The event will begin shortly
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fan audience tiles (creator view only) — small strip at bottom */}
        {!joining && !error && isCreator && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: '30%'
          }}>
            {Object.values(participants).filter(p => !p.local && !p.owner).map(p => (
              <div key={p.session_id} style={{
                width: 120, height: 80, borderRadius: 8,
                background: '#161616', border: '1px solid #ffffff15',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555'
              }}>
                {p.user_name || 'Fan'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// VideoTile renders a MediaStreamTrack into a <video> element
function VideoTile({ track, name, isLocal, accentColor, fullScreen }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && track) {
      videoRef.current.srcObject = new MediaStream([track])
    }
  }, [track])

  return (
    <div style={{
      position: fullScreen ? 'absolute' : 'relative',
      inset: fullScreen ? 0 : undefined,
      background: '#111',
      borderRadius: fullScreen ? 0 : 8,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {track ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: accentColor + '22',
            border: `2px solid ${accentColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 28, color: accentColor
          }}>
            {(name || '?')[0].toUpperCase()}
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#888' }}>
            {name}{isLocal ? ' (You)' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
