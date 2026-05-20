import { useEffect, useState, useCallback } from 'react'
import DailyIframe from '@daily-co/daily-js'

export default function LiveRoom({ event, profile, isCreator, onLeave }) {
  const [callFrame, setCallFrame] = useState(null)
  const [joining, setJoining] = useState(true)
  const [error, setError] = useState(null)
  const [participants, setParticipants] = useState(0)

  const accentColor = '#c9a84c'

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

      // Create the Daily call frame
      const frame = DailyIframe.createFrame(
        document.getElementById('daily-container'),
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
              accent: accentColor,
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

      frame.on('participant-counts-updated', (e) => {
        setParticipants(e.participants.present)
      })

      frame.on('left-meeting', () => {
        onLeave()
      })

      frame.on('error', (e) => {
        setError(e.errorMsg || 'Failed to join room')
        setJoining(false)
      })

      await frame.join({
        url: `https://${process.env.VITE_DAILY_DOMAIN || import.meta.env.VITE_DAILY_DOMAIN}/${event.daily_room_name}`,
        token,
      })

      setCallFrame(frame)
    } catch (err) {
      setError(err.message)
      setJoining(false)
    }
  }, [event, profile, isCreator])

  useEffect(() => {
    joinRoom()
    return () => {
      if (callFrame) {
        callFrame.destroy()
      }
    }
  }, [])

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
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 60, background: '#0a0a0a', borderBottom: '1px solid #ffffff0a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: accentColor }}>StagePass</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444' }}>·</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#888' }}>{event.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!joining && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#555' }}>
              👥 {participants} live
            </div>
          )}
          {isCreator && !joining && (
            <button onClick={handleEndForAll} style={{ background: '#e8454518', color: '#e84545', border: '1px solid #e8454544', borderRadius: 6, padding: '6px 14px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
              END EVENT
            </button>
          )}
          <button onClick={handleLeave} style={{ background: '#ffffff0a', color: '#888', border: '1px solid #ffffff15', borderRadius: 6, padding: '6px 14px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
            LEAVE
          </button>
        </div>
      </div>

      {/* Room container */}
      <div style={{ flex: 1, padding: '20px', position: 'relative' }}>
        {joining && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#444', letterSpacing: '0.2em' }}>JOINING ROOM...</div>
            <div style={{ width: 200, height: 2, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: accentColor, borderRadius: 999, animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: '#f0ebe0' }}>Couldn't join room</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#555' }}>{error}</div>
            <button onClick={onLeave} style={{ background: accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>
              GO BACK
            </button>
          </div>
        )}

        <div id="daily-container" style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 100px)', borderRadius: 12, overflow: 'hidden', opacity: joining ? 0 : 1, transition: 'opacity 0.3s' }} />
      </div>
    </div>
  )
}