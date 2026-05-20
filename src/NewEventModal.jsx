import { useState } from 'react'
import { supabase } from './supabaseClient'


export default function NewEventModal({ creatorId, accentColor, onClose, onEventCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [venue, setVenue] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventType, setEventType] = useState('virtual')
  const [streamUrl, setStreamUrl] = useState('')
  const [capacity, setCapacity] = useState('')
  const [isFree, setIsFree] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [startTime, setStartTime] = useState('18:00')
  const [duration, setDuration] = useState('60')

  const input = {
    width: '100%', background: '#111', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Please add an event name.'); return }
    if (!eventDate) { setError('Please set a date.'); return }
    setError(null)
    setLoading(true)

    try {
      let dailyRoomName = null

      // Create Daily room for virtual events
      if (eventType === 'virtual') {
        const startDateTime = `${eventDate}T${startTime || '18:00'}:00`
        const res = await fetch('/.netlify/functions/create-daily-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: crypto.randomUUID(),
            eventName: name.trim(),
            startTime: startDateTime,
            durationMinutes: parseInt(duration) || 60,
          })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        dailyRoomName = data.roomName
      }

      const { error: insertError } = await supabase.from('events').insert({
        creator_id: creatorId,
        name: name.trim(),
        description: description.trim(),
        venue: venue.trim(),
        event_date: eventDate,
        event_type: eventType,
        stream_url: streamUrl.trim() || null,
        capacity: capacity ? parseInt(capacity) : null,
        is_free: isFree,
        daily_room_name: dailyRoomName,
        duration_minutes: parseInt(duration) || 60,
        start_time: startTime || '18:00',
      })

      if (insertError) throw new Error(insertError.message)

      onEventCreated?.()
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: '#0e0e0e', border: '1px solid #ffffff12', borderRadius: 14, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>New Event</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Event type */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[{ id: 'virtual', label: '💻 Virtual' }, { id: 'in_person', label: '📍 In Person' }].map(t => (
            <button key={t.id} onClick={() => setEventType(t.id)} style={{
              flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
              background: eventType === t.id ? accentColor + '18' : 'none',
              border: eventType === t.id ? `1px solid ${accentColor}66` : '1px solid #ffffff15',
              color: eventType === t.id ? accentColor : '#555',
              fontFamily: "'DM Mono', monospace", fontSize: 11,
              letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>{t.label}</button>
          ))}
        </div>

        <input style={input} placeholder="Event name" value={name} onChange={e => setName(e.target.value)} />
        <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
        <input style={input} placeholder={eventType === 'virtual' ? 'Platform (e.g. StagePass Live, Zoom)' : 'Venue name and address'} value={venue} onChange={e => setVenue(e.target.value)} />
        <input style={input} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />

        {eventType === 'virtual' && (
          <>
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
          </>
        )}

        {eventType === 'virtual' && (
          <input style={input} placeholder="Stream URL (optional — add later)" value={streamUrl} onChange={e => setStreamUrl(e.target.value)} />
        )}

        <input style={input} placeholder="Capacity (optional — leave blank for unlimited)" value={capacity} onChange={e => setCapacity(e.target.value)} type="number" />

        {/* Free toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #ffffff10', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: '#e8e2d6' }}>Free for subscribers</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 2 }}>
              {isFree ? 'Subscribers can RSVP for free' : 'Requires separate ticket purchase'}
            </div>
          </div>
          <div onClick={() => setIsFree(!isFree)} style={{ width: 44, height: 24, borderRadius: 999, cursor: 'pointer', background: isFree ? accentColor : '#2a2a2a', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: isFree ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>

        {error && <div style={{ color: '#e84545', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', background: accentColor, color: '#080808', border: 'none', borderRadius: 8, padding: '14px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </div>
    </div>
  )
}