import { useState } from 'react'
import { supabase } from './supabaseClient'

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

  const input = {
    width: '100%', background: '#111', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box'
  }

  const titles = { login: 'WELCOME BACK', signup: 'CREATE YOUR ACCOUNT', forgot: 'RESET PASSWORD' }

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: '#c9a84c' }}>StagePass</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.2em', marginTop: 4 }}>{titles[mode]}</div>
        </div>

        {mode === 'signup' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['fan', 'creator'].map(r => (
                <button key={r} onClick={() => setRole(r)} style={{
                  flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                  background: role === r ? '#c9a84c18' : 'none',
                  border: role === r ? '1px solid #c9a84c66' : '1px solid #ffffff15',
                  color: role === r ? '#c9a84c' : '#555',
                  fontFamily: "'DM Mono', monospace", fontSize: 11,
                  letterSpacing: '0.12em', textTransform: 'uppercase'
                }}>{r === 'fan' ? '🎧 Fan' : '🎤 Creator'}</button>
              ))}
            </div>
            <input style={input} placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <input style={input} placeholder="Handle (e.g. maravoss)" value={handle} onChange={e => setHandle(e.target.value)} />
          </>
        )}

        {mode === 'forgot' ? (
          <>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7, marginBottom: 20 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <input style={input} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </>
        ) : (
          <>
            <input style={input} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <input style={input} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </>
        )}

        {error && <div style={{ color: '#e84545', fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}
        {message && <div style={{ color: '#6dbf8a', fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{message}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', background: '#c9a84c', color: '#080808',
          border: 'none', borderRadius: 8, padding: '14px',
          fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
          letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', opacity: loading ? 0.7 : 1, marginBottom: 16
        }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
        </button>

        <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#444', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'login' && (
            <>
              <span>
                Don't have an account?{' '}
                <span onClick={() => { setMode('signup'); setError(null); setMessage(null) }} style={{ color: '#c9a84c', cursor: 'pointer' }}>Sign up</span>
              </span>
              <span>
                Forgot your password?{' '}
                <span onClick={() => { setMode('forgot'); setError(null); setMessage(null) }} style={{ color: '#c9a84c', cursor: 'pointer' }}>Reset it</span>
              </span>
            </>
          )}
          {mode === 'signup' && (
            <span>
              Already have an account?{' '}
              <span onClick={() => { setMode('login'); setError(null); setMessage(null) }} style={{ color: '#c9a84c', cursor: 'pointer' }}>Log in</span>
            </span>
          )}
          {mode === 'forgot' && (
            <span>
              Remember it?{' '}
              <span onClick={() => { setMode('login'); setError(null); setMessage(null) }} style={{ color: '#c9a84c', cursor: 'pointer' }}>Back to login</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}