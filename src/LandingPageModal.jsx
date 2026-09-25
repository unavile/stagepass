import { useState, useEffect } from 'react'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG      = '#09090b'
const BG2     = '#111114'
const BG3     = '#18181c'
const BORDER  = 'rgba(255,255,255,0.08)'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#555250'
const GOLD    = '#c9a84c'
const RED     = '#e55'

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export default function LandingPageModal({ event, session, onClose, onSaved }) {
  const [slug, setSlug] = useState(event.slug || slugify(event.name || ''))
  const [description, setDescription] = useState(event.landing_description || '')
  const [imageUrl, setImageUrl] = useState(event.brochure_image_url || '')
  const [accentColor, setAccentColor] = useState(event.accent_color || '#c9a84c')
  const [enabled, setEnabled] = useState(event.landing_page_enabled || false)
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [slugError, setSlugError] = useState('')

  const sbUrl = import.meta.env.VITE_SUPABASE_URL
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const authHeaders = {
    'apikey': sbKey,
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }

  // Load existing ticket categories
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${sbUrl}/rest/v1/ticket_categories?event_id=eq.${event.id}&order=sort_order.asc,created_at.asc&select=*`,
          { headers: authHeaders }
        )
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data.map(c => ({ ...c, _dirty: false })))
        } else {
          // Default: single General Admission category pre-filled with event's ticket price
          setCategories([{
            id: null, // new
            name: 'General Admission',
            price: event.ticket_price || '',
            description: '',
            sort_order: 0,
            _new: true,
          }])
        }
      } catch (e) {
        console.error('load categories error:', e)
      }
    }
    load()
  }, [event.id])

  function addCategory() {
    setCategories(prev => [
      ...prev,
      { id: null, name: '', price: '', description: '', sort_order: prev.length, _new: true },
    ])
  }

  function removeCategory(idx) {
    setCategories(prev => prev.filter((_, i) => i !== idx))
  }

  function updateCategory(idx, field, value) {
    setCategories(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  function validateSlug(val) {
    if (!val) { setSlugError('Slug is required to enable landing page'); return false }
    if (!/^[a-z0-9-]+$/.test(val)) { setSlugError('Only lowercase letters, numbers, and hyphens'); return false }
    setSlugError('')
    return true
  }

  async function handleSave() {
    if (enabled && !validateSlug(slug)) return
    setError('')
    setSaving(true)

    try {
      // 1. Update event record
      const evPatch = {
        slug: slug || null,
        landing_page_enabled: enabled,
        landing_description: description || null,
        brochure_image_url: imageUrl || null,
        accent_color: accentColor || null,
      }
      const evRes = await fetch(
        `${sbUrl}/rest/v1/events?id=eq.${event.id}`,
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify(evPatch),
        }
      )
      if (!evRes.ok) {
        const err = await evRes.text()
        // Unique constraint violation → slug taken
        if (err.includes('duplicate') || err.includes('unique') || err.includes('slug')) {
          setSlugError('This URL slug is already taken. Choose a different one.')
          setSaving(false)
          return
        }
        throw new Error(err)
      }

      // 2. Delete existing categories for this event then re-insert
      await fetch(
        `${sbUrl}/rest/v1/ticket_categories?event_id=eq.${event.id}`,
        { method: 'DELETE', headers: authHeaders }
      )

      const validCats = categories.filter(c => c.name.trim() && c.price !== '' && !isNaN(parseFloat(c.price)))
      if (validCats.length > 0) {
        const insertData = validCats.map((c, i) => ({
          event_id: event.id,
          name: c.name.trim(),
          price: parseFloat(c.price),
          description: c.description?.trim() || null,
          sort_order: i,
        }))
        const catRes = await fetch(
          `${sbUrl}/rest/v1/ticket_categories`,
          {
            method: 'POST',
            headers: { ...authHeaders, 'Prefer': 'return=minimal' },
            body: JSON.stringify(insertData),
          }
        )
        if (!catRes.ok) {
          const err = await catRes.text()
          throw new Error(err)
        }
      }

      onSaved({
        ...event,
        ...evPatch,
        ticket_categories: validCats,
      })
      onClose()
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.')
    }
    setSaving(false)
  }

  const landingUrl = `https://covetedstage.com/${slug || '...'}`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: BG2,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: 32,
        width: '100%',
        maxWidth: 580,
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ color: GOLD, fontSize: 10, letterSpacing: '0.2em', marginBottom: 6 }}>
              EVENT LANDING PAGE
            </div>
            <div style={{ color: TEXT1, fontSize: 16, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
              {event.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: TEXT3,
            fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Enable toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: BG3, border: `1px solid ${BORDER}`, borderRadius: 10,
          padding: '14px 16px', marginBottom: 24,
        }}>
          <div>
            <div style={{ color: TEXT1, fontSize: 12, letterSpacing: '0.08em', marginBottom: 2 }}>
              Enable public landing page
            </div>
            <div style={{ color: TEXT3, fontSize: 10, letterSpacing: '0.06em' }}>
              Make this page accessible to anyone with the link
            </div>
          </div>
          <div
            onClick={() => setEnabled(v => !v)}
            style={{
              width: 44, height: 24, borderRadius: 12,
              background: enabled ? GOLD : '#333',
              cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: enabled ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {/* Slug */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 9, color: TEXT3, letterSpacing: '0.16em', marginBottom: 7 }}>
            URL SLUG *
          </label>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: TEXT3, fontSize: 11, pointerEvents: 'none',
            }}>
              covetedstage.com/
            </div>
            <input
              value={slug}
              onChange={e => {
                const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                setSlug(val)
                if (slugError) validateSlug(val)
              }}
              placeholder="event-name"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: BG3, border: `1px solid ${slugError ? RED : BORDER}`,
                borderRadius: 8, padding: '10px 12px 10px 160px',
                color: TEXT1, fontFamily: "'DM Mono', monospace", fontSize: 12,
                outline: 'none',
              }}
            />
          </div>
          {slugError && <div style={{ color: RED, fontSize: 10, marginTop: 5 }}>{slugError}</div>}
          {slug && !slugError && (
            <div style={{ color: TEXT3, fontSize: 10, marginTop: 5, letterSpacing: '0.06em' }}>
              {landingUrl}
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 9, color: TEXT3, letterSpacing: '0.16em', marginBottom: 7 }}>
            EVENT DESCRIPTION
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell your audience about this event — what to expect, who should attend, what makes it special..."
            rows={5}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: BG3, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '10px 12px',
              color: TEXT1, fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.7,
              outline: 'none', resize: 'vertical',
            }}
          />
        </div>

        {/* Brochure image URL */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 9, color: TEXT3, letterSpacing: '0.16em', marginBottom: 7 }}>
            BROCHURE / BANNER IMAGE URL
          </label>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: BG3, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '10px 12px',
              color: TEXT1, fontFamily: "'DM Mono', monospace", fontSize: 11,
              outline: 'none',
            }}
          />
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Preview"
              onError={e => e.target.style.display = 'none'}
              style={{ marginTop: 10, width: '100%', borderRadius: 8, maxHeight: 160, objectFit: 'cover' }}
            />
          )}
        </div>

        {/* Accent color */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', fontSize: 9, color: TEXT3, letterSpacing: '0.16em', marginBottom: 7 }}>
            ACCENT COLOR
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="color"
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              style={{ width: 40, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
            />
            <div style={{ color: TEXT2, fontSize: 11, letterSpacing: '0.06em' }}>
              {accentColor} — used for headings and highlights on the landing page
            </div>
          </div>
        </div>

        {/* Ticket categories */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: TEXT3, letterSpacing: '0.16em' }}>
              TICKET CATEGORIES
            </div>
            <button
              onClick={addCategory}
              style={{
                background: 'transparent', border: `1px solid ${GOLD}44`,
                borderRadius: 6, padding: '5px 12px',
                color: GOLD, fontSize: 10, letterSpacing: '0.12em',
                cursor: 'pointer', fontFamily: "'DM Mono', monospace",
              }}
            >
              + ADD CATEGORY
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categories.map((cat, i) => (
              <div key={i} style={{
                background: BG3, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <input
                    value={cat.name}
                    onChange={e => updateCategory(i, 'name', e.target.value)}
                    placeholder="Category name (e.g. General Admission)"
                    style={{
                      flex: 1, background: BG2, border: `1px solid ${BORDER}`,
                      borderRadius: 6, padding: '8px 10px',
                      color: TEXT1, fontFamily: "'DM Mono', monospace", fontSize: 11,
                      outline: 'none',
                    }}
                  />
                  <div style={{ position: 'relative', width: 100, flexShrink: 0 }}>
                    <div style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      color: TEXT3, fontSize: 12, pointerEvents: 'none',
                    }}>$</div>
                    <input
                      value={cat.price}
                      onChange={e => updateCategory(i, 'price', e.target.value)}
                      placeholder="0.00"
                      type="number"
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: BG2, border: `1px solid ${BORDER}`,
                        borderRadius: 6, padding: '8px 10px 8px 22px',
                        color: TEXT1, fontFamily: "'DM Mono', monospace", fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>
                  {categories.length > 1 && (
                    <button
                      onClick={() => removeCategory(i)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: TEXT3, cursor: 'pointer', fontSize: 16,
                        padding: '0 4px', flexShrink: 0,
                      }}
                    >✕</button>
                  )}
                </div>
                <input
                  value={cat.description || ''}
                  onChange={e => updateCategory(i, 'description', e.target.value)}
                  placeholder="Short description (optional)"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: BG2, border: `1px solid ${BORDER}`,
                    borderRadius: 6, padding: '7px 10px',
                    color: TEXT2, fontFamily: "'DM Mono', monospace", fontSize: 10,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ color: TEXT3, fontSize: 10, marginTop: 8, letterSpacing: '0.06em' }}>
            If only one category, no type selector is shown on the landing page.
          </div>
        </div>

        {error && (
          <div style={{
            color: RED, fontSize: 11, marginBottom: 16,
            background: 'rgba(238,85,85,0.08)', border: '1px solid rgba(238,85,85,0.2)',
            borderRadius: 8, padding: '10px 14px',
          }}>{error}</div>
        )}

        {/* Save button */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px 0',
              background: 'transparent', border: `1px solid ${BORDER}`,
              borderRadius: 10, color: TEXT2,
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: '0.12em', cursor: 'pointer',
            }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '12px 0',
              background: saving ? BG3 : GOLD,
              border: 'none', borderRadius: 10,
              color: saving ? TEXT3 : BG,
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              fontWeight: 700, letterSpacing: '0.12em',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'SAVING...' : 'SAVE LANDING PAGE'}
          </button>
        </div>

        {/* Share link if enabled */}
        {enabled && slug && (
          <div style={{
            marginTop: 20,
            background: 'rgba(201,168,76,0.06)',
            border: `1px solid ${GOLD}22`,
            borderRadius: 10, padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ color: TEXT2, fontSize: 10, letterSpacing: '0.06em', wordBreak: 'break-all' }}>
              {landingUrl}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(landingUrl)}
              style={{
                background: 'transparent', border: `1px solid ${GOLD}44`,
                borderRadius: 6, padding: '5px 10px',
                color: GOLD, fontSize: 9, letterSpacing: '0.12em',
                cursor: 'pointer', flexShrink: 0,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              COPY
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
