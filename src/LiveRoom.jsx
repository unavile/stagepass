import { useEffect, useState, useRef, useCallback } from 'react'
import DailyIframe from '@daily-co/daily-js'

const ACCENT = '#c9a84c'

export default function LiveRoom({ event, profile, isCreator, onLeave }) {
  const [joining, setJoining] = useState(true)
  const [error, setError] = useState(null)
  const [participants, setParticipants] = useState(0)
  const containerRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    // Wait for the container div to be in the DOM
    if (!containerRef.current) {
      setError('Could not find video container. Please try again.')
      setJoining(false)
      return
    }

    let frame = null

    async function join() {
      try {
        // Get meeting token
        const tokenRes = await fetch('/.netlify/functions/create-daily-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: event.daily_room_name,
            isOwner: isCreator,
            userName: profile.display_name || 'Guest',
          })
        })

        const tokenData = await tokenRes.json()
        if (tokenData.error) throw new Error(tokenData.error)

        // Destroy any existing frame first
        if (frameRef.current) {
          frameRef.current.destroy()
          frameRef.current = null
        }

        // Create Daily iframe attached to the ref'd div
        frame = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            position: 'absolute',
            top: 0, left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: false,
          showFullscreenButton: true,
          theme: {
            colors: {
              accent: ACCENT,
              accentText: '#080808',
              background: '#0e0e0e',
              backgroundAccent: '#161616',
              baseText: '#f4f0e8',
              border: 'rgba(255,255,255,0.08)',
              mainAreaBg: '#09090b',
              mainAreaBgAccent: '#111114',
              mainAreaText: '#f4f0e8',
              supportiveText: '#9a9690',
            }
          }
        })

        frameRef.current = frame

        // Event listeners
        frame.on('joined-meeting', (e) => {
          console.log('Daily: joined-meeting', e)
          setJoining(false)
        })

        frame.on('participant-counts-updated', (e) => {
          setParticipants(e.participants?.present || 0)
        })

        frame.on('left-meeting', () => {
          console.log('Daily: left-meeting')
          onLeave()
        })

        frame.on('error', (e) => {
          console.error('Daily error:', e)
          setError(e.errorMsg || e.error?.message || 'Failed to connect to live room')
          setJoining(false)
        })

        frame.on('camera-error', (e) => {
          console.error('Daily camera error:', e)
          // Camera error doesn't stop joining — audio only is fine
        })

        // Join the room
        const dailyDomain = import.meta.env.VITE_DAILY_DOMAIN
        if (!dailyDomain) {
          throw new Error('VITE_DAILY_DOMAIN is not set. Check your environment variables.')
        }

        console.log('Daily: joining room', event.daily_room_name, 'on domain', dailyDomain)

        await frame.join({
          url: `https://${dailyDomain}/${event.daily_room_name}`,
          token: tokenData.token,
          // Start with video/audio based on role
          startVideoOff: false,
          startAudioOff: !isCreator,
        })

      } catch (err) {
        console.error('LiveRoom join error:', err)
        setError(err.message)
        setJoining(false)
      }
    }

    join()

    // Cleanup on unmount
    return () => {
      if (frameRef.current) {
        frameRef.current.destroy()
        frameRef.current = null
      }
    }
  }, []) // Only run once on mount

  async function handleLeave() {
    if (frameRef.current) {
      await frameRef.current.leave()
      frameRef.current.destroy()
      frameRef.current = null
    }
    onLeave()
  }

  async function handleEndForAll() {
    if (frameRef.current) {
      await frameRef.current.sendAppMessage({ type: 'end-event' }, '*')
      await frameRef.current.leave()
      frameRef.current.destroy()
      frameRef.current = null
    }
    onLeave()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#09090b',
      display: 'flex', flexDirection: 'column',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60,
        background: 'rgba(9,9,11,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: ACCENT }}>StagePass</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{event.name}</span>
          {!joining && (
            <span style={{
              background: 'rgba(232,69,69,0.15)', color: '#e84545',
              border: '1px solid rgba(232,69,69,0.3)', borderRadius: 4,
              fontSize: 9, fontWeight: 700, padding: '3px 8px',
              letterSpacing: '0.14em', fontFamily: "'DM Mono', monospace"
            }}>● LIVE</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!joining && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              👥 {participants} live
            </div>
          )}
          {isCreator && !joining && (
            <button onClick={handleEndForAll} style={{
              background: 'rgba(232,69,69,0.12)', color: '#e84545',
              border: '1px solid rgba(232,69,69,0.3)', borderRadius: 6,
              padding: '6px 14px', fontFamily: "'DM Mono', monospace",
              fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
            }}>END FOR ALL</button>
          )}
          <button onClick={handleLeave} style={{
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            padding: '6px 14px', fontFamily: "'DM Mono', monospace",
            fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
          }}>LEAVE</button>
        </div>
      </div>

      {/* Video container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Joining overlay */}
        {joining && !error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 20,
            background: '#09090b',
          }}>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 24, color: '#f4f0e8' }}>
              {event.name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>
              CONNECTING TO LIVE ROOM...
            </div>
            {/* Animated dots instead of fake progress bar */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: ACCENT,
                  opacity: 0.3,
                  animation: `pulse-${i} 1.2s ${i * 0.2}s ease-in-out infinite`,
                }} />
              ))}
            </div>
            <style>{`
              @keyframes pulse-0 { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
              @keyframes pulse-1 { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
              @keyframes pulse-2 { 0%,100%{opacity:0.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.3)} }
            `}</style>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.2)', maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
              Please allow camera and microphone access if prompted.
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 16,
            background: '#09090b',
          }}>
            <div style={{ fontSize: 36 }}>⚠️</div>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f4f0e8' }}>
              Couldn't join room
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.35)', maxWidth: 360, textAlign: 'center', lineHeight: 1.7 }}>
              {error}
            </div>
            <button onClick={onLeave} style={{
              marginTop: 8, background: ACCENT, color: '#080808',
              border: 'none', borderRadius: 7, padding: '10px 24px',
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
              boxShadow: `0 4px 20px ${ACCENT}50`,
            }}>GO BACK</button>
          </div>
        )}

        {/* Daily iframe mounts here via ref */}
        <div
          ref={containerRef}
          style={{
            position: 'absolute', inset: 0,
            opacity: joining ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
