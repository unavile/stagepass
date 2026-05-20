import { useState } from 'react'
import { supabase } from './supabaseClient'

const ACCENT_COLORS = [
  { label: 'Gold',   value: '#c9a84c' },
  { label: 'Red',    value: '#e84545' },
  { label: 'Green',  value: '#6dbf8a' },
  { label: 'Blue',   value: '#4a9eff' },
  { label: 'Purple', value: '#9b6dff' },
  { label: 'Pink',   value: '#ff6db0' },
]

export default function EditProfileModal({ profile, creator, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [handle, setHandle] = useState(profile.handle || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [monthlyPrice, setMonthlyPrice] = useState(creator.monthlyPrice || 5)
  const [accentColor, setAccentColor] = useState(creator.accentColor || '#c9a84c')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const input = {
    width: '100%', background: '#111', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box'
  }

  async function handleSave() {
    if (!displayName.trim()) { setError('Display name is required.'); return }
    if (!handle.trim()) { setError('Handle is required.'); return }
    setLoading(true)
    setError(null)

    const [{ error: profileError }, { error: creatorError }] = await Promise.all([
      supabase.from('profiles').update({
        display_name: displayName.trim(),
        handle: handle.toLowerCase().trim(),
        bio: bio.trim(),
      }).eq('id', profile.id),

      supabase.from('creators').update({
        monthly_price: parseFloat(monthlyPrice),
        accent_color: accentColor,
      }).eq('id', profile.id),
    ])

    if (profileError || creatorError) {
      setError(profileError?.message || creatorError?.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: '#0e0e0e', border: '1px solid #ffffff12', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>Edit Profile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 8 }}>PROFILE</div>
        <input style={input} placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <input style={input} placeholder="Handle" value={handle} onChange={e => setHandle(e.target.value)} />
        <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="Bio (optional)" value={bio} onChange={e => setBio(e.target.value)} />

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 8, marginTop: 8 }}>SUBSCRIPTION PRICE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ color: '#555', fontSize: 18, fontFamily: "'DM Mono', monospace" }}>$</span>
          <input
            style={{ ...input, marginBottom: 0, width: 100 }}
            type="number" min="1" max="99" step="1"
            value={monthlyPrice}
            onChange={e => setMonthlyPrice(e.target.value)}
          />
          <span style={{ color: '#555', fontSize: 13, fontFamily: "'DM Mono', monospace" }}>/ month</span>
        </div>

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 12 }}>ACCENT COLOR</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {ACCENT_COLORS.map(c => (
            <div key={c.value} onClick={() => setAccentColor(c.value)} style={{
              width: 36, height: 36, borderRadius: '50%', background: c.value,
              cursor: 'pointer', border: accentColor === c.value ? `3px solid #fff` : '3px solid transparent',
              transition: 'border 0.15s', boxSizing: 'border-box'
            }} title={c.label} />
          ))}
        </div>

        {/* Preview */}
        <div style={{ background: '#111', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: `1px solid ${accentColor}33` }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.15em', marginBottom: 8 }}>PREVIEW</div>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: '#f0ebe0' }}>{displayName || 'Your Name'}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: accentColor, marginTop: 2 }}>@{handle || 'yourhandle'}</div>
          {bio && <div style={{ fontSize: 12, color: '#555', marginTop: 6, lineHeight: 1.6 }}>{bio}</div>}
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: accentColor, marginTop: 8 }}>${monthlyPrice}/mo</div>
        </div>

        {error && <div style={{ color: '#e84545', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', color: '#555', border: '1px solid #ffffff15', borderRadius: 8, padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, background: accentColor, color: '#080808', border: 'none', borderRadius: 8, padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}