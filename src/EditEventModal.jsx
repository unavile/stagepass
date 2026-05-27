import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function EditEventModal({ event, accentColor, accessToken, onClose, onSaved }) {
  const [name, setName] = useState(event.name || '')
  const [description, setDescription] = useState(event.description || '')
  const [venue, setVenue] = useState(event.venue || '')
  const [eventDate, setEventDate] = useState(event.event_date || '')
  const [startTime, setStartTime] = useState(event.start_time || '18:00')
  const [duration, setDuration] = useState(event.duration_minutes || 60)
  const [capacity, setCapacity] = useState(event.capacity || '')
  const [accessType, setAccessType] = useState(event.access_type || (event.is_free ? 'free' : 'subscribers'))
  const [ticketPrice, setTicketPrice] = useState(event.ticket_price || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ac = accentColor || '#c9a84c'
  const isVirtual = event.event_type === 'virtual'

  const input = {
    width: '100%', background: '#111', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
  }

  const ACCESS_OPTIONS = [
    { id: 'free',        icon: '🌐', label: 'Free',        sub: 'Anyone can RSVP and attend' },
    { id: 'subscribers', icon: '🔑', label: 'Subscribers', sub: 'Only your subscribers can attend' },
    { id: 'ticketed',    icon: '🎟', label: 'Ticketed',    sub: 'Anyone can buy a ticket to attend' },
  ]

  async function handleSave() {
    if (!name.trim()) { setError('Event name is required.'); return }
    if (!eventDate) { setError('Please set a date.'); return }
    if (accessType === 'ticketed' && (!ticketPrice || isNaN(parseFloat(ticketPrice)) || parseFloat(ticketPrice) <= 0)) {
      setError('Please enter a valid ticket price.'); return
    }
    setLoading(true)
    setError(null)

    try {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${sbUrl}/rest/v1/events?id=eq.${event.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${accessToken || sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          venue: venue.trim() || null,
          event_date: eventDate,
          start_time: startTime,
          duration_minutes: parseInt(duration) || 60,
          capacity: capacity ? parseInt(capacity) : null,
          access_type: accessType,
          is_free: accessType === 'free',
          ticket_price: accessType === 'ticketed' ? parseFloat(ticketPrice) : null,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Update failed (${res.status})`)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24,
    }}>
      <div style={{
        background: '#0e0e0e', border: '1px solid #ffffff12',
        borderRadius: 14, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', padding: 32,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>Edit Event</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Type badge */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 20 }}>
          {isVirtual ? '💻 VIRTUAL EVENT' : '📍 IN-PERSON EVENT'}
          {event.daily_room_name && <span style={{ marginLeft: 8, color: ac }}>· Live room active</span>}
        </div>

        {/* Name */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>EVENT NAME</div>
        <input style={input} placeholder="Event name" value={name} onChange={e => setName(e.target.value)} autoFocus />

        {/* Description */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>DESCRIPTION</div>
        <textarea style={{ ...input, minHeight: 80, resize: 'vertical' }} placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />

        {/* Venue — in-person only */}
        {!isVirtual && (
          <>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>VENUE</div>
            <input style={input} placeholder="Venue name and address" value={venue} onChange={e => setVenue(e.target.value)} />
          </>
        )}

        {/* Date */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>SELECT DATE</div>
        <input style={input} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />

        {/* Time + duration — virtual only */}
        {isVirtual && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.12em', marginBottom: 6 }}>START TIME</div>
              <input style={{ ...input, marginBottom: 0 }} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.12em', marginBottom: 6 }}>DURATION (MINS)</div>
              <input style={{ ...input, marginBottom: 0 }} type="number" min="15" max="480" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>
        )}

        {/* Capacity */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>CAPACITY</div>
        <input style={input} placeholder="Leave blank for unlimited" value={capacity} onChange={e => setCapacity(e.target.value)} type="number" />

        {/* Access type */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 10 }}>ACCESS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {ACCESS_OPTIONS.map(opt => (
            <div
              key={opt.id}
              onClick={() => setAccessType(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: accessType === opt.id ? ac + '12' : '#111',
                border: accessType === opt.id ? `1px solid ${ac}55` : '1px solid #ffffff10',
                borderRadius: 9, padding: '12px 14px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: accessType === opt.id ? ac : '#2a2a2a',
                border: `2px solid ${accessType === opt.id ? ac : '#444'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {accessType === opt.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#080808' }} />}
              </div>
              <div style={{ fontSize: 16, flexShrink: 0 }}>{opt.icon}</div>
              <div>
                <div style={{ fontSize: 13, color: accessType === opt.id ? '#f0ebe0' : '#888', fontWeight: accessType === opt.id ? 500 : 400 }}>{opt.label}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 1 }}>{opt.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Ticket price */}
        {accessType === 'ticketed' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>TICKET PRICE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#555', fontSize: 18, fontFamily: "'DM Mono', monospace" }}>$</span>
              <input style={{ ...input, marginBottom: 0, width: 120 }} type="number" min="1" step="0.01" placeholder="e.g. 15.00" value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} />
              <span style={{ color: '#555', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>per ticket</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#e84545', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, background: 'transparent', color: '#555',
            border: '1px solid #ffffff15', borderRadius: 8, padding: '12px',
            fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: 'pointer',
          }}>CANCEL</button>
          <button onClick={handleSave} disabled={loading} style={{
            flex: 2, background: ac, color: '#080808',
            border: 'none', borderRadius: 8, padding: '12px',
            fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
            letterSpacing: '0.12em', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: `0 4px 16px ${ac}40`,
          }}>
            {loading ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  )
}
