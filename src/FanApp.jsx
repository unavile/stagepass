import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePublicEvents } from './hooks/useEvents'
import { useFanEvents } from './hooks/useFanEvents'
import LiveRoom from './LiveRoom'

export default function FanApp({ session, profile, onSignOut }) {
  const [creators, setCreators] = useState([])
  const [selected, setSelected] = useState(null)
  const [posts, setPosts] = useState([])
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [eventRsvps, setEventRsvps] = useState({})
  const { events: creatorEvents } = usePublicEvents(selected?.id)
  const [activeTab, setActiveTab] = useState('discover')
  const { events: fanEvents, loading: fanEventsLoading, refetch: refetchFanEvents } = useFanEvents(session.user.id)
  const [liveEvent, setLiveEvent] = useState(null)

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

    // Build a map of event_id -> true for existing RSVPs
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
        await supabase.from('rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('fan_id', session.user.id)
        setEventRsvps(prev => ({ ...prev, [eventId]: false }))
    } else {
        const { error } = await supabase.from('rsvps')
        .upsert(
            { event_id: eventId, fan_id: session.user.id },
            { onConflict: 'event_id,fan_id' }
        )
        if (!error) setEventRsvps(prev => ({ ...prev, [eventId]: true }))
    }
    refetchFanEvents()
  }

  const accent = '#c9a84c'
  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e8e2d6' }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64, borderBottom: '1px solid #ffffff12', position: 'sticky', top: 0, background: '#080808cc', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selected && activeTab === 'discover' && (
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace", marginRight: 8 }}>←</button>
            )}
            <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: accent }}>StagePass</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Tab switcher */}
            {[
            { id: 'discover', label: 'Discover' },
            { id: 'myevents', label: `My Events${fanEvents.length > 0 ? ` (${fanEvents.length})` : ''}` },
            ].map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(null) }} style={{
                background: activeTab === t.id ? accent + '18' : 'none',
                border: activeTab === t.id ? `1px solid ${accent}44` : '1px solid transparent',
                borderRadius: 6, padding: '6px 14px', color: activeTab === t.id ? accent : '#555',
                fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer',
                letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>{t.label}</button>
            ))}
            <button onClick={onSignOut} style={{ background: 'none', border: '1px solid #ffffff15', borderRadius: 6, padding: '6px 12px', color: '#555', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer' }}>Sign Out</button>
        </div>
        </nav>

        {/* DISCOVER TAB */}
        {activeTab === 'discover' && (
        <>
            {/* Creator discovery */}
            {!selected && (
            <div style={{ padding: '40px 24px', maxWidth: 900, margin: '0 auto' }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: '#f0ebe0', marginBottom: 4 }}>Discover Creators</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.15em', marginBottom: 32 }}>FIND ARTISTS TO SUPPORT</div>

                {loading ? (
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading creators...</div>
                ) : creators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                    No creators yet. Check back soon.
                </div>
                ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {creators.map(c => (
                    <div key={c.id} onClick={() => selectCreator(c)}
                        style={{ background: '#0e0e0e', border: '1px solid #ffffff10', borderRadius: 12, padding: '24px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = accent + '55'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#ffffff10'}
                    >
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#161616', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, color: accent, marginBottom: 16, overflow: 'hidden', flexShrink: 0 }}>
                        {c.profiles?.avatar_url ? (<img src={c.profiles.avatar_url} alt={c.profiles.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : ((c.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2))}
                        </div>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#161616', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, color: accent, marginBottom: 16 }}>
                        {(c.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: '#f0ebe0', marginBottom: 4 }}>{c.profiles?.display_name || 'Creator'}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: accent, marginBottom: 8 }}>@{c.profiles?.handle || 'creator'}</div>
                        {c.profiles?.bio && <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>{c.profiles.bio}</div>}
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: accent }}>${c.monthly_price}/mo</div>
                    </div>
                    ))}
                </div>
                )}
            </div>
            )}

            {/* Creator page */}
            {selected && (
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#161616', border: `2px solid ${accent}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  {selected.profiles?.avatar_url ? (
                    <img src={selected.profiles.avatar_url} alt={selected.profiles.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: accent }}>
                      {(selected.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: '#f0ebe0', marginBottom: 4 }}>{selected.profiles?.display_name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: accent, marginBottom: 8 }}>@{selected.profiles?.handle}</div>
                    {selected.profiles?.bio && <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, maxWidth: 480, margin: 0 }}>{selected.profiles.bio}</p>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 20 }}>
                    {subscribed ? (
                    <div>
                        <div style={{ background: accent + '22', color: accent, border: `1px solid ${accent}44`, borderRadius: 6, padding: '6px 14px', fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 8 }}>✓ Subscribed</div>
                        <button onClick={handleUnsubscribe} style={{ background: 'none', border: '1px solid #ffffff10', borderRadius: 6, padding: '6px 14px', color: '#555', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                    </div>
                    ) : (
                    <button onClick={handleSubscribe} disabled={subscribeLoading} style={{ background: accent, color: '#080808', border: 'none', borderRadius: 8, padding: '12px 24px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', cursor: subscribeLoading ? 'not-allowed' : 'pointer', opacity: subscribeLoading ? 0.7 : 1 }}>
                        {subscribeLoading ? 'Redirecting...' : `Subscribe · $${selected.monthly_price}/mo`}
                    </button>
                    )}
                </div>
                </div>

                {/* Posts */}
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.2em', marginBottom: 16 }}>POSTS</div>
                {posts.length === 0 ? (
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12, textAlign: 'center', padding: '40px 0' }}>No posts yet.</div>
                ) : posts.map(p => {
                const canView = !p.is_locked || subscribed
                return (
                    <div key={p.id} style={{ background: '#0e0e0e', border: '1px solid #ffffff08', borderRadius: 10, padding: '18px', marginBottom: 10, opacity: canView ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 40, height: 40, background: '#161616', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{p.thumbnail_emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: canView ? '#f0ebe0' : '#555', marginBottom: 4 }}>{p.title}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ background: '#ffffff0a', color: '#555', borderRadius: 4, fontSize: 10, padding: '2px 8px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>{typeLabels[p.type]}</span>
                            {p.is_locked && !subscribed && <span style={{ background: accent + '22', color: accent, borderRadius: 4, fontSize: 10, padding: '2px 8px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>EXCLUSIVE</span>}
                            {p.is_locked && subscribed && <span style={{ background: accent + '22', color: accent, borderRadius: 4, fontSize: 10, padding: '2px 8px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>✓ UNLOCKED</span>}
                        </div>
                        </div>
                        {p.is_locked && !subscribed && <span style={{ color: '#333', fontSize: 18 }}>🔒</span>}
                    </div>
                    {canView && p.file_url && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #ffffff08' }}>
                        {p.type === 'video' && <video controls src={p.file_url} style={{ width: '100%', borderRadius: 8, maxHeight: 300 }} />}
                        {p.type === 'audio' && <audio controls src={p.file_url} style={{ width: '100%' }} />}
                        {p.type === 'text' && <a href={p.file_url} target="_blank" rel="noreferrer" style={{ color: accent, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Open PDF →</a>}
                        </div>
                    )}
                    {canView && p.description && (
                        <div style={{ marginTop: 10, fontSize: 13, color: '#666', lineHeight: 1.6 }}>{p.description}</div>
                    )}
                    </div>
                )
                })}

                {/* Events */}
                {creatorEvents.length > 0 && (
                <div style={{ marginTop: 32 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.2em', marginBottom: 16 }}>UPCOMING EVENTS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {creatorEvents.map(event => (
                        <div key={event.id} style={{ background: '#0e0e0e', border: `1px solid ${accent}22`, borderRadius: 10, padding: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div>
                            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: '#f0ebe0', marginBottom: 4 }}>{event.name}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: accent, fontWeight: 700 }}>
                                {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            </div>
                            <span style={{ background: accent + '22', color: accent, border: `1px solid ${accent}44`, borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>
                            {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                            </span>
                        </div>
                        {event.description && <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 8 }}>{event.description}</div>}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                            {event.venue && <div style={{ fontSize: 12, color: '#555' }}>📍 {event.venue}</div>}
                            <div style={{ fontSize: 12, color: '#555' }}>👥 {event.rsvps?.[0]?.count || 0} attending</div>
                            {event.capacity && <div style={{ fontSize: 12, color: '#555' }}>🎟 {event.capacity} capacity</div>}
                            {event.is_free && <div style={{ fontSize: 12, color: '#6dbf8a' }}>✓ Free for subscribers</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {subscribed ? (
                            <button onClick={() => handleRsvp(event.id)} style={{ background: eventRsvps[event.id] ? '#ffffff10' : accent, color: eventRsvps[event.id] ? '#888' : '#080808', border: 'none', borderRadius: 6, padding: '8px 18px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em' }}>
                                {eventRsvps[event.id] ? "✓ RSVP'd — Cancel" : 'RSVP Now'}
                            </button>
                            ) : (
                            <button onClick={handleSubscribe} style={{ background: accent + '22', color: accent, border: `1px solid ${accent}44`, borderRadius: 6, padding: '8px 18px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
                                Subscribe to RSVP
                            </button>
                            )}
                            {event.daily_room_name && eventRsvps[event.id] && (
                            <button
                                onClick={() => setLiveEvent(event)}
                                style={{
                                background: accent, color: '#080808',
                                border: 'none', borderRadius: 6, padding: '8px 18px',
                                fontFamily: "'DM Mono', monospace", fontSize: 11,
                                fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em'
                                }}
                            >
                                🎙 JOIN LIVE
                            </button>
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

        {/* MY EVENTS TAB */}
        {activeTab === 'myevents' && (
        <div style={{ padding: '40px 24px', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: '#f0ebe0', marginBottom: 4 }}>My Events</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.15em', marginBottom: 32 }}>YOUR UPCOMING RSVPS</div>

            {fanEventsLoading ? (
            <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading...</div>
            ) : fanEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>◈</div>
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 20 }}>No upcoming events. Browse creators to find events.</div>
                <button onClick={() => setActiveTab('discover')} style={{ background: accent, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>
                DISCOVER CREATORS
                </button>
            </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {fanEvents.map(rsvp => {
                const event = rsvp.events
                if (!event) return null
                return (
                    <div key={rsvp.id} style={{ background: '#0e0e0e', border: `1px solid ${accent}22`, borderRadius: 12, padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: '#f0ebe0', marginBottom: 4 }}>{event.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: accent, fontWeight: 700 }}>
                            {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <span style={{ background: accent + '22', color: accent, border: `1px solid ${accent}44`, borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>
                            {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                        </span>
                        <span style={{ background: '#6dbf8a22', color: '#6dbf8a', border: '1px solid #6dbf8a44', borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>
                            ✓ RSVP'D
                        </span>
                        </div>
                    </div>

                    {event.description && (
                        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 8 }}>{event.description}</div>
                    )}

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                        {event.venue && <div style={{ fontSize: 12, color: '#555' }}>📍 {event.venue}</div>}
                        <div style={{ fontSize: 12, color: '#555' }}>
                        By <span style={{ color: '#888' }}>{event.creators?.profiles?.display_name || 'Creator'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {event.daily_room_name && (
                        <button
                            onClick={() => setLiveEvent(rsvp.events)}
                            style={{
                            background: accent, color: '#080808',
                            border: 'none', borderRadius: 6, padding: '8px 18px',
                            fontFamily: "'DM Mono', monospace", fontSize: 11,
                            fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em'
                            }}
                        >
                            🎙 JOIN LIVE
                        </button>
                        )}
                        <button
                        onClick={async () => {
                            await supabase.from('rsvps').delete().eq('id', rsvp.id)
                            refetchFanEvents()
                        }}
                        style={{ background: 'none', border: '1px solid #ffffff10', borderRadius: 6, padding: '8px 14px', color: '#555', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer' }}
                        >
                        Cancel RSVP
                        </button>
                    </div>
                    </div>
                )
                })}
            </div>
            )}
        </div>
        )}

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