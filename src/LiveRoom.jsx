import { useEffect, useState, useCallback, useRef } from 'react'
import DailyIframe from '@daily-co/daily-js'

// Module-level flag — survives React Strict Mode double-mounts unlike a ref.
let globalJoinInProgress = false

export default function LiveRoom({ event, profile, isCreator, onLeave, accessToken }) {
  const accentColor = '#c9a84c'

  const frameRef = useRef(null)
  const isJoinedRef = useRef(false)
  const onLeaveRef = useRef(onLeave)
  const eventRef = useRef(event)
  const profileRef = useRef(profile)
  const isCreatorRef = useRef(isCreator)
  const sessionRowIdRef = useRef(null)
  const isMountActiveRef = useRef(false)
  const containerRef = useRef(null)  // parentEl for Daily iframe

  const [joining, setJoining] = useState(true)
  const [error, setError] = useState(null)
  const [participants, setParticipants] = useState(0)
  // null = live, 'loading' = fetching summary, Array = summary ready
  const [sessionSummary, setSessionSummary] = useState(null)

  useEffect(() => { onLeaveRef.current = onLeave }, [onLeave])
  useEffect(() => { eventRef.current = event }, [event])
  useEffect(() => { profileRef.current = profile }, [profile])
  useEffect(() => { isCreatorRef.current = isCreator }, [isCreator])

  async function logParticipantJoin() {
    try {
      const res = await fetch('/.netlify/functions/log-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          eventId: eventRef.current.id,
          creatorId: eventRef.current.creator_id,
          displayName: profileRef.current?.display_name || 'Guest',
          fanId: profileRef.current?.id || null,
        })
      })
      const { rowId } = await res.json()
      if (rowId) sessionRowIdRef.current = rowId
    } catch (e) {
      console.error('log-participant join error:', e)
    }
  }

  async function logParticipantLeave() {
    if (!sessionRowIdRef.current) return
    try {
      await fetch('/.netlify/functions/log-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', sessionRowId: sessionRowIdRef.current })
      })
    } catch (e) {
      console.error('log-participant leave error:', e)
    }
  }

  async function fetchSessionSummary() {
    // Fetch via the Netlify function using the service role key — this bypasses
    // RLS entirely so we never hit auth/token issues on the summary screen.
    try {
      const res = await fetch('/.netlify/functions/log-participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch', eventId: eventRef.current.id }),
      })
      const json = await res.json()
      if (json.error) {
        console.error('fetchSessionSummary error from function:', json.error)
        return []
      }
      console.log('fetchSessionSummary rows:', json.rows?.length)
      return Array.isArray(json.rows) ? json.rows : []
    } catch (e) {
      console.error('fetchSessionSummary error:', e)
      return []
    }
  }

  async function destroyExistingInstances() {
    if (frameRef.current) {
      try { await frameRef.current.destroy() } catch {}
      frameRef.current = null
    }
    try {
      const existing = DailyIframe.getCallInstance()
      if (existing) { await existing.destroy() }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const joinRoom = useCallback(async () => {
    if (globalJoinInProgress) return
    globalJoinInProgress = true
    isMountActiveRef.current = true

    await destroyExistingInstances()

    if (!isMountActiveRef.current) {
      globalJoinInProgress = false
      return
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

      if (!isMountActiveRef.current) { globalJoinInProgress = false; return }

      // Wait for the container div to be in the DOM before mounting
      if (!containerRef.current) throw new Error('Container not ready')

      // Daily is mounted into containerRef (the padding-bottom aspect-ratio div).
      // iframeStyle uses absolute positioning to fill that container exactly —
      // this is the official Daily.co fix for video cropping on responsive pages.
      const frame = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          border: 'none',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
        showUserNameChangeUI: false,
        showLocalVideo: isCreatorRef.current,
        // Fans watch a single broadcaster — use grid mode (activeSpeakerMode: false)
        // so Daily uses object-fit: contain internally, showing the full video frame
        // without cropping the edges. Active speaker mode (the default) uses
        // object-fit: cover which intentionally crops to fill the tile.
        activeSpeakerMode: isCreatorRef.current ? true : false,
        // Hide the participants bar for fans — they don't need to see thumbnails
        // and hiding it gives the main video the full iframe height.
        showParticipantsBar: isCreatorRef.current ? true : false,
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
      })

      frame.on('joined-meeting', async () => {
        isJoinedRef.current = true
        setJoining(false)
        globalJoinInProgress = false
        await logParticipantJoin()
      })

      frame.on('participant-updated', (e) => {
        if (e.participant?.local) {
          isJoinedRef.current = true
          setJoining(false)
          globalJoinInProgress = false
        }
      })

      frame.on('participant-counts-updated', (e) => {
        const count = e?.participantCounts?.present ?? e?.participants?.present ?? 0
        setParticipants(count)
      })

      frame.on('participant-joined', () => {
        setParticipants(prev => prev + 1)
      })

      frame.on('participant-left', () => {
        setParticipants(prev => Math.max(0, prev - 1))
      })

      frame.on('left-meeting', () => {
        globalJoinInProgress = false
        if (isJoinedRef.current) onLeaveRef.current()
      })

      frame.on('error', (e) => {
        globalJoinInProgress = false
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
    } catch (err) {
      globalJoinInProgress = false
      setError(err.message)
      setJoining(false)
    }
  }, [])

  useEffect(() => {
    // Poll until containerRef is mounted in the DOM, then call joinRoom.
    // Needed because createFrame() now takes a parentEl and throws if it's null.
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
      isMountActiveRef.current = false
      isJoinedRef.current = false
      globalJoinInProgress = false
      if (frameRef.current) {
        try { frameRef.current.destroy() } catch {}
        frameRef.current = null
      }
    }
  }, [joinRoom])

  async function handleLeave() {
    isJoinedRef.current = false
    await logParticipantLeave()
    const frame = frameRef.current
    if (frame) {
      try { await frame.leave() } catch {}
      try { frame.destroy() } catch {}
      frameRef.current = null
    }
    onLeave()
  }

  async function handleEndForAll() {
    isJoinedRef.current = false

    // 1. Log the creator's own leave
    await logParticipantLeave()

    // 2. Tear down the Daily call
    const frame = frameRef.current
    if (frame) {
      try {
        if (!joining) await frame.sendAppMessage({ type: 'end-event' }, '*')
        await frame.leave()
        frame.destroy()
      } catch {}
      frameRef.current = null
    }

    // 3. Show loading state while we fetch the participant list
    setSessionSummary('loading')

    // Small delay — give the DB a moment to receive the final leave stamps
    // from any participants whose left_at is being written simultaneously
    await new Promise(resolve => setTimeout(resolve, 1200))

    const rows = await fetchSessionSummary()
    setSessionSummary(rows)
  }

  // ── Session summary screen (shown to creator after ending for all) ──────────
  if (sessionSummary !== null) {
    const rows = Array.isArray(sessionSummary) ? sessionSummary : []
    const loading = sessionSummary === 'loading'

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: '#080808', display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Mono', monospace",
      }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: 60, background: '#0a0a0a',
          borderBottom: '1px solid #ffffff0a', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: accentColor }}>Coveted Stage</span>
            <span style={{ fontSize: 11, color: '#444' }}>·</span>
            <span style={{ fontSize: 12, color: '#888' }}>{event.name}</span>
            <span style={{
              background: '#ffffff0a', color: '#555',
              border: '1px solid #ffffff10', borderRadius: 4,
              fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.12em',
            }}>ENDED</span>
          </div>
          <button onClick={onLeave} style={{
            background: accentColor, color: '#080808',
            border: 'none', borderRadius: 6, padding: '7px 18px',
            fontFamily: "'DM Mono', monospace", fontSize: 11,
            fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em',
          }}>DONE</button>
        </div>

        {/* Summary body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px', maxWidth: 760, width: '100%', margin: '0 auto' }}>

          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: '#f0ebe0', marginBottom: 6 }}>
            Session Summary
          </div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.14em', marginBottom: 32 }}>
            {event.name.toUpperCase()}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 80 }}>
              <div style={{ fontSize: 11, color: '#444', letterSpacing: '0.2em' }}>LOADING ATTENDEES...</div>
              <div style={{ width: 200, height: 2, background: '#1a1a1a', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: '60%', height: '100%', background: accentColor, borderRadius: 999 }} />
              </div>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'TOTAL VIEWERS', value: rows.length },
                  { label: 'REGISTERED FANS', value: rows.filter(r => r.fan_id).length },
                  { label: 'GUESTS', value: rows.filter(r => !r.fan_id).length },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'rgba(17,17,20,0.8)', border: '1px solid #ffffff0a',
                    borderRadius: 10, padding: '16px 20px',
                  }}>
                    <div style={{ fontSize: 8, color: '#555', letterSpacing: '0.2em', marginBottom: 8 }}>{stat.label}</div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 30, color: accentColor }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Participant table */}
              {rows.length === 0 ? (
                <div style={{
                  background: 'rgba(17,17,20,0.8)', border: '1px solid #ffffff08',
                  borderRadius: 10, padding: '40px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, color: '#555' }}>No viewer data was recorded for this session.</div>
                </div>
              ) : (
                <div style={{ background: 'rgba(17,17,20,0.8)', border: '1px solid #ffffff08', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Column headers */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px',
                    gap: 8, padding: '10px 20px',
                    borderBottom: '1px solid #ffffff08',
                    fontSize: 8, color: '#444', letterSpacing: '0.18em',
                  }}>
                    <span>NAME</span>
                    <span>JOINED</span>
                    <span>LEFT</span>
                    <span>DURATION</span>
                  </div>

                  {rows.map((p, i) => {
                    const joinedAt = p.joined_at ? new Date(p.joined_at) : null
                    const leftAt = p.left_at ? new Date(p.left_at) : null
                    let duration = '—'
                    if (joinedAt && leftAt) {
                      const mins = Math.round((leftAt - joinedAt) / 60000)
                      duration = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
                    } else if (joinedAt) {
                      duration = 'Active'
                    }
                    return (
                      <div key={p.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px',
                        gap: 8, padding: '12px 20px', alignItems: 'center',
                        borderBottom: i < rows.length - 1 ? '1px solid #ffffff05' : 'none',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}>
                        {/* Name + badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: '#111', border: `1px solid ${accentColor}33`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: "'DM Serif Display', Georgia, serif",
                            fontSize: 11, color: accentColor,
                          }}>
                            {(p.display_name || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: '#f0ebe0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.display_name || 'Guest'}
                            </div>
                            <div style={{ fontSize: 8, color: '#444', letterSpacing: '0.12em', marginTop: 1 }}>
                              {p.fan_id ? 'REGISTERED FAN' : 'GUEST'}
                            </div>
                          </div>
                        </div>

                        {/* Joined */}
                        <div style={{ fontSize: 11, color: '#666' }}>
                          {joinedAt ? joinedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>

                        {/* Left */}
                        <div style={{ fontSize: 11, color: '#666' }}>
                          {leftAt ? leftAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>

                        {/* Duration */}
                        <div style={{
                          fontSize: 11, fontWeight: 600,
                          color: duration === 'Active' ? '#6dbf8a' : '#9a9690',
                        }}>
                          {duration}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <button onClick={onLeave} style={{
                marginTop: 28, width: '100%',
                background: accentColor, color: '#080808',
                border: 'none', borderRadius: 8, padding: '13px 0',
                fontFamily: "'DM Mono', monospace", fontSize: 12,
                fontWeight: 700, cursor: 'pointer', letterSpacing: '0.14em',
                boxShadow: `0 4px 20px ${accentColor}40`,
              }}>BACK TO DASHBOARD</button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Live room view ──────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#080808',
      display: 'flex', flexDirection: 'column',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60, background: '#0a0a0a',
        borderBottom: '1px solid #ffffff0a',
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

      {/* Aspect-ratio wrapper — Daily.co's official fix for video cropping.
          This must be a block element (not flex) so that padding-bottom: 56.25%
          correctly resolves against the element's width to enforce 16:9.
          Inside a flex container, percentage padding resolves to zero. */}
      <div style={{
        position: 'relative',
        width: isCreator ? 'calc(100% - 32px)' : '100%',
        paddingBottom: isCreator ? 'calc(56.25% - 18px)' : '56.25%',
        background: '#080808',
        margin: isCreator ? '16px auto' : '0',
      }}>

        {/* Daily iframe mounts here via containerRef — fills the aspect-ratio box */}
        <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

          {/* Loading overlay — sits on top of the container while joining */}
          {joining && !error && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: '#080808',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 20,
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

          {/* Error overlay */}
          {error && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: '#080808',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 16,
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

        </div>
    </div>
  )
}
