import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useEvents(creatorId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchEvents() {
    if (!creatorId) { setLoading(false); return }
    const { data, error } = await supabase
      .from('events')
      .select('*, rsvps(id, fan_id, profiles(display_name, handle))')
      .eq('creator_id', creatorId)
      .order('event_date', { ascending: true })
    if (!error) setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchEvents() }, [creatorId])
  return { events, loading, refetch: fetchEvents }
}

export function usePublicEvents(creatorId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false) // false by default — no creatorId on mount

  useEffect(() => {
    if (!creatorId) { setEvents([]); return }
    setLoading(true)
    supabase
      .from('events')
      .select('*, rsvps(count)')
      .eq('creator_id', creatorId)
      .order('event_date', { ascending: false }) // most recent first
      .then(({ data, error }) => {
        if (!error) setEvents(data || [])
        setLoading(false)
      })
  }, [creatorId])

  return { events, loading }
}
