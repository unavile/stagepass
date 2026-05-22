import { useState } from 'react'
import { supabase } from './supabaseClient'

const ACCENT  = '#c9a84c'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#8c8883'
const BORDER  = 'rgba(255,255,255,0.08)'

export default function FanLoginModal({ onSuccess, onClose, initialMessage }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const input = {
    width: '100%',
    background: 'rgba(9,9,11,0.6)',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '11px 14px',
    color: TEXT1,
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    outline: 'none',
    marginBottom: 10,
    boxSizing: 'border-box',
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://myaudience.netlify.app/reset-password',
      })
      if (error) setError(error.message)
      else setMessage('Check your email for a reset link.')
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      if (!displayName.trim()) { setError('Please enter your name.'); setLoading(false); return }
      if (!email.trim()) { setError('Please enter your email.'); setLoading(false); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }

      // Generate a handle from display name
      const handle = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Math.random().toString(36).slice(2, 6)

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim(), handle, role: 'fan' }
        }
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }

      if (data?.user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id, role: 'fan', display_name: displayName.trim(), handle })
        if (profileError && profileError.code !== '23505') {
          setError(profileError.message); setLoading(false); return
        }
      }
      // Sign in immediately after signup
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) {
        setMessage('Account created! Please sign in.')
        setMode('login')
        setLoading(false)
        return
      }
      onSuccess()
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) { setError(loginError.message); setLoading(false); return }
      onSuccess()
    }
    setLoading(false)
  }

  return (
    // Faux overlay — normal flow div so iframe renders correctly
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'rgba(17,17,20,0.96)',
        backdropFilter: 'blur(24px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 16, padding: '28px 24px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        position: 'relative',
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', color: TEXT3,
          fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4,
        }}>✕</button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: TEXT1, marginBottom: 4 }}>
            {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create fan account' : 'Reset password'}
          </div>
          {initialMessage && mode === 'login' && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, letterSpacing: '0.1em', marginTop: 4 }}>{initialMessage}</div>
          )}
          {mode === 'signup' && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.08em', marginTop: 4 }}>
              Your display name appears to creators and on events.
            </div>
          )}
        </div>

        {/* Signup: display name first */}
        {mode === 'signup' && (
          <input
            style={input}
            placeholder="Your display name (e.g. Alex Chen)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            autoFocus
          />
        )}

        {/* Forgot: just email */}
        {mode === 'forgot' ? (
          <>
            <p style={{ fontSize: 12, color: TEXT2, lineHeight: 1.7, marginBottom: 14 }}>
              Enter your email and we'll send a reset link.
            </p>
            <input style={input} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </>
        ) : (
          <>
            <input style={input} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input style={input} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </>
        )}

        {/* Error / success */}
        {error && (
          <div style={{ color: '#e84545', fontSize: 11, marginBottom: 12, fontFamily: "'DM Mono', monospace", background: 'rgba(232,69,69,0.08)', border: '1px solid rgba(232,69,69,0.2)', borderRadius: 7, padding: '7px 10px' }}>{error}</div>
        )}
        {message && (
          <div style={{ color: '#6dbf8a', fontSize: 11, marginBottom: 12, fontFamily: "'DM Mono', monospace", background: 'rgba(109,191,138,0.08)', border: '1px solid rgba(109,191,138,0.2)', borderRadius: 7, padding: '7px 10px' }}>{message}</div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', background: ACCENT, color: '#080808',
          border: 'none', borderRadius: 8, padding: '12px',
          fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
          letterSpacing: '0.14em', cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', opacity: loading ? 0.7 : 1, marginBottom: 16,
          boxShadow: `0 4px 20px ${ACCENT}45`,
        }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
        </button>

        {/* Mode switcher */}
        <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 11, color: TEXT3, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {mode === 'login' && (
            <>
              <span>
                New here?{' '}
                <span onClick={() => { setMode('signup'); setError(null); setMessage(null) }} style={{ color: ACCENT, cursor: 'pointer' }}>Create free account</span>
              </span>
              <span>
                <span onClick={() => { setMode('forgot'); setError(null); setMessage(null) }} style={{ color: TEXT3, cursor: 'pointer', textDecoration: 'underline' }}>Forgot password?</span>
              </span>
            </>
          )}
          {mode === 'signup' && (
            <span>
              Already have an account?{' '}
              <span onClick={() => { setMode('login'); setError(null); setMessage(null) }} style={{ color: ACCENT, cursor: 'pointer' }}>Sign in</span>
            </span>
          )}
          {mode === 'forgot' && (
            <span onClick={() => { setMode('login'); setError(null); setMessage(null) }} style={{ color: ACCENT, cursor: 'pointer' }}>← Back to sign in</span>
          )}
        </div>
      </div>
    </div>
  )
}
