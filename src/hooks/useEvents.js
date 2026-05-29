import { useState, useEffect } from 'react'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function sbHeaders(accessToken) {
  return {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${accessToken || SB_KEY}`,
    'Content-Type': 'application/json',
  }
}

// ── Creator portal: fetch events for a creator (authenticated) ────────────────
export function useEvents(creatorId, accessToken) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchEvents() {
    if (!creatorId) { setLoading(false); return }
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/events?creator_id=eq.${creatorId}&select=*,rsvps(id,fan_id,profiles(display_name,handle))&order=event_date.asc`,
        { headers: sbHeaders(accessToken) }
      )
      const data = await res.json()
      if (Array.isArray(data)) setEvents(data)
    } catch (e) {
      console.error('useEvents fetchEvents error:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [creatorId])
  return { events, loading, refetch: fetchEvents }
}

// ── Fan portal: fetch public events for a creator (anon) ─────────────────────
export function usePublicEvents(creatorId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!creatorId) { setEvents([]); return }
    setLoading(true)
    fetch(
      `${SB_URL}/rest/v1/events?creator_id=eq.${creatorId}&select=*,rsvps(count)&order=event_date.desc`,
      { headers: sbHeaders() }
    )
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEvents(data)
        setLoading(false)
      })
      .catch(e => {
        console.error('usePublicEvents error:', e)
        setLoading(false)
      })
  }, [creatorId])

  return { events, loading }
}
