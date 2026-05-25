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

  useEffect(() => {
    // Read session from localStorage — bypasses Supabase JS hang on Netlify
    async function checkSession() {
      try {
        const projectRef = import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]
        const stored = localStorage.getItem(`sb-${projectRef}-auth-token`)
        if (stored) {
          const tokenData = JSON.parse(stored)
          if (tokenData?.user?.id && tokenData?.access_token) {
            // Build a minimal session object
            setSession({
              user: tokenData.user,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token,
            })
          }
        }
      } catch (e) {
        console.error('Session read error:', e)
      }
      setSessionChecked(true)
    }
    checkSession()

    // Still listen for sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { setSession(null); setProfile(null); setSessionChecked(true) }
      if (event === 'TOKEN_REFRESHED' && session) setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load profile once we have a session
  useEffect(() => {
    if (!session) { setProfile(null); setProfileLoading(false); return }
    if (profile?.id === session.user.id) return

    setProfileLoading(true)
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?select=*,creators(*)&id=eq.${session.user.id}&limit=1`
    fetch(url, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      }
    })
      .then(r => r.json())
      .then(data => {
        const profile = Array.isArray(data) ? data[0] : null
        if (profile) setProfile(profile)
        else {
          // Clear invalid session
          const projectRef = import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]
          localStorage.removeItem(`sb-${projectRef}-auth-token`)
          setSession(null)
        }
        setProfileLoading(false)
      })
      .catch(() => {
        setSession(null)
        setProfileLoading(false)
      })
  }, [session])

  // Show Auth immediately if no session confirmed yet
  // This prevents the "Loading..." freeze — show login form right away
  if (!sessionChecked && !session) {
    return <Auth creatorOnly={true} onAuth={() => {}} />
  }

  // Session confirmed but still loading profile
  if (session && (profileLoading || !profile)) return <Loading />

  // No session — show login
  if (!session) return <Auth creatorOnly={true} onAuth={() => {}} />

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
          onClick={() => supabase.auth.signOut()}
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
      onSignOut={() => supabase.auth.signOut()}
    />
  )
}
