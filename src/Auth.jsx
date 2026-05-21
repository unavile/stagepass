import { useState } from 'react'
import { supabase } from './supabaseClient'

const ACCENT  = '#c9a84c'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#555250'
const BORDER  = 'rgba(255,255,255,0.08)'

// Recording booth / studio background
const IMG_BOOTH = 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1920&q=80'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [role, setRole] = useState('fan')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://myaudience.netlify.app/reset-password',
      })
      if (error) setError(error.message)
      else setMessage('Check your email for a password reset link.')
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            handle: handle.toLowerCase(),
            role,
          }
        }
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      if (data?.user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id, role, display_name: displayName, handle: handle.toLowerCase() })
        if (profileError && profileError.code !== '23505') {
          setError(profileError.message); setLoading(false); return
        }
      }
      setMessage('Account created! Logging you in...')
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) { setError(loginError.message); setLoading(false); return }
      onAuth()
    }
    setLoading(false)
  }

  const titles = {
    login:  'WELCOME BACK',
    signup: 'CREATE YOUR ACCOUNT',
    forgot: 'RESET PASSWORD',
  }

  const input = {
    width: '100%',
    background: 'rgba(9,9,11,0.5)',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '12px 16px',
    color: TEXT1,
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    outline: 'none',
    marginBottom: 12,
    boxSizing: 'border-box',
    backdropFilter: 'blur(4px)',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      // Recording booth background with dark overlay
      backgroundImage: `
        linear-gradient(to bottom,
          rgba(9,9,11,0.65) 0%,
          rgba(9,9,11,0.82) 100%
        ),
        url('${IMG_BOOTH}')
      `,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Frosted glass card */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(17,17,20,0.78)',
        backdropFilter: 'blur(28px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        padding: '40px 36px',
        boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
      }}>

        {/* Logo + mode title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 34, color: ACCENT,
            letterSpacing: '0.01em', marginBottom: 6,
            // Subtle text glow
            textShadow: `0 0 40px ${ACCENT}60`,
          }}>StagePass</div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10, color: TEXT3,
            letterSpacing: '0.22em',
          }}>{titles[mode]}</div>
        </div>

        {/* Signup: role selector + extra fields */}
        {mode === 'signup' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['fan', 'creator'].map(r => (
                <button key={r} onClick={() => setRole(r)} style={{
                  flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                  background: role === r ? ACCENT + '18' : 'rgba(9,9,11,0.4)',
                  border: role === r ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`,
                  color: role === r ? ACCENT : TEXT3,
                  fontFamily: "'DM Mono', monospace", fontSize: 11,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  transition: 'all 0.15s',
                  boxShadow: role === r ? `0 0 12px ${ACCENT}20` : 'none',
                }}>{r === 'fan' ? '🎧 Fan' : '🎤 Creator'}</button>
              ))}
            </div>
            <input
              style={input}
              placeholder="Display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
            <input
              style={input}
              placeholder="Handle (e.g. maravoss)"
              value={handle}
              onChange={e => setHandle(e.target.value)}
            />
          </>
        )}

        {/* Forgot password: just email */}
        {mode === 'forgot' ? (
          <>
            <p style={{ fontSize: 13, color: TEXT2, lineHeight: 1.7, marginBottom: 20 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <input
              style={input}
              placeholder="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </>
        ) : (
          <>
            <input
              style={input}
              placeholder="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              style={input}
              placeholder="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </>
        )}

        {/* Error / success messages */}
        {error && (
          <div style={{
            color: '#e84545', fontSize: 12, marginBottom: 14,
            fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em',
            background: 'rgba(232,69,69,0.08)', border: '1px solid rgba(232,69,69,0.2)',
            borderRadius: 7, padding: '8px 12px',
          }}>{error}</div>
        )}
        {message && (
          <div style={{
            color: '#6dbf8a', fontSize: 12, marginBottom: 14,
            fontFamily: "'DM Mono', monospace", letterSpacing: '0.04em',
            background: 'rgba(109,191,138,0.08)', border: '1px solid rgba(109,191,138,0.2)',
            borderRadius: 7, padding: '8px 12px',
          }}>{message}</div>
        )}

        {/* Primary action button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', background: ACCENT, color: '#080808',
            border: 'none', borderRadius: 8, padding: '14px',
            fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
            letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', opacity: loading ? 0.7 : 1, marginBottom: 20,
            boxShadow: `0 4px 24px ${ACCENT}50`,
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}
        >
          {loading
            ? 'Please wait...'
            : mode === 'login'
              ? 'Log In'
              : mode === 'signup'
                ? 'Create Account'
                : 'Send Reset Link'
          }
        </button>

        {/* Mode switcher links */}
        <div style={{
          textAlign: 'center',
          fontFamily: "'DM Mono', monospace",
          fontSize: 11, color: TEXT3,
          display: 'flex', flexDirection: 'column', gap: 8,
          letterSpacing: '0.04em',
        }}>
          {mode === 'login' && (
            <>
              <span>
                Don't have an account?{' '}
                <span
                  onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
                  style={{ color: ACCENT, cursor: 'pointer' }}
                >Sign up</span>
              </span>
              <span>
                Forgot your password?{' '}
                <span
                  onClick={() => { setMode('forgot'); setError(null); setMessage(null) }}
                  style={{ color: ACCENT, cursor: 'pointer' }}
                >Reset it</span>
              </span>
            </>
          )}
          {mode === 'signup' && (
            <span>
              Already have an account?{' '}
              <span
                onClick={() => { setMode('login'); setError(null); setMessage(null) }}
                style={{ color: ACCENT, cursor: 'pointer' }}
              >Log in</span>
            </span>
          )}
          {mode === 'forgot' && (
            <span>
              Remember it?{' '}
              <span
                onClick={() => { setMode('login'); setError(null); setMessage(null) }}
                style={{ color: ACCENT, cursor: 'pointer' }}
              >Back to login</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
