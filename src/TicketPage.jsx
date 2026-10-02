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

export default function TicketPage({ eventSlug }) {
  const sessionId = new URLSearchParams(window.location.search).get('session_id')

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const sbUrl = import.meta.env.VITE_SUPABASE_URL
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${sbUrl}/rest/v1/events?slug=eq.${encodeURIComponent(eventSlug)}&select=*`,
          { headers: { 'apikey': sbKey } }
        )
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setEvent(data[0])
        } else {
          setNotFound(true)
        }
      } catch (_) {
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [eventSlug])

  if (!sessionId) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', monospace", padding: 24, gap: 12, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40 }}>🎟</div>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>No ticket found</div>
        <div style={{ color: '#666', fontSize: 13, maxWidth: 300 }}>
          This link is missing a ticket reference. Check your confirmation email for the full ticket link.
        </div>
        <a href={`/${eventSlug}`} style={{ color: '#7c5cbf', fontSize: 12, letterSpacing: '0.12em', textDecoration: 'none', marginTop: 8 }}>
          ← Back to event
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', monospace", color: '#555', letterSpacing: '0.2em', fontSize: 13,
      }}>
        Loading…
      </div>
    )
  }

  const accent = event?.accent_color || '#7c5cbf'
  const dateDisplay = event ? formatEventDate(event.event_date, event.start_time) : null
  const bookingRef = sessionId.replace('cs_live_', '').replace('cs_test_', '').slice(0, 16).toUpperCase()
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(sessionId)}&bgcolor=0f0f0f&color=ffffff&margin=6`

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'DM Mono', monospace", padding: '32px 16px', gap: 0,
    }}>

      {/* Nav */}
      <div style={{ width: '100%', maxWidth: 440, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="https://covetedstage.com" style={{ color: '#555', fontSize: 11, letterSpacing: '0.18em', textDecoration: 'none', textTransform: 'uppercase' }}>
          Coveted Stage
        </a>
        <a href={`/${eventSlug}`} style={{ color: '#555', fontSize: 11, letterSpacing: '0.12em', textDecoration: 'none' }}>
          ← Event page
        </a>
      </div>

      {/* Ticket card */}
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#161616', border: '1.5px solid #2a2a2a',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${accent}22`,
      }}>

        {/* Card header */}
        <div style={{
          background: accent + '18', borderBottom: `1.5px solid ${accent}33`,
          padding: '20px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: accent, letterSpacing: '0.2em', marginBottom: 6 }}>
            COVETED STAGE · ADMISSION TICKET
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#f0ebe0', fontWeight: 700, lineHeight: 1.2 }}>
            {event?.name || eventSlug}
          </div>
        </div>

        {/* Event details */}
        <div style={{ padding: '16px 24px', borderBottom: '1px dashed #2a2a2a' }}>
          {dateDisplay && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>📅</span>
              <span style={{ color: '#ccc', fontSize: 13, lineHeight: 1.5 }}>{dateDisplay}</span>
            </div>
          )}
          {event?.venue && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 15 }}>📍</span>
              <span style={{ color: '#ccc', fontSize: 13, lineHeight: 1.5 }}>{event.venue}</span>
            </div>
          )}
        </div>

        {/* QR code */}
        <div style={{ padding: '28px 24px', textAlign: 'center', borderBottom: '1px dashed #2a2a2a' }}>
          <div style={{
            display: 'inline-block', padding: 16,
            background: '#0f0f0f', borderRadius: 16,
            border: `2px solid ${accent}44`,
          }}>
            <img
              src={qrUrl}
              alt="Ticket QR Code"
              width={220}
              height={220}
              style={{ display: 'block', borderRadius: 8 }}
            />
          </div>
          <div style={{ color: '#555', fontSize: 10, letterSpacing: '0.18em', marginTop: 14, textTransform: 'uppercase' }}>
            Show this QR code at the door
          </div>
        </div>

        {/* Booking reference */}
        <div style={{ padding: '16px 24px', borderBottom: '1px dashed #2a2a2a', textAlign: 'center' }}>
          <div style={{ color: '#444', fontSize: 10, letterSpacing: '0.18em', marginBottom: 8 }}>BOOKING REFERENCE</div>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: 15, color: accent,
            letterSpacing: '0.2em', fontWeight: 700,
          }}>
            {bookingRef}
          </div>
        </div>

        {/* Footer note */}
        <div style={{ padding: '16px 24px', textAlign: 'center' }}>
          <div style={{ color: '#444', fontSize: 11, lineHeight: 1.7 }}>
            Bookmark this page or screenshot the QR code.<br />
            This ticket is valid for one entry per person.
          </div>
        </div>
      </div>

      <div style={{ color: '#2a2a2a', fontSize: 10, letterSpacing: '0.12em', marginTop: 32 }}>
        COVETED STAGE · NOT FOR RESALE
      </div>
    </div>
  )
}
