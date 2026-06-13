import { useState, useEffect } from 'react'

const ACCENT = '#c9a84c'
const BORDER = 'rgba(255,255,255,0.08)'

export default function ResetPasswordFan() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    // Supabase puts token in URL hash: #access_token=...&type=recovery
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    const type = params.get('type')
    if (token && type === 'recovery') {
      setAccessToken(token)
      // Clean the hash from the URL without triggering a reload
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handleReset() {
    if (!password) { setError('Please enter a new password.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (!accessToken) { setError('Invalid or expired reset link. Please request a new one.'); return }

    setLoading(true)
    setError(null)

    try {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const res = await fetch(`${sbUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': sbKey,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.msg || data.error_description || data.error || 'Failed to update password')
      }

      setMessage('Password updated! Redirecting to login...')
      setTimeout(() => { window.location.href = '/' }, 2500)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const input = {
    width: '100%',
    background: 'rgba(9,9,11,0.6)',
    border: `1px solid ${BORDER}`,
    borderRadius: 8, padding: '12px 16px', color: '#f4f0e8',
    fontFamily: "'DM Mono', monospace", fontSize: 13,
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#09090b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(17,17,20,0.92)',
        border: `1px solid ${BORDER}`,
        borderRadius: 18, padding: '40px 36px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: ACCENT, marginBottom: 6 }}>
            Coveted Stage
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.22em' }}>
            SET NEW PASSWORD
          </div>
        </div>

        {!accessToken ? (
          <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ color: '#e84545', marginBottom: 16 }}>
              This link is invalid or has expired.
            </div>
            <span
              onClick={() => window.location.href = '/'}
              style={{ color: ACCENT, cursor: 'pointer', fontSize: 11, letterSpacing: '0.1em' }}
            >
              ← Back to fan login
            </span>
          </div>
        ) : message ? (
          <div style={{
            color: '#6dbf8a', fontSize: 13, textAlign: 'center',
            fontFamily: "'DM Mono', monospace", lineHeight: 1.8,
            background: 'rgba(109,191,138,0.08)',
            border: '1px solid rgba(109,191,138,0.2)',
            borderRadius: 8, padding: '16px',
          }}>{message}</div>
        ) : (
          <>
            <div style={{ position: 'relative', marginBottom: 0 }}>
              <input
                style={{ ...input, paddingRight: 44 }}
                placeholder="New password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                position: 'absolute', right: 12, top: 13,
                background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 15,
              }}>{showPassword ? '🙈' : '👁'}</button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...input, paddingRight: 44 }}
                placeholder="Confirm new password"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
                position: 'absolute', right: 12, top: 13,
                background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 15,
              }}>{showConfirm ? '🙈' : '👁'}</button>
            </div>

            {error && (
              <div style={{
                color: '#e84545', fontSize: 12, marginBottom: 14,
                fontFamily: "'DM Mono', monospace",
                background: 'rgba(232,69,69,0.08)',
                border: '1px solid rgba(232,69,69,0.2)',
                borderRadius: 7, padding: '8px 12px',
              }}>{error}</div>
            )}

            <button onClick={handleReset} disabled={loading} style={{
              width: '100%', background: ACCENT, color: '#080808',
              border: 'none', borderRadius: 8, padding: '14px',
              fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
              letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase', opacity: loading ? 0.7 : 1, marginBottom: 16,
              boxShadow: `0 4px 24px ${ACCENT}50`,
            }}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <span
                onClick={() => window.location.href = '/'}
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', cursor: 'pointer', letterSpacing: '0.1em' }}
              >
                ← Back to fan login
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
