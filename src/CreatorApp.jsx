import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePosts } from './hooks/usePosts'
import { useSubscribers } from './hooks/useSubscribers'
import NewPostModal from './NewPostModal'
import { useEvents } from './hooks/useEvents'
import NewEventModal from './NewEventModal'
import EditProfileModal from './EditProfileModal'
import LiveRoom from './LiveRoom'
import EditPostModal from './EditPostModal'
import EditEventModal from './EditEventModal'

// ─── Design tokens ─────────────────────────────────────────────────────────
const BG      = '#09090b'
const BG2     = '#111114'
const BG3     = '#18181c'
const BORDER  = 'rgba(255,255,255,0.08)'
const BORDER2 = 'rgba(255,255,255,0.04)'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#8c8883'

// const TEXT3   = '#555250'

// Background images
const IMG_STUDIO = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1920&q=80'


const card = (extra = {}) => ({
  background: 'rgba(17,17,20,0.75)',
  backdropFilter: 'blur(12px)',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  ...extra,
})

function tabStyle(active, accent) {
  return {
    display: 'flex', alignItems: 'center', gap: 11,
    background: active ? accent + '18' : 'transparent',
    border: 'none',
    borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
    color: active ? accent : TEXT2,
    padding: '11px 20px',
    cursor: 'pointer', width: '100%', textAlign: 'left',
    fontFamily: "'DM Mono', monospace",
    fontSize: 11, letterSpacing: '0.1em',
    transition: 'all 0.15s',
  }
}

// Parse YYYY-MM-DD as local date — avoids UTC timezone shift
function parseLocalDate(s) {
  if (!s) return new Date()
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function CreatorApp({ session, profile, onSignOut }) {
  const [tab, setTab] = useState('overview')
  const [showUpload, setShowUpload] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const { posts: hookPosts, loading: postsLoading, refetch } = usePosts(session.user.id, session.access_token)
  const [postsOverride, setPostsOverride] = useState(null)
  const posts = postsOverride || hookPosts
  function setPosts(data) { setPostsOverride(data) }
  const { subscribers, loading: subsLoading } = useSubscribers(session.user.id, session.access_token)
  const { events: hookEvents, loading: eventsLoading, refetch: refetchEvents } = useEvents(session.user.id, session.access_token)
  const [eventsOverride, setEventsOverride] = useState(null)
  const events = eventsOverride || hookEvents
  function setEvents(data) { setEventsOverride(data) }
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [liveEvent, setLiveEvent] = useState(null)
  const [editPost, setEditPost] = useState(null)
  const [editEvent, setEditEvent] = useState(null)
  const [eventFilter, setEventFilter] = useState('current')
  const [notifications, setNotifications] = useState([])
  const [notifsLoading, setNotifsLoading] = useState(false)
  const [openNotif, setOpenNotif] = useState(null) // id of expanded notification
  const [eventParticipants, setEventParticipants] = useState({})       // { eventId: [...rows] }
  const [loadingParticipants, setLoadingParticipants] = useState({})   // { eventId: bool }
  const [expandedParticipants, setExpandedParticipants] = useState({}) // { eventId: bool }
  // Use local date (not UTC) so US timezones don't get pushed to tomorrow
  // eventDateTime is defined outside the render-time `now` so comparisons
  // always use a fresh Date() — prevents stale `now` after refetch
  function eventDateTime(e) {
    const time = e.start_time || '00:00'
    const [h, m] = time.split(':').map(Number)
    const d = parseLocalDate(e.event_date)
    d.setHours(h, m, 0, 0)
    return d
  }

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const currentEvents = (events || []).filter(e => eventDateTime(e) >= new Date())
  const pastEvents    = (events || []).filter(e => eventDateTime(e) <  new Date())
  const filteredEvents = eventFilter === 'current' ? currentEvents : pastEvents

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const creator = {
    id: session.user.id,
    name: profile.display_name || 'Your Name',
    handle: '@' + (profile.handle || 'creator'),
    accentColor: profile.creators?.accent_color || '#c9a84c',
    monthlyPrice: profile.creators?.monthly_price || 5,
    category: profile.creators?.category || 'Music',
    customCategory: '',
    paidSubscribers: profile.creators?.paid_subscribers !== false, // default true
    acceptDonations: profile.creators?.accept_donations || false,
  }

  const ac = creator.accentColor

  // Native fetch refetch functions — bypass Supabase JS hang
  async function nativeRefetchPosts() {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${sbUrl}/rest/v1/posts?creator_id=eq.${session.user.id}&order=published_at.desc`, {
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (Array.isArray(data)) setPosts(data)
  }

  async function nativeRefetchEvents() {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${sbUrl}/rest/v1/events?creator_id=eq.${session.user.id}&order=event_date.asc&select=*,rsvps(id,fan_id,profiles(display_name,handle))`, {
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (Array.isArray(data)) setEvents(data)
  }
  async function fetchNotifications() {
    setNotifsLoading(true)
    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    try {
      const res = await fetch(
        `${sbUrl}/rest/v1/admin_notifications?creator_id=eq.${session.user.id}&order=created_at.desc`,
        { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${session.access_token}` } }
      )
      if (res.status === 401) {
        // Token expired — skip silently, CreatorPortal will handle refresh
        console.warn('fetchNotifications: session expired, skipping')
        setNotifsLoading(false)
        return
      }
      const data = await res.json()
      if (Array.isArray(data)) setNotifications(data)
    } catch (err) {
      console.error('fetchNotifications error:', err)
    }
    setNotifsLoading(false)
  }

  async function markNotifRead(notifId) {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    await fetch(
      `${sbUrl}/rest/v1/admin_notifications?id=eq.${notifId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ read: true }),
      }
    )
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
  }

  async function markAllRead() {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    await fetch(
      `${sbUrl}/rest/v1/admin_notifications?creator_id=eq.${session.user.id}&read=eq.false`,
      {
        method: 'PATCH',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ read: true }),
      }
    )
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // ── Fetch live session participants for a past event ───────────────────────
  async function fetchParticipants(eventId) {
    if (eventParticipants[eventId] !== undefined) {
      // Already loaded — just toggle visibility
      setExpandedParticipants(prev => ({ ...prev, [eventId]: !prev[eventId] }))
      return
    }
    setExpandedParticipants(prev => ({ ...prev, [eventId]: true }))
    setLoadingParticipants(prev => ({ ...prev, [eventId]: true }))
    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    try {
      const res = await fetch(
        `${sbUrl}/rest/v1/live_session_participants?event_id=eq.${eventId}&select=*&order=joined_at.asc`,
        { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${session.access_token}` } }
      )
      const data = await res.json()
      setEventParticipants(prev => ({ ...prev, [eventId]: Array.isArray(data) ? data : [] }))
    } catch (e) {
      console.error('fetchParticipants error:', e)
      setEventParticipants(prev => ({ ...prev, [eventId]: [] }))
    }
    setLoadingParticipants(prev => ({ ...prev, [eventId]: false }))
  }

  // Load notifications on mount, then poll every 60 seconds for new ones
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const monthlyRevenue = subscribers.length * creator.monthlyPrice
  const netRevenue = (monthlyRevenue * 0.85).toFixed(2)
  const platformFee = (monthlyRevenue * 0.15).toFixed(2)

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: '⬡' },
    { id: 'content',     label: 'Content',     icon: '▤' },
    { id: 'subscribers', label: 'Subscribers', icon: '◎' },
    { id: 'events',      label: 'Events',      icon: '◈' },
    { id: 'earnings',    label: 'Earnings',    icon: '◇' },
    { id: 'inbox',       label: 'Inbox',       icon: '✉' },
  ]

  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }

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

  function StatCard({ label, value, sub, accent }) {
    return (
      <div style={{
        background: 'rgba(17,17,20,0.72)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: '20px 22px',
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 30, color: accent || TEXT1, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: TEXT3, marginTop: 6 }}>{sub}</div>}
      </div>
    )
  }

  function SectionLabel({ children }) {
    return (
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        {children}
        <div style={{ flex: 1, height: 1, background: BORDER2 }} />
      </div>
    )
  }

  const p = isMobile ? '20px 16px' : '36px 44px'

  return (
    <div style={{
      minHeight: '100vh',
      color: TEXT1,
      display: 'flex',
      flexDirection: 'column',
      // Studio background with dark overlay
      backgroundImage: `
        linear-gradient(to bottom,
          rgba(9,9,11,0.78) 0%,
          rgba(9,9,11,0.88) 40%,
          rgba(9,9,11,0.96) 100%
        ),
        url('${IMG_STUDIO}')
      `,
      backgroundSize: 'cover',
      backgroundPosition: 'center top',
      backgroundAttachment: 'scroll',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── Mobile top bar ── */}
      {isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', height: 56,
          background: 'rgba(9,9,11,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${BORDER}`,
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: ac }}>Coveted Stage</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowEditProfile(true)} style={{
              background: 'transparent', color: TEXT2,
              border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 12px',
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              letterSpacing: '0.1em', cursor: 'pointer',
            }}>PROFILE</button>
            <button onClick={() => setShowUpload(true)} style={{
              background: ac, color: '#080808',
              border: 'none', borderRadius: 6, padding: '6px 14px',
              fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', cursor: 'pointer',
              boxShadow: `0 2px 12px ${ac}50`,
            }}>+ POST</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Desktop sidebar ── */}
        {!isMobile && (
          <div style={{
            width: 232,
            background: 'rgba(9,9,11,0.88)',
            backdropFilter: 'blur(24px)',
            borderRight: `1px solid ${BORDER}`,
            display: 'flex', flexDirection: 'column', flexShrink: 0,
          }}>
            {/* Logo + profile */}
            <div style={{ padding: '28px 20px 24px', borderBottom: `1px solid ${BORDER2}`, marginBottom: 6 }}>
              <div style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 22, color: ac, marginBottom: 20, letterSpacing: '0.01em',
              }}>Coveted Stage</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: BG3, border: `2px solid ${ac}55`,
                  overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 16px ${ac}30`,
                }}>
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={creator.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 14, color: ac }}>
                      {creator.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: TEXT1, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creator.name}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 2, letterSpacing: '0.06em' }}>{creator.handle}</div>
                </div>
              </div>
            </div>

            {/* Nav tabs */}
            <nav style={{ flex: 1, padding: '8px 0' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id, ac)}>
                  <span style={{ fontSize: 13, opacity: tab === t.id ? 1 : 0.5 }}>{t.icon}</span>
                  <span style={{ fontWeight: tab === t.id ? 500 : 400 }}>{t.label.toUpperCase()}</span>
                </button>
              ))}
            </nav>

            {/* Bottom actions */}
            <div style={{ padding: '16px 16px 24px', borderTop: `1px solid ${BORDER2}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => setShowUpload(true)} style={{
                width: '100%', background: ac, color: '#080808',
                border: 'none', borderRadius: 7, padding: '10px 0',
                fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
                letterSpacing: '0.14em', cursor: 'pointer',
                boxShadow: `0 4px 20px ${ac}50`,
              }}>+ NEW POST</button>
              <button onClick={() => setShowEditProfile(true)} style={{
                width: '100%', background: 'transparent', color: TEXT2,
                border: `1px solid ${BORDER}`, borderRadius: 7, padding: '8px 0',
                fontFamily: "'DM Mono', monospace", fontSize: 10,
                letterSpacing: '0.1em', cursor: 'pointer',
              }}>EDIT PROFILE</button>
              <button onClick={onSignOut} style={{
                width: '100%', background: 'transparent', color: TEXT3,
                border: `1px solid ${BORDER2}`, borderRadius: 7, padding: '8px 0',
                fontFamily: "'DM Mono', monospace", fontSize: 10,
                letterSpacing: '0.1em', cursor: 'pointer',
              }}>SIGN OUT</button>
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 80 : 0, position: 'relative' }}>

          {/* Accent glow overlay */}
          <div style={{
            position: 'fixed', top: 0, right: 0, width: 700, height: 700,
            background: `radial-gradient(ellipse at 85% 5%, ${ac}12 0%, transparent 60%)`,
            pointerEvents: 'none', zIndex: 0,
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div style={{ padding: p }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 24 : 34, color: TEXT1, lineHeight: 1.2 }}>
                    Welcome back, <span style={{ color: ac }}>{creator.name.split(' ')[0]}</span>.
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.18em', marginTop: 6 }}>CREATOR STUDIO</div>
                </div>
                {!isMobile && (
                  <button onClick={() => setShowEditProfile(true)} style={{
                    background: 'rgba(17,17,20,0.6)', backdropFilter: 'blur(8px)',
                    color: TEXT2, border: `1px solid ${BORDER}`,
                    borderRadius: 7, padding: '8px 16px',
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    letterSpacing: '0.1em', cursor: 'pointer', flexShrink: 0,
                  }}>EDIT PROFILE</button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
                <StatCard label="Subscribers" value={subscribers.length} sub="Active" accent={ac} />
                <StatCard label="Monthly Revenue" value={`$${monthlyRevenue}`} sub="Gross" />
                <StatCard label="Posts" value={posts.length} sub="Published" />
                <StatCard label="Net Revenue" value={`$${netRevenue}`} sub="After 15% platform fee" />
              </div>

              <SectionLabel>Recent Posts</SectionLabel>
              {postsLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : posts.length === 0 ? (
                <div style={{ ...card({ padding: '36px', textAlign: 'center' }), border: `1px dashed ${BORDER}` }}>
                  <div style={{ fontSize: 13, color: TEXT3, marginBottom: 16 }}>No posts yet. Share your first piece of content.</div>
                  <button onClick={() => setShowUpload(true)} style={{
                    background: ac, color: '#080808', border: 'none', borderRadius: 7,
                    padding: '10px 20px', fontFamily: "'DM Mono', monospace",
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                    boxShadow: `0 4px 16px ${ac}40`,
                  }}>+ CREATE FIRST POST</button>
                </div>
              ) : posts.slice(0, 5).map(post => (
                <div key={post.id} style={{
                  ...card({ padding: '12px 16px', marginBottom: 8 }),
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ width: 36, height: 36, background: BG3, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{post.thumbnail_emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: TEXT1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 2 }}>{typeLabels[post.type]} · {new Date(post.published_at).toLocaleDateString()}</div>
                  </div>
                  {post.is_locked ? <Pill color={ac}>SUBSCRIBERS</Pill> : <Pill color='#6dbf8a'>FREE</Pill>}
                </div>
              ))}
            </div>
          )}

          {/* ── CONTENT ── */}
          {tab === 'content' && (
            <div style={{ padding: p }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 24 : 34, color: TEXT1 }}>Content</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 4, letterSpacing: '0.14em' }}>{posts.length} POSTS PUBLISHED</div>
                </div>
                {!isMobile && (
                  <button onClick={() => setShowUpload(true)} style={{
                    background: ac, color: '#080808', border: 'none', borderRadius: 7,
                    padding: '10px 20px', fontFamily: "'DM Mono', monospace",
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                    boxShadow: `0 4px 16px ${ac}40`,
                  }}>+ NEW POST</button>
                )}
              </div>
              {postsLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : posts.length === 0 ? (
                <div style={{ ...card({ padding: '36px', textAlign: 'center' }), border: `1px dashed ${BORDER}` }}>
                  <div style={{ fontSize: 13, color: TEXT3 }}>No posts yet.</div>
                </div>
              ) : posts.map(post => (
                <div key={post.id} style={{ ...card({ padding: '16px', marginBottom: 10 }) }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 44, height: 44, background: BG3, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{post.thumbnail_emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: TEXT1, marginBottom: 4 }}>{post.title}</div>
                      {post.description && <div style={{ fontSize: 12, color: TEXT3, marginBottom: 6, lineHeight: 1.5 }}>{post.description}</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Pill color={TEXT2}>{typeLabels[post.type]}</Pill>
                        {post.is_locked ? <Pill color={ac}>SUBSCRIBERS ONLY</Pill> : <Pill color='#6dbf8a'>FREE</Pill>}
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, paddingTop: 2 }}>{new Date(post.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button onClick={() => setEditPost(post)} style={{
                      background: 'transparent', border: `1px solid ${BORDER}`,
                      borderRadius: 6, padding: '5px 12px', color: TEXT2,
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      cursor: 'pointer', letterSpacing: '0.08em', flexShrink: 0,
                    }}>EDIT</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SUBSCRIBERS ── */}
          {tab === 'subscribers' && (
            <div style={{ padding: p }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 24 : 34, color: TEXT1, marginBottom: 4 }}>Subscribers</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.14em', marginBottom: 24 }}>{subscribers.length} ACTIVE</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                <StatCard label="Active" value={subscribers.length} accent={ac} />
                <StatCard label="Gross (Monthly)" value={`$${monthlyRevenue}`} />
                <StatCard label="Net (Monthly)" value={`$${netRevenue}`} sub="After 15% platform fee" />
              </div>
              {subsLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : subscribers.length === 0 ? (
                <div style={{ ...card({ padding: '40px', textAlign: 'center' }), border: `1px dashed ${BORDER}` }}>
                  <div style={{ fontSize: 13, color: TEXT3 }}>No subscribers yet. Share your page to get started.</div>
                </div>
              ) : (
                <div style={{ ...card({ overflow: 'hidden' }) }}>
                  {subscribers.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < subscribers.length - 1 ? `1px solid ${BORDER2}` : 'none' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: BG3, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: ac, flexShrink: 0, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                        {(s.profiles?.display_name || 'F').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: TEXT1 }}>{s.profiles?.display_name || 'Fan'}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3 }}>@{s.profiles?.handle || 'fan'} · Since {new Date(s.started_at).toLocaleDateString()}</div>
                      </div>
                      {!isMobile && <Pill color={ac}>ACTIVE</Pill>}
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: TEXT3, flexShrink: 0 }}>${creator.monthlyPrice}/mo</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── EVENTS ── */}
          {tab === 'events' && (
            <div style={{ padding: p }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 24 : 34, color: TEXT1 }}>Events</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 4, letterSpacing: '0.14em' }}>{currentEvents.length} CURRENT · {pastEvents.length} PAST</div>
                </div>
                <button onClick={() => setShowNewEvent(true)} style={{
                  background: ac, color: '#080808', border: 'none', borderRadius: 7,
                  padding: '10px 20px', fontFamily: "'DM Mono', monospace",
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                  boxShadow: `0 4px 16px ${ac}40`,
                }}>+ NEW EVENT</button>
              </div>
              {/* Current / Past toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['current', 'past'].map(f => (
                  <button key={f} onClick={() => setEventFilter(f)} style={{
                    background: eventFilter === f ? ac : 'rgba(17,17,20,0.7)',
                    color: eventFilter === f ? '#080808' : TEXT3,
                    border: eventFilter === f ? 'none' : `1px solid ${BORDER}`,
                    borderRadius: 20, padding: '6px 18px',
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    fontWeight: eventFilter === f ? 700 : 400,
                    letterSpacing: '0.1em', cursor: 'pointer',
                    boxShadow: eventFilter === f ? `0 4px 12px ${ac}40` : 'none',
                  }}>{f === 'current' ? 'CURRENT & UPCOMING' : 'PAST'}</button>
                ))}
              </div>
              {eventsLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : filteredEvents.length === 0 ? (
                <div style={{ ...card({ padding: '48px', textAlign: 'center' }), border: `1px dashed ${BORDER}` }}>
                  <div style={{ fontSize: 28, marginBottom: 10, color: TEXT3 }}>◈</div>
                  <div style={{ fontSize: 13, color: TEXT3, marginBottom: 18 }}>No events scheduled yet.</div>
                  <button onClick={() => setShowNewEvent(true)} style={{ background: ac, color: '#080808', border: 'none', borderRadius: 7, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em', boxShadow: `0 4px 16px ${ac}40` }}>+ SCHEDULE FIRST EVENT</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {filteredEvents.map(event => (
                    <div key={event.id} style={{
                      background: 'rgba(17,17,20,0.72)',
                      backdropFilter: 'blur(16px)',
                      border: `1px solid ${ac}28`,
                      borderRadius: 14, padding: isMobile ? '16px' : '22px 26px',
                      boxShadow: `0 4px 32px ${ac}10`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 19, color: TEXT1, marginBottom: 4 }}>{event.name}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: ac, fontWeight: 700 }}>
                            {parseLocalDate(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ background: ac + '18', color: ac, border: `1px solid ${ac}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
                            {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                          </span>
                          <button onClick={() => setEditEvent(event)} style={{
                            background: 'transparent', border: `1px solid ${BORDER}`,
                            borderRadius: 6, padding: '4px 10px', color: TEXT2,
                            fontFamily: "'DM Mono', monospace", fontSize: 10,
                            cursor: 'pointer', letterSpacing: '0.08em',
                          }}>EDIT</button>
                        </div>
                      </div>
                      {event.description && <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6, marginBottom: 10 }}>{event.description}</div>}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                        {event.venue && <div style={{ fontSize: 12, color: TEXT3 }}>📍 {event.venue}</div>}
                        <div style={{ fontSize: 12, color: TEXT3 }}>👥 {event.rsvps?.length || 0} RSVPs {event.capacity ? `/ ${event.capacity}` : ''}</div>
                        <div style={{ fontSize: 12, color: event.access_type === 'free' ? '#6dbf8a' : event.access_type === 'ticketed' ? ac : '#9a9690' }}>
                          {event.access_type === 'free' ? '✓ Free for All' : event.access_type === 'ticketed' ? `🎟 Ticketed · $${event.ticket_price}` : '🔑 Subscribers Only'}
                        </div>
                      </div>
                      {event.rsvps?.length > 0 && (
                        <div style={{ paddingTop: 12, borderTop: `1px solid ${BORDER2}` }}>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 10 }}>ATTENDEES</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {event.rsvps.map(rsvp => (
                              <div key={rsvp.id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(24,24,28,0.8)', borderRadius: 7, padding: '6px 10px', border: `1px solid ${BORDER2}` }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: BG, border: `1px solid ${ac}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: ac, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                                  {(rsvp.profiles?.display_name || 'F').split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, color: TEXT1 }}>{rsvp.profiles?.display_name || 'Fan'}</div>
                                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3 }}>@{rsvp.profiles?.handle || 'fan'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* ── Live session participants (past events only) ── */}
                      {event.daily_room_name && eventDateTime(event) < new Date() && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER2}` }}>
                          <button
                            onClick={() => fetchParticipants(event.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              background: 'none', border: `1px solid ${BORDER}`,
                              borderRadius: 7, padding: '6px 14px', cursor: 'pointer',
                              fontFamily: "'DM Mono', monospace", fontSize: 10,
                              color: TEXT2, letterSpacing: '0.1em',
                            }}
                          >
                            <span>👁</span>
                            {expandedParticipants[event.id] ? 'HIDE VIEWERS' : 'VIEW LIVE ATTENDEES'}
                            {eventParticipants[event.id] !== undefined && (
                              <span style={{
                                background: ac + '22', color: ac,
                                border: `1px solid ${ac}40`,
                                borderRadius: 10, fontSize: 9, fontWeight: 700,
                                padding: '1px 7px', fontFamily: "'DM Mono', monospace",
                              }}>{eventParticipants[event.id].length}</span>
                            )}
                          </button>

                          {expandedParticipants[event.id] && (
                            <div style={{ marginTop: 12 }}>
                              {loadingParticipants[event.id] ? (
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.1em' }}>
                                  LOADING...
                                </div>
                              ) : !eventParticipants[event.id]?.length ? (
                                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3 }}>
                                  No viewer data recorded for this session.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {/* Column headers */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 120px 120px 80px',
                                    gap: 8, padding: '4px 10px',
                                    fontFamily: "'DM Mono', monospace", fontSize: 8,
                                    color: TEXT3, letterSpacing: '0.16em',
                                  }}>
                                    <span>NAME</span>
                                    {!isMobile && <span>JOINED</span>}
                                    {!isMobile && <span>LEFT</span>}
                                    <span>DURATION</span>
                                  </div>
                                  {eventParticipants[event.id].map((p, i) => {
                                    const joinedAt = p.joined_at ? new Date(p.joined_at) : null
                                    const leftAt = p.left_at ? new Date(p.left_at) : null
                                    let duration = '—'
                                    if (joinedAt && leftAt) {
                                      const mins = Math.round((leftAt - joinedAt) / 60000)
                                      duration = mins < 60
                                        ? `${mins}m`
                                        : `${Math.floor(mins / 60)}h ${mins % 60}m`
                                    } else if (joinedAt) {
                                      duration = 'Active'
                                    }
                                    return (
                                      <div key={p.id} style={{
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 120px 120px 80px',
                                        gap: 8, padding: '8px 10px',
                                        background: i % 2 === 0 ? 'rgba(24,24,28,0.5)' : 'transparent',
                                        borderRadius: 6, alignItems: 'center',
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                          <div style={{
                                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                            background: BG, border: `1px solid ${ac}35`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 9, color: ac,
                                            fontFamily: "'DM Serif Display', Georgia, serif",
                                          }}>
                                            {(p.display_name || 'G').charAt(0).toUpperCase()}
                                          </div>
                                          <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: TEXT1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {p.display_name || 'Guest'}
                                            </div>
                                            {p.fan_id && (
                                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: TEXT3 }}>REGISTERED FAN</div>
                                            )}
                                          </div>
                                        </div>
                                        {!isMobile && (
                                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3 }}>
                                            {joinedAt ? joinedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                          </div>
                                        )}
                                        {!isMobile && (
                                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3 }}>
                                            {leftAt ? leftAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                          </div>
                                        )}
                                        <div style={{
                                          fontFamily: "'DM Mono', monospace", fontSize: 10,
                                          color: duration === 'Active' ? '#6dbf8a' : TEXT2,
                                          fontWeight: 600,
                                        }}>
                                          {duration}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {event.daily_room_name && eventDateTime(event) >= new Date() && (
                        <button onClick={() => setLiveEvent(event)} style={{
                          marginTop: 14, width: '100%',
                          background: ac, color: '#080808',
                          border: 'none', borderRadius: 8, padding: '11px 0',
                          fontFamily: "'DM Mono', monospace", fontSize: 11,
                          fontWeight: 700, cursor: 'pointer', letterSpacing: '0.14em',
                          boxShadow: `0 4px 20px ${ac}50`,
                        }}>🎙 GO LIVE</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── EARNINGS ── */}
          {tab === 'earnings' && (
            <div style={{ padding: p }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 24 : 34, color: TEXT1, marginBottom: 24 }}>Earnings</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                <StatCard label="Gross (Monthly)" value={`$${monthlyRevenue}`} accent={ac} />
                <StatCard label="Net (Monthly)" value={`$${netRevenue}`} sub="After 15% platform fee" />
                <StatCard label="Active Subs" value={subscribers.length} />
              </div>
              <SectionLabel>Subscription Breakdown</SectionLabel>
              <div style={{ ...card({ padding: isMobile ? '16px' : '24px 28px', marginBottom: 20 }) }}>
                {[
                  { label: 'Subscribers', value: subscribers.length },
                  { label: 'Price per subscriber', value: `$${creator.monthlyPrice}/mo` },
                  { label: 'Gross revenue', value: `$${monthlyRevenue}` },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${BORDER2}` }}>
                    <span style={{ fontSize: 13, color: TEXT2 }}>{row.label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: TEXT1 }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${BORDER2}` }}>
                  <span style={{ fontSize: 13, color: TEXT2 }}>Platform fee (15%)</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e84545' }}>-${platformFee}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0' }}>
                  <span style={{ fontSize: 14, color: TEXT1, fontWeight: 600 }}>Net revenue</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 17, color: ac, fontWeight: 700 }}>${netRevenue}</span>
                </div>
              </div>
              <div style={{
                ...card({ padding: '16px 20px' }),
                display: 'flex', gap: 14, alignItems: 'center',
                border: `1px solid ${ac}22`,
                background: `linear-gradient(135deg, rgba(17,17,20,0.75) 0%, rgba(17,17,20,0.6) 100%)`,
              }}>
                <span style={{ fontSize: 22 }}>💳</span>
                <div>
                  <div style={{ fontSize: 13, color: TEXT1, marginBottom: 2 }}>Stripe payouts</div>
                  <div style={{ fontSize: 12, color: TEXT3 }}>Connect your Stripe account to receive payouts directly to your bank.</div>
                </div>
                <button style={{ marginLeft: 'auto', background: ac, color: '#080808', border: 'none', borderRadius: 7, padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0, letterSpacing: '0.12em', boxShadow: `0 4px 14px ${ac}40` }}>CONNECT</button>
              </div>
            </div>
          )}

          {/* ── INBOX ── */}
          {tab === 'inbox' && (
            <div style={{ padding: p }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 24 : 34, color: TEXT1 }}>
                  Inbox
                  {unreadCount > 0 && (
                    <span style={{
                      marginLeft: 12, background: '#e84545', color: '#fff',
                      borderRadius: 12, fontSize: 12, fontWeight: 700,
                      padding: '2px 9px', fontFamily: "'DM Mono', monospace",
                      verticalAlign: 'middle',
                    }}>{unreadCount} unread</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{
                    background: 'none', border: `1px solid ${BORDER2}`,
                    borderRadius: 7, padding: '7px 14px',
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    color: TEXT3, cursor: 'pointer', letterSpacing: '0.1em',
                  }}>MARK ALL AS READ</button>
                )}
              </div>

              {notifsLoading ? (
                <div style={{ color: TEXT3, fontSize: 12, fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>LOADING...</div>
              ) : notifications.length === 0 ? (
                <div style={{
                  ...card({ padding: '40px 24px' }),
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✉</div>
                  <div style={{ fontSize: 13, color: TEXT2, marginBottom: 6 }}>No notifications yet</div>
                  <div style={{ fontSize: 11, color: TEXT3 }}>Messages from the Coveted Stage team will appear here.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setOpenNotif(openNotif === n.id ? null : n.id)
                        if (!n.read) markNotifRead(n.id)
                      }}
                      style={{
                        ...card({ padding: '16px 20px' }),
                        cursor: 'pointer',
                        borderLeft: n.read ? `3px solid transparent` : `3px solid ${ac}`,
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {/* Row: icon + preview + date + unread dot */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: n.read ? BORDER2 : ac + '20',
                          border: `1px solid ${n.read ? BORDER2 : ac + '50'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14,
                        }}>✦</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{
                              fontSize: 11, fontFamily: "'DM Mono', monospace",
                              letterSpacing: '0.1em', color: n.read ? TEXT3 : ac,
                            }}>
                              COVETED STAGE
                              {!n.read && (
                                <span style={{
                                  marginLeft: 8, background: ac, borderRadius: 8,
                                  fontSize: 8, color: '#080808', fontWeight: 700,
                                  padding: '1px 6px',
                                }}>NEW</span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: TEXT3, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                              {n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                            </div>
                          </div>
                          {/* Preview or full message */}
                          <div style={{
                            fontSize: 13, color: n.read ? TEXT2 : TEXT1,
                            lineHeight: 1.65,
                            ...(openNotif !== n.id ? {
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            } : {})
                          }}>{n.message}</div>
                          {openNotif === n.id && (
                            <div style={{ marginTop: 10, fontSize: 10, color: TEXT3, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
                              CLICK TO COLLAPSE
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          </div>
        </div>
      </div>

      {/* ── Mobile bottom tabs ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(9,9,11,0.92)',
          backdropFilter: 'blur(24px)',
          borderTop: `1px solid ${BORDER}`,
          display: 'flex', zIndex: 100, height: 64,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'inbox') fetchNotifications() }} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'none', border: 'none',
              borderTop: tab === t.id ? `2px solid ${ac}` : '2px solid transparent',
              color: tab === t.id ? ac : TEXT3,
              cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              fontSize: 8, letterSpacing: '0.08em', transition: 'color 0.15s',
              position: 'relative',
            }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label.toUpperCase().slice(0, 4)}
              {t.id === 'inbox' && unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 6, right: '50%', marginRight: -18,
                  background: '#e84545', color: '#fff', borderRadius: 8,
                  fontSize: 8, fontWeight: 700, padding: '1px 4px',
                  fontFamily: "'DM Mono', monospace",
                }}>{unreadCount}</span>
              )}
            </button>
          ))}
          <button onClick={onSignOut} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 4,
            background: 'none', border: 'none', borderTop: '2px solid transparent',
            color: TEXT3, cursor: 'pointer',
            fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: '0.08em',
          }}>
            <span style={{ fontSize: 15 }}>→</span>OUT
          </button>
        </div>
      )}

      {showUpload && <NewPostModal creator={creator} accessToken={session.access_token} onClose={() => setShowUpload(false)} onPostCreated={refetch} />}
      {editPost && <EditPostModal post={editPost} accentColor={ac} accessToken={session.access_token} onClose={() => setEditPost(null)} onSaved={() => { setEditPost(null); nativeRefetchPosts() }} />}
      {editEvent && <EditEventModal event={editEvent} accentColor={ac} accessToken={session.access_token} onClose={() => setEditEvent(null)} onSaved={() => { setEditEvent(null); nativeRefetchEvents() }} />}
      {showNewEvent && <NewEventModal creatorId={creator.id} accentColor={ac} onClose={() => setShowNewEvent(false)} onEventCreated={refetchEvents} />}
      {showEditProfile && <EditProfileModal profile={profile} creator={creator} accessToken={session.access_token} onClose={() => setShowEditProfile(false)} onSaved={() => window.location.reload()} />}
      {liveEvent && <LiveRoom event={liveEvent} profile={profile} isCreator={true} onLeave={() => setLiveEvent(null)} accessToken={session.access_token} />}
    </div>
  )
}
