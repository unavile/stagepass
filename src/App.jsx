import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CreatorApp from './CreatorApp'
import FanApp from './FanApp'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const initialSessionReceived = useRef(false)
  const profileFetchedFor = useRef(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session?.user?.id ?? 'none')

      if (event === 'INITIAL_SESSION') {
        // Page load — this is always the truth
        initialSessionReceived.current = true
        setSession(session ?? null)

      } else if (event === 'SIGNED_IN') {
        if (!initialSessionReceived.current) {
          // INITIAL_SESSION hasn't fired yet, hold off
          return
        }
        // Fresh login (INITIAL_SESSION already fired with null)
        setSession(session ?? null)

      } else if (event === 'SIGNED_OUT') {
        initialSessionReceived.current = false
        profileFetchedFor.current = null
        setSession(null)
        setProfile(null)

      } else if (event === 'TOKEN_REFRESHED') {
        setSession(session ?? null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setProfile(null); setProfileLoading(false); return }

    // Skip if we already fetched for this user
    if (profileFetchedFor.current === session.user.id) return
    profileFetchedFor.current = session.user.id

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