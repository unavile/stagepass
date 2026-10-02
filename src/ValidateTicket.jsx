import { useState, useEffect, useRef } from 'react'

const STAFF_PASSWORD = import.meta.env.VITE_VALIDATE_PASSWORD || 'covetedstage'

export default function ValidateTicket({ eventSlug }) {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [scanning, setScanning] = useState(false)
  const [manualId, setManualId] = useState('')
  const [result, setResult] = useState(null)   // { valid, ... }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const scannerRef = useRef(null)   // Html5Qrcode instance

  // Fetch event to get event_id for cross-checking
  const [eventId, setEventId] = useState(null)
  const sbUrl = import.meta.env.VITE_SUPABASE_URL
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(
          `${sbUrl}/rest/v1/events?slug=eq.${encodeURIComponent(eventSlug)}&select=id,name`,
          { headers: { 'apikey': sbKey } }
        )
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) setEventId(data[0].id)
      } catch (_) {}
    }
    if (authed) fetchEvent()
  }, [authed, eventSlug])

  // Clean up scanner on unmount
  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  // ── Camera scanning (html5-qrcode — works on Safari iOS + Chrome Android) ────

  async function startScanner() {
    setResult(null)
    setError('')
    setScanning(true)

    // Dynamically import html5-qrcode to avoid bundling it eagerly
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const qr = new Html5Qrcode('qr-reader')
      scannerRef.current = qr

      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          stopScanner()
          validateSession(decodedText)
        },
        () => { /* ignore scan errors — called on every undetected frame */ }
      )
    } catch (err) {
      setScanning(false)
      if (err?.message?.includes('Permission')) {
        setError('Camera access denied. Use manual entry below.')
      } else {
        setError('Could not start camera. Use manual entry below.')
      }
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (_) {}
      scannerRef.current = null
    }
    setScanning(false)
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  async function validateSession(sessionId) {
    if (!sessionId?.trim()) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/.netlify/functions/validate-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.trim(), eventId }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError('Network error. Please try again.')
    }
    setLoading(false)
    setManualId('')
  }

  function reset() {
    setResult(null)
    setError('')
    setManualId('')
  }

  // ── Password gate ────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f0f',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', monospace", padding: 24, gap: 16,
      }}>
        <div style={{ fontSize: 32 }}>🎭</div>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em' }}>
          COVETED STAGE
        </div>
        <div style={{ color: '#888', fontSize: 12, letterSpacing: '0.15em', marginBottom: 8 }}>
          STAFF TICKET VALIDATION
        </div>
        <input
          type="password"
          placeholder="Staff password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (password === STAFF_PASSWORD) { setAuthed(true) }
              else { setPasswordError('Incorrect password') }
            }
          }}
          style={{
            background: '#1a1a1a', border: '1.5px solid #333', borderRadius: 10,
            color: '#fff', fontSize: 15, padding: '12px 16px', width: 260,
            fontFamily: "'DM Mono', monospace", outline: 'none',
          }}
          autoFocus
        />
        {passwordError && (
          <div style={{ color: '#e74c3c', fontSize: 12 }}>{passwordError}</div>
        )}
        <button
          onClick={() => {
            if (password === STAFF_PASSWORD) { setAuthed(true) }
            else { setPasswordError('Incorrect password') }
          }}
          style={{
            background: '#7c5cbf', color: '#fff', border: 'none', borderRadius: 10,
            padding: '12px 32px', fontFamily: "'DM Mono', monospace",
            fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer',
          }}
        >
          ENTER →
        </button>
      </div>
    )
  }

  // ── Main validation UI ───────────────────────────────────────────────────────

  const resultBg = result?.valid ? '#0d2e1a' : '#2e0d0d'
  const resultBorder = result?.valid ? '#2a7a44' : '#7a2a2a'
  const resultColor = result?.valid ? '#4ade80' : '#f87171'

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'DM Mono', monospace", padding: '24px 16px', gap: 16,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ color: '#888', fontSize: 11, letterSpacing: '0.2em', marginBottom: 4 }}>
          COVETED STAGE · STAFF
        </div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
          Ticket Validation
        </div>
        {eventSlug && (
          <div style={{ color: '#666', fontSize: 12, marginTop: 4, letterSpacing: '0.08em' }}>
            /{eventSlug}
          </div>
        )}
      </div>

      {/* Result display */}
      {result && (
        <div style={{
          background: resultBg, border: `2px solid ${resultBorder}`,
          borderRadius: 16, padding: '20px 24px', width: '100%', maxWidth: 400,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>
            {result.valid ? '✅' : '❌'}
          </div>
          <div style={{ color: resultColor, fontSize: 20, fontWeight: 700, marginBottom: 12, letterSpacing: '0.05em' }}>
            {result.valid ? 'VALID TICKET' : 'INVALID TICKET'}
          </div>
          {result.valid ? (
            <div style={{ color: '#ccc', fontSize: 13, lineHeight: 2, textAlign: 'left' }}>
              <div><span style={{ color: '#888' }}>Name:</span> {result.customerName}</div>
              <div><span style={{ color: '#888' }}>Email:</span> {result.customerEmail}</div>
              <div><span style={{ color: '#888' }}>Category:</span> {result.ticketCategory}</div>
              <div><span style={{ color: '#888' }}>Qty:</span> {result.quantity}</div>
              <div><span style={{ color: '#888' }}>Paid:</span> {result.currency} ${result.amountTotal}</div>
              <div><span style={{ color: '#888' }}>Purchased:</span> {result.purchasedAt}</div>
            </div>
          ) : (
            <div style={{ color: '#f87171', fontSize: 13 }}>
              {result.reason || result.error || 'This ticket could not be verified.'}
            </div>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16, background: '#1a1a1a', border: '1.5px solid #333',
              color: '#aaa', borderRadius: 8, padding: '10px 24px',
              fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            SCAN NEXT
          </button>
        </div>
      )}

      {/* Camera scanner — html5-qrcode mounts into #qr-reader div */}
      {!result && (
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* The div below is the mount point for html5-qrcode */}
          <div
            id="qr-reader"
            style={{
              width: '100%',
              display: scanning ? 'block' : 'none',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          />

          {scanning ? (
            <button
              onClick={stopScanner}
              style={{
                marginTop: 12, width: '100%', background: '#1a1a1a',
                border: '1.5px solid #333', color: '#aaa', borderRadius: 10,
                padding: '12px 0', fontFamily: "'DM Mono', monospace",
                fontSize: 12, cursor: 'pointer', letterSpacing: '0.1em',
              }}
            >
              CANCEL
            </button>
          ) : (
            <button
              onClick={startScanner}
              disabled={loading}
              style={{
                width: '100%', padding: '18px 0',
                background: '#7c5cbf', color: '#fff', border: 'none', borderRadius: 14,
                fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
                letterSpacing: '0.12em', cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(124,92,191,0.4)',
              }}
            >
              📷 SCAN QR CODE
            </button>
          )}
        </div>
      )}

      {/* Manual entry */}
      {!result && !scanning && (
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ color: '#555', fontSize: 10, letterSpacing: '0.18em', textAlign: 'center', marginBottom: 10 }}>
            — OR ENTER SESSION ID MANUALLY —
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="cs_live_..."
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && validateSession(manualId)}
              style={{
                flex: 1, background: '#1a1a1a', border: '1.5px solid #333',
                borderRadius: 10, color: '#fff', fontSize: 13,
                padding: '12px 14px', fontFamily: "'DM Mono', monospace", outline: 'none',
              }}
            />
            <button
              onClick={() => validateSession(manualId)}
              disabled={loading || !manualId.trim()}
              style={{
                background: loading || !manualId.trim() ? '#2a2a2a' : '#7c5cbf',
                color: loading || !manualId.trim() ? '#555' : '#fff',
                border: 'none', borderRadius: 10, padding: '12px 18px',
                fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
                cursor: loading || !manualId.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '...' : '→'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: '#f87171', fontSize: 12, textAlign: 'center', maxWidth: 400 }}>
          {error}
        </div>
      )}

      <div style={{ color: '#333', fontSize: 10, letterSpacing: '0.12em', marginTop: 'auto', paddingTop: 24 }}>
        COVETED STAGE STAFF TOOL · NOT FOR PUBLIC USE
      </div>
    </div>
  )
}
