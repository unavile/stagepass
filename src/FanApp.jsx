const [subscribeLoading, setSubscribeLoading] = useState(false)
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

<button
  onClick={handleSubscribe}
  disabled={subscribeLoading}
  style={{
    background: accent, color: '#080808', border: 'none',
    borderRadius: 8, padding: '12px 24px',
    fontFamily: "'DM Mono', monospace", fontSize: 12,
    fontWeight: 700, letterSpacing: '0.12em',
    cursor: subscribeLoading ? 'not-allowed' : 'pointer',
    opacity: subscribeLoading ? 0.7 : 1
  }}
>
  {subscribeLoading ? 'Redirecting...' : `Subscribe · $${selected.monthly_price}/mo`}
</button>

export default function FanApp({ session, profile, onSignOut }) {
  const [creators, setCreators] = useState([])
  const [selected, setSelected] = useState(null)
  const [posts, setPosts] = useState([])
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [subscribeLoading, setSubscribeLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('creators')
      .select('*, profiles(display_name, handle, bio, avatar_url)')
      .then(({ data }) => { setCreators(data || []); setLoading(false) })
  }, [])

  async function selectCreator(c) {
    setSelected(c)
    const [{ data: postsData }, { data: subData }] = await Promise.all([
      supabase.from('posts').select('*').eq('creator_id', c.id).order('published_at', { ascending: false }),
      supabase.from('subscriptions').select('id').eq('fan_id', session.user.id).eq('creator_id', c.id).eq('status', 'active').maybeSingle()
    ])
    setPosts(postsData || [])
    setSubscribed(!!subData)
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
    window.location.href = url // redirect to Stripe Checkout
  } catch (err) {
    console.error('Checkout error:', err)
  }
  setSubscribeLoading(false)
}

  async function handleUnsubscribe() {
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('fan_id', session.user.id).eq('creator_id', selected.id)
    setSubscribed(false)
  }

  const accent = '#c9a84c'
  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#e8e2d6' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64, borderBottom: '1px solid #ffffff12', position: 'sticky', top: 0, background: '#080808cc', backdropFilter: 'blur(12px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selected && <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Mono', monospace", marginRight: 8 }}>←</button>}
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: accent }}>StagePass</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444' }}>{profile.handle}</span>
          <button onClick={onSignOut} style={{ background: 'none', border: '1px solid #ffffff15', borderRadius: 6, padding: '6px 12px', color: '#555', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer' }}>Sign Out</button>
        </div>
      </nav>

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
                <div key={c.id} onClick={() => selectCreator(c)} style={{ background: '#0e0e0e', border: '1px solid #ffffff10', borderRadius: 12, padding: '24px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = accent + '55'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#ffffff10'}
                >
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
                <button onClick={handleSubscribe} style={{ background: accent, color: '#080808', border: 'none', borderRadius: 8, padding: '12px 24px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer' }}>
                  Subscribe · ${selected.monthly_price}/mo
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
        </div>
      )}
    </div>
  )
}