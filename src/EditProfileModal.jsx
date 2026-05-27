import { useState, useRef } from 'react'
import { supabase } from './supabaseClient'

const ACCENT_COLORS = [
  { label: 'Gold',   value: '#c9a84c' },
  { label: 'Red',    value: '#e84545' },
  { label: 'Green',  value: '#6dbf8a' },
  { label: 'Blue',   value: '#4a9eff' },
  { label: 'Purple', value: '#9b6dff' },
  { label: 'Pink',   value: '#ff6db0' },
]

const CATEGORIES = [
  { id: 'Music',    icon: '🎵' },
  { id: 'Dance',    icon: '💃' },
  { id: 'Comedy',   icon: '🎤' },
  { id: 'Modeling', icon: '✨' },
  { id: 'Art',      icon: '🎨' },
  { id: 'Other',    icon: '✦'  },
]

export default function EditProfileModal({ profile, creator, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [handle, setHandle] = useState(profile.handle || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [monthlyPrice, setMonthlyPrice] = useState(creator.monthlyPrice || 5)
  const [accentColor, setAccentColor] = useState(creator.accentColor || '#c9a84c')
  const KNOWN = ['Music','Dance','Comedy','Modeling','Art','Other']
  const isCustom = creator.category && !KNOWN.includes(creator.category)
  const [category, setCategory] = useState(isCustom ? 'Other' : (creator.category || 'Music'))
  const [customCategory, setCustomCategory] = useState(isCustom ? (creator.category || '') : '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef()

  const input = {
    width: '100%', background: '#111', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box'
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2MB.'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError(null)
  }

  async function uploadAvatar() {
    if (!avatarFile) return profile.avatar_url
    const ext = avatarFile.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, cacheControl: '3600' })
    if (uploadError) throw new Error(uploadError.message)
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!displayName.trim()) { setError('Display name is required.'); return }
    if (!handle.trim()) { setError('Handle is required.'); return }
    setLoading(true)
    setError(null)

    try {
      const avatarUrl = await uploadAvatar()

      const [{ error: profileError }, { error: creatorError }] = await Promise.all([
        supabase.from('profiles').update({
          display_name: displayName.trim(),
          handle: handle.toLowerCase().trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
        }).eq('id', profile.id),
        supabase.from('creators').update({
          monthly_price: parseFloat(monthlyPrice),
          accent_color: accentColor,
          category: category === 'Other' ? (customCategory.trim() || 'Other') : category,
        }).eq('id', profile.id),
      ])

      if (profileError || creatorError) {
        setError(profileError?.message || creatorError?.message)
        setLoading(false)
        return
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: '#0e0e0e', border: '1px solid #ffffff12', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>Edit Profile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Avatar upload */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 12 }}>PROFILE PHOTO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div onClick={() => fileInputRef.current.click()} style={{ width: 72, height: 72, borderRadius: '50%', cursor: 'pointer', background: '#161616', border: `2px solid ${accentColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: 20, color: accentColor, fontFamily: "'DM Serif Display', Georgia, serif" }}>
                {(displayName || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            )}
          </div>
          <div>
            <button onClick={() => fileInputRef.current.click()} style={{ background: accentColor + '18', color: accentColor, border: `1px solid ${accentColor}44`, borderRadius: 6, padding: '8px 16px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
              {avatarPreview ? 'Change Photo' : 'Upload Photo'}
            </button>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444' }}>JPG, PNG or WEBP · Max 2MB</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
        </div>

        {/* Profile fields */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 8 }}>PROFILE</div>
        <input style={input} placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
        <input style={input} placeholder="Handle" value={handle} onChange={e => setHandle(e.target.value)} />
        <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="Bio (optional)" value={bio} onChange={e => setBio(e.target.value)} />

        {/* Category */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 12, marginTop: 4 }}>CATEGORY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: category === 'Other' ? 8 : 20 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
              flex: 1, padding: '10px 8px', borderRadius: 9, cursor: 'pointer',
              background: category === cat.id ? accentColor + '18' : '#111',
              border: category === cat.id ? `1px solid ${accentColor}55` : '1px solid #ffffff12',
              color: category === cat.id ? accentColor : '#555',
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: '0.08em', textAlign: 'center',
              transition: 'all 0.15s',
              boxShadow: category === cat.id ? `0 0 12px ${accentColor}20` : 'none',
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{cat.icon}</div>
              {cat.id.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Custom category input */}
        {category === 'Other' && (
          <input
            style={{ ...input, marginBottom: 20 }}
            placeholder="Describe your creative category..."
            value={customCategory}
            onChange={e => setCustomCategory(e.target.value)}
          />
        )}

        {/* Subscription price */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 8 }}>SUBSCRIPTION PRICE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ color: '#555', fontSize: 18, fontFamily: "'DM Mono', monospace" }}>$</span>
          <input style={{ ...input, marginBottom: 0, width: 100 }} type="number" min="1" max="99" step="1" value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} />
          <span style={{ color: '#555', fontSize: 13, fontFamily: "'DM Mono', monospace" }}>/ month</span>
        </div>

        {/* Accent color */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.15em', marginBottom: 12 }}>ACCENT COLOR</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {ACCENT_COLORS.map(c => (
            <div key={c.value} onClick={() => setAccentColor(c.value)} style={{ width: 36, height: 36, borderRadius: '50%', background: c.value, cursor: 'pointer', border: accentColor === c.value ? '3px solid #fff' : '3px solid transparent', transition: 'border 0.15s', boxSizing: 'border-box' }} title={c.label} />
          ))}
        </div>

        {/* Preview */}
        <div style={{ background: '#111', borderRadius: 8, padding: '14px 16px', marginBottom: 16, border: `1px solid ${accentColor}33` }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', letterSpacing: '0.15em', marginBottom: 10 }}>PREVIEW</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#161616', border: `2px solid ${accentColor}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 14, color: accentColor }}>
                  {(displayName || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              )}
            </div>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, color: '#f0ebe0' }}>{displayName || 'Your Name'}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: accentColor }}>@{handle || 'yourhandle'} · ${monthlyPrice}/mo</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#555', marginTop: 2, letterSpacing: '0.1em' }}>{category.toUpperCase()}</div>
              {bio && <div style={{ fontSize: 12, color: '#555', marginTop: 4, lineHeight: 1.5 }}>{bio}</div>}
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#e84545', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', color: '#555', border: '1px solid #ffffff15', borderRadius: 8, padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, background: accentColor, color: '#080808', border: 'none', borderRadius: 8, padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
