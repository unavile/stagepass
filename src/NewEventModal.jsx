import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function NewEventModal({ creatorId, accentColor, onClose, onEventCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [venue, setVenue] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventType, setEventType] = useState('virtual')
  const [capacity, setCapacity] = useState('')
  const [accessType, setAccessType] = useState('free') // 'free' | 'subscribers' | 'ticketed'
  const [ticketPrice, setTicketPrice] = useState('')
  const [startTime, setStartTime] = useState('18:00')
  const [duration, setDuration] = useState('60')
  const [eventMode, setEventMode] = useState('broadcast') // 'broadcast' | 'class'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ac = accentColor || '#c9a84c'

  const input = {
    width: '100%', background: '#252530', border: '1px solid #ffffff28',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
    colorScheme: 'dark',
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Please add an event name.'); return }
    if (!eventDate) { setError('Please set a date.'); return }
    if (accessType === 'ticketed' && (!ticketPrice || isNaN(parseFloat(ticketPrice)) || parseFloat(ticketPrice) <= 0)) {
      setError('Please enter a valid ticket price.'); return
    }
    setError(null)
    setLoading(true)

    try {
      let dailyRoomName = null

      if (eventType === 'virtual') {
        const startDateTime = `${eventDate}T${startTime}:00`
        const res = await fetch('/.netlify/functions/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: crypto.randomUUID(),
            eventName: name.trim(),
            startTime: startDateTime,
            durationMinutes: parseInt(duration) || 60,
            eventMode,
          })
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to create live room')
        dailyRoomName = data.roomName
      }

      const sbUrl = import.meta.env.VITE_SUPABASE_URL
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const insertRes = await fetch(`${sbUrl}/rest/v1/events`, {
        method: 'POST',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          creator_id: creatorId,
          name: name.trim(),
          description: description.trim(),
          venue: venue.trim() || null,
          event_date: eventDate,
          event_type: eventType,
          stream_url: null,
          capacity: capacity ? parseInt(capacity) : null,
          is_free: accessType === 'free',
          access_type: accessType,
          ticket_price: accessType === 'ticketed' ? parseFloat(ticketPrice) : null,
          daily_room_name: dailyRoomName,
          duration_minutes: parseInt(duration) || 60,
          start_time: startTime,
          event_mode: eventType === 'virtual' ? eventMode : 'broadcast',
        }),
      })
      if (!insertRes.ok) {
        const errData = await insertRes.json().catch(() => ({}))
        throw new Error(errData.message || `Failed to create event (${insertRes.status})`)
      }
      onEventCreated?.()
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const ACCESS_OPTIONS = [
    {
      id: 'free',
      icon: '🌐',
      label: 'Free',
      sub: 'Anyone can RSVP and attend',
    },
    {
      id: 'subscribers',
      icon: '🔑',
      label: 'Subscribers',
      sub: 'Only your subscribers can attend',
    },
    {
      id: 'ticketed',
      icon: '🎟',
      label: 'Ticketed',
      sub: 'Anyone can buy a ticket to attend',
    },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24
    }}>
      <div style={{
        background: '#161618', border: '1px solid #ffffff18',
        borderRadius: 14, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', padding: 32
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>New Event</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Event type */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'virtual',   label: '💻 Virtual' },
            { id: 'in_person', label: '📍 In Person' }
          ].map(t => (
            <button key={t.id} onClick={() => setEventType(t.id)} style={{
              flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
              background: eventType === t.id ? ac + '18' : 'none',
              border: eventType === t.id ? `1px solid ${ac}66` : '1px solid #ffffff15',
              color: eventType === t.id ? ac : '#555',
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>{t.label}</button>
          ))}
        </div>

        {/* Virtual info banner */}
        {eventType === 'virtual' && (
          <div style={{
            background: ac + '0f', border: `1px solid ${ac}33`,
            borderRadius: 8, padding: '10px 14px', marginBottom: 14,
            display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🎙</span>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
              A private live room will be automatically created via Daily.co when you submit.
            </div>
          </div>
        )}

        {/* Virtual event mode selector */}
        {eventType === 'virtual' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>
              STREAMING MODE
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'broadcast', icon: '📡', label: 'Broadcast', sub: 'Fans watch only — your camera is pinned' },
                { id: 'class',     icon: '🎓', label: 'Class',     sub: 'Interactive — fans can share camera/mic' },
              ].map(m => (
                <div
                  key={m.id}
                  onClick={() => setEventMode(m.id)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
                    background: eventMode === m.id ? ac + '12' : '#111',
                    border: eventMode === m.id ? `1px solid ${ac}55` : '1px solid #ffffff10',
                    borderRadius: 9, padding: '12px 14px', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      background: eventMode === m.id ? ac : '#2a2a2a',
                      border: `2px solid ${eventMode === m.id ? ac : '#444'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {eventMode === m.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#080808' }} />}
                    </div>
                    <span style={{ fontSize: 14 }}>{m.icon}</span>
                    <span style={{ fontSize: 12, color: eventMode === m.id ? '#f0ebe0' : '#888', fontWeight: eventMode === m.id ? 500 : 400 }}>{m.label}</span>
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#444', paddingLeft: 24, lineHeight: 1.5 }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <input style={input} placeholder="Event name" value={name} onChange={e => setName(e.target.value)} />

        {/* Description */}
        <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />

        {/* Venue — in-person only */}
        {eventType === 'in_person' && (
          <input style={input} placeholder="Venue name and address" value={venue} onChange={e => setVenue(e.target.value)} />
        )}

        {/* Date */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>SELECT DATE</div>
        <input style={input} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />

        {/* Time + duration — virtual only */}
        {eventType === 'virtual' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.12em', marginBottom: 6 }}>START TIME</div>
              <input style={{ ...input, marginBottom: 0 }} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.12em', marginBottom: 6 }}>DURATION (MINS)</div>
              <input style={{ ...input, marginBottom: 0 }} type="number" min="15" max="480" value={duration} onChange={e => setDuration(e.target.value)} placeholder="60" />
            </div>
          </div>
        )}

        {/* Capacity */}
        <input style={input} placeholder="Capacity (optional — leave blank for unlimited)" value={capacity} onChange={e => setCapacity(e.target.value)} type="number" />

        {/* Access type — 3-way selector */}
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

        {/* Ticket price — only shown when Ticketed selected */}
        {accessType === 'ticketed' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>TICKET PRICE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#555', fontSize: 18, fontFamily: "'DM Mono', monospace" }}>$</span>
              <input
                style={{ ...input, marginBottom: 0, width: 120 }}
                type="number" min="1" step="0.01"
                placeholder="e.g. 15.00"
                value={ticketPrice}
                onChange={e => setTicketPrice(e.target.value)}
              />
              <span style={{ color: '#555', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>per ticket</span>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 8, lineHeight: 1.6 }}>
              Subscribers attend for free. Non-subscribers can purchase a ticket via Stripe.
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: '#e84545', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', background: ac, color: '#080808',
            border: 'none', borderRadius: 8, padding: '14px',
            fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
            letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', opacity: loading ? 0.7 : 1,
            boxShadow: `0 4px 20px ${ac}40`,
          }}
        >
          {loading ? (eventType === 'virtual' ? 'Creating Live Room...' : 'Creating Event...') : 'Create Event'}
        </button>
      </div>
    </div>
  )
}
