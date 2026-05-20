import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [validSession, setValidSession] = useState(false)

  useEffect(() => {
    // Supabase puts the token in the URL hash on redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true)
    })
  }, [])

  async function handleReset() {
    if (!password) { setError('Please enter a new password.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setMessage('Password updated! Redirecting to login...')
      await supabase.auth.signOut()
      setTimeout(() => { window.location.href = '/' }, 2000)
    }
    setLoading(false)
  }

  const input = {
    width: '100%', background: '#111', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: '#c9a84c' }}>StagePass</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.2em', marginTop: 4 }}>SET NEW PASSWORD</div>
        </div>

        {!validSession ? (
          <div style={{ textAlign: 'center', color: '#555', fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.8 }}>
            This link is invalid or has expired.<br />
            <span onClick={() => window.location.href = '/'} style={{ color: '#c9a84c', cursor: 'pointer' }}>Back to login</span>
          </div>
        ) : (
          <>
            <input style={input} placeholder="New password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <input style={input} placeholder="Confirm new password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />

            {error && <div style={{ color: '#e84545', fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}
            {message && <div style={{ color: '#6dbf8a', fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{message}</div>}

            <button onClick={handleReset} disabled={loading} style={{
              width: '100%', background: '#c9a84c', color: '#080808',
              border: 'none', borderRadius: 8, padding: '14px',
              fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
              letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase', opacity: loading ? 0.7 : 1
            }}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}