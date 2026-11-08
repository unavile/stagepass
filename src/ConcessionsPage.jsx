import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// In-venue concessions  ·  covetedstage.com/<event-slug>/concessions
// Menu is edited in Supabase → Table Editor → concession_items (no code).
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Snacks', 'Beverages']
const CATEGORY_ICON = { Snacks: '🍿', Beverages: '🥤' }
const MAX_QTY = 20
const PAYMENT_METHODS = [
  { id: 'card',  label: 'Credit Card', icon: '💳', note: 'Pay now, securely via Stripe' },
  { id: 'cash',  label: 'Cash',        icon: '💵', note: 'Pay at the stand' },
  { id: 'check', label: 'Check',       icon: '🧾', note: 'Pay at the stand' },
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

const money = n => `$${(parseFloat(n) || 0).toFixed(2)}`

function CenterMessage({ icon, title, body, link }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#faf8f4',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", gap: 16, padding: 24, textAlign: 'center',
    }}>
      {icon && <div style={{ fontSize: 48 }}>{icon}</div>}
      {title && <div style={{ color: '#111', fontSize: 20, fontWeight: 700 }}>{title}</div>}
      {body && <div style={{ color: '#777', fontSize: 13, maxWidth: 340, lineHeight: 1.6 }}>{body}</div>}
      {link}
    </div>
  )
}

function Stepper({ q, onChange, accent }) {
  const btn = (disabled) => ({
    width: 36, height: 34, background: '#fff', border: 'none',
    color: disabled ? '#ccc' : '#333', fontSize: 16,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: 8, overflow: 'hidden', width: 120, background: '#fff' }}>
      <button aria-label="Remove one" onClick={() => onChange(q - 1)} disabled={q <= 0}
        style={{ ...btn(q <= 0), borderRight: '1.5px solid #ddd' }}>−</button>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: q > 0 ? accent : '#bbb' }}>{q}</div>
      <button aria-label="Add one" onClick={() => onChange(q + 1)} disabled={q >= MAX_QTY}
        style={{ ...btn(q >= MAX_QTY), borderLeft: '1.5px solid #ddd' }}>+</button>
    </div>
  )
}

export default function ConcessionsPage({ eventSlug }) {
  const [event, setEvent] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)

  const [activeCat, setActiveCat] = useState('Snacks')
  const [quantities, setQuantities] = useState({})
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')

  const [paymentMethod, setPaymentMethod] = useState('card')
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')

  const [order, setOrder] = useState(null)
  const [orderError, setOrderError] = useState('')

  const sbUrl = import.meta.env.VITE_SUPABASE_URL
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const params    = new URLSearchParams(window.location.search)
  const purchased = params.get('purchased') === '1'
  const sessionId = params.get('session_id')
  const orderId   = params.get('order')
  const orderRef  = sessionId || orderId

  // ── Load event + menu ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const evRes = await fetch(
          `${sbUrl}/rest/v1/events?slug=eq.${encodeURIComponent(eventSlug)}&select=*`,
          { headers: { 'apikey': sbKey } }
        )
        const evData = await evRes.json()
        if (!Array.isArray(evData) || evData.length === 0) {
          setNotFound(true); setLoading(false); return
        }
        setEvent(evData[0])

        const itRes = await fetch(
          `${sbUrl}/rest/v1/concession_items?event_slug=eq.${encodeURIComponent(eventSlug)}` +
          `&is_available=eq.true&order=sort_order.asc,name.asc&select=*`,
          { headers: { 'apikey': sbKey } }
        )
        const itData = await itRes.json()
        const list = Array.isArray(itData) ? itData : []
        setItems(list)
        if (!list.some(i => i.category === 'Snacks') && list.some(i => i.category === 'Beverages')) {
          setActiveCat('Beverages')
        }
      } catch (err) {
        console.error('Concessions load error:', err)
        setLoadError(true)
      }
      setLoading(false)
    }
    load()
  }, [eventSlug])

  // ── Load the confirmed order after returning from Stripe ─────────────────
  useEffect(() => {
    if (!purchased || !orderRef) return
    const ref = sessionId
      ? `session_id=${encodeURIComponent(sessionId)}`
      : `order=${encodeURIComponent(orderId)}`
    fetch(`/.netlify/functions/get-concession-order?${ref}&event=${encodeURIComponent(eventSlug)}`)
      .then(r => r.json())
      .then(d => { if (d.orderNumber) setOrder(d); else setOrderError(d.error || 'Could not load your order.') })
      .catch(() => setOrderError('Could not load your order.'))
  }, [purchased, orderRef, eventSlug])

  function setQty(id, val) {
    setQuantities(prev => ({ ...prev, [id]: Math.min(MAX_QTY, Math.max(0, val)) }))
  }

  const cart = items
    .filter(i => (quantities[i.id] || 0) > 0)
    .map(i => ({ ...i, quantity: quantities[i.id] }))
  const totalQty   = cart.reduce((s, i) => s + i.quantity, 0)
  const totalPrice = cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0)
  const hasSelection = totalQty > 0

  const isOffline = paymentMethod !== 'card'
  const detailsValid = !isOffline || (buyerName.trim() && EMAIL_RE.test(buyerEmail.trim()))

  async function handleBuy() {
    if (buying || !hasSelection) return
    setBuyError('')
    if (isOffline) {
      if (!buyerName.trim()) { setBuyError('Please enter your name.'); return }
      if (!EMAIL_RE.test(buyerEmail.trim())) { setBuyError('Please enter a valid email address.'); return }
    }
    setBuying(true)
    const orderItems = cart.map(i => ({ id: i.id, quantity: i.quantity }))
    try {
      if (isOffline) {
        // Cash / check → save the order, then show the confirmation
        const res = await fetch('/.netlify/functions/create-concessions-offline-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventSlug, items: orderItems, paymentMethod,
            buyerName: buyerName.trim(), buyerEmail: buyerEmail.trim(), buyerPhone: buyerPhone.trim(),
          }),
        })
        const data = await res.json()
        if (data.orderId) {
          window.location.href = `/${eventSlug}/concessions?purchased=1&order=${encodeURIComponent(data.orderId)}`
          return
        }
        setBuyError(data.error || 'Something went wrong. Please try again.')
      } else {
        // Card → Stripe Checkout
        const res = await fetch('/.netlify/functions/create-concessions-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventSlug, items: orderItems }),
        })
        const data = await res.json()
        if (data.url) { window.location.href = data.url; return }
        setBuyError(data.error || 'Something went wrong. Please try again.')
      }
    } catch (_) {
      setBuyError('Something went wrong. Please try again.')
    }
    setBuying(false)
  }

  // ── States ───────────────────────────────────────────────────────────────
  if (loading) {
    return <CenterMessage title={<span style={{ color: '#aaa', fontWeight: 400, fontSize: 13, letterSpacing: '0.2em' }}>Loading…</span>} />
  }
  const backHome = (
    <a href="https://covetedstage.com" style={{ color: '#7c5cbf', fontSize: 12, letterSpacing: '0.12em', textDecoration: 'none' }}>
      ← COVETED STAGE
    </a>
  )
  if (notFound) {
    return <CenterMessage icon="🎭" title="Event Not Found" body="This event page doesn't exist or is no longer available." link={backHome} />
  }
  if (loadError) {
    return <CenterMessage icon="⚠️" title="Couldn't load the menu" body="Please check your connection and refresh the page." link={backHome} />
  }

  const accent = event.accent_color || '#7c5cbf'
  const accentBg = accent + '18'
  const accentBorder = accent + '55'
  const dateDisplay = formatEventDate(event.event_date, event.start_time)
  const catItems = items.filter(i => i.category === activeCat)
  const catCount = cat => cart.filter(i => i.category === cat).reduce((s, i) => s + i.quantity, 0)

  // ── Page ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#faf8f4', fontFamily: "'DM Mono', monospace", color: '#111', paddingBottom: hasSelection ? 72 : 0 }}>

      {/* Top nav */}
      <div style={{
        background: '#fff', borderBottom: '1.5px solid #ede8df',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <a href="https://covetedstage.com" style={{
          textDecoration: 'none', fontSize: 13, fontWeight: 700, color: '#111',
          letterSpacing: '0.18em', textTransform: 'uppercase', flexShrink: 0,
        }}>
          Coveted Stage
        </a>
        <div style={{
          fontFamily: 'Georgia, serif', fontSize: 15, color: '#333', fontStyle: 'italic',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'right',
        }}>
          {event.name} —{' '}
          <span style={{ color: accent, fontStyle: 'normal', fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.1em' }}>
            Concessions
          </span>
        </div>
      </div>

      {/* Success banner */}
      {purchased && (
        <div style={{
          background: '#e8f7ee', borderBottom: '1.5px solid #b2dfc5',
          padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 24,
          color: '#1a7a44', fontSize: 14, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              {orderId ? 'Order placed!' : 'Order confirmed!'}
            </div>
            <div style={{ fontSize: 13, color: '#3a9a64', fontFamily: 'Georgia, serif', lineHeight: 1.6 }}>
              Show your order number or QR code at the concessions stand to collect your items.
              {order?.email ? <> A confirmation has been sent to <strong>{order.email}</strong>.</> : ' A confirmation has been sent to your email.'}
            </div>

            {order && order.paymentMethod !== 'card' && order.status === 'awaiting_payment' && (
              <div style={{
                marginTop: 12, maxWidth: 380, background: '#fff6e5', border: '1.5px solid #f0c674',
                borderRadius: 10, padding: '10px 14px', color: '#8a5a00', fontSize: 13, lineHeight: 1.5,
              }}>
                <strong>{order.paymentMethod === 'check' ? '🧾 Pay by check' : '💵 Pay in cash'}:</strong>{' '}
                please pay <strong>{money(order.total)}</strong> at the concessions stand when you collect your order.
              </div>
            )}

            {order && (
              <>
                <div style={{ marginTop: 14, fontSize: 10, letterSpacing: '0.18em', color: '#5aaa7a' }}>ORDER NUMBER</div>
                <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.12em', color: '#1a7a44' }}>{order.orderNumber}</div>

                <div style={{ marginTop: 12, maxWidth: 380, background: '#fff', border: '1.5px solid #b2dfc5', borderRadius: 10, padding: '10px 14px' }}>
                  {CATEGORIES.map(cat => {
                    const rows = order.items.filter(i => i.category === cat)
                    if (!rows.length) return null
                    return (
                      <div key={cat} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#5aaa7a', margin: '4px 0' }}>{cat.toUpperCase()}</div>
                        {rows.map((r, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#333', marginBottom: 3 }}>
                            <span>{r.quantity} × {r.name}</span>
                            <span>{money(r.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #b2dfc5', paddingTop: 6, marginTop: 4, fontWeight: 700 }}>
                    <span style={{ fontSize: 11, letterSpacing: '0.12em' }}>
                      {order.paymentMethod === 'card' ? 'TOTAL PAID' : `TOTAL DUE (${order.paymentMethod.toUpperCase()})`}
                    </span>
                    <span>{money(order.total)}</span>
                  </div>
                </div>
              </>
            )}
            {!order && !orderError && orderRef && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#5aaa7a' }}>Loading your order…</div>
            )}
            {orderError && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#c0392b' }}>
                {orderError} Your receipt email has the full order details.
              </div>
            )}
          </div>

          {(sessionId || order?.orderNumber) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: '#fff', padding: 8, borderRadius: 10, border: '2px solid #b2dfc5' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(sessionId || order.orderNumber)}&bgcolor=ffffff&color=111111&margin=4`}
                  alt="Order QR code" width={160} height={160} style={{ display: 'block' }}
                />
              </div>
              <div style={{ fontSize: 10, color: '#5aaa7a', marginTop: 6, letterSpacing: '0.1em' }}>SHOW AT THE STAND</div>
            </div>
          )}
        </div>
      )}

      {/* Event header */}
      <div style={{ background: '#fff', borderBottom: '1.5px solid #ede8df', padding: '14px 24px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: accent, letterSpacing: '0.2em', marginBottom: 6 }}>IN-VENUE CONCESSIONS</div>
        <h1 style={{
          margin: '0 0 10px', fontFamily: 'Georgia, serif',
          fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, lineHeight: 1.15,
        }}>
          {event.name}
        </h1>
        {(dateDisplay || event.venue) && (
          <div style={{ color: '#555', fontSize: 15, fontFamily: 'Georgia, serif', display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {dateDisplay && <span>📅 {dateDisplay}</span>}
            {event.venue && <span>📍 {event.venue}</span>}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center', padding: '0 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍿</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Concessions aren't open yet</div>
          <div style={{ color: '#888', fontSize: 13, fontFamily: 'Georgia, serif' }}>Check back closer to the event.</div>
        </div>
      ) : (
        <div className="cx-grid" style={{
          maxWidth: 1100, margin: '0 auto', padding: '20px 20px 32px',
          display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start',
        }}>

          {/* Menu */}
          <div>
            <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {CATEGORIES.map(cat => {
                const active = cat === activeCat
                const count = catCount(cat)
                const n = items.filter(i => i.category === cat).length
                return (
                  <button key={cat} role="tab" aria-selected={active} onClick={() => setActiveCat(cat)}
                    style={{
                      flex: 1, padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1.5px solid ${active ? accent : '#e0dbd2'}`,
                      background: active ? accent : '#fff',
                      color: active ? '#fff' : '#333',
                      fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    <span>{CATEGORY_ICON[cat]} {cat.toUpperCase()}</span>
                    <span style={{ fontWeight: 400, opacity: 0.75, fontSize: 11 }}>({n})</span>
                    {count > 0 && (
                      <span style={{
                        background: active ? '#fff' : accent, color: active ? accent : '#fff',
                        borderRadius: 999, minWidth: 20, height: 20, fontSize: 11,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                      }}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {catItems.length === 0 ? (
              <div style={{ color: '#aaa', fontFamily: 'Georgia, serif', fontStyle: 'italic', padding: '24px 0', textAlign: 'center' }}>
                No {activeCat.toLowerCase()} on the menu right now.
              </div>
            ) : (
              <div className="cx-items" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {catItems.map(it => {
                  const q = quantities[it.id] || 0
                  return (
                    <div key={it.id} style={{
                      border: `1.5px solid ${q > 0 ? accent : '#e0dbd2'}`, borderRadius: 12,
                      background: q > 0 ? accentBg : '#fff', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column', transition: 'all 0.15s',
                    }}>
                      {it.image_url && (
                        <img src={it.image_url} alt={it.name} loading="lazy"
                          onError={e => { e.currentTarget.style.display = 'none' }}
                          style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                      )}
                      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: q > 0 ? 700 : 400, color: q > 0 ? accent : '#222' }}>
                            {it.name}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: q > 0 ? accent : '#444', flexShrink: 0 }}>
                            {money(it.price)}
                          </div>
                        </div>
                        {it.description && (
                          <div style={{ color: '#888', fontSize: 12, fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.5 }}>
                            {it.description}
                          </div>
                        )}
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Stepper q={q} accent={accent} onChange={v => setQty(it.id, v)} />
                          {q > 0 && <span style={{ fontSize: 11, color: accent }}>{money(parseFloat(it.price) * q)}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Order card */}
          <div id="cx-order" className="cx-order" style={{
            background: '#fff', border: '1.5px solid #ede8df', borderRadius: 18, padding: 16,
            display: 'flex', flexDirection: 'column', gap: 10,
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)', position: 'sticky', top: 16,
          }}>
            <div style={{ fontSize: 11, color: accent, letterSpacing: '0.18em' }}>YOUR ORDER</div>

            {!hasSelection ? (
              <div style={{ color: '#aaa', fontSize: 12, fontFamily: 'Georgia, serif', fontStyle: 'italic', padding: '8px 0' }}>
                Add snacks or beverages from the menu.
              </div>
            ) : (
              <div style={{ background: accentBg, border: `1.5px solid ${accentBorder}`, borderRadius: 10, padding: '10px 12px' }}>
                {CATEGORIES.map(cat => {
                  const rows = cart.filter(i => i.category === cat)
                  if (!rows.length) return null
                  return (
                    <div key={cat} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 10, color: accent, letterSpacing: '0.15em', margin: '2px 0 4px' }}>{cat.toUpperCase()}</div>
                      {rows.map(r => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: '#555', marginBottom: 3 }}>
                          <span>{r.name} × {r.quantity}</span>
                          <span>{money(parseFloat(r.price) * r.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderTop: `1px solid ${accentBorder}`, marginTop: 6, paddingTop: 6,
                }}>
                  <div style={{ color: '#666', fontSize: 11, letterSpacing: '0.12em' }}>TOTAL</div>
                  <div style={{ color: accent, fontSize: 20, fontWeight: 700 }}>{money(totalPrice)}</div>
                </div>
              </div>
            )}

            {/* Payment method */}
            <div>
              <div style={{ fontSize: 10, color: accent, letterSpacing: '0.15em', marginBottom: 6 }}>PAYMENT METHOD</div>
              <div role="radiogroup" aria-label="Payment method" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PAYMENT_METHODS.map(pm => {
                  const on = paymentMethod === pm.id
                  return (
                    <label key={pm.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      border: `1.5px solid ${on ? accent : '#e0dbd2'}`, borderRadius: 10,
                      background: on ? accentBg : '#faf8f4', padding: '9px 12px', transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="payment-method" value={pm.id} checked={on}
                        onChange={() => { setPaymentMethod(pm.id); setBuyError('') }}
                        style={{ accentColor: accent, margin: 0 }} />
                      <span style={{ fontSize: 16 }}>{pm.icon}</span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: on ? accent : '#222' }}>{pm.label}</span>
                        <span style={{ fontSize: 10, color: '#888', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{pm.note}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Buyer details (cash / check only — Stripe collects them for card) */}
            {isOffline && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: accent, letterSpacing: '0.15em' }}>YOUR DETAILS</div>
                {[
                  { v: buyerName,  set: setBuyerName,  ph: 'Full name *',        type: 'text',  ac: 'name' },
                  { v: buyerEmail, set: setBuyerEmail, ph: 'Email *',            type: 'email', ac: 'email' },
                  { v: buyerPhone, set: setBuyerPhone, ph: 'Phone (optional)',   type: 'tel',   ac: 'tel' },
                ].map(f => (
                  <input key={f.ph} type={f.type} value={f.v} placeholder={f.ph} autoComplete={f.ac}
                    aria-label={f.ph.replace(' *', '')}
                    onChange={e => f.set(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '9px 11px',
                      border: '1.5px solid #e0dbd2', borderRadius: 8, background: '#fff',
                      fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#111', outline: 'none',
                    }} />
                ))}
                <div style={{ fontSize: 10, color: '#999', fontFamily: 'Georgia, serif', fontStyle: 'italic', lineHeight: 1.4 }}>
                  We'll email your order number and itemized total.
                </div>
              </div>
            )}

            <button onClick={handleBuy} disabled={buying || !hasSelection || !detailsValid} style={{
              width: '100%', padding: '11px 0', border: 'none', borderRadius: 10,
              background: (buying || !hasSelection || !detailsValid) ? '#ddd' : accent,
              color: (buying || !hasSelection || !detailsValid) ? '#aaa' : '#fff',
              fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em',
              cursor: (buying || !hasSelection || !detailsValid) ? 'not-allowed' : 'pointer',
              boxShadow: (buying || !hasSelection || !detailsValid) ? 'none' : `0 4px 20px ${accent}44`,
            }}>
              {buying
                ? (isOffline ? 'PLACING ORDER...' : 'REDIRECTING...')
                : !hasSelection
                  ? 'SELECT ITEMS ABOVE'
                  : isOffline
                    ? `PLACE ORDER · PAY ${money(totalPrice)} AT STAND`
                    : `PAY ${money(totalPrice)} BY CARD →`}
            </button>

            {buyError && <div style={{ color: '#c0392b', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>{buyError}</div>}

            <div style={{ color: '#bbb', fontSize: 10, textAlign: 'center', lineHeight: 1.4, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
              {isOffline
                ? <>Pay by {paymentMethod} when you collect your order<br />at the concessions stand.</>
                : <>Secure checkout via Stripe. No account required.<br />Collect your order at the concessions stand.</>}
            </div>
          </div>
        </div>
      )}

      {/* Mobile order bar */}
      {hasSelection && (
        <a href="#cx-order" className="cx-bar" style={{
          position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 50,
          display: 'none', alignItems: 'center', justifyContent: 'space-between',
          background: accent, color: '#fff', borderRadius: 12, padding: '14px 18px',
          textDecoration: 'none', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
          boxShadow: `0 6px 24px ${accent}66`,
        }}>
          <span>{totalQty} ITEM{totalQty !== 1 ? 'S' : ''} · {money(totalPrice)}</span>
          <span>REVIEW ORDER ↓</span>
        </a>
      )}

      {/* Footer */}
      <div style={{
        borderTop: '1.5px solid #ede8df', padding: '22px 24px', textAlign: 'center',
        color: '#bbb', fontSize: 11, letterSpacing: '0.16em',
      }}>
        COVETED STAGE · THE STAGE IS YOURS ·{' '}
        <a href="https://covetedstage.com" style={{ color: '#aaa', textDecoration: 'none' }}>covetedstage.com</a>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .cx-grid { grid-template-columns: 1fr !important; padding: 16px 16px 24px !important; }
          .cx-order { position: static !important; }
          .cx-bar { display: flex !important; }
        }
        @media (max-width: 480px) {
          .cx-items { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
