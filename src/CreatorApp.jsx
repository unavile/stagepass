import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePosts } from './hooks/usePosts'
import { useSubscribers } from './hooks/useSubscribers'
import NewPostModal from './NewPostModal'
import { useEvents } from './hooks/useEvents'
import NewEventModal from './NewEventModal'
import EditProfileModal from './EditProfileModal'
import LiveRoom from './LiveRoom'

// ─── Design tokens ─────────────────────────────────────────────────────────
const BG      = '#09090b'
const BG2     = '#111114'
const BG3     = '#18181c'
const BORDER  = 'rgba(255,255,255,0.08)'
const BORDER2 = 'rgba(255,255,255,0.04)'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#555250'

// Background images
// const IMG_STUDIO = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1920&q=80'
const IMG_STUDIO = 'images/Creator_bg.jpg'


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

export default function CreatorApp({ session, profile, onSignOut }) {
  const [tab, setTab] = useState('overview')
  const [showUpload, setShowUpload] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const { posts, loading: postsLoading, refetch } = usePosts(session.user.id)
  const { subscribers, loading: subsLoading } = useSubscribers(session.user.id)
  const { events, loading: eventsLoading, refetch: refetchEvents } = useEvents(session.user.id)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [liveEvent, setLiveEvent] = useState(null)

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
  }

  const ac = creator.accentColor
  const monthlyRevenue = subscribers.length * creator.monthlyPrice
  const netRevenue = (monthlyRevenue * 0.92).toFixed(2)
  const platformFee = (monthlyRevenue * 0.08).toFixed(2)

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: '⬡' },
    { id: 'content',     label: 'Content',     icon: '▤' },
    { id: 'subscribers', label: 'Subscribers', icon: '◎' },
    { id: 'events',      label: 'Events',      icon: '◈' },
    { id: 'earnings',    label: 'Earnings',    icon: '◇' },
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
      backgroundAttachment: 'fixed',
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
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: ac }}>StagePass</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.1em' }}>{creator.handle}</span>
          <button onClick={() => setShowUpload(true)} style={{
            background: ac, color: '#080808',
            border: 'none', borderRadius: 6, padding: '6px 14px',
            fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', cursor: 'pointer',
            boxShadow: `0 2px 12px ${ac}50`,
          }}>+ POST</button>
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
              }}>StagePass</div>
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
                <StatCard label="Net Revenue" value={`$${netRevenue}`} sub="After 8% fee" />
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
                  {post.is_locked && <Pill color={ac}>EXCL.</Pill>}
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
                        {post.is_locked && <Pill color={ac}>EXCLUSIVE</Pill>}
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, paddingTop: 2 }}>{new Date(post.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
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
                <StatCard label="Net (Monthly)" value={`$${netRevenue}`} sub="After 8% fee" />
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 24 : 34, color: TEXT1 }}>Events</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 4, letterSpacing: '0.14em' }}>{events.length} SCHEDULED</div>
                </div>
                <button onClick={() => setShowNewEvent(true)} style={{
                  background: ac, color: '#080808', border: 'none', borderRadius: 7,
                  padding: '10px 20px', fontFamily: "'DM Mono', monospace",
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em',
                  boxShadow: `0 4px 16px ${ac}40`,
                }}>+ NEW EVENT</button>
              </div>
              {eventsLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : events.length === 0 ? (
                <div style={{ ...card({ padding: '48px', textAlign: 'center' }), border: `1px dashed ${BORDER}` }}>
                  <div style={{ fontSize: 28, marginBottom: 10, color: TEXT3 }}>◈</div>
                  <div style={{ fontSize: 13, color: TEXT3, marginBottom: 18 }}>No events scheduled yet.</div>
                  <button onClick={() => setShowNewEvent(true)} style={{ background: ac, color: '#080808', border: 'none', borderRadius: 7, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em', boxShadow: `0 4px 16px ${ac}40` }}>+ SCHEDULE FIRST EVENT</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {events.map(event => (
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
                            {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <span style={{ background: ac + '18', color: ac, border: `1px solid ${ac}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 9px', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                          {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                        </span>
                      </div>
                      {event.description && <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6, marginBottom: 10 }}>{event.description}</div>}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                        {event.venue && <div style={{ fontSize: 12, color: TEXT3 }}>📍 {event.venue}</div>}
                        <div style={{ fontSize: 12, color: TEXT3 }}>👥 {event.rsvps?.length || 0} RSVPs {event.capacity ? `/ ${event.capacity}` : ''}</div>
                        <div style={{ fontSize: 12, color: event.is_free ? '#6dbf8a' : ac }}>{event.is_free ? '✓ Free for subscribers' : 'Ticketed'}</div>
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
                      {event.daily_room_name && (
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
                <StatCard label="Net (Monthly)" value={`$${netRevenue}`} sub="After 8% fee" />
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
                  <span style={{ fontSize: 13, color: TEXT2 }}>Platform fee (8%)</span>
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
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'none', border: 'none',
              borderTop: tab === t.id ? `2px solid ${ac}` : '2px solid transparent',
              color: tab === t.id ? ac : TEXT3,
              cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              fontSize: 8, letterSpacing: '0.08em', transition: 'color 0.15s',
            }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label.toUpperCase().slice(0, 4)}
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

      {showUpload && <NewPostModal creator={creator} onClose={() => setShowUpload(false)} onPostCreated={refetch} />}
      {showNewEvent && <NewEventModal creatorId={creator.id} accentColor={ac} onClose={() => setShowNewEvent(false)} onEventCreated={refetchEvents} />}
      {showEditProfile && <EditProfileModal profile={profile} creator={creator} onClose={() => setShowEditProfile(false)} onSaved={() => window.location.reload()} />}
      {liveEvent && <LiveRoom event={liveEvent} profile={profile} isCreator={true} onLeave={() => setLiveEvent(null)} />}
    </div>
  )
}
