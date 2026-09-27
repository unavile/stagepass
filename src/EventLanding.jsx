import { useState, useEffect } from 'react'

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

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh', background: '#faf8f4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", color: '#aaa', letterSpacing: '0.2em', fontSize: 13,
    }}>
      Loading…
    </div>
  )
}

function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#faf8f4',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>🎭</div>
      <div style={{ color: '#111', fontSize: 20, fontWeight: 700 }}>Event Not Found</div>
      <div style={{ color: '#777', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
        This event page doesn't exist or is no longer available.
      </div>
      <a href="https://covetedstage.com" style={{ color: '#7c5cbf', fontSize: 12, letterSpacing: '0.12em', textDecoration: 'none' }}>
        ← COVETED STAGE
      </a>
    </div>
  )
}

export default function EventLanding({ slug, fallback = null }) {
  const [event, setEvent] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [selectedCat, setSelectedCat] = useState(0)
  const [qty, setQty] = useState(1)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')

  const sbUrl = import.meta.env.VITE_SUPABASE_URL
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    async function load() {
      try {
        const evRes = await fetch(
          `${sbUrl}/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&landing_page_enabled=eq.true&select=*`,
          { headers: { 'apikey': sbKey } }
        )
        const evData = await evRes.json()
        if (!Array.isArray(evData) || evData.length === 0) {
          setNotFound(true); setLoading(false); return
        }
        const ev = evData[0]
        setEvent(ev)

        const catRes = await fetch(
          `${sbUrl}/rest/v1/ticket_categories?event_id=eq.${ev.id}&order=sort_order.asc,created_at.asc&select=*`,
          { headers: { 'apikey': sbKey } }
        )
        const catData = await catRes.json()
        if (Array.isArray(catData) && catData.length > 0) {
          setCategories(catData)
        } else {
          setCategories([{ id: 'default', name: 'General Admission', price: ev.ticket_price || 0, description: '' }])
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

  const purchased = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('purchased') === '1'

  if (loading) return <Spinner />
  if (notFound) return fallback || <NotFound />

  const cat = categories[selectedCat] || categories[0]
  const totalPrice = (parseFloat(cat?.price || 0) * qty).toFixed(2)
  const dateDisplay = formatEventDate(event.event_date, event.start_time)
  const accent = event.accent_color || '#7c5cbf'
  const accentBg = accent + '18'
  const accentBorder = accent + '55'

  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', fontFamily: "'DM Mono', monospace", color: '#111' }}>

      {/* ── Top nav banner — compact ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #ede8df',
        padding: '0 24px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <a href="https://covetedstage.com" style={{
          textDecoration: 'none',
          fontFamily: "'DM Mono', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: '#111',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Coveted Stage
        </a>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: 15,
          color: '#333',
          fontStyle: 'italic',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          textAlign: 'right',
        }}>
          {event.name} —{' '}
          <span style={{ color: accent, fontStyle: 'normal', fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.1em' }}>
            Tickets
          </span>
        </div>
      </div>

      {/* ── Success banner ── */}
      {purchased && (
        <div style={{
          background: '#e8f7ee', borderBottom: '1.5px solid #b2dfc5',
          padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12,
          color: '#1a7a44', fontSize: 14,
        }}>
          <span style={{ fontSize: 22 }}>🎉</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Purchase confirmed!</div>
            <div style={{ fontSize: 12, color: '#3a9a64', fontFamily: 'Georgia, serif' }}>
              A confirmation email has been sent to you. See you at the event!
            </div>
          </div>
        </div>
      )}

      {/* ── Event header — compact, ~50% height reduction ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #ede8df',
        padding: '20px 24px 18px',   /* was 40px/36px */
        textAlign: 'center',
      }}>
        <h1 style={{
          margin: '0 0 10px',
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(24px, 4vw, 42px)',   /* was clamp(32,5vw,56) */
          fontWeight: 700,
          color: '#111',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
        }}>
          {event.name}
        </h1>

        {/* Date pill — 1.5× larger font than before (was 15px → 22px) */}
        {dateDisplay && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: accentBg,
            border: `1.5px solid ${accentBorder}`,
            borderRadius: 999,
            padding: '7px 20px',
            fontSize: 18,
            color: accent,
            letterSpacing: '0.03em',
            marginBottom: 6,
            fontFamily: 'Georgia, serif',
          }}>
            📅 {dateDisplay}
          </div>
        )}

        {/* Venue — 1.5× larger (was 14px → 21px) */}
        {event.venue && (
          <div style={{ color: '#555', fontSize: 18, marginTop: 6, letterSpacing: '0.02em', fontFamily: 'Georgia, serif' }}>
            📍 {event.venue}
          </div>
        )}
      </div>

      {/* ── Three-column body: brochure | description | tickets ── */}
      <div
        className="landing-grid"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '24px 20px 32px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 300px',
          gap: 28,
          alignItems: 'stretch',
        }}
      >
        {/* Col 1: Brochure image */}
        <div className="col-brochure">
          {event.brochure_image_url ? (
            <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 32px rgba(0,0,0,0.11)', height: '100%' }}>
              <img
                src={event.brochure_image_url}
                alt={event.name}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{
              borderRadius: 16, background: '#f0ece4',
              border: '1.5px solid #ede8df', aspectRatio: '3/4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ccc', fontSize: 48,
            }}>🎭</div>
          )}
        </div>

        {/* Col 2: Description */}
        <div className="col-description">
          {event.landing_description ? (
            <>
              <div style={{
                fontSize: 11, color: accent, letterSpacing: '0.2em',
                marginBottom: 14, fontFamily: "'DM Mono', monospace",
              }}>
                ABOUT THIS EVENT
              </div>
              <div style={{
                color: '#222', fontSize: 17, lineHeight: 1.85,
                fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap',
              }}>
                {event.landing_description}
              </div>
            </>
          ) : (
            <div style={{ color: '#bbb', fontSize: 15, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              No description provided.
            </div>
          )}
        </div>

        {/* Col 3: Ticket purchase card */}
        <div
          className="col-tickets"
          style={{
            background: '#fff',
            border: '1.5px solid #ede8df',
            borderRadius: 18,
            padding: '16px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          }}
        >
          {/* Categories (multi) */}
          {categories.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.18em', marginBottom: 8 }}>
                TICKET TYPE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categories.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCat(i)}
                    style={{
                      background: selectedCat === i ? accentBg : '#faf8f4',
                      border: `2px solid ${selectedCat === i ? accent : '#e0dbd2'}`,
                      borderRadius: 10, padding: '8px 12px',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        color: selectedCat === i ? accent : '#222',
                        fontSize: 14, fontFamily: 'Georgia, serif',
                        fontWeight: selectedCat === i ? 700 : 400,
                      }}>
                        {c.name}
                      </div>
                      <div style={{
                        color: selectedCat === i ? accent : '#444',
                        fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                      }}>
                        ${parseFloat(c.price).toFixed(2)}
                      </div>
                    </div>
                    {c.description && (
                      <div style={{ color: '#888', fontSize: 12, marginTop: 4, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                        {c.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Single category */}
          {categories.length === 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#faf8f4', border: '1.5px solid #ede8df',
              borderRadius: 10, padding: '10px 14px', marginBottom: 12,
            }}>
              <div style={{ color: '#222', fontSize: 15, fontFamily: 'Georgia, serif' }}>
                {categories[0].name}
              </div>
              <div style={{ color: accent, fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                ${parseFloat(categories[0].price || 0).toFixed(2)}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.18em', marginBottom: 8 }}>QUANTITY</div>
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: 10, overflow: 'hidden', width: 150 }}>
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                disabled={qty <= 1}
                style={{
                  width: 40, height: 40, background: '#faf8f4', border: 'none',
                  borderRight: '1.5px solid #ddd', color: qty <= 1 ? '#ccc' : '#333',
                  fontSize: 18, cursor: qty <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >−</button>
              <div style={{
                flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 700,
                color: '#111', fontFamily: "'DM Mono', monospace",
              }}>{qty}</div>
              <button
                onClick={() => setQty(q => Math.min(10, q + 1))}
                disabled={qty >= 10}
                style={{
                  width: 40, height: 40, background: '#faf8f4', border: 'none',
                  borderLeft: '1.5px solid #ddd', color: qty >= 10 ? '#ccc' : '#333',
                  fontSize: 18, cursor: qty >= 10 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >+</button>
            </div>
          </div>

          {/* Total */}
          <div style={{
            background: accentBg, border: `1.5px solid ${accentBorder}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 12,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ color: '#666', fontSize: 11, letterSpacing: '0.12em' }}>TOTAL</div>
            <div style={{ color: accent, fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
              ${totalPrice}
            </div>
          </div>

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={buying}
            style={{
              width: '100%', padding: '12px 0',
              background: buying ? '#ddd' : accent,
              color: buying ? '#aaa' : '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
              letterSpacing: '0.14em', cursor: buying ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: buying ? 'none' : `0 4px 20px ${accent}44`,
            }}
          >
            {buying ? 'REDIRECTING...' : `BUY ${qty > 1 ? qty + ' TICKETS' : 'TICKET'} →`}
          </button>

          {buyError && (
            <div style={{ color: '#c0392b', fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
              {buyError}
            </div>
          )}

          <div style={{
            color: '#bbb', fontSize: 10, textAlign: 'center', marginTop: 10,
            lineHeight: 1.5, fontFamily: 'Georgia, serif', fontStyle: 'italic',
          }}>
            Secure checkout via Stripe. No account required.
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1.5px solid #ede8df', padding: '22px 24px',
        textAlign: 'center', color: '#bbb', fontSize: 11,
        letterSpacing: '0.16em', fontFamily: "'DM Mono', monospace",
      }}>
        COVETED STAGE · THE STAGE IS YOURS ·{' '}
        <a href="https://covetedstage.com" style={{ color: '#aaa', textDecoration: 'none' }}>
          covetedstage.com
        </a>
      </div>

      {/* ── Responsive styles ── */}
      <style>{`
        /* Tablet: collapse to 2 cols — brochure full width, description + tickets side by side */
        @media (max-width: 900px) {
          .landing-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .col-brochure {
            grid-column: 1 / -1 !important;
          }
          .col-tickets {
            position: static !important;
          }
        }

        /* Mobile: single column, tickets at bottom */
        @media (max-width: 560px) {
          .landing-grid {
            grid-template-columns: 1fr !important;
            padding: 20px 16px 40px !important;
            gap: 20px !important;
          }
          .col-brochure, .col-description, .col-tickets {
            grid-column: 1 / -1 !important;
          }
          .col-tickets {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}
