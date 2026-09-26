import { useState, useEffect } from 'react'

// ─── Design tokens — bright, vibrant landing page palette ─────────────────────
const GOLD    = '#c9a84c'
const GOLD2   = '#e8c96a'
const CREAM   = '#f4f0e8'
const DARK    = '#09090b'
const DARK2   = '#111114'
const DARK3   = '#18181c'
const BORDER  = 'rgba(255,255,255,0.12)'
const TEXT2   = '#9a9690'
const RED     = '#e55'

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh', background: DARK,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", color: '#555', letterSpacing: '0.2em', fontSize: 12,
    }}>
      LOADING...
    </div>
  )
}

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: DARK,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>🎭</div>
      <div style={{ color: CREAM, fontSize: 18, fontWeight: 700 }}>Event Not Found</div>
      <div style={{ color: TEXT2, fontSize: 12, textAlign: 'center', maxWidth: 320 }}>
        This event page doesn't exist or is no longer available.
      </div>
      <a href="https://covetedstage.com" style={{ color: GOLD, fontSize: 11, letterSpacing: '0.12em', textDecoration: 'none' }}>
        ← BACK TO COVETED STAGE
      </a>
    </div>
  )
}

// Format date nicely: "Saturday, October 12, 2025 · 7:00 PM"
function formatEventDate(dateStr, timeStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  if (!timeStr) return `${dayName}, ${monthDay}`

  const [h, min] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  const minStr = min === 0 ? '' : `:${String(min).padStart(2, '0')}`
  return `${dayName}, ${monthDay} · ${h12}${minStr} ${ampm}`
}

export default function EventLanding({ slug, fallback = null }) {
  const [event, setEvent] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Selected category index and quantity
  const [selectedCat, setSelectedCat] = useState(0)
  const [qty, setQty] = useState(1)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')

  const sbUrl = import.meta.env.VITE_SUPABASE_URL
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    async function load() {
      try {
        // Fetch event by slug (landing_page_enabled must be true)
        const evRes = await fetch(
          `${sbUrl}/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&landing_page_enabled=eq.true&select=*`,
          { headers: { 'apikey': sbKey } }
        )
        const evData = await evRes.json()
        if (!Array.isArray(evData) || evData.length === 0) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const ev = evData[0]
        setEvent(ev)

        // Fetch ticket categories for this event
        const catRes = await fetch(
          `${sbUrl}/rest/v1/ticket_categories?event_id=eq.${ev.id}&order=sort_order.asc,created_at.asc&select=*`,
          { headers: { 'apikey': sbKey } }
        )
        const catData = await catRes.json()
        if (Array.isArray(catData) && catData.length > 0) {
          setCategories(catData)
        } else {
          // Fall back to single-price from event itself
          setCategories([{
            id: 'default',
            name: 'General Admission',
            price: ev.ticket_price || 0,
            description: '',
          }])
        }
      } catch (err) {
        console.error('EventLanding load error:', err)
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function handleBuy() {
    if (buying) return
    setBuyError('')
    setBuying(true)

    try {
      const cat = categories[selectedCat]
      const currentUrl = window.location.href

      const res = await fetch('/.netlify/functions/create-ticket-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventName: event.name,
          ticketPrice: cat.price,
          quantity: qty,
          categoryName: categories.length > 1 ? cat.name : undefined,
          categoryPrice: cat.price,
          // Return to this landing page after purchase
          successUrl: `${currentUrl}?purchased=1`,
          cancelUrl: currentUrl,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setBuyError(data.error || 'Something went wrong. Please try again.')
      }
    } catch (err) {
      setBuyError('Something went wrong. Please try again.')
    }
    setBuying(false)
  }

  // Show success banner if returned from Stripe
  const purchased = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('purchased') === '1'

  if (loading) return <Spinner />
  if (notFound) return fallback || <NotFound />

  const cat = categories[selectedCat] || categories[0]
  const totalPrice = (parseFloat(cat?.price || 0) * qty).toFixed(2)
  const dateDisplay = formatEventDate(event.event_date, event.start_time)
  const accent = event.accent_color || GOLD

  return (
    <div style={{
      minHeight: '100vh',
      background: DARK,
      fontFamily: "'DM Mono', monospace",
      color: CREAM,
    }}>
      {/* ── Hero ── */}
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: 420,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 48,
      }}>
        {/* Background image */}
        {event.brochure_image_url ? (
          <img
            src={event.brochure_image_url}
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(135deg, ${DARK2} 0%, #1a1020 50%, ${DARK3} 100%)`,
          }} />
        )}
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(9,9,11,0.3) 0%, rgba(9,9,11,0.85) 100%)',
        }} />

        {/* Coveted Stage branding */}
        <div style={{
          position: 'absolute', top: 24, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
        }}>
          <a href="https://covetedstage.com" style={{
            color: accent, fontSize: 13, letterSpacing: '0.22em',
            fontWeight: 700, textDecoration: 'none', opacity: 0.9,
          }}>
            ✦ COVETED STAGE
          </a>
        </div>

        {/* Event title */}
        <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px', maxWidth: 700 }}>
          {event.category && (
            <div style={{
              display: 'inline-block',
              background: accent + '22',
              border: `1px solid ${accent}55`,
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 10,
              color: accent,
              letterSpacing: '0.18em',
              marginBottom: 16,
            }}>
              {event.category.toUpperCase()}
            </div>
          )}
          <h1 style={{
            fontSize: 'clamp(28px, 6vw, 52px)',
            fontWeight: 800,
            color: CREAM,
            margin: '0 0 12px',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            fontFamily: 'Georgia, serif',
          }}>
            {event.name}
          </h1>
          {dateDisplay && (
            <div style={{
              color: accent,
              fontSize: 13,
              letterSpacing: '0.12em',
              marginBottom: 8,
            }}>
              📅 {dateDisplay}
            </div>
          )}
          {event.location && (
            <div style={{ color: TEXT2, fontSize: 12, letterSpacing: '0.08em' }}>
              📍 {event.location}
            </div>
          )}
        </div>
      </div>

      {/* ── Success banner ── */}
      {purchased && (
        <div style={{
          background: 'rgba(80,200,120,0.12)',
          border: '1px solid rgba(80,200,120,0.35)',
          borderRadius: 12,
          padding: '16px 24px',
          margin: '24px auto',
          maxWidth: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#6ee7a0',
          fontSize: 13,
          letterSpacing: '0.08em',
        }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Purchase confirmed!</div>
            <div style={{ fontSize: 11, color: TEXT2 }}>A confirmation email has been sent to you. See you at the event!</div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '40px 20px 80px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 340px',
        gap: 40,
        alignItems: 'start',
      }}
        className="landing-grid"
      >
        {/* Left: description + brochure */}
        <div>
          {event.landing_description && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: '28px 32px',
              marginBottom: 28,
            }}>
              <div style={{
                fontSize: 10, color: accent, letterSpacing: '0.2em', marginBottom: 16,
              }}>
                ABOUT THIS EVENT
              </div>
              <div style={{
                color: CREAM,
                fontSize: 15,
                lineHeight: 1.8,
                fontFamily: 'Georgia, serif',
                whiteSpace: 'pre-wrap',
              }}>
                {event.landing_description}
              </div>
            </div>
          )}

          {event.brochure_image_url && (
            <img
              src={event.brochure_image_url}
              alt={event.name}
              style={{
                width: '100%',
                borderRadius: 16,
                border: `1px solid ${BORDER}`,
                objectFit: 'cover',
                maxHeight: 480,
              }}
            />
          )}
        </div>

        {/* Right: ticket purchase card */}
        <div style={{
          background: DARK2,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: '28px 24px',
          position: 'sticky',
          top: 24,
        }}>
          <div style={{ fontSize: 10, color: accent, letterSpacing: '0.2em', marginBottom: 20 }}>
            GET TICKETS
          </div>

          {/* Ticket categories */}
          {categories.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: TEXT2, letterSpacing: '0.14em', marginBottom: 10 }}>
                TICKET TYPE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCat(i)}
                    style={{
                      background: selectedCat === i ? accent + '18' : 'transparent',
                      border: `1.5px solid ${selectedCat === i ? accent : BORDER}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        color: selectedCat === i ? accent : CREAM,
                        fontSize: 12, fontFamily: "'DM Mono', monospace",
                        letterSpacing: '0.06em',
                      }}>
                        {c.name}
                      </div>
                      <div style={{
                        color: selectedCat === i ? accent : TEXT2,
                        fontSize: 13, fontWeight: 700,
                        fontFamily: "'DM Mono', monospace",
                      }}>
                        ${parseFloat(c.price).toFixed(2)}
                      </div>
                    </div>
                    {c.description && (
                      <div style={{ color: TEXT2, fontSize: 10, marginTop: 4, letterSpacing: '0.06em' }}>
                        {c.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Single category price display */}
          {categories.length === 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20, paddingBottom: 16,
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{ color: CREAM, fontSize: 12, letterSpacing: '0.06em' }}>
                {categories[0].name}
              </div>
              <div style={{ color: accent, fontSize: 18, fontWeight: 700 }}>
                ${parseFloat(categories[0].price || 0).toFixed(2)}
              </div>
            </div>
          )}

          {/* Quantity selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: TEXT2, letterSpacing: '0.14em', marginBottom: 10 }}>
              QUANTITY
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{
                  width: 36, height: 36,
                  background: DARK3, border: `1px solid ${BORDER}`,
                  borderRadius: 8, color: CREAM, fontSize: 18,
                  cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                  opacity: qty <= 1 ? 0.3 : 1,
                  fontFamily: "'DM Mono', monospace",
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                disabled={qty <= 1}
              >−</button>
              <div style={{
                flex: 1, textAlign: 'center',
                fontSize: 20, fontWeight: 700, color: CREAM,
              }}>{qty}</div>
              <button
                onClick={() => setQty(q => Math.min(10, q + 1))}
                style={{
                  width: 36, height: 36,
                  background: DARK3, border: `1px solid ${BORDER}`,
                  borderRadius: 8, color: CREAM, fontSize: 18,
                  cursor: qty >= 10 ? 'not-allowed' : 'pointer',
                  opacity: qty >= 10 ? 0.3 : 1,
                  fontFamily: "'DM Mono', monospace",
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                disabled={qty >= 10}
              >+</button>
            </div>
          </div>

          {/* Total */}
          <div style={{
            background: accent + '10',
            border: `1px solid ${accent}30`,
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ color: TEXT2, fontSize: 11, letterSpacing: '0.1em' }}>TOTAL</div>
            <div style={{ color: accent, fontSize: 20, fontWeight: 700 }}>
              ${totalPrice}
            </div>
          </div>

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={buying}
            style={{
              width: '100%',
              padding: '14px 0',
              background: buying ? DARK3 : accent,
              color: buying ? TEXT2 : DARK,
              border: 'none',
              borderRadius: 10,
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.14em',
              cursor: buying ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {buying ? 'REDIRECTING...' : `BUY ${qty > 1 ? qty + ' TICKETS' : 'TICKET'} →`}
          </button>

          {buyError && (
            <div style={{
              color: RED, fontSize: 11, marginTop: 10,
              textAlign: 'center', lineHeight: 1.5,
            }}>
              {buyError}
            </div>
          )}

          <div style={{
            color: TEXT2, fontSize: 10, textAlign: 'center',
            marginTop: 14, lineHeight: 1.6, letterSpacing: '0.06em',
          }}>
            Secure checkout via Stripe. No account required.
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: `1px solid ${BORDER}`,
        padding: '24px 20px',
        textAlign: 'center',
        color: '#444',
        fontSize: 10,
        letterSpacing: '0.16em',
      }}>
        COVETED STAGE · THE STAGE IS YOURS ·{' '}
        <a href="https://covetedstage.com" style={{ color: '#555', textDecoration: 'none' }}>
          covetedstage.com
        </a>
      </div>

      {/* Responsive grid collapse */}
      <style>{`
        @media (max-width: 700px) {
          .landing-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
