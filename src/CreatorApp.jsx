import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePosts } from './hooks/usePosts'
import NewPostModal from './NewPostModal'

export default function CreatorApp({ session, profile, onSignOut }) {
  const [tab, setTab] = useState('overview')
  const [showUpload, setShowUpload] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const { posts, loading, refetch } = usePosts(session.user.id)

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

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: '⬡' },
    { id: 'content',     label: 'Content',     icon: '▤' },
    { id: 'earnings',    label: 'Earnings',    icon: '◇' },
  ]

  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }

  function Pill({ color, children }) {
    return (
      <span style={{
        background: color + '22', color, border: `1px solid ${color}44`,
        borderRadius: 4, fontSize: 10, fontWeight: 700,
        padding: '2px 8px', letterSpacing: '0.12em',
        textTransform: 'uppercase', fontFamily: "'DM Mono', monospace"
      }}>{children}</span>
    )
  }

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
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '40px 48px', paddingBottom: isMobile ? 80 : 40 }}>

          {tab === 'overview' && (
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0', marginBottom: 4 }}>
                Welcome, {creator.name.split(' ')[0]}.
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.15em', marginBottom: 24 }}>YOUR DASHBOARD</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Posts', value: posts.length },
                  { label: 'Monthly Price', value: `$${creator.monthlyPrice}/mo` },
                ].map((s, i) => (
                  <div key={i} style={{ background: '#0e0e0e', border: '1px solid #ffffff0a', borderRadius: 10, padding: '20px' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: creator.accentColor }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Recent Posts</div>
              {loading ? (
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading...</div>
              ) : posts.length === 0 ? (
                <div style={{ background: '#0e0e0e', border: '1px dashed #ffffff10', borderRadius: 10, padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✦</div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>No posts yet. Share your first piece of content.</div>
                  <button onClick={() => setShowUpload(true)} style={{ background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>+ CREATE FIRST POST</button>
                </div>
              ) : posts.slice(0, 5).map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0e0e0e', border: '1px solid #ffffff08', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                  <div style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{p.thumbnail_emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#e8e2d6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555' }}>{typeLabels[p.type]} · {new Date(p.published_at).toLocaleDateString()}</div>
                  </div>
                  {p.is_locked && <Pill color={creator.accentColor}>EXCL.</Pill>}
                </div>
              ))}
            </div>
          )}

          {tab === 'content' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0' }}>Content</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 2 }}>{posts.length} POSTS</div>
                </div>
                {!isMobile && <button onClick={() => setShowUpload(true)} style={{ background: creator.accentColor, color: '#080808', border: 'none', borderRadius: 6, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em' }}>+ New Post</button>}
              </div>
              {loading ? (
                <div style={{ color: '#444', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading...</div>
              ) : posts.length === 0 ? (
                <div style={{ background: '#0e0e0e', border: '1px dashed #ffffff10', borderRadius: 10, padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#555' }}>No posts yet.</div>
                </div>
              ) : posts.map(p => (
                <div key={p.id} style={{ background: '#0e0e0e', border: '1px solid #ffffff08', borderRadius: 10, padding: '16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, background: '#161616', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{p.thumbnail_emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#f0ebe0', marginBottom: 4 }}>{p.title}</div>
                      {p.description && <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{p.description}</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Pill color="#888">{typeLabels[p.type]}</Pill>
                        {p.is_locked && <Pill color={creator.accentColor}>EXCLUSIVE</Pill>}
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', paddingTop: 2 }}>{new Date(p.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'earnings' && (
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: '#f0ebe0', marginBottom: 20 }}>Earnings</div>
              <div style={{ background: '#0e0e0e', border: `1px solid ${creator.accentColor}22`, borderRadius: 12, padding: '28px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.2em', marginBottom: 12 }}>STRIPE PAYMENTS</div>
                <div style={{ fontSize: 14, color: '#666', lineHeight: 1.7 }}>Stripe integration coming in Phase 4.<br />Your earnings dashboard will appear here.</div>
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
    </div>
  )
}