import { useState } from 'react'
import { supabase } from './supabaseClient'

async function nativeSignIn(email, password) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (data.error || data.error_description) throw new Error(data.error_description || data.error || 'Sign in failed')
  return data
}

const ACCENT  = '#c9a84c'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#555250'
const BORDER  = 'rgba(255,255,255,0.08)'
const IMG_BOOTH = 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1920&q=80'

const CATEGORIES = [
  { id: 'Music',    icon: '🎵' },
  { id: 'Dance',    icon: '💃' },
  { id: 'Comedy',   icon: '🎤' },
  { id: 'Modeling', icon: '✨' },
  { id: 'Art',      icon: '🎨' },
  { id: 'Other',    icon: '✦'  },
]

export default function Auth({ onAuth, creatorOnly = false }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [category, setCategory] = useState('Music')
  const [customCategory, setCustomCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const role = 'creator' // always creator in this portal

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setMessage(null)

    // ── Forgot password ──────────────────────────────────────────────────
    if (mode === 'forgot') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://covetedstage.com/reset-password',
      })
      if (resetError) setError(resetError.message)
      else setMessage('Check your email for a password reset link.')
      setLoading(false)
      return
    }

    // ── Sign up ──────────────────────────────────────────────────────────
    if (mode === 'signup') {
      if (!displayName.trim()) { setError('Please enter your display name.'); setLoading(false); return }
      if (!handle.trim()) { setError('Please enter a handle.'); setLoading(false); return }
      if (!email.trim()) { setError('Please enter your email.'); setLoading(false); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            handle: handle.toLowerCase().trim(),
            role,
            category: category === 'Other' ? (customCategory.trim() || 'Other') : category,
          }
        }
      })

      if (signUpError) {
        // Handle "user already exists" gracefully
        if (signUpError.message.toLowerCase().includes('already registered') ||
            signUpError.message.toLowerCase().includes('already exists')) {
          setError('An account with this email already exists. Please sign in instead.')
          setMode('login')
        } else {
          setError(signUpError.message)
        }
        setLoading(false)
        return
      }

      // The Supabase database trigger handles profile + creator record creation
      // automatically when the user confirms their email — no manual insert needed

      if (data?.session) {
        // Email confirmation is OFF — user is logged in immediately
        // Update creator record with category then sign in natively
        const finalCategory = category === 'Other' ? (customCategory.trim() || 'Other') : category
        await supabase.from('creators').upsert({ id: data.user.id, category: finalCategory }, { onConflict: 'id' })
        // Use native sign-in to get token and pass directly to portal
        try {
          const signInResult = await nativeSignIn(email.trim(), password)
          onAuth(signInResult)
        } catch {
          // Fallback: switch to login so user can sign in manually
          setEmail(email.trim())
          setPassword('')
          setMode('login')
          setMessage('Account created! Please sign in below.')
        }
      } else {
        // Email confirmation is ON — switch to login and show confirmation message
        setEmail(email.trim()) // keep email pre-filled
        setPassword('')
        setMode('login')
        setMessage('Account created! Check your email to confirm, then sign in below.')
      }

      setLoading(false)
      return
    }

    // ── Sign in — native fetch, pass token directly to onAuth ──────────
    try {
      const signInResult = await nativeSignIn(email.trim(), password)
      onAuth(signInResult)
    } catch (err) {
      const msg = err.message.toLowerCase()
      if (msg.includes('invalid login') || msg.includes('invalid credentials') ||
          msg.includes('invalid email') || msg.includes('wrong password') ||
          msg.includes('user not found') || msg.includes('no user')) {
        setError('Incorrect email or password.')
      } else if (msg.includes('email not confirmed')) {
        setError('Please confirm your email address before signing in. Check your inbox.')
      } else if (msg.includes('too many requests') || msg.includes('rate limit')) {
        setError('Too many attempts. Please wait a moment and try again.')
      } else {
        setError(err.message || 'Sign in failed. Please try again.')
      }
    }
    setLoading(false)
  }

  const input = {
    width: '100%',
    background: 'rgba(9,9,11,0.5)',
    border: `1px solid ${BORDER}`,
    borderRadius: 8, padding: '12px 16px', color: TEXT1,
    fontFamily: "'DM Mono', monospace", fontSize: 13,
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
    backdropFilter: 'blur(4px)',
  }

  const titles = {
    login:  'CREATOR LOGIN',
    signup: 'CREATE CREATOR ACCOUNT',
    forgot: 'RESET PASSWORD',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      backgroundImage: `
        linear-gradient(to bottom, rgba(9,9,11,0.65) 0%, rgba(9,9,11,0.88) 100%),
        url('${IMG_BOOTH}')
      `,
      backgroundSize: 'cover', backgroundPosition: 'center',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(17,17,20,0.82)',
        backdropFilter: 'blur(28px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 18, padding: '40px 36px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 34, color: ACCENT, letterSpacing: '0.01em', marginBottom: 6, textShadow: `0 0 40px ${ACCENT}60` }}>Coveted Stage</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.22em' }}>{titles[mode]}</div>
          {mode === 'login' && (
            <div style={{ marginTop: 10, background: ACCENT + '12', border: `1px solid ${ACCENT}30`, borderRadius: 6, padding: '5px 14px', display: 'inline-block' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, letterSpacing: '0.1em' }}>🎤 CREATOR PORTAL</span>
            </div>
          )}
        </div>

        {/* Signup extra fields */}
        {mode === 'signup' && (
          <>
            <input style={input} placeholder="Display name (e.g. Mara Voss)" value={displayName} onChange={e => setDisplayName(e.target.value)} autoFocus />
            <input style={input} placeholder="Handle (e.g. maravoss — no spaces)" value={handle} onChange={e => setHandle(e.target.value.toLowerCase().replace(/\s+/g, ''))} />

            {/* Category */}
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.2em', marginBottom: 10 }}>WHAT KIND OF CREATOR ARE YOU?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 9, cursor: 'pointer',
                  background: category === cat.id ? ACCENT + '18' : 'rgba(9,9,11,0.4)',
                  border: category === cat.id ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`,
                  color: category === cat.id ? ACCENT : TEXT3,
                  fontFamily: "'DM Mono', monospace", fontSize: 10,
                  letterSpacing: '0.08em', textAlign: 'center',
                  transition: 'all 0.15s',
                  boxShadow: category === cat.id ? `0 0 14px ${ACCENT}25` : 'none',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{cat.icon}</div>
                  {cat.id.toUpperCase()}
                </button>
              ))}
            </div>
            {category === 'Other' && (
              <input
                style={input}
                placeholder="Describe your creative category..."
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                autoFocus={false}
              />
            )}
          </>
        )}

        {/* Forgot: just email */}
        {mode === 'forgot' ? (
          <>
            <p style={{ fontSize: 13, color: TEXT2, lineHeight: 1.7, marginBottom: 20 }}>Enter your email and we'll send a reset link.</p>
            <input style={input} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </>
        ) : (
          <>
            <input style={input} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <div style={{ position: 'relative', marginBottom: 12 }}>
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
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontSize: 15, padding: 4, lineHeight: 1 }}
              >{showPassword ? '🙈' : '👁'}</button>
            </div>
          </>
        )}

        {/* Messages */}
        {error && (
          <div style={{ color: '#e84545', fontSize: 12, marginBottom: 14, fontFamily: "'DM Mono', monospace", background: 'rgba(232,69,69,0.08)', border: '1px solid rgba(232,69,69,0.2)', borderRadius: 7, padding: '8px 12px' }}>{error}</div>
        )}
        {message && (
          <div style={{ color: '#6dbf8a', fontSize: 12, marginBottom: 14, fontFamily: "'DM Mono', monospace", background: 'rgba(109,191,138,0.08)', border: '1px solid rgba(109,191,138,0.2)', borderRadius: 7, padding: '8px 12px' }}>{message}</div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', background: ACCENT, color: '#080808',
          border: 'none', borderRadius: 8, padding: '14px',
          fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
          letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', opacity: loading ? 0.7 : 1, marginBottom: 20,
          boxShadow: `0 4px 24px ${ACCENT}50`,
        }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
        </button>

        {/* Mode links */}
        <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 11, color: TEXT3, display: 'flex', flexDirection: 'column', gap: 8, letterSpacing: '0.04em' }}>
          {mode === 'login' && (
            <>
              <span>New creator? <span onClick={() => { setMode('signup'); setError(null); setMessage(null) }} style={{ color: ACCENT, cursor: 'pointer' }}>Sign up</span></span>
              <span>Forgot password? <span onClick={() => { setMode('forgot'); setError(null); setMessage(null) }} style={{ color: ACCENT, cursor: 'pointer' }}>Reset it</span></span>
            </>
          )}
          {mode === 'signup' && (
            <span>Already have an account? <span onClick={() => { setMode('login'); setError(null); setMessage(null) }} style={{ color: ACCENT, cursor: 'pointer' }}>Log in</span></span>
          )}
          {mode === 'forgot' && (
            <span onClick={() => { setMode('login'); setError(null); setMessage(null) }} style={{ color: ACCENT, cursor: 'pointer' }}>← Back to login</span>
          )}
        </div>

        {/* Fan page link */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.1em', textDecoration: 'none' }}>
            🎧 Looking for the fan page? <span style={{ color: ACCENT }}>Click here →</span>
          </a>
        </div>
      </div>
    </div>
  )
}
