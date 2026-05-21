import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePublicEvents } from './hooks/useEvents'
import { useFanEvents } from './hooks/useFanEvents'
import LiveRoom from './LiveRoom'

// ─── Design tokens ─────────────────────────────────────────────────────────
const BG      = '#09090b'
const BG2     = '#111114'
const BG3     = '#18181c'
const BORDER  = 'rgba(255,255,255,0.08)'
const BORDER2 = 'rgba(255,255,255,0.04)'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
// const TEXT3   = '#555250'
const TEXT3   = '#8c8883'
const ACCENT  = '#c9a84c'

// Background images
const IMG_STAGE = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1920&q=80'

const card = (extra = {}) => ({
  background: 'rgba(17,17,20,0.75)',
  backdropFilter: 'blur(12px)',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  ...extra,
})

function Pill({ color, children }) {
  return (
    <span style={{
      background: color + '1a', color,
      border: `1px solid ${color}40`,
      borderRadius: 4, fontSize: 9, fontWeight: 700,
      padding: '2px 7px', letterSpacing: '0.14em',
      textTransform: 'uppercase', fontFamily: "'DM Mono', monospace"
    }}>{children}</span>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3,
      letterSpacing: '0.22em', textTransform: 'uppercase',
      marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: BORDER2 }} />
    </div>
  )
}

export default function FanApp({ session, profile, onSignOut }) {
  const [creators, setCreators] = useState([])
  const [selected, setSelected] = useState(null)
  const [posts, setPosts] = useState([])
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [eventRsvps, setEventRsvps] = useState({})
  const [activeTab, setActiveTab] = useState('discover')
  const [liveEvent, setLiveEvent] = useState(null)

  const { events: creatorEvents } = usePublicEvents(selected?.id)
  const { events: fanEvents, loading: fanEventsLoading, refetch: refetchFanEvents } = useFanEvents(session.user.id)

  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }

  useEffect(() => {
    supabase
      .from('creators')
      .select('*, profiles(display_name, handle, bio, avatar_url)')
      .then(({ data }) => { setCreators(data || []); setLoading(false) })
  }, [])

  async function selectCreator(c) {
    setSelected(c)
    const [{ data: postsData }, { data: subData }, { data: rsvpData }] = await Promise.all([
      supabase.from('posts').select('*').eq('creator_id', c.id).order('published_at', { ascending: false }),
      supabase.from('subscriptions').select('id').eq('fan_id', session.user.id).eq('creator_id', c.id).eq('status', 'active').maybeSingle(),
      supabase.from('rsvps').select('event_id').eq('fan_id', session.user.id)
    ])
    setPosts(postsData || [])
    setSubscribed(!!subData)
    const rsvpMap = {}
    rsvpData?.forEach(r => { rsvpMap[r.event_id] = true })
    setEventRsvps(rsvpMap)
  }

  async function handleSubscribe() {
    setSubscribeLoading(true)
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: selected.id,
          creatorName: selected.profiles?.display_name,
          monthlyPrice: selected.monthly_price,
          fanId: session.user.id,
          fanEmail: session.user.email,
        })
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
    }
    setSubscribeLoading(false)
  }

  async function handleUnsubscribe() {
    await supabase.from('subscriptions').update({ status: 'cancelled' })
      .eq('fan_id', session.user.id)
      .eq('creator_id', selected.id)
    setSubscribed(false)
  }

  async function handleRsvp(eventId) {
    const alreadyRsvped = eventRsvps[eventId]
    if (alreadyRsvped) {
      await supabase.from('rsvps').delete().eq('event_id', eventId).eq('fan_id', session.user.id)
      setEventRsvps(prev => ({ ...prev, [eventId]: false }))
    } else {
      const { error } = await supabase.from('rsvps')
        .upsert({ event_id: eventId, fan_id: session.user.id }, { onConflict: 'event_id,fan_id' })
      if (!error) setEventRsvps(prev => ({ ...prev, [eventId]: true }))
    }
    refetchFanEvents()
  }

  return (
    <div style={{
      minHeight: '100vh',
      color: TEXT1,
      // Concert stage background with dark overlay
      backgroundImage: `
        linear-gradient(to bottom,
          rgba(9,9,11,0.72) 0%,
          rgba(9,9,11,0.85) 35%,
          rgba(9,9,11,0.96) 100%
        ),
        url('${IMG_STAGE}')
      `,
      backgroundSize: 'cover',
      backgroundPosition: 'center 30%',
      backgroundAttachment: 'fixed',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Accent glow */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: 800, height: 600,
        background: `radial-gradient(ellipse at 15% 0%, ${ACCENT}0a 0%, transparent 55%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: 64,
        borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 0,
        background: 'rgba(9,9,11,0.82)',
        backdropFilter: 'blur(24px)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {selected && activeTab === 'discover' && (
            <button onClick={() => setSelected(null)} style={{
              background: 'none', border: 'none', color: TEXT3,
              fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '4px 8px 4px 0',
            }}>←</button>
          )}
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: ACCENT, letterSpacing: '0.01em' }}>StagePass</span>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[
            { id: 'discover', label: 'Discover' },
            { id: 'myevents', label: `Events${fanEvents.length > 0 ? ` · ${fanEvents.length}` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(null) }} style={{
              background: activeTab === t.id ? ACCENT + '14' : 'transparent',
              border: activeTab === t.id ? `1px solid ${ACCENT}40` : '1px solid transparent',
              borderRadius: 7, padding: '6px 14px',
              color: activeTab === t.id ? ACCENT : TEXT3,
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
          <div style={{ width: 1, height: 16, background: BORDER, margin: '0 4px' }} />
          <button onClick={onSignOut} style={{
            background: 'transparent', border: `1px solid ${BORDER}`,
            borderRadius: 7, padding: '6px 12px',
            color: TEXT3, fontFamily: "'DM Mono', monospace",
            fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
          }}>SIGN OUT</button>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 1 }}>

      {/* ── DISCOVER TAB ── */}
      {activeTab === 'discover' && (
        <>
          {/* Creator grid */}
          {!selected && (
            <div style={{ padding: '44px 28px', maxWidth: 960, margin: '0 auto' }}>
              <div style={{ marginBottom: 40 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 38, color: TEXT1, lineHeight: 1.15, marginBottom: 6 }}>
                  Discover <span style={{ color: ACCENT }}>Creators</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.2em' }}>FIND ARTISTS TO SUPPORT</div>
              </div>

              {loading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading creators...</div>
              ) : creators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                  No creators yet. Check back soon.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 20 }}>
                  {creators.map(c => (
                    <div key={c.id} onClick={() => selectCreator(c)}
                      style={{
                        background: 'rgba(17,17,20,0.72)',
                        backdropFilter: 'blur(16px)',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 16, padding: '26px',
                        cursor: 'pointer', transition: 'all 0.2s',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = ACCENT + '55'
                        e.currentTarget.style.transform = 'translateY(-3px)'
                        e.currentTarget.style.boxShadow = `0 12px 40px ${ACCENT}18`
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = BORDER
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'
                      }}
                    >
                      <div style={{
                        width: 54, height: 54, borderRadius: '50%',
                        background: BG3, border: `2px solid ${ACCENT}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'DM Serif Display', Georgia, serif",
                        fontSize: 18, color: ACCENT, marginBottom: 18,
                        overflow: 'hidden', flexShrink: 0,
                        boxShadow: `0 0 20px ${ACCENT}25`,
                      }}>
                        {c.profiles?.avatar_url ? (
                          <img src={c.profiles.avatar_url} alt={c.profiles.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          (c.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)
                        )}
                      </div>
                      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 19, color: TEXT1, marginBottom: 3 }}>{c.profiles?.display_name || 'Creator'}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, marginBottom: 10, letterSpacing: '0.08em' }}>@{c.profiles?.handle || 'creator'}</div>
                      {c.profiles?.bio && (
                        <div style={{ fontSize: 12, color: TEXT3, lineHeight: 1.65, marginBottom: 18 }}>{c.profiles.bio}</div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: `1px solid ${BORDER2}` }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: ACCENT, fontWeight: 700 }}>${c.monthly_price}<span style={{ fontSize: 10, color: TEXT3, fontWeight: 400 }}>/mo</span></div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.1em' }}>VIEW PAGE →</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Creator page */}
          {selected && (
            <div style={{ maxWidth: 820, margin: '0 auto', padding: '36px 28px' }}>

              {/* Header card */}
              <div style={{
                background: 'rgba(17,17,20,0.80)',
                backdropFilter: 'blur(20px)',
                border: `1px solid ${ACCENT}22`,
                borderRadius: 16, padding: '28px',
                marginBottom: 24,
                boxShadow: `0 8px 48px ${ACCENT}0c`,
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                  <div style={{
                    width: 70, height: 70, borderRadius: '50%',
                    background: BG3, border: `2px solid ${ACCENT}55`,
                    overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 24px ${ACCENT}30`,
                  }}>
                    {selected.profiles?.avatar_url ? (
                      <img src={selected.profiles.avatar_url} alt={selected.profiles.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 24, color: ACCENT }}>
                        {(selected.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1, marginBottom: 4, lineHeight: 1.2 }}>{selected.profiles?.display_name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, marginBottom: 10, letterSpacing: '0.08em' }}>@{selected.profiles?.handle}</div>
                    {selected.profiles?.bio && <p style={{ fontSize: 13, color: TEXT2, lineHeight: 1.65, maxWidth: 420, margin: 0 }}>{selected.profiles.bio}</p>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {subscribed ? (
                    <div>
                      <div style={{
                        background: ACCENT + '14', color: ACCENT,
                        border: `1px solid ${ACCENT}40`, borderRadius: 7,
                        padding: '7px 16px', fontFamily: "'DM Mono', monospace",
                        fontSize: 10, marginBottom: 8, letterSpacing: '0.1em'
                      }}>✓ SUBSCRIBED</div>
                      <button onClick={handleUnsubscribe} style={{
                        background: 'transparent', border: `1px solid ${BORDER}`,
                        borderRadius: 7, padding: '6px 14px',
                        color: TEXT3, fontFamily: "'DM Mono', monospace",
                        fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
                        display: 'block', width: '100%',
                      }}>CANCEL</button>
                    </div>
                  ) : (
                    <button onClick={handleSubscribe} disabled={subscribeLoading} style={{
                      background: ACCENT, color: '#080808',
                      border: 'none', borderRadius: 8, padding: '12px 22px',
                      fontFamily: "'DM Mono', monospace", fontSize: 11,
                      fontWeight: 700, letterSpacing: '0.12em',
                      cursor: subscribeLoading ? 'not-allowed' : 'pointer',
                      opacity: subscribeLoading ? 0.7 : 1,
                      boxShadow: `0 4px 24px ${ACCENT}50`,
                    }}>
                      {subscribeLoading ? 'REDIRECTING...' : `SUBSCRIBE · $${selected.monthly_price}/mo`}
                    </button>
                  )}
                </div>
              </div>

              {/* Posts */}
              <SectionLabel>Posts</SectionLabel>
              {posts.length === 0 ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: 'center', padding: '40px 0' }}>No posts yet.</div>
              ) : posts.map(post => {
                const canView = !post.is_locked || subscribed
                return (
                  <div key={post.id} style={{
                    ...card({ padding: '16px 18px', marginBottom: 10 }),
                    opacity: canView ? 1 : 0.55,
                  }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ width: 42, height: 42, background: BG3, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{post.thumbnail_emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: canView ? TEXT1 : TEXT3, marginBottom: 5 }}>{post.title}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Pill color={TEXT2}>{typeLabels[post.type]}</Pill>
                          {post.is_locked && !subscribed && <Pill color={ACCENT}>EXCLUSIVE</Pill>}
                          {post.is_locked && subscribed && <Pill color={ACCENT}>✓ UNLOCKED</Pill>}
                        </div>
                      </div>
                      {post.is_locked && !subscribed && <span style={{ color: TEXT3, fontSize: 16 }}>🔒</span>}
                    </div>
                    {canView && post.file_url && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER2}` }}>
                        {post.type === 'video' && <video controls src={post.file_url} style={{ width: '100%', borderRadius: 8, maxHeight: 300 }} />}
                        {post.type === 'audio' && <audio controls src={post.file_url} style={{ width: '100%' }} />}
                        {post.type === 'text' && <a href={post.file_url} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.08em' }}>OPEN PDF →</a>}
                      </div>
                    )}
                    {canView && post.description && (
                      <div style={{ marginTop: 10, fontSize: 13, color: TEXT2, lineHeight: 1.65 }}>{post.description}</div>
                    )}
                  </div>
                )
              })}

              {/* Events */}
              {creatorEvents.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <SectionLabel>Upcoming Events</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {creatorEvents.map(event => (
                      <div key={event.id} style={{
                        background: 'rgba(17,17,20,0.75)',
                        backdropFilter: 'blur(16px)',
                        border: `1px solid ${ACCENT}22`,
                        borderRadius: 12, padding: '18px 20px',
                        boxShadow: `0 4px 32px ${ACCENT}08`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: TEXT1, marginBottom: 3 }}>{event.name}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: ACCENT, fontWeight: 700 }}>
                              {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                          <span style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 9px', letterSpacing: '0.14em', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                            {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                          </span>
                        </div>
                        {event.description && <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6, marginBottom: 10 }}>{event.description}</div>}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                          {event.venue && <div style={{ fontSize: 12, color: TEXT3 }}>📍 {event.venue}</div>}
                          <div style={{ fontSize: 12, color: TEXT3 }}>👥 {event.rsvps?.[0]?.count || 0} attending</div>
                          {event.capacity && <div style={{ fontSize: 12, color: TEXT3 }}>🎟 {event.capacity} capacity</div>}
                          {event.is_free && <div style={{ fontSize: 12, color: '#6dbf8a' }}>✓ Free for subscribers</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {subscribed ? (
                            <button onClick={() => handleRsvp(event.id)} style={{
                              background: eventRsvps[event.id] ? 'rgba(255,255,255,0.06)' : ACCENT,
                              color: eventRsvps[event.id] ? TEXT2 : '#080808',
                              border: `1px solid ${eventRsvps[event.id] ? BORDER : 'transparent'}`,
                              borderRadius: 7, padding: '8px 18px',
                              fontFamily: "'DM Mono', monospace", fontSize: 10,
                              fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em',
                              boxShadow: eventRsvps[event.id] ? 'none' : `0 4px 16px ${ACCENT}40`,
                            }}>
                              {eventRsvps[event.id] ? "✓ RSVP'D — CANCEL" : 'RSVP NOW'}
                            </button>
                          ) : (
                            <button onClick={handleSubscribe} style={{
                              background: ACCENT + '14', color: ACCENT,
                              border: `1px solid ${ACCENT}40`, borderRadius: 7,
                              padding: '8px 18px', fontFamily: "'DM Mono', monospace",
                              fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em',
                            }}>SUBSCRIBE TO RSVP</button>
                          )}
                          {event.daily_room_name && eventRsvps[event.id] && (
                            <button onClick={() => setLiveEvent(event)} style={{
                              background: ACCENT, color: '#080808',
                              border: 'none', borderRadius: 7, padding: '8px 18px',
                              fontFamily: "'DM Mono', monospace", fontSize: 10,
                              fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em',
                              boxShadow: `0 4px 16px ${ACCENT}50`,
                            }}>🎙 JOIN LIVE</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MY EVENTS TAB ── */}
      {activeTab === 'myevents' && (
        <div style={{ padding: '44px 28px', maxWidth: 820, margin: '0 auto' }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 38, color: TEXT1, lineHeight: 1.15, marginBottom: 6 }}>
              My <span style={{ color: ACCENT }}>Events</span>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.2em' }}>YOUR UPCOMING RSVPS</div>
          </div>

          {fanEventsLoading ? (
            <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
          ) : fanEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 16, color: TEXT3 }}>◈</div>
              <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 24, letterSpacing: '0.08em' }}>No upcoming events. Browse creators to find events.</div>
              <button onClick={() => setActiveTab('discover')} style={{
                background: ACCENT, color: '#080808',
                border: 'none', borderRadius: 7, padding: '10px 22px',
                fontFamily: "'DM Mono', monospace", fontSize: 11,
                fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                boxShadow: `0 4px 20px ${ACCENT}50`,
              }}>DISCOVER CREATORS</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {fanEvents.map(rsvp => {
                const event = rsvp.events
                if (!event) return null
                return (
                  <div key={rsvp.id} style={{
                    background: 'rgba(17,17,20,0.75)',
                    backdropFilter: 'blur(16px)',
                    border: `1px solid ${ACCENT}22`,
                    borderRadius: 14, padding: '22px 26px',
                    boxShadow: `0 4px 32px ${ACCENT}0a`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 19, color: TEXT1, marginBottom: 4 }}>{event.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, color: ACCENT, fontWeight: 700 }}>
                          {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <span style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 9px', letterSpacing: '0.14em', fontFamily: "'DM Mono', monospace" }}>
                          {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                        </span>
                        <span style={{ background: '#6dbf8a18', color: '#6dbf8a', border: '1px solid #6dbf8a40', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 9px', letterSpacing: '0.14em', fontFamily: "'DM Mono', monospace" }}>
                          ✓ RSVP'D
                        </span>
                      </div>
                    </div>
                    {event.description && (
                      <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6, marginBottom: 10 }}>{event.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                      {event.venue && <div style={{ fontSize: 12, color: TEXT3 }}>📍 {event.venue}</div>}
                      <div style={{ fontSize: 12, color: TEXT3 }}>
                        By <span style={{ color: TEXT2 }}>{event.creators?.profiles?.display_name || 'Creator'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {event.daily_room_name && (
                        <button onClick={() => setLiveEvent(rsvp.events)} style={{
                          background: ACCENT, color: '#080808',
                          border: 'none', borderRadius: 7, padding: '9px 20px',
                          fontFamily: "'DM Mono', monospace", fontSize: 11,
                          fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                          boxShadow: `0 4px 16px ${ACCENT}50`,
                        }}>🎙 JOIN LIVE</button>
                      )}
                      <button onClick={async () => { await supabase.from('rsvps').delete().eq('id', rsvp.id); refetchFanEvents() }}
                        style={{
                          background: 'transparent', border: `1px solid ${BORDER}`,
                          borderRadius: 7, padding: '9px 16px',
                          color: TEXT3, fontFamily: "'DM Mono', monospace",
                          fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em',
                        }}>CANCEL RSVP</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      </div>

      {liveEvent && (
        <LiveRoom
          event={liveEvent}
          profile={profile}
          isCreator={false}
          onLeave={() => setLiveEvent(null)}
        />
      )}
    </div>
  )
}
