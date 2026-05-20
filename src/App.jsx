import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CreatorApp from './CreatorApp'
import FanApp from './FanApp'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    // Get current session once on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    // Only listen for explicit user-driven changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN')     setSession(session)
      if (event === 'SIGNED_OUT')    { setSession(null); setProfile(null) }
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

  if (session === undefined) return <Loading />
  if (!session) return <Auth onAuth={() => {}} />
  if (profileLoading || !profile) return <Loading />

  if (profile.role === 'creator') {
    return <CreatorApp session={session} profile={profile} onSignOut={() => supabase.auth.signOut()} />
  }

  return <FanApp session={session} profile={profile} onSignOut={() => supabase.auth.signOut()} />
}

function Loading() {
  return (
    <div style={{
      minHeight: '100vh', background: '#080808',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Mono', monospace", color: '#444', letterSpacing: '0.2em'
    }}>
      LOADING...
    </div>
  )
}