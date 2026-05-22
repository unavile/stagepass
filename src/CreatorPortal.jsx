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
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN')       setSession(session)
      if (event === 'SIGNED_OUT')      { setSession(null); setProfile(null) }
      if (event === 'TOKEN_REFRESHED') setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setProfile(null); setProfileLoading(false); return }
    if (profile?.id === session.user.id) return

    setProfileLoading(true)
    supabase
      .from('profiles')
      .select('*, creators(*)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data)
        else supabase.auth.signOut()
        setProfileLoading(false)
      })
  }, [session])

  // Still checking session
  if (session === undefined) return <Loading />

  // Not logged in — show creator-specific auth
  if (!session) return (
    <Auth
      creatorOnly={true}
      onAuth={() => {}}
    />
  )

  // Logged in but loading profile
  if (profileLoading || !profile) return <Loading />

  // Logged in but not a creator — show error
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
