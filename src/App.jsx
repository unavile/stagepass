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
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session?.user?.id ?? 'none')
    
    // Only update session on these specific events
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') {
      setSession(session ?? null)
    } else if (event === 'SIGNED_IN' && session?.user?.id !== undefined) {
      // Only set on SIGNED_IN if we don't already have a session
      setSession(prev => {
        if (prev === undefined) return session
        if (prev?.user?.id === session?.user?.id) return prev // same user, no change
        return session // different user, update
      })
    }
  })
  return () => subscription.unsubscribe()
}, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setProfile(null); setProfileLoading(false); return }

    console.log('Fetching profile for:', session.user.id)
    setProfileLoading(true)

    supabase
      .from('profiles')
      .select('*, creators(*)')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        console.log('Profile fetch done:', data?.role, error?.message)
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