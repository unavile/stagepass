import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePosts } from './hooks/usePosts'
import { useSubscribers } from './hooks/useSubscribers'
import NewPostModal from './NewPostModal'
import { useEvents } from './hooks/useEvents'
import NewEventModal from './NewEventModal'

export default function CreatorApp({ session, profile, onSignOut }) {
  const [tab, setTab] = useState('overview')
  const [showUpload, setShowUpload] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const { posts, loading: postsLoading, refetch } = usePosts(session.user.id)
  const { subscribers, loading: subsLoading } = useSubscribers(session.user.id)
  const { events, loading: eventsLoading, refetch: refetchEvents } = useEvents(session.user.id)
  const [showNewEvent, setShowNewEvent] = useState(false)

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

 /*
  const monthlyRevenue = subscribers.length * creator.monthlyPrice
  const netRevenue = Math.round(monthlyRevenue * 0.92)
  */
  const monthlyRevenue = subscribers.length * creator.monthlyPrice
  const netRevenue = (monthlyRevenue * 0.92).toFixed(2)
  const platformFee = (monthlyRevenue * 0.08).toFixed(2)

  const TABS = [
    { id: 'overview',    label: 'Overview',   icon: '⬡' },
    { id: 'content',     label: 'Content',    icon: '▤' },
    { id: 'subscribers', label: 'Subs',       icon: '◎' },
    { id: 'events',      label: 'Events',     icon: '◈' },
    { id: 'earnings',    label: 'Earnings',   icon: '◇' },
  ]

  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }

  function Pill({ color, children }) {
    return (
      <span style={{
        background: color + '22', color,
        border: `1px solid ${color}44`,
        borderRadius: 4, fontSize: 10, fontWeight: 700,
        padding: '2px 8px', letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: "'DM Mono', monospace"
      }}>{children}</span>
    )
  }

  function StatCard({ label, value, sub, accent }) {
    return (
      <div style={{ background: '#0e0e0e', border: '1px solid #ffffff0a', borderRadius: 10, padding: '20px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: accent || '#f0ebe0' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{sub}</div>}
      </div>
    )
  }

  const p = isMobile ? '20px 16px' : '40px 48px'

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e8e2d6', display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Mobile top bar */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, background: '#0a0a0a', borderBottom: '1px solid #ffffff0a', position: 'sticky', top: 0, zIndex: 100 }}>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: creator.accentColor }}>StagePass</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: creator.accentColor }}>{creator.handle}</span>
          <button onClick={() => setShowUpload(true)} style={{ background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 5, padding: '6px 12px', fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>+ POST</button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* Desktop sidebar */}
        {!isMobile && (
          <div style={{ width: 220, background: '#0a0a0a', borderRight: '1px solid #ffffff0a', padding: '0 0 32px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #ffffff08', marginBottom: 8 }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: creator.accentColor, marginBottom: 16 }}>StagePass</div>
              <div style={{ fontSize: 13, color: '#f0ebe0' }}>{creator.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: creator.accentColor, marginTop: 2 }}>{creator.handle}</div>
            </div>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: tab === t.id ? creator.accentColor + '15' : 'none',
                border: 'none', borderLeft: tab === t.id ? `2px solid ${creator.accentColor}` : '2px solid transparent',
                color: tab === t.id ? creator.accentColor : '#555',
                padding: '12px 20px', cursor: 'pointer', width: '100%', textAlign: 'left',
                fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.08em',
              }}>
                <span>{t.icon}</span>{t.label.toUpperCase()}
              </button>
            ))}
            <div style={{ marginTop: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => setShowUpload(true)} style={{ width: '100%', background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 0', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer' }}>+ New Post</button>
              <button onClick={onSignOut} style={{ width: '100%', background: 'none', color: '#444', border: '1px solid #ffffff10', borderRadius: 6, padding: '8px 0', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>Sign Out</button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 80 : 0 }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ padding: p }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0', marginBottom: 4 }}>
                Welcome, {creator.name.split(' ')[0]}.
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.15em', marginBottom: 24 }}>YOUR DASHBOARD</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 28 }}>
                <StatCard label="Subscribers" value={subscribers.length} sub="Active" accent={creator.accentColor} />
                <StatCard label="Monthly Revenue" value={`$${monthlyRevenue}`} sub="Gross" />
                <StatCard label="Posts" value={posts.length} sub="Published" />
                <StatCard label="Net Revenue" value={`$${netRevenue}`} sub="After 8% fee" />
              </div>

              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Recent Posts</div>
              {postsLoading ? (
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading...</div>
              ) : posts.length === 0 ? (
                <div style={{ background: '#0e0e0e', border: '1px dashed #ffffff10', borderRadius: 10, padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>No posts yet. Share your first piece of content.</div>
                  <button onClick={() => setShowUpload(true)} style={{ background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>+ CREATE FIRST POST</button>
                </div>
              ) : posts.slice(0, 5).map(post => (
                <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0e0e0e', border: '1px solid #ffffff08', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                  <div style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{post.thumbnail_emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#e8e2d6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.title}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555' }}>{typeLabels[post.type]} · {new Date(post.published_at).toLocaleDateString()}</div>
                  </div>
                  {post.is_locked && <Pill color={creator.accentColor}>EXCL.</Pill>}
                </div>
              ))}
            </div>
          )}

          {/* CONTENT */}
          {tab === 'content' && (
            <div style={{ padding: p }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0' }}>Content</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 2 }}>{posts.length} POSTS</div>
                </div>
                {!isMobile && (
                  <button onClick={() => setShowUpload(true)} style={{ background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>+ New Post</button>
                )}
              </div>
              {postsLoading ? (
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading...</div>
              ) : posts.length === 0 ? (
                <div style={{ background: '#0e0e0e', border: '1px dashed #ffffff10', borderRadius: 10, padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#555' }}>No posts yet.</div>
                </div>
              ) : posts.map(post => (
                <div key={post.id} style={{ background: '#0e0e0e', border: '1px solid #ffffff08', borderRadius: 10, padding: '16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, background: '#161616', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{post.thumbnail_emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#f0ebe0', marginBottom: 4 }}>{post.title}</div>
                      {post.description && <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{post.description}</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Pill color="#888">{typeLabels[post.type]}</Pill>
                        {post.is_locked && <Pill color={creator.accentColor}>EXCLUSIVE</Pill>}
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', paddingTop: 2 }}>{new Date(post.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBSCRIBERS */}
          {tab === 'subscribers' && (
            <div style={{ padding: p }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0', marginBottom: 4 }}>Subscribers</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.1em', marginBottom: 20 }}>{subscribers.length} ACTIVE</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
                <StatCard label="Active" value={subscribers.length} accent={creator.accentColor} />
                <StatCard label="Gross (Monthly)" value={`$${monthlyRevenue}`} accent={creator.accentColor} />
                <StatCard label="Net (Monthly)" value={`$${netRevenue}`} sub="After 8% fee" />
              </div>

              {subsLoading ? (
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading...</div>
              ) : subscribers.length === 0 ? (
                <div style={{ background: '#0e0e0e', border: '1px dashed #ffffff10', borderRadius: 10, padding: '40px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#555' }}>No subscribers yet. Share your page to get started.</div>
                </div>
              ) : (
                <div style={{ border: '1px solid #ffffff08', borderRadius: 10, overflow: 'hidden' }}>
                  {subscribers.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < subscribers.length - 1 ? '1px solid #ffffff06' : 'none' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#161616', border: '1px solid #ffffff10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: creator.accentColor, flexShrink: 0, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                        {(s.profiles?.display_name || 'F').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#e8e2d6' }}>{s.profiles?.display_name || 'Fan'}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444' }}>
                          @{s.profiles?.handle || 'fan'} · Since {new Date(s.started_at).toLocaleDateString()}
                        </div>
                      </div>
                      {!isMobile && <Pill color={creator.accentColor}>ACTIVE</Pill>}
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', flexShrink: 0 }}>${creator.monthlyPrice}/mo</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* EVENTS */}
        {tab === 'events' && (
        <div style={{ padding: p }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0' }}>Events</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 2 }}>{events.length} SCHEDULED</div>
            </div>
            <button onClick={() => setShowNewEvent(true)} style={{ background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>
                + New Event
            </button>
            </div>

            {eventsLoading ? (
            <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading...</div>
            ) : events.length === 0 ? (
            <div style={{ background: '#0e0e0e', border: '1px dashed #ffffff10', borderRadius: 10, padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>No events scheduled yet.</div>
                <button onClick={() => setShowNewEvent(true)} style={{ background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>
                + SCHEDULE FIRST EVENT
                </button>
            </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.map(event => (
            <div key={event.id} style={{ background: '#0e0e0e', border: `1px solid ${creator.accentColor}22`, borderRadius: 12, padding: isMobile ? '16px' : '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: '#f0ebe0', marginBottom: 4 }}>{event.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: creator.accentColor, fontWeight: 700 }}>
                    {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                </div>
                <span style={{ background: creator.accentColor + '22', color: creator.accentColor, border: `1px solid ${creator.accentColor}44`, borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace" }}>
                    {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                </span>
                </div>

                {event.description && (
                <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 8 }}>{event.description}</div>
                )}

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                {event.venue && <div style={{ fontSize: 12, color: '#555' }}>📍 {event.venue}</div>}
                <div style={{ fontSize: 12, color: '#555' }}>👥 {event.rsvps?.length || 0} RSVPs {event.capacity ? `/ ${event.capacity} capacity` : ''}</div>
                <div style={{ fontSize: 12, color: event.is_free ? '#6dbf8a' : creator.accentColor }}>{event.is_free ? '✓ Free for subscribers' : 'Ticketed'}</div>
                </div>

                {/* Attendee list */}
                {event.rsvps?.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #ffffff08' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.15em', marginBottom: 10 }}>ATTENDEES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {event.rsvps.map(rsvp => (
                        <div key={rsvp.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#161616', borderRadius: 6, padding: '6px 10px', border: '1px solid #ffffff08' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#222', border: `1px solid ${creator.accentColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: creator.accentColor, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                            {(rsvp.profiles?.display_name || 'F').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, color: '#e8e2d6' }}>{rsvp.profiles?.display_name || 'Fan'}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#444' }}>@{rsvp.profiles?.handle || 'fan'}</div>
                        </div>
                        </div>
                    ))}
        </div>
      </div>
    )}

    {event.stream_url && (
      <div style={{ marginTop: 12 }}>
        <a href={event.stream_url} target="_blank" rel="noreferrer" style={{ color: creator.accentColor, fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.1em' }}>
          JOIN STREAM →
        </a>
      </div>
    )}
  </div>
                ))}
            </div>
            )}
        </div>
        )}

            {/* EARNINGS */}
            {tab === 'earnings' && (
            <div style={{ padding: p }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0', marginBottom: 20 }}>Earnings</div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
                <StatCard label="Gross (Monthly)" value={`$${monthlyRevenue}`} accent={creator.accentColor} />
                <StatCard label="Net (Monthly)" value={`$${netRevenue}`} sub="After 8% fee" />
                <StatCard label="Active Subs" value={subscribers.length} />
                </div>

                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Subscription Breakdown</div>
                <div style={{ background: '#0e0e0e', border: '1px solid #ffffff08', borderRadius: 10, padding: isMobile ? '16px' : '24px 32px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ffffff08' }}>
                    <span style={{ fontSize: 13, color: '#888' }}>Subscribers</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e8e2d6' }}>{subscribers.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ffffff08' }}>
                    <span style={{ fontSize: 13, color: '#888' }}>Price per subscriber</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e8e2d6' }}>${creator.monthlyPrice}/mo</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ffffff08' }}>
                    <span style={{ fontSize: 13, color: '#888' }}>Gross revenue</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e8e2d6' }}>${monthlyRevenue}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #ffffff08' }}>
                    <span style={{ fontSize: 13, color: '#888' }}>Platform fee (8%)</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e84545' }}>-${platformFee}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0' }}>
                    <span style={{ fontSize: 14, color: '#f0ebe0', fontWeight: 600 }}>Net revenue</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: creator.accentColor, fontWeight: 700 }}>${netRevenue}</span>
                </div>
                </div>

                <div style={{ background: '#0e0e0e', border: `1px solid ${creator.accentColor}22`, borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <div>
                    <div style={{ fontSize: 13, color: '#e8e2d6', marginBottom: 2 }}>Stripe payouts</div>
                    <div style={{ fontSize: 12, color: '#555' }}>Connect your Stripe account to receive payouts directly to your bank.</div>
                </div>
                <button style={{ marginLeft: 'auto', background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, letterSpacing: '0.1em' }}>
                    CONNECT
                </button>
                </div>
            </div>
            )}
        </div>
      </div>

      {/* Mobile bottom tabs */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0a0a0a', borderTop: '1px solid #ffffff0a', display: 'flex', zIndex: 100, height: 64 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'none', border: 'none',
              borderTop: tab === t.id ? `2px solid ${creator.accentColor}` : '2px solid transparent',
              color: tab === t.id ? creator.accentColor : '#444',
              cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.06em'
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label.toUpperCase()}
            </button>
          ))}
          <button onClick={onSignOut} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', borderTop: '2px solid transparent', color: '#444', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.06em' }}>
            <span style={{ fontSize: 16 }}>→</span>SIGN OUT
          </button>
        </div>
      )}

      {showUpload && (
        <NewPostModal
          creator={creator}
          onClose={() => setShowUpload(false)}
          onPostCreated={refetch}
        />
      )}

      {showNewEvent && (
        <NewEventModal
            creatorId={creator.id}
            accentColor={creator.accentColor}
            onClose={() => setShowNewEvent(false)}
            onEventCreated={refetchEvents}
        />
      )}
    </div>
  )
}