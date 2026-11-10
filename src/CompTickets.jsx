import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Complimentary tickets  ·  covetedstage.com/<event-slug>/comp
// Password is checked on the server (COMP_ISSUE_PASSWORD in Netlify).
// Tickets issued here scan as VALID at /<event-slug>/validate.
// ─────────────────────────────────────────────────────────────────────────────

const PW_KEY = 'cs-comp-password'
const ACCENT = '#7c5cbf'
const qrSrc = (code, size = 200) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(code)}&bgcolor=ffffff&color=111111&margin=8`

function readPw() { try { return sessionStorage.getItem(PW_KEY) || '' } catch (_) { return '' } }
function savePw(v) { try { v ? sessionStorage.setItem(PW_KEY, v) : sessionStorage.removeItem(PW_KEY) } catch (_) {} }

const input = {
  width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1.5px solid #333',
  borderRadius: 10, color: '#fff', fontSize: 14, padding: '11px 14px',
  fontFamily: "'DM Mono', monospace", outline: 'none',
}
const label = { display: 'block', color: '#888', fontSize: 10, letterSpacing: '0.16em', marginBottom: 6 }
const primaryBtn = disabled => ({
  width: '100%', padding: '13px 0', border: 'none', borderRadius: 10,
  background: disabled ? '#2a2a2a' : ACCENT, color: disabled ? '#555' : '#fff',
  fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: '0.12em',
  cursor: disabled ? 'not-allowed' : 'pointer',
})
const ghostBtn = {
  background: 'transparent', border: '1.5px solid #333', color: '#aaa', borderRadius: 8,
  padding: '8px 14px', fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer',
}

export default function CompTickets({ eventSlug }) {
  const [password, setPassword] = useState(readPw())
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [checking, setChecking] = useState(false)

  const [eventName, setEventName] = useState('')
  const [tickets, setTickets] = useState([])

  const [form, setForm] = useState({ guestName: '', guestEmail: '', quantity: 1, category: 'Complimentary', note: '', sendEmail: true })
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState('')
  const [issued, setIssued] = useState(null)   // { ticket, ticketUrl, emailSent }
  const [copied, setCopied] = useState(false)
  const [resendState, setResendState] = useState({})

  async function call(body) {
    const res = await fetch('/.netlify/functions/issue-comp-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, eventSlug, ...body }),
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  }

  async function loadList(showErrors = true) {
    setChecking(true)
    setAuthError('')
    try {
      const { status, data } = await call({ action: 'list' })
      if (status === 200) {
        setAuthed(true)
        savePw(password)
        setEventName(data.event?.name || '')
        setTickets(data.tickets || [])
      } else {
        setAuthed(false)
        savePw('')
        if (showErrors) setAuthError(data.error || 'Could not sign in.')
      }
    } catch (_) {
      if (showErrors) setAuthError('Network error. Please try again.')
    }
    setChecking(false)
  }

  // Re-use the password from this browser tab, if any
  useEffect(() => { if (password) loadList(false) }, [])

  function update(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function issue() {
    if (issuing) return
    setIssueError('')
    if (!form.guestName.trim()) { setIssueError("Enter the guest's name."); return }
    if (form.sendEmail && !form.guestEmail.trim()) { setIssueError('Enter an email address, or untick "Email the ticket".'); return }
    setIssuing(true)
    try {
      const { status, data } = await call({ action: 'issue', ...form })
      if (status === 200) {
        setIssued(data)
        setCopied(false)
        setTickets(t => [data.ticket, ...t])
        setForm(f => ({ ...f, guestName: '', guestEmail: '', quantity: 1, note: '' }))
      } else if (status === 401) {
        setAuthed(false); savePw(''); setAuthError('Your session expired. Enter the password again.')
      } else {
        setIssueError(data.error || 'Could not issue the ticket.')
      }
    } catch (_) {
      setIssueError('Network error. Please try again.')
    }
    setIssuing(false)
  }

  async function resend(id) {
    setResendState(s => ({ ...s, [id]: 'sending' }))
    const { status } = await call({ action: 'resend', id }).catch(() => ({ status: 0 }))
    setResendState(s => ({ ...s, [id]: status === 200 ? 'sent' : 'failed' }))
    if (status === 200) setTickets(t => t.map(x => x.id === id ? { ...x, email_sent: true } : x))
  }

  async function copyLink(url) {
    try { await navigator.clipboard.writeText(url); setCopied(true) } catch (_) {}
  }

  const page = {
    minHeight: '100vh', background: '#0f0f0f', fontFamily: "'DM Mono', monospace",
    color: '#fff', padding: '24px 16px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  }

  // ── Password gate ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ ...page, justifyContent: 'center' }}>
        <div style={{ fontSize: 32 }}>🎟</div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.1em' }}>COVETED STAGE</div>
        <div style={{ color: '#888', fontSize: 12, letterSpacing: '0.15em', marginBottom: 8 }}>COMPLIMENTARY TICKETS</div>
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="password" placeholder="Password" value={password} autoFocus
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && password && loadList()}
            style={input} aria-label="Password" />
          {authError && <div style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>{authError}</div>}
          <button onClick={() => loadList()} disabled={!password || checking} style={primaryBtn(!password || checking)}>
            {checking ? 'CHECKING…' : 'ENTER →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#888', fontSize: 11, letterSpacing: '0.2em', marginBottom: 4 }}>COVETED STAGE · STAFF</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Complimentary Tickets</div>
        <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>{eventName || `/${eventSlug}`}</div>
      </div>

      {/* Just issued */}
      {issued && (
        <div style={{
          width: '100%', maxWidth: 440, background: '#0d2e1a', border: '2px solid #2a7a44',
          borderRadius: 16, padding: 20, textAlign: 'center',
        }}>
          <div style={{ color: '#4ade80', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✅ TICKET ISSUED</div>
          <div style={{ color: '#ccc', fontSize: 13, marginBottom: 12 }}>
            {issued.ticket.guest_name} · {issued.ticket.ticket_category} × {issued.ticket.quantity}
          </div>
          <div style={{ display: 'inline-block', background: '#fff', padding: 8, borderRadius: 10 }}>
            <img src={qrSrc(issued.ticket.code)} alt="Ticket QR code" width={200} height={200} style={{ display: 'block' }} />
          </div>
          <div style={{ color: issued.emailSent ? '#4ade80' : '#fbbf24', fontSize: 12, margin: '12px 0' }}>
            {issued.emailSent
              ? `Emailed to ${issued.ticket.guest_email}`
              : issued.ticket.guest_email ? 'Email could not be sent. Share the link below instead.' : 'Not emailed. Share the link below.'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={ghostBtn} onClick={() => copyLink(issued.ticketUrl)}>{copied ? '✓ LINK COPIED' : '🔗 COPY TICKET LINK'}</button>
            <a style={{ ...ghostBtn, textDecoration: 'none' }} href={issued.ticketUrl} target="_blank" rel="noreferrer">OPEN TICKET ↗</a>
            <button style={ghostBtn} onClick={() => setIssued(null)}>ISSUE ANOTHER</button>
          </div>
        </div>
      )}

      {/* Issue form */}
      {!issued && (
        <div style={{ width: '100%', maxWidth: 440, background: '#161616', border: '1.5px solid #2a2a2a', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label} htmlFor="ct-name">GUEST NAME *</label>
            <input id="ct-name" style={input} value={form.guestName} onChange={e => update('guestName', e.target.value)} />
          </div>
          <div>
            <label style={label} htmlFor="ct-email">EMAIL{form.sendEmail ? ' *' : ''}</label>
            <input id="ct-email" type="email" style={input} value={form.guestEmail} onChange={e => update('guestEmail', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 110 }}>
              <label style={label} htmlFor="ct-qty">TICKETS</label>
              <input id="ct-qty" type="number" min={1} max={20} style={input} value={form.quantity}
                onChange={e => update('quantity', Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label} htmlFor="ct-cat">TICKET TYPE</label>
              <input id="ct-cat" style={input} value={form.category} onChange={e => update('category', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={label} htmlFor="ct-note">INTERNAL NOTE (OPTIONAL)</label>
            <input id="ct-note" style={input} placeholder="e.g. Sponsor, Press, Artist guest" value={form.note} onChange={e => update('note', e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.sendEmail} onChange={e => update('sendEmail', e.target.checked)} style={{ accentColor: ACCENT }} />
            Email the ticket to the guest
          </label>
          {issueError && <div style={{ color: '#f87171', fontSize: 12 }}>{issueError}</div>}
          <button onClick={issue} disabled={issuing} style={primaryBtn(issuing)}>
            {issuing ? 'ISSUING…' : `ISSUE ${form.quantity > 1 ? form.quantity + ' TICKETS' : 'TICKET'} →`}
          </button>
        </div>
      )}

      {/* Issued list */}
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0 10px' }}>
          <div style={{ color: '#888', fontSize: 10, letterSpacing: '0.16em' }}>ISSUED ({tickets.length} · {tickets.filter(t => !t.revoked).reduce((s, t) => s + t.quantity, 0)} TICKETS)</div>
          <button style={{ ...ghostBtn, padding: '4px 10px' }} onClick={() => loadList()}>REFRESH</button>
        </div>
        {tickets.length === 0 ? (
          <div style={{ color: '#555', fontSize: 12, textAlign: 'center', padding: 16 }}>No complimentary tickets yet.</div>
        ) : tickets.map(t => {
          const url = `/${eventSlug}/ticket?session_id=${encodeURIComponent(t.code)}`
          const rs = resendState[t.id]
          return (
            <div key={t.id} style={{
              background: '#161616', border: '1.5px solid #2a2a2a', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
              opacity: t.revoked ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {t.guest_name}{t.revoked && <span style={{ color: '#f87171', fontSize: 11, fontWeight: 400 }}> · REVOKED</span>}
                </div>
                <div style={{ color: '#aaa', fontSize: 12, flexShrink: 0 }}>× {t.quantity}</div>
              </div>
              <div style={{ color: '#777', fontSize: 11, marginTop: 3, lineHeight: 1.6 }}>
                {t.ticket_category}{t.note ? ` · ${t.note}` : ''}<br />
                {t.guest_email || 'No email'}{t.guest_email ? (t.email_sent ? ' · emailed' : ' · not emailed') : ''}
                {' · '}{new Date(t.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
              {!t.revoked && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <a style={{ ...ghostBtn, padding: '5px 10px', textDecoration: 'none' }} href={url} target="_blank" rel="noreferrer">VIEW QR ↗</a>
                  {t.guest_email && (
                    <button style={{ ...ghostBtn, padding: '5px 10px' }} disabled={rs === 'sending'} onClick={() => resend(t.id)}>
                      {rs === 'sending' ? 'SENDING…' : rs === 'sent' ? '✓ SENT' : rs === 'failed' ? 'FAILED · RETRY' : 'RESEND EMAIL'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <a href={`/${eventSlug}/validate`} style={{ color: '#666', fontSize: 11, letterSpacing: '0.1em', textDecoration: 'none' }}>VALIDATE PAGE →</a>
        <button style={{ ...ghostBtn, border: 'none', padding: 0, color: '#666' }} onClick={() => { savePw(''); setPassword(''); setAuthed(false) }}>SIGN OUT</button>
      </div>
    </div>
  )
}
