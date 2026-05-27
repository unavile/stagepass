import { useEffect, useState, useCallback, useRef } from 'react'
import DailyIframe from '@daily-co/daily-js'

export default function LiveRoom({ event, profile, isCreator, onLeave }) {
  // accentColor must be declared before all hooks
  const accentColor = '#c9a84c'

  const containerRef = useRef(null)
  const [callFrame, setCallFrame] = useState(null)
  const [joining, setJoining] = useState(true)
  const [error, setError] = useState(null)
  const [participants, setParticipants] = useState(0)

  const joinRoom = useCallback(async () => {
    try {
      // Get a meeting token
      const tokenRes = await fetch('/.netlify/functions/create-daily-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: event.daily_room_name,
          isOwner: isCreator,
          userName: profile.display_name || 'Guest',
        })
      })
      const { token, error: tokenError } = await tokenRes.json()
      if (tokenError) throw new Error(tokenError)

      // Wait for container ref to be available
      if (!containerRef.current) throw new Error('Live room container not ready')

      // Create the Daily call frame inside the container div
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
        setJoining(false)
      })

      // Fallback: participant-updated fires when local participant joins
      // This catches cases where joined-meeting doesn't fire reliably
      frame.on('participant-updated', (e) => {
        if (e.participant?.local) {
          setJoining(false)
        }
      })

      frame.on('participant-counts-updated', (e) => {
        setParticipants(e.participants?.present || 0)
      })

      frame.on('left-meeting', () => {
        onLeave()
      })

      frame.on('error', (e) => {
        setError(e.errorMsg || 'Failed to join room')
        setJoining(false)
      })

      // Join using import.meta.env for browser env vars
      await frame.join({
        url: `https://${import.meta.env.VITE_DAILY_DOMAIN}/${event.daily_room_name}`,
        token,
      })

      setCallFrame(frame)
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }, [event, profile, isCreator, onLeave, containerRef])

  useEffect(() => {
    // Wait for DOM to be fully ready before Daily mounts
    // 300ms gives React time to paint the container
    const timer = setTimeout(() => {
      if (containerRef.current) {
        joinRoom()
      } else {
        // Retry once more if container still not ready
        setTimeout(() => {
          if (containerRef.current) joinRoom()
        }, 300)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      if (callFrame) {
        callFrame.destroy()
      }
    }
  }, [joinRoom])

  async function handleLeave() {
    if (callFrame) {
      await callFrame.leave()
      callFrame.destroy()
    }
    onLeave()
  }

  async function handleEndForAll() {
    if (callFrame) {
      await callFrame.sendAppMessage({ type: 'end-event' }, '*')
      await callFrame.leave()
      callFrame.destroy()
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

        {/* Joining state */}
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
              <div style={{
                width: '60%', height: '100%',
                background: accentColor, borderRadius: 999,
              }} />
            </div>
          </div>
        )}

        {/* Error state */}
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

        {/* Daily iframe container */}
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
