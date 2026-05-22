import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useFanEvents(fanId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false) // false by default — no fanId on mount

  async function fetchFanEvents() {
    if (!fanId) { setEvents([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('rsvps')
      .select(`
        id,
        event_id,
        events (
          id,
          name,
          description,
          venue,
          event_date,
          event_type,
          stream_url,
          is_free,
          creator_id,
          creators (
            profiles (
              display_name,
              handle
            )
          )
        )
      `)
      .eq('fan_id', fanId)
      .order('created_at', { ascending: false })

    if (!error) {
      const sorted = (data || [])
        .filter(r => r.events)
        .sort((a, b) => new Date(a.events.event_date) - new Date(b.events.event_date))
      setEvents(sorted)
    } else {
      console.error('useFanEvents error:', error.message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchFanEvents() }, [fanId])

  return { events, loading, refetch: fetchFanEvents }
}
