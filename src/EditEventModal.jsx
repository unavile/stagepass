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
  const [eventMode, setEventMode] = useState(event.event_mode || 'broadcast')
  const [alwaysOn, setAlwaysOn] = useState(event.always_on || false)
  const [tier4Price, setTier4Price] = useState(event.tier_4_price || '')
  const [tier8Price, setTier8Price] = useState(event.tier_8_price || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ac = accentColor || '#c9a84c'
  const isVirtual = event.event_type === 'virtual'

  const input = {
    width: '100%', background: '#252530', border: '1px solid #ffffff28',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
    colorScheme: 'dark',
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
          ...(isVirtual ? { event_mode: eventMode, always_on: alwaysOn } : {}),
          ...(alwaysOn ? { event_date: '2099-12-31', start_time: null } : {}),
          ...(alwaysOn ? {
            tier_4_price: tier4Price ? parseFloat(tier4Price) : null,
            tier_8_price: tier8Price ? parseFloat(tier8Price) : null,
          } : {}),
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
        background: '#161618', border: '1px solid #ffffff18',
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

        {/* Streaming mode — virtual only */}
        {isVirtual && (
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

        {/* Always On toggle — Class mode only */}
        {isVirtual && eventMode === 'class' && (
          <div
            onClick={() => setAlwaysOn(a => !a)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: alwaysOn ? ac + '12' : '#111',
              border: alwaysOn ? `1px solid ${ac}55` : '1px solid #ffffff10',
              borderRadius: 9, padding: '12px 14px', cursor: 'pointer',
              marginBottom: 16, transition: 'all 0.15s',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: alwaysOn ? '#f0ebe0' : '#888', fontWeight: alwaysOn ? 500 : 400 }}>
                🔁 Always On
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#444', marginTop: 3, lineHeight: 1.5 }}>
                No fixed date or time — fans can join any time
              </div>
            </div>
            <div style={{
              width: 36, height: 20, borderRadius: 999, flexShrink: 0,
              background: alwaysOn ? ac : '#2a2a2a',
              position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 2,
                left: alwaysOn ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
          </div>
        )}

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

        {/* Date — hidden for always-on events */}
        {!alwaysOn && (
          <>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>SELECT DATE</div>
            <input style={input} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </>
        )}

        {/* Time + duration — virtual only, hidden for always-on */}
        {isVirtual && !alwaysOn && (
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

        {/* For always-on class events: show tier pricing instead of access type */}
        {alwaysOn ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 10 }}>
              REGISTRATION TIERS
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#444', marginBottom: 12, lineHeight: 1.6 }}>
              Students register for a monthly class package. Set the price per tier.
            </div>
            {[
              { tier: 4, label: '4 Classes / Month', price: tier4Price, setPrice: setTier4Price },
              { tier: 8, label: '8 Classes / Month', price: tier8Price, setPrice: setTier8Price },
            ].map(t => (
              <div key={t.tier} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #ffffff10', borderRadius: 9, padding: '12px 14px', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#f0ebe0' }}>{t.label}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#444', marginTop: 2 }}>Monthly recurring subscription</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#555', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>$</span>
                  <input
                    style={{ ...input, width: 80, marginBottom: 0 }}
                    type="number" min="1" step="0.01" placeholder="0.00"
                    value={t.price}
                    onChange={e => t.setPrice(e.target.value)}
                  />
                  <span style={{ color: '#555', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>/mo</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <>
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
        </>
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
