import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CreatorApp from './CreatorApp'

function Loading() {
  return (
    <div style={{
      minHeight: '100vh', background: '#09090b',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", color: '#555', letterSpacing: '0.2em',
      fontSize: 12,
    }}>
      LOADING...
    </div>
  )
}

export default function CreatorPortal() {
  // Start as null (not logged in) — show Auth immediately
  // Only switch to a session if onAuthStateChange confirms one exists
  const [session, setSession] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const SESSION_KEY = 'cs-creator-session'

  function storeCreatorSession(tokenData) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        user: tokenData.user,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: tokenData.expires_at || Math.floor(Date.now() / 1000) + (tokenData.expires_in || 3600),
      }))
    } catch (e) { console.error('storeCreatorSession error:', e) }
  }

  function clearCreatorSession() {
    try { localStorage.removeItem(SESSION_KEY) } catch (e) {}
  }

  // Called by Auth after successful login with token data
  function handleAuthSuccess(tokenData) {
    if (tokenData?.access_token && tokenData?.user) {
      storeCreatorSession(tokenData)
      setSession({
        user: tokenData.user,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      })
      setSessionChecked(true)
    }
  }

  useEffect(() => {
    // ── Restore session from localStorage on mount (survives refresh) ──────
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) {
        const tokenData = JSON.parse(stored)
        const expiresAt = tokenData.expires_at || 0
        const nowSecs = Math.floor(Date.now() / 1000)
        if (tokenData?.access_token && tokenData?.user && expiresAt > nowSecs) {
          // Session still valid — restore it
          setSession({
            user: tokenData.user,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
          })
          setSessionChecked(true)
          return // skip showing login
        } else {
          // Expired — clear it
          clearCreatorSession()
        }
      }
    } catch (e) { console.error('Session restore error:', e) }

    setSessionChecked(true) // No stored session — show login

    // Listen only for sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearCreatorSession()
        setSession(null)
        setProfile(null)
        setSessionChecked(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load profile once we have a session
  useEffect(() => {
    if (!session) { setProfile(null); setProfileLoading(false); return }
    if (profile?.id === session.user.id) return

    setProfileLoading(true)
    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(`${sbUrl}/rest/v1/profiles?select=*,creators(*)&id=eq.${session.user.id}&limit=1`, {
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${session.access_token}` }
    })
      .then(r => r.json())
      .then(data => {
        const p = Array.isArray(data) ? data[0] : null
        if (p) setProfile(p)
        else { setSession(null) }
        setProfileLoading(false)
      })
      .catch(() => { setSession(null); setProfileLoading(false) })
  }, [session])

  // Show Auth immediately if no session confirmed yet
  // This prevents the "Loading..." freeze — show login form right away
  if (!sessionChecked && !session) {
    return <Auth creatorOnly={true} onAuth={handleAuthSuccess} />
  }

  // Session confirmed but still loading profile
  if (session && (profileLoading || !profile)) return <Loading />

  // No session — show login
  if (!session) return <Auth creatorOnly={true} onAuth={handleAuthSuccess} />

  // Logged in but not a creator
  if (profile.role !== 'creator') {
    return (
      <div style={{
        minHeight: '100vh', background: '#09090b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16, padding: 24,
        fontFamily: "'DM Mono', monospace",
      }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: '#f4f0e8', fontSize: 14, textAlign: 'center' }}>
          This account is registered as a fan, not a creator.
        </div>
        <div style={{ color: '#555', fontSize: 12, textAlign: 'center' }}>
          Sign up with a new account to become a creator.
        </div>
        <button
          onClick={() => { clearCreatorSession(); supabase.auth.signOut() }}
          style={{
            background: '#c9a84c', color: '#080808',
            border: 'none', borderRadius: 7, padding: '10px 20px',
            fontFamily: "'DM Mono', monospace", fontSize: 11,
            fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer',
          }}
        >SIGN OUT</button>
      </div>
    )
  }

  return (
    <CreatorApp
      session={session}
      profile={profile}
      onSignOut={() => {
        clearCreatorSession()
        supabase.auth.signOut()  // best-effort, may be no-op
        setSession(null)
        setProfile(null)
      }}
    />
  )
}
