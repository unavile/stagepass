import { useState, useEffect } from 'react'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useFanEvents(fanId, accessToken) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)

  async function fetchFanEvents() {
    if (!fanId) { setEvents([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/rsvps?fan_id=eq.${fanId}&select=id,event_id,events(id,name,description,venue,event_date,event_type,stream_url,is_free,access_type,ticket_price,creator_id,daily_room_name,start_time,duration_minutes,event_mode,always_on,creators(profiles(display_name,handle)))&order=created_at.desc`,
        {
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${accessToken || SB_KEY}`,
          }
        }
      )
      const data = await res.json()
      if (Array.isArray(data)) {
        const sorted = data
          .filter(r => r.events)
          .sort((a, b) => new Date(a.events.event_date) - new Date(b.events.event_date))
        setEvents(sorted)
      } else {
        console.error('useFanEvents unexpected response:', data)
      }
    } catch (e) {
      console.error('useFanEvents error:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchFanEvents() }, [fanId])

  return { events, loading, refetch: fetchFanEvents }
}
