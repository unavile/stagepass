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
  return `${dayName}, ${monthDay} · ${h12}${minStr} ${ampm} · Seating starts at 3PM`
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

  // Multi-category quantities: { [catId]: number }
  const [quantities, setQuantities] = useState({})
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')

  // Email send state
  const [emailSent, setEmailSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState('')

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
        const cats = Array.isArray(catData) && catData.length > 0
          ? catData
          : [{ id: 'default', name: 'General Admission', price: ev.ticket_price || 0, description: '' }]
        setCategories(cats)

        // Initialise all quantities to 0
        const initQtys = {}
        cats.forEach(c => { initQtys[c.id] = 0 })
        setQuantities(initQtys)
      } catch (err) {
        console.error('EventLanding load error:', err)
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [slug])

  function setQty(catId, val) {
    setQuantities(prev => ({ ...prev, [catId]: Math.min(10, Math.max(0, val)) }))
  }

  // Build the line items array for categories with qty > 0
  function buildLineItems() {
    return categories
      .filter(c => (quantities[c.id] || 0) > 0)
      .map(c => ({ id: c.id, name: c.name, price: c.price, quantity: quantities[c.id] }))
  }

  const lineItems = buildLineItems()
  const totalQty = lineItems.reduce((s, li) => s + li.quantity, 0)
  const totalPrice = lineItems.reduce((s, li) => s + parseFloat(li.price) * li.quantity, 0).toFixed(2)
  const hasSelection = totalQty > 0

  async function handleBuy() {
    if (buying || !hasSelection) return
    setBuyError('')
    setBuying(true)
    try {
      const currentUrl = window.location.href
      const res = await fetch('/.netlify/functions/create-ticket-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventName: event.name,
          lineItems,                             // array of { id, name, price, quantity }
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

  async function handleSendTicketEmail() {
    if (emailSending || emailSent || !sessionId || !event) return
    setEmailSending(true)
    setEmailError('')
    try {
      // Get the customer email from the Stripe session via validate-ticket
      const validateRes = await fetch('/.netlify/functions/validate-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, eventId: event.id }),
      })
      const validateData = await validateRes.json()
      const fanEmail = validateData?.customerEmail

      if (!fanEmail || fanEmail === 'N/A') {
        setEmailError('Could not find your email address. Please check your Stripe confirmation email.')
        setEmailSending(false)
        return
      }

      const dateDisplay = formatEventDate(event.event_date, event.start_time)
      const res = await fetch('/.netlify/functions/send-ticket-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          eventName: event.name,
          eventDate: dateDisplay,
          eventVenue: event.venue || '',
          eventSlug: slug,
          fanEmail,
        }),
      })
      const data = await res.json()
      if (data.sent) {
        setEmailSent(true)
      } else {
        setEmailError('Failed to send email. Please screenshot your QR code.')
      }
    } catch (err) {
      setEmailError('Failed to send email. Please screenshot your QR code.')
    }
    setEmailSending(false)
  }

  const purchased = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('purchased') === '1'
  const sessionId = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('session_id')

  if (loading) return <Spinner />
  if (notFound) return fallback || <NotFound />

  const dateDisplay = formatEventDate(event.event_date, event.start_time)
  const accent = event.accent_color || '#7c5cbf'
  const accentBg = accent + '18'
  const accentBorder = accent + '55'
  const ticketPageUrl = `/${slug}/ticket?session_id=${encodeURIComponent(sessionId || '')}`

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
          padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 20,
          color: '#1a7a44', fontSize: 14, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Purchase confirmed!</div>
            <div style={{ fontSize: 13, color: '#3a9a64', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
              A confirmation email has been sent to you. See you at the event!
            </div>

            {sessionId && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Save My Ticket button */}
                <a
                  href={ticketPageUrl}
                  style={{
                    display: 'inline-block',
                    background: '#1a7a44', color: '#fff',
                    textDecoration: 'none', borderRadius: 8,
                    padding: '10px 20px', fontFamily: "'DM Mono', monospace",
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
                    width: 'fit-content',
                  }}
                >
                  🎟 SAVE MY TICKET →
                </a>

                {/* Email me my ticket */}
                {!emailSent ? (
                  <div>
                    <button
                      onClick={handleSendTicketEmail}
                      disabled={emailSending}
                      style={{
                        background: 'none', border: '1.5px solid #5aaa7a',
                        color: '#1a7a44', borderRadius: 8,
                        padding: '8px 16px', fontFamily: "'DM Mono', monospace",
                        fontSize: 11, cursor: emailSending ? 'not-allowed' : 'pointer',
                        letterSpacing: '0.1em', opacity: emailSending ? 0.6 : 1,
                      }}
                    >
                      {emailSending ? 'SENDING...' : '📧 EMAIL ME MY TICKET'}
                    </button>
                    {emailError && (
                      <div style={{ color: '#c0392b', fontSize: 11, marginTop: 6 }}>{emailError}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#1a7a44', fontFamily: "'DM Mono', monospace" }}>
                    ✓ Ticket link sent to your email
                  </div>
                )}
              </div>
            )}
          </div>

          {sessionId && (
            <div style={{ textAlign: 'center' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(sessionId)}&bgcolor=e8f7ee&color=1a7a44&margin=4`}
                alt="Ticket QR Code"
                style={{ borderRadius: 8, display: 'block', border: '2px solid #b2dfc5' }}
                width={140}
                height={140}
              />
              <div style={{ fontSize: 10, color: '#5aaa7a', marginTop: 6, fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>
                TICKET QR CODE
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Event header — compact ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1.5px solid #ede8df',
        padding: '14px 24px 12px',
        textAlign: 'center',
      }}>
        <h1 style={{
          margin: '0 0 10px',
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(24px, 4vw, 42px)',
          fontWeight: 700,
          color: '#111',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
        }}>
          {event.name}
        </h1>

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

        {event.venue && (
          <div style={{ marginTop: 6 }}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#555', fontSize: 18, letterSpacing: '0.02em',
                fontFamily: 'Georgia, serif', textDecoration: 'none',
                borderBottom: '1px dotted #aaa',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = accent}
              onMouseLeave={e => e.currentTarget.style.color = '#555'}
            >
              📍 {event.venue}
            </a>
          </div>
        )}
      </div>

      {/* ── Three-column body: brochure | description | tickets ── */}
      <div
        className="landing-grid"
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '16px 20px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 300px',
          gap: 24,
          alignItems: 'stretch',
          height: 'calc(100vh - 64px - 70px - 66px)',
        }}
      >
        {/* Col 1: Brochure image */}
        <div className="col-brochure" style={{ minHeight: 0 }}>
          {event.brochure_image_url ? (
            <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 32px rgba(0,0,0,0.11)', height: '100%', maxWidth: '80%' }}>
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
        <div className="col-description" style={{ minHeight: 0, overflowY: 'auto' }}>
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
            gap: 10,
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, color: accent, letterSpacing: '0.18em', marginBottom: 2 }}>
            SELECT TICKETS
          </div>

          {/* Per-category quantity steppers */}
          {categories.map(c => {
            const q = quantities[c.id] || 0
            return (
              <div key={c.id} style={{
                border: `1.5px solid ${q > 0 ? accent : '#e0dbd2'}`,
                borderRadius: 12,
                padding: '10px 12px',
                background: q > 0 ? accentBg : '#faf8f4',
                transition: 'all 0.15s',
              }}>
                {/* Category name + price row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: c.description ? 4 : 8 }}>
                  <div style={{
                    color: q > 0 ? accent : '#222',
                    fontSize: 14, fontFamily: 'Georgia, serif',
                    fontWeight: q > 0 ? 700 : 400,
                  }}>
                    {c.name}
                  </div>
                  <div style={{
                    color: q > 0 ? accent : '#444',
                    fontSize: 15, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                  }}>
                    ${parseFloat(c.price).toFixed(2)}
                  </div>
                </div>
                {c.description && (
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 8, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    {c.description}
                  </div>
                )}
                {/* Quantity stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1.5px solid #ddd', borderRadius: 8, overflow: 'hidden', width: 120 }}>
                  <button
                    onClick={() => setQty(c.id, q - 1)}
                    disabled={q <= 0}
                    style={{
                      width: 36, height: 34, background: '#fff', border: 'none',
                      borderRight: '1.5px solid #ddd', color: q <= 0 ? '#ccc' : '#333',
                      fontSize: 16, cursor: q <= 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >−</button>
                  <div style={{
                    flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700,
                    color: q > 0 ? accent : '#bbb', fontFamily: "'DM Mono', monospace",
                  }}>{q}</div>
                  <button
                    onClick={() => setQty(c.id, q + 1)}
                    disabled={q >= 10}
                    style={{
                      width: 36, height: 34, background: '#fff', border: 'none',
                      borderLeft: '1.5px solid #ddd', color: q >= 10 ? '#ccc' : '#333',
                      fontSize: 16, cursor: q >= 10 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >+</button>
                </div>
                {/* Per-category subtotal */}
                {q > 0 && (
                  <div style={{ fontSize: 11, color: accent, marginTop: 6, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
                    {q} × ${parseFloat(c.price).toFixed(2)} = ${(parseFloat(c.price) * q).toFixed(2)}
                  </div>
                )}
              </div>
            )
          })}

          {/* Order summary */}
          {hasSelection && (
            <div style={{
              background: accentBg, border: `1.5px solid ${accentBorder}`,
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10, color: accent, letterSpacing: '0.15em', marginBottom: 6 }}>ORDER SUMMARY</div>
              {lineItems.map(li => (
                <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 3 }}>
                  <span>{li.name} × {li.quantity}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>${(parseFloat(li.price) * li.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderTop: `1px solid ${accentBorder}`, marginTop: 6, paddingTop: 6,
              }}>
                <div style={{ color: '#666', fontSize: 11, letterSpacing: '0.12em' }}>TOTAL</div>
                <div style={{ color: accent, fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                  ${totalPrice}
                </div>
              </div>
            </div>
          )}

          {/* Buy button */}
          <button
            onClick={handleBuy}
            disabled={buying || !hasSelection}
            style={{
              width: '100%', padding: '10px 0',
              background: (buying || !hasSelection) ? '#ddd' : accent,
              color: (buying || !hasSelection) ? '#aaa' : '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
              letterSpacing: '0.14em', cursor: (buying || !hasSelection) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: (buying || !hasSelection) ? 'none' : `0 4px 20px ${accent}44`,
            }}
          >
            {buying
              ? 'REDIRECTING...'
              : !hasSelection
                ? 'SELECT TICKETS ABOVE'
                : `BUY ${totalQty} TICKET${totalQty !== 1 ? 'S' : ''} →`}
          </button>

          {buyError && (
            <div style={{ color: '#c0392b', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
              {buyError}
            </div>
          )}

          <div style={{
            color: '#bbb', fontSize: 10, textAlign: 'center',
            lineHeight: 1.4, fontFamily: 'Georgia, serif', fontStyle: 'italic',
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
        /* Tablet: collapse to 2 cols, remove fixed height */
        @media (max-width: 900px) {
          .landing-grid {
            grid-template-columns: 1fr 1fr !important;
            height: auto !important;
          }
          .col-brochure {
            grid-column: 1 / -1 !important;
            min-height: unset !important;
          }
          .col-brochure > div {
            height: auto !important;
            max-width: 100% !important;
            aspect-ratio: 16/7;
          }
          .col-brochure img {
            height: 100% !important;
          }
          .col-description {
            overflow-y: visible !important;
          }
          .col-tickets {
            position: static !important;
            overflow-y: visible !important;
          }
        }

        /* Mobile: single column, natural flow */
        @media (max-width: 560px) {
          .landing-grid {
            grid-template-columns: 1fr !important;
            height: auto !important;
            padding: 16px 16px 32px !important;
            gap: 16px !important;
          }
          .col-brochure {
            grid-column: 1 / -1 !important;
          }
          .col-brochure > div {
            height: auto !important;
            max-width: 100% !important;
            aspect-ratio: 4/3;
          }
          .col-brochure img {
            height: 100% !important;
          }
          .col-description, .col-tickets {
            grid-column: 1 / -1 !important;
            overflow-y: visible !important;
          }
          .col-tickets {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}
