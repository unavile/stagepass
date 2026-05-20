import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
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

  if (mode === 'signup') {
    const { data, error: signUpError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          display_name: displayName,
          handle: handle.toLowerCase(),
          role: role,
        }
      }
    })

    if (signUpError) { 
      setError(signUpError.message)
      setLoading(false)
      return 
    }

    // Insert profile if user is immediately available (email confirmation disabled)
    // If email confirmation is on, this is handled after confirmation via onAuthStateChange
    if (data?.user?.id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          role,
          display_name: displayName,
          handle: handle.toLowerCase()
        })

      if (profileError && profileError.code !== '23505') {
        // 23505 = duplicate, means profile already exists, safe to ignore
        setError(profileError.message)
        setLoading(false)
        return
      }
    }

    setMessage('Account created! Check your email to confirm, then log in.')

  } else {
    const { error: loginError } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    })
    if (loginError) { 
      setError(loginError.message)
      setLoading(false)
      return 
    }
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

  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: '#c9a84c' }}>StagePass</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#444', letterSpacing: '0.2em', marginTop: 4 }}>
            {mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR ACCOUNT'}
          </div>
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
                  fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.12em',
                  textTransform: 'uppercase'
                }}>{r === 'fan' ? '🎧 Fan' : '🎤 Creator'}</button>
              ))}
            </div>
            <input style={input} placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            <input style={input} placeholder="Handle (e.g. maravoss)" value={handle} onChange={e => setHandle(e.target.value)} />
          </>
        )}

        <input style={input} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={input} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />

        {error && <div style={{ color: '#e84545', fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{error}</div>}
        {message && <div style={{ color: '#6dbf8a', fontSize: 13, marginBottom: 12, fontFamily: "'DM Mono', monospace" }}>{message}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', background: '#c9a84c', color: '#080808',
          border: 'none', borderRadius: 8, padding: '14px',
          fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
          letterSpacing: '0.15em', cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase', opacity: loading ? 0.7 : 1, marginBottom: 16
        }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
        </button>

        <div style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#444' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null) }}
            style={{ color: '#c9a84c', cursor: 'pointer' }}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </span>
        </div>
      </div>
    </div>
  )
}