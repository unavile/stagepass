import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useEvents(creatorId) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchEvents() {
    if (!creatorId) return
    const { data, error } = await supabase
      .from('events')
      .select('*, rsvps(count)')
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!creatorId) return
    supabase
      .from('events')
      .select('*, rsvps(count)')
      .eq('creator_id', creatorId)
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setEvents(data || [])
        setLoading(false)
      })
  }, [creatorId])

  return { events, loading }
}