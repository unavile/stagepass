import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePublicEvents } from './hooks/useEvents'
import { useFanEvents } from './hooks/useFanEvents'
import LiveRoom from './LiveRoom'

// ─── Design tokens ──────────────────────────────────────────────────────────
const BG      = '#09090b'
const BG2     = '#111114'
const BG3     = '#18181c'
const BORDER  = 'rgba(255,255,255,0.08)'
const BORDER2 = 'rgba(255,255,255,0.04)'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#8c8883'
const ACCENT  = '#c9a84c'
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

// Check if an event is currently active (started and not expired)
function isEventActive(event) {
  if (!event.event_date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDate = new Date(event.event_date)
  eventDate.setHours(0, 0, 0, 0)
  // Active if today is the event date or up to 1 day after (gives time for live sessions)
  const diffDays = Math.floor((today - eventDate) / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 1
}

// ─── Creator card (shared) ───────────────────────────────────────────────────
function CreatorCard({ c, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        background: 'rgba(17,17,20,0.72)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 16, padding: '22px',
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
        width: 50, height: 50, borderRadius: '50%',
        background: BG3, border: `2px solid ${ACCENT}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 17, color: ACCENT, marginBottom: 14,
        overflow: 'hidden', flexShrink: 0,
        boxShadow: `0 0 16px ${ACCENT}22`,
      }}>
        {c.profiles?.avatar_url ? (
          <img src={c.profiles.avatar_url} alt={c.profiles.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          (c.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)
        )}
      </div>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: TEXT1, marginBottom: 2 }}>{c.profiles?.display_name || 'Creator'}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, marginBottom: 8, letterSpacing: '0.08em' }}>@{c.profiles?.handle || 'creator'}</div>
      {c.category && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, marginBottom: 8, letterSpacing: '0.1em' }}>{c.category.toUpperCase()}</div>}
      {c.profiles?.bio && (
        <div style={{ fontSize: 11, color: TEXT3, lineHeight: 1.6, marginBottom: 14 }}>{c.profiles.bio}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${BORDER2}` }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: ACCENT, fontWeight: 700 }}>${c.monthly_price}<span style={{ fontSize: 9, color: TEXT3, fontWeight: 400 }}>/mo</span></div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.1em' }}>VIEW →</div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function FanApp({ session, profile, onSignOut }) {
  // Navigation
  const [activeTab, setActiveTab] = useState('search')
  const [menuOpen, setMenuOpen] = useState(false)

  // Creator browsing
  const [allCreators, setAllCreators] = useState([])
  const [subscribedCreators, setSubscribedCreators] = useState([])
  const [selected, setSelected] = useState(null)
  const [posts, setPosts] = useState([])
  const [subscribed, setSubscribed] = useState(false)
  const [creatorLoading, setCreatorLoading] = useState(true)

  // Search / filter
  const [searchCategory, setSearchCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // Subscription
  const [subscribeLoading, setSubscribeLoading] = useState(false)

  // Events
  const [eventRsvps, setEventRsvps] = useState({})
  const [liveEvent, setLiveEvent] = useState(null)
  const { events: creatorEvents } = usePublicEvents(selected?.id)
  const { events: fanEvents, loading: fanEventsLoading, refetch: refetchFanEvents } = useFanEvents(session.user.id)

  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }
  const CATEGORIES = ['All', 'Music', 'Dance', 'Comedy']

  // Load all creators and subscriptions
  useEffect(() => {
    async function load() {
      const [{ data: creatorsData }, { data: subsData }] = await Promise.all([
        supabase.from('creators').select('*, profiles(display_name, handle, bio, avatar_url)'),
        supabase.from('subscriptions').select('creator_id').eq('fan_id', session.user.id).eq('status', 'active')
      ])
      const subscribedIds = new Set((subsData || []).map(s => s.creator_id))
      const all = creatorsData || []
      setAllCreators(all)
      setSubscribedCreators(all.filter(c => subscribedIds.has(c.id)))
      setCreatorLoading(false)
    }
    load()
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

  function goBack() {
    setSelected(null)
  }

  async function handleSubscribe() {
    if (!selected) return
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
      .eq('fan_id', session.user.id).eq('creator_id', selected.id)
    setSubscribed(false)
    setSubscribedCreators(prev => prev.filter(c => c.id !== selected.id))
  }

  async function handleRsvp(eventId) {
    const already = eventRsvps[eventId]
    if (already) {
      await supabase.from('rsvps').delete().eq('event_id', eventId).eq('fan_id', session.user.id)
      setEventRsvps(prev => ({ ...prev, [eventId]: false }))
    } else {
      const { error } = await supabase.from('rsvps')
        .upsert({ event_id: eventId, fan_id: session.user.id }, { onConflict: 'event_id,fan_id' })
      if (!error) setEventRsvps(prev => ({ ...prev, [eventId]: true }))
    }
    refetchFanEvents()
  }

  // Unsubscribed creators filtered for Search tab
  const subscribedIds = new Set(subscribedCreators.map(c => c.id))
  const unsubscribedCreators = allCreators
    .filter(c => !subscribedIds.has(c.id))
    .filter(c => searchCategory === 'All' || c.category === searchCategory)
    .filter(c => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        c.profiles?.display_name?.toLowerCase().includes(q) ||
        c.profiles?.handle?.toLowerCase().includes(q) ||
        c.profiles?.bio?.toLowerCase().includes(q)
      )
    })

  // ─── Shared creator page view ────────────────────────────────────────────
  function CreatorPage() {
    if (!selected) return null
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 16px 100px' }}>
        {/* Header */}
        <div style={{
          background: 'rgba(17,17,20,0.80)', backdropFilter: 'blur(20px)',
          border: `1px solid ${ACCENT}22`, borderRadius: 16, padding: '20px',
          marginBottom: 20, boxShadow: `0 8px 48px ${ACCENT}0c`,
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: BG3,
              border: `2px solid ${ACCENT}55`, overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 20px ${ACCENT}25`,
            }}>
              {selected.profiles?.avatar_url ? (
                <img src={selected.profiles.avatar_url} alt={selected.profiles.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: ACCENT }}>
                  {(selected.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: TEXT1, lineHeight: 1.2 }}>{selected.profiles?.display_name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, marginTop: 2, letterSpacing: '0.08em' }}>@{selected.profiles?.handle}</div>
              {selected.profiles?.bio && <p style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6, margin: '8px 0 0' }}>{selected.profiles.bio}</p>}
            </div>
          </div>
          {subscribed ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ background: ACCENT + '14', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 7, padding: '7px 14px', fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em' }}>✓ SUBSCRIBED</div>
              <button onClick={handleUnsubscribe} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '7px 14px', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em' }}>CANCEL</button>
            </div>
          ) : (
            <button onClick={handleSubscribe} disabled={subscribeLoading} style={{
              width: '100%', background: ACCENT, color: '#080808',
              border: 'none', borderRadius: 8, padding: '12px',
              fontFamily: "'DM Mono', monospace", fontSize: 12,
              fontWeight: 700, letterSpacing: '0.12em',
              cursor: subscribeLoading ? 'not-allowed' : 'pointer',
              opacity: subscribeLoading ? 0.7 : 1,
              boxShadow: `0 4px 24px ${ACCENT}50`,
            }}>
              {subscribeLoading ? 'REDIRECTING...' : `SUBSCRIBE · $${selected.monthly_price}/mo`}
            </button>
          )}
        </div>

        {/* Posts */}
        <SectionLabel>Posts</SectionLabel>
        {posts.length === 0 ? (
          <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: 'center', padding: '32px 0' }}>No posts yet.</div>
        ) : posts.map(post => {
          const canView = !post.is_locked || subscribed
          return (
            <div key={post.id} style={{ ...card({ padding: '14px 16px', marginBottom: 10 }), opacity: canView ? 1 : 0.55 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 38, height: 38, background: BG3, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{post.thumbnail_emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: canView ? TEXT1 : TEXT3, marginBottom: 4 }}>{post.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Pill color={TEXT2}>{typeLabels[post.type]}</Pill>
                    {post.is_locked && !subscribed && <Pill color={ACCENT}>EXCLUSIVE</Pill>}
                    {post.is_locked && subscribed && <Pill color={ACCENT}>✓ UNLOCKED</Pill>}
                  </div>
                </div>
                {post.is_locked && !subscribed && <span style={{ color: TEXT3, fontSize: 15 }}>🔒</span>}
              </div>
              {canView && post.file_url && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER2}` }}>
                  {post.type === 'video' && <video controls src={post.file_url} style={{ width: '100%', borderRadius: 8, maxHeight: 260 }} />}
                  {post.type === 'audio' && <audio controls src={post.file_url} style={{ width: '100%' }} />}
                  {post.type === 'text' && <a href={post.file_url} target="_blank" rel="noreferrer" style={{ color: ACCENT, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>OPEN PDF →</a>}
                </div>
              )}
              {canView && post.description && <div style={{ marginTop: 8, fontSize: 12, color: TEXT2, lineHeight: 1.6 }}>{post.description}</div>}
            </div>
          )
        })}

        {/* Events */}
        {creatorEvents.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionLabel>Upcoming Events</SectionLabel>
            {creatorEvents.map(event => (
              <div key={event.id} style={{
                background: 'rgba(17,17,20,0.75)', backdropFilter: 'blur(16px)',
                border: `1px solid ${ACCENT}22`, borderRadius: 12, padding: '16px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, color: TEXT1, marginBottom: 2 }}>{event.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: ACCENT, fontWeight: 700 }}>
                      {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <span style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                    {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                  </span>
                </div>
                {event.description && <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.55, marginBottom: 10 }}>{event.description}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {subscribed ? (
                    <button onClick={() => handleRsvp(event.id)} style={{
                      background: eventRsvps[event.id] ? 'rgba(255,255,255,0.06)' : ACCENT,
                      color: eventRsvps[event.id] ? TEXT2 : '#080808',
                      border: `1px solid ${eventRsvps[event.id] ? BORDER : 'transparent'}`,
                      borderRadius: 7, padding: '7px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
                    }}>
                      {eventRsvps[event.id] ? "✓ RSVP'D — CANCEL" : 'RSVP'}
                    </button>
                  ) : (
                    <button onClick={handleSubscribe} style={{
                      background: ACCENT + '14', color: ACCENT, border: `1px solid ${ACCENT}40`,
                      borderRadius: 7, padding: '7px 14px', fontFamily: "'DM Mono', monospace",
                      fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em',
                    }}>SUBSCRIBE TO RSVP</button>
                  )}
                  {event.daily_room_name && eventRsvps[event.id] && isEventActive(event) && (
                    <button onClick={() => setLiveEvent(event)} style={{
                      background: ACCENT, color: '#080808', border: 'none',
                      borderRadius: 7, padding: '7px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
                      boxShadow: `0 4px 14px ${ACCENT}50`,
                    }}>🎙 JOIN LIVE</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Page wrapper styles ─────────────────────────────────────────────────
  const pageStyle = {
    minHeight: '100vh',
    color: TEXT1,
    backgroundImage: `
      linear-gradient(to bottom,
        rgba(9,9,11,0.72) 0%,
        rgba(9,9,11,0.88) 40%,
        rgba(9,9,11,0.97) 100%
      ),
      url('${IMG_STAGE}')
    `,
    backgroundSize: 'cover',
    backgroundPosition: 'center 30%',
    backgroundAttachment: 'scroll', // fixed causes issues on mobile Safari
    // Critical mobile fix: prevent horizontal overflow
    overflowX: 'hidden',
    width: '100%',
  }

  const contentPad = { padding: '16px 16px 100px', maxWidth: 960, margin: '0 auto' }

  return (
    <div style={pageStyle}>
      {/* Critical viewport meta is set in index.html — this ensures no zoom needed */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Accent glow */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: 400, background: `radial-gradient(ellipse at 20% 0%, ${ACCENT}08 0%, transparent 60%)`, pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Top nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 56,
        borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 0,
        background: 'rgba(9,9,11,0.92)',
        backdropFilter: 'blur(24px)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selected && (
            <button onClick={goBack} style={{ background: 'none', border: 'none', color: TEXT3, fontSize: 18, cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>←</button>
          )}
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: ACCENT }}>StagePass</span>
        </div>

        {/* Hamburger menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '6px 10px', color: TEXT2, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <div style={{ width: 18, height: 2, background: menuOpen ? ACCENT : TEXT2, borderRadius: 2, transition: 'background 0.15s' }} />
          <div style={{ width: 18, height: 2, background: menuOpen ? ACCENT : TEXT2, borderRadius: 2, transition: 'background 0.15s' }} />
          <div style={{ width: 18, height: 2, background: menuOpen ? ACCENT : TEXT2, borderRadius: 2, transition: 'background 0.15s' }} />
        </button>
      </nav>

      {/* ── Dropdown menu ── */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 56, right: 0, width: '100%', maxWidth: 280,
          background: 'rgba(17,17,20,0.97)', backdropFilter: 'blur(24px)',
          border: `1px solid ${BORDER}`, borderTop: 'none',
          borderRadius: '0 0 0 14px',
          zIndex: 200, overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}>
          {/* Profile header in menu */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER2}` }}>
            <div style={{ fontSize: 13, color: TEXT1, fontWeight: 500 }}>{profile.display_name}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 2 }}>@{profile.handle}</div>
          </div>

          {[
            { id: 'profile',   icon: '◉', label: 'My Profile' },
            { id: 'artists',   icon: '♪', label: 'My Artists' },
            { id: 'myevents',  icon: '◈', label: 'My Events' },
            { id: 'search',    icon: '⊕', label: 'Search' },
          ].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setSelected(null); setMenuOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              width: '100%', background: activeTab === item.id ? ACCENT + '12' : 'transparent',
              border: 'none',
              borderLeft: activeTab === item.id ? `3px solid ${ACCENT}` : '3px solid transparent',
              color: activeTab === item.id ? ACCENT : TEXT2,
              padding: '13px 20px', cursor: 'pointer', textAlign: 'left',
              fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.08em',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 14, opacity: activeTab === item.id ? 1 : 0.5 }}>{item.icon}</span>
              {item.label.toUpperCase()}
            </button>
          ))}

          <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER2}` }}>
            <button onClick={() => { setMenuOpen(false); onSignOut() }} style={{
              width: '100%', background: 'transparent', color: TEXT3,
              border: `1px solid ${BORDER}`, borderRadius: 7, padding: '9px',
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: '0.1em', cursor: 'pointer',
            }}>SIGN OUT</button>
          </div>
        </div>
      )}

      {/* Dismiss menu on outside tap */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
      )}

      {/* ── Tab indicator bar ── */}
      <div style={{
        display: 'flex', borderBottom: `1px solid ${BORDER2}`,
        background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 56, zIndex: 90, overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {[
          { id: 'profile',  label: 'Profile' },
          { id: 'artists',  label: 'Artists' },
          { id: 'myevents', label: 'Events' },
          { id: 'search',   label: 'Search' },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(null) }} style={{
            flex: '1 0 auto', minWidth: 72, padding: '10px 12px',
            background: 'none', border: 'none',
            borderBottom: activeTab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
            color: activeTab === t.id ? ACCENT : TEXT3,
            fontFamily: "'DM Mono', monospace", fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Content area ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Creator page overlay (shared across tabs) */}
        {selected ? <CreatorPage /> : (
          <>

          {/* ── MY PROFILE ── */}
          {activeTab === 'profile' && (
            <div style={contentPad}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1, lineHeight: 1.2 }}>
                  My <span style={{ color: ACCENT }}>Profile</span>
                </div>
              </div>

              <div style={{
                background: 'rgba(17,17,20,0.80)', backdropFilter: 'blur(20px)',
                border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px', marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', background: BG3,
                    border: `2px solid ${ACCENT}55`, overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 20px ${ACCENT}25`,
                  }}>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: ACCENT }}>
                        {(profile.display_name || 'F').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: TEXT1 }}>{profile.display_name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: ACCENT, marginTop: 2 }}>@{profile.handle}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 4 }}>{session.user.email}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ ...card({ padding: '16px' }) }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 6 }}>SUBSCRIPTIONS</div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 26, color: ACCENT }}>{subscribedCreators.length}</div>
                  </div>
                  <div style={{ ...card({ padding: '16px' }) }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 6 }}>EVENTS</div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 26, color: ACCENT }}>{fanEvents.length}</div>
                  </div>
                </div>
              </div>

              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.12em', textAlign: 'center', marginTop: 8 }}>
                To edit your profile, contact support or sign up as a creator.
              </div>
            </div>
          )}

          {/* ── MY ARTISTS ── */}
          {activeTab === 'artists' && (
            <div style={contentPad}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1, lineHeight: 1.2 }}>
                  My <span style={{ color: ACCENT }}>Artists</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.18em', marginTop: 4 }}>
                  {subscribedCreators.length} ACTIVE SUBSCRIPTION{subscribedCreators.length !== 1 ? 'S' : ''}
                </div>
              </div>

              {creatorLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : subscribedCreators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, color: TEXT3 }}>♪</div>
                  <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 20 }}>No subscriptions yet.</div>
                  <button onClick={() => setActiveTab('search')} style={{
                    background: ACCENT, color: '#080808', border: 'none', borderRadius: 7,
                    padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11,
                    fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                    boxShadow: `0 4px 16px ${ACCENT}40`,
                  }}>FIND ARTISTS</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {subscribedCreators.map(c => (
                    <CreatorCard key={c.id} c={c} onClick={() => selectCreator(c)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MY EVENTS ── */}
          {activeTab === 'myevents' && (
            <div style={contentPad}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1, lineHeight: 1.2 }}>
                  My <span style={{ color: ACCENT }}>Events</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.18em', marginTop: 4 }}>YOUR RSVPS</div>
              </div>

              {fanEventsLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : fanEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, color: TEXT3 }}>◈</div>
                  <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 20 }}>No upcoming events.</div>
                  <button onClick={() => setActiveTab('artists')} style={{
                    background: ACCENT, color: '#080808', border: 'none', borderRadius: 7,
                    padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11,
                    fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                    boxShadow: `0 4px 16px ${ACCENT}40`,
                  }}>BROWSE ARTISTS</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {fanEvents.map(rsvp => {
                    const event = rsvp.events
                    if (!event) return null
                    const active = isEventActive(event)
                    return (
                      <div key={rsvp.id} style={{
                        background: 'rgba(17,17,20,0.75)', backdropFilter: 'blur(16px)',
                        border: `1px solid ${active ? ACCENT + '44' : ACCENT + '22'}`,
                        borderRadius: 14, padding: '18px 20px',
                        boxShadow: active ? `0 4px 24px ${ACCENT}18` : 'none',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: TEXT1, marginBottom: 3 }}>{event.name}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: ACCENT, fontWeight: 700 }}>
                              {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                            {active && (
                              <span style={{ background: '#e8454518', color: '#e84545', border: '1px solid #e8454540', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>● LIVE NOW</span>
                            )}
                            <span style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>
                              {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                            </span>
                            <span style={{ background: '#6dbf8a18', color: '#6dbf8a', border: '1px solid #6dbf8a40', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>✓ RSVP'D</span>
                          </div>
                        </div>

                        {event.description && <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.55, marginBottom: 10 }}>{event.description}</div>}

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                          {event.venue && <div style={{ fontSize: 11, color: TEXT3 }}>📍 {event.venue}</div>}
                          <div style={{ fontSize: 11, color: TEXT3 }}>By <span style={{ color: TEXT2 }}>{event.creators?.profiles?.display_name || 'Creator'}</span></div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {/* Join Live — only show when active */}
                          {event.daily_room_name && active && (
                            <button onClick={() => setLiveEvent(rsvp.events)} style={{
                              background: ACCENT, color: '#080808', border: 'none',
                              borderRadius: 7, padding: '9px 18px',
                              fontFamily: "'DM Mono', monospace", fontSize: 11,
                              fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em',
                              boxShadow: `0 4px 16px ${ACCENT}50`,
                            }}>🎙 JOIN LIVE</button>
                          )}
                          {/* Show room link even if not "active" but has daily room */}
                          {event.daily_room_name && !active && (
                            <button onClick={() => setLiveEvent(rsvp.events)} style={{
                              background: ACCENT + '14', color: ACCENT,
                              border: `1px solid ${ACCENT}40`, borderRadius: 7, padding: '9px 18px',
                              fontFamily: "'DM Mono', monospace", fontSize: 11,
                              fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em',
                            }}>🎙 ENTER ROOM</button>
                          )}
                          <button onClick={async () => { await supabase.from('rsvps').delete().eq('id', rsvp.id); refetchFanEvents() }}
                            style={{
                              background: 'transparent', border: `1px solid ${BORDER}`,
                              borderRadius: 7, padding: '9px 14px',
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

          {/* ── SEARCH ── */}
          {activeTab === 'search' && (
            <div style={contentPad}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1, lineHeight: 1.2, marginBottom: 4 }}>
                  Discover <span style={{ color: ACCENT }}>Artists</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.18em' }}>FIND NEW CREATORS TO SUPPORT</div>
              </div>

              {/* Search input */}
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, handle or bio..."
                style={{
                  width: '100%', background: 'rgba(17,17,20,0.8)',
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${BORDER}`, borderRadius: 9,
                  padding: '11px 16px', color: TEXT1,
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                  outline: 'none', marginBottom: 14, boxSizing: 'border-box',
                }}
              />

              {/* Category filter pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSearchCategory(cat)} style={{
                    background: searchCategory === cat ? ACCENT : 'rgba(17,17,20,0.7)',
                    color: searchCategory === cat ? '#080808' : TEXT3,
                    border: searchCategory === cat ? 'none' : `1px solid ${BORDER}`,
                    borderRadius: 20, padding: '7px 16px',
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    fontWeight: searchCategory === cat ? 700 : 400,
                    letterSpacing: '0.1em', cursor: 'pointer',
                    boxShadow: searchCategory === cat ? `0 4px 14px ${ACCENT}40` : 'none',
                    transition: 'all 0.15s',
                  }}>{cat.toUpperCase()}</button>
                ))}
              </div>

              {/* Results count */}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.14em', marginBottom: 16 }}>
                {unsubscribedCreators.length} ARTIST{unsubscribedCreators.length !== 1 ? 'S' : ''} FOUND
              </div>

              {creatorLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : unsubscribedCreators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                  No artists found. Try a different filter.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {unsubscribedCreators.map(c => (
                    <CreatorCard key={c.id} c={c} onClick={() => selectCreator(c)} />
                  ))}
                </div>
              )}
            </div>
          )}

          </>
        )}
      </div>

      {/* ── Bottom nav bar (mobile) ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(9,9,11,0.96)', backdropFilter: 'blur(24px)',
        borderTop: `1px solid ${BORDER}`,
        display: 'flex', zIndex: 100, height: 60,
      }}>
        {[
          { id: 'profile',  icon: '◉', label: 'Me' },
          { id: 'artists',  icon: '♪', label: 'Artists' },
          { id: 'myevents', icon: '◈', label: 'Events' },
          { id: 'search',   icon: '⊕', label: 'Search' },
        ].map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(null); setMenuOpen(false) }} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            background: 'none', border: 'none',
            borderTop: activeTab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
            color: activeTab === t.id ? ACCENT : TEXT3,
            cursor: 'pointer', fontFamily: "'DM Mono', monospace",
            fontSize: 8, letterSpacing: '0.08em', transition: 'color 0.15s',
          }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {liveEvent && (
        <LiveRoom event={liveEvent} profile={profile} isCreator={false} onLeave={() => setLiveEvent(null)} />
      )}
    </div>
  )
}
