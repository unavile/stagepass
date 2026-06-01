import { useEffect, useState, useCallback, useRef } from 'react'
import DailyIframe from '@daily-co/daily-js'

export default function LiveRoom({ event, profile, isCreator, onLeave }) {
  const accentColor = '#c9a84c'

  const containerRef = useRef(null)
  const frameRef = useRef(null)
  const isJoinedRef = useRef(false)
  const joinStarted = useRef(false)

  // Stable refs for props — prevents useCallback from depending on unstable values
  const onLeaveRef = useRef(onLeave)
  const eventRef = useRef(event)
  const profileRef = useRef(profile)
  const isCreatorRef = useRef(isCreator)

  const [callFrame, setCallFrame] = useState(null)
  const [joining, setJoining] = useState(true)
  const [error, setError] = useState(null)
  const [participants, setParticipants] = useState(0)

  // Keep prop refs in sync without causing re-renders or re-creating joinRoom
  useEffect(() => { onLeaveRef.current = onLeave }, [onLeave])
  useEffect(() => { eventRef.current = event }, [event])
  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { isCreatorRef.current = isCreator }, [isCreator])

  // joinRoom has empty deps — created once, uses refs for all external values
  // This prevents the useEffect from re-running when props change
  const joinRoom = useCallback(async () => {
    // Prevent re-entry (StrictMode double-invoke, polling race)
    if (joinStarted.current) return
    joinStarted.current = true

    // Destroy ANY existing Daily instance before creating a new one
    try {
      const existing = DailyIframe.getCallInstance()
      if (existing) {
        console.log('Destroying existing Daily instance')
        existing.destroy()
      }
    } catch {}
    if (frameRef.current) {
      try { frameRef.current.destroy() } catch {}
      frameRef.current = null
    }

    try {
      // Get a meeting token
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

      if (!containerRef.current) throw new Error('Live room container not ready')

      const frame = DailyIframe.createFrame(
        containerRef.current,
        {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: false,
          showFullscreenButton: true,
          startVideoOff: !isCreatorRef.current,
          startAudioOff: !isCreatorRef.current,
          subscribeToTracksAutomatically: true,

          theme: {
            colors: {
              accent: '#c9a84c',
              accentText: '#080808',
              background: '#0e0e0e',
              backgroundAccent: '#161616',
              baseText: '#e8e2d6',
              border: '#ffffff15',
              mainAreaBg: '#080808',
              mainAreaBgAccent: '#0e0e0e',
              mainAreaText: '#e8e2d6',
              supportiveText: '#888',
            }
          }
        }
      )

      frame.on('joined-meeting', () => {
        isJoinedRef.current = true
        setJoining(false)
      })

      // When a remote participant joins, unsubscribe from their video
      // so the creator only sees their own content in the main panel
      frame.on('participant-joined', (e) => {
        if (!isCreatorRef.current || e?.participant?.local) return
        try {
          frame.updateParticipant(e.participant.session_id, {
            setSubscribedTracks: { audio: true, video: false, screenVideo: false, screenAudio: false },
          })
        } catch (err) {
          console.warn('updateParticipant error:', err.message)
        }
      })

      // Fallback: fires when local participant joins
      frame.on('participant-updated', (e) => {
        if (e.participant?.local) {
          isJoinedRef.current = true
          setJoining(false)
        }
      })

      frame.on('participant-counts-updated', (e) => {
        // Daily.co v2 uses e.participantCounts, v1 uses e.participants
        const count = e?.participantCounts?.present ?? e?.participants?.present ?? 0
        setParticipants(count)
      })

      // Also update count on any participant change as a fallback
      frame.on('participant-joined', () => {
        setParticipants(prev => prev + 1)
      })
      frame.on('participant-left', () => {
        setParticipants(prev => Math.max(0, prev - 1))
      })

      frame.on('left-meeting', () => {
        // Only navigate away if user actually joined — prevents premature exit
        // during Daily.co internal setup, reconnects, or cleanup
        if (isJoinedRef.current) {
          onLeaveRef.current()
        }
      })

      frame.on('error', (e) => {
        setError(e.errorMsg || 'Failed to join room')
        setJoining(false)
      })

      await frame.join({
        url: `https://${import.meta.env.VITE_DAILY_DOMAIN}/${eventRef.current.daily_room_name}`,
        token,
        startVideoOff: !isCreatorRef.current,
        startAudioOff: !isCreatorRef.current,
      })

      frameRef.current = frame
      setCallFrame(frame)
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }, [])  // empty deps — all values accessed via refs

  useEffect(() => {
    // Poll until container div is mounted, then join exactly once
    let attempts = 0
    const maxAttempts = 20
    const interval = setInterval(() => {
      attempts++
      if (containerRef.current) {
        clearInterval(interval)
        joinRoom()
      } else if (attempts >= maxAttempts) {
        clearInterval(interval)
        setError('Live room container failed to mount. Please try again.')
        setJoining(false)
      }
    }, 150)

    return () => {
      clearInterval(interval)
      joinStarted.current = false
      isJoinedRef.current = false
      if (frameRef.current) {
        try { frameRef.current.destroy() } catch {}
        frameRef.current = null
      }
    }
  }, [joinRoom])

  async function handleLeave() {
    isJoinedRef.current = false
    const frame = frameRef.current || callFrame
    if (frame) {
      try { await frame.leave() } catch {}
      try { frame.destroy() } catch {}
      frameRef.current = null
    }
    onLeave()
  }

  async function handleEndForAll() {
    isJoinedRef.current = false
    const frame = frameRef.current || callFrame
    if (frame) {
      try {
        if (!joining) await frame.sendAppMessage({ type: 'end-event' }, '*')
        await frame.leave()
        frame.destroy()
      } catch {}
      frameRef.current = null
    }
    onLeave()
  }

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
              👥 {participants} live
            </div>
          )}
          {isCreator && !joining && (
            <button onClick={handleEndForAll} style={{
              background: '#e8454518', color: '#e84545',
              border: '1px solid #e8454544', borderRadius: 6,
              padding: '6px 14px', fontFamily: "'DM Mono', monospace",
              fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em'
            }}>
              END FOR ALL
            </button>
          )}
          <button onClick={handleLeave} style={{
            background: '#ffffff0a', color: '#888',
            border: '1px solid #ffffff15', borderRadius: 6,
            padding: '6px 14px', fontFamily: "'DM Mono', monospace",
            fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em'
          }}>
            LEAVE
          </button>
        </div>
      </div>

      {/* Room container */}
      <div style={{ flex: 1, padding: '20px', position: 'relative' }}>

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
            }}>
              GO BACK
            </button>
          </div>
        )}

        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: 'calc(100vh - 100px)',
            borderRadius: 12,
            overflow: 'hidden',
            opacity: joining ? 0 : 1,
            transition: 'opacity 0.3s'
          }}
        />
      </div>
    </div>
  )
}
