import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CreatorApp from './CreatorApp'
import FanApp from './FanApp'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const currentUserId = useRef(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.id ?? 'none')
      setSession(session ?? null)
    })

    // Listen for auth changes but ignore if same user
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session?.user?.id ?? 'none')
      const incomingId = session?.user?.id ?? null
      if (incomingId !== currentUserId.current) {
        currentUserId.current = incomingId
        setSession(session ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile only when session changes to a new user
  useEffect(() => {
    if (session === undefined) return
    if (!session) { setProfile(null); return }

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