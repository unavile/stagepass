import { useState } from 'react'
import { supabase } from './supabaseClient'

const ACCENT  = '#c9a84c'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#8c8883'
const BORDER  = 'rgba(255,255,255,0.08)'

// Use native fetch for auth calls to avoid Supabase JS client hang on Netlify
async function nativeSignIn(email, password) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (data.error || data.error_description) {
    throw new Error(data.error_description || data.error || 'Sign in failed')
  }
  return data
}

async function nativeSignUp(email, password, metadata) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/signup`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password, data: metadata }),
  })
  const data = await res.json()
  if (data.error || data.error_description) {
    throw new Error(data.error_description || data.error || 'Sign up failed')
  }
  return data
}

async function nativeResetPassword(email) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/recover`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      email,
      gotrue_meta_security: {},
    }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error_description || data.error || 'Reset failed')
  }
}

export default function FanLoginModal({ onSuccess, onClose, initialMessage }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

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

  function storeSession(tokenData) {
    // Store tokens directly in localStorage so Supabase picks them up on reload
    const projectRef = import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]
    const storageKey = `sb-${projectRef}-auth-token`
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at || Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600),
      expires_in: tokenData.expires_in || 3600,
      token_type: 'bearer',
      user: tokenData.user,
    }))
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      // ── Forgot password ──────────────────────────────────────────────
      if (mode === 'forgot') {
        await nativeResetPassword(email.trim())
        setMessage('Check your email for a reset link.')
        setLoading(false)
        return
      }

      // ── Sign up ──────────────────────────────────────────────────────
      if (mode === 'signup') {
        if (!displayName.trim()) { setError('Please enter your name.'); setLoading(false); return }
        if (!email.trim()) { setError('Please enter your email.'); setLoading(false); return }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }

        const handle = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Math.random().toString(36).slice(2, 6)

        const signUpResult = await nativeSignUp(email.trim(), password, {
          display_name: displayName.trim(),
          handle,
          role: 'fan',
        })

        // Send welcome email — await so server-side confirmation runs
        const fanUserId = signUpResult.user?.id || signUpResult.id
        try {
          const welcomeRes = await fetch('/.netlify/functions/send-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              displayName: displayName.trim(),
              role: 'fan',
              userId: fanUserId,
            }),
          })
          const welcomeData = await welcomeRes.json().catch(() => ({}))
          if (!welcomeRes.ok && welcomeData.error === 'invalid_email') {
            setError(welcomeData.message || 'That email address appears to be invalid.')
            setLoading(false)
            return
          }
        } catch (e) {
          console.warn('Welcome email failed:', e)
        }

        // Sign in immediately — email confirmed server-side by send-welcome-email
        try {
          const signInResult = await nativeSignIn(email.trim(), password)
          storeSession(signInResult)
          onSuccess()
        } catch {
          // Fallback: ask them to sign in manually
          setEmail(email.trim())
          setPassword('')
          setMode('login')
          setMessage('Account created! Please sign in below.')
        }
        setLoading(false)
        return
      }

      // ── Sign in ──────────────────────────────────────────────────────
      const signInResult = await nativeSignIn(email.trim(), password)
      storeSession(signInResult)
      onSuccess()

    } catch (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        setError('Incorrect email or password.')
      } else if (msg.includes('email not confirmed')) {
        setError('Please confirm your email address before signing in. Check your inbox.')
      } else if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('An account with this email already exists.')
        setMode('login')
      } else {
        setError(err.message)
      }
    }

    setLoading(false)
  }

  return (
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
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                style={{ ...input, marginBottom: 0, paddingRight: 44 }}
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontSize: 15, padding: 4, lineHeight: 1 }}
              >{showPassword ? '🙈' : '👁'}</button>
            </div>
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
