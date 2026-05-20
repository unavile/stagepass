import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CreatorApp from './CreatorApp'
import FanApp from './FanApp'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = not yet checked
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Step 1: just get the session, nothing else
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.id ?? 'none')
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session?.user?.id ?? 'none')
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

const fetchingRef = useRef(false)

// Step 2: when session changes, fetch profile separately
useEffect(() => {
  if (session === undefined) return
  if (!session) { setProfile(null); return }
  if (fetchingRef.current) return // already fetching, skip

  fetchingRef.current = true
  console.log('Fetching profile for:', session.user.id)
  setProfileLoading(true)

  supabase
    .from('profiles')
    .select('*, creators(*)')
    .eq('id', session.user.id)
    .maybeSingle()
    .then(({ data, error }) => {
      console.log('Profile fetch done:', data?.role, error?.message)
      if (data) {
        setProfile(data)
      } else {
        console.log('No profile found, signing out')
        supabase.auth.signOut()
      }
      setProfileLoading(false)
      fetchingRef.current = false
    })
}, [session])

  // Still checking session
  if (session === undefined) return <Loading />

  // Session checked, no session = show login
  if (!session) return <Auth onAuth={() => {}} />

  // Session exists but profile still loading
  if (profileLoading || !profile) return <Loading />

  // Route by role
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