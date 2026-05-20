import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import CreatorApp from './CreatorApp'
import FanApp from './FanApp'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, creators(*)')
    .eq('id', userId)
    .single()

  if (error || !data) {
    // Profile missing — sign out and return to login
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  } else {
    setProfile(data)
  }
  setLoading(false)
}

useEffect(() => {
  console.log('App mounted, checking session...')
  
  supabase.auth.getSession().then(async ({ data: { session }, error }) => {
    console.log('Session result:', session, 'Error:', error)
    
    if (session) {
      console.log('Session found, fetching profile for:', session.user.id)
      await fetchProfile(session.user.id)
    } else {
      console.log('No session found, going to login')
      setLoading(false)
    }
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    console.log('Auth state changed:', _event, session?.user?.id)
    setSession(session)
    if (session) await fetchProfile(session.user.id)
    else { setProfile(null); setLoading(false) }
  })

  return () => subscription.unsubscribe()
}, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono', monospace", color: '#444', letterSpacing: '0.2em' }}>
      LOADING...
    </div>
  )

  if (!session || !profile) return <Auth onAuth={() => {}} />

  if (profile.role === 'creator') return (
    <CreatorApp session={session} profile={profile} onSignOut={async () => {
      await supabase.auth.signOut()
    }} />
  )

  return (
    <FanApp session={session} profile={profile} onSignOut={async () => {
      await supabase.auth.signOut()
    }} />
  )
}