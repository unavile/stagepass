import { useState } from 'react'
import { supabase } from './supabaseClient'

const ACCENT  = '#c9a84c'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#555250'
const BORDER  = 'rgba(255,255,255,0.08)'
const IMG_BOOTH = 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1920&q=80'

const CATEGORIES = [
  { id: 'Music',  icon: '🎵' },
  { id: 'Dance',  icon: '💃' },
  { id: 'Comedy', icon: '🎤' },
]

export default function Auth({ onAuth, creatorOnly = false }) {
  const [mode, setMode] = useState('login')
  const [role] = useState('creator')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [category, setCategory] = useState('Music')
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
          data: { display_name: displayName, handle: handle.toLowerCase(), role }
        }
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }

      if (data?.user?.id) {
        // Insert profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ id: data.user.id, role, display_name: displayName, handle: handle.toLowerCase() })
        if (profileError && profileError.code !== '23505') {
          setError(profileError.message); setLoading(false); return
        }
        // Insert creator record with category
        await supabase.from('creators').upsert({ id: data.user.id, category }, { onConflict: 'id' })
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
    login:  creatorOnly ? 'CREATOR LOGIN' : 'WELCOME BACK',
    signup: 'CREATE CREATOR ACCOUNT',
    forgot: 'RESET PASSWORD',
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
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 34, color: ACCENT, letterSpacing: '0.01em', marginBottom: 6, textShadow: `0 0 40px ${ACCENT}60` }}>StagePass</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.22em' }}>{titles[mode]}</div>
          {creatorOnly && mode === 'login' && (
            <div style={{ marginTop: 10, background: ACCENT + '12', border: `1px solid ${ACCENT}30`, borderRadius: 6, padding: '5px 14px', display: 'inline-block' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, letterSpacing: '0.1em' }}>🎤 CREATOR PORTAL</span>
            </div>
          )}
        </div>

        {/* Signup fields */}
        {mode === 'signup' && (
          <>
            <input style={input} placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <input style={input} placeholder="Handle (e.g. maravoss)" value={handle} onChange={e => setHandle(e.target.value)} />

            {/* Category selection at signup */}
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.2em', marginBottom: 10 }}>WHAT KIND OF CREATOR ARE YOU?</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
            <input style={input} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </>
        )}

        {error && (
          <div style={{ color: '#e84545', fontSize: 12, marginBottom: 14, fontFamily: "'DM Mono', monospace", background: 'rgba(232,69,69,0.08)', border: '1px solid rgba(232,69,69,0.2)', borderRadius: 7, padding: '8px 12px' }}>{error}</div>
        )}
        {message && (
          <div style={{ color: '#6dbf8a', fontSize: 12, marginBottom: 14, fontFamily: "'DM Mono', monospace", background: 'rgba(109,191,138,0.08)', border: '1px solid rgba(109,191,138,0.2)', borderRadius: 7, padding: '8px 12px' }}>{message}</div>
        )}

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

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.1em', textDecoration: 'none' }}>
            🎧 Looking for the fan page? <span style={{ color: ACCENT }}>Click here →</span>
          </a>
        </div>
      </div>
    </div>
  )
}
