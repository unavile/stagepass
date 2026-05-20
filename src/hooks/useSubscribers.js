import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useSubscribers(creatorId) {
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!creatorId) return
    supabase
      .from('subscriptions')
      .select('*, profiles(display_name, handle, avatar_url, created_at)')
      .eq('creator_id', creatorId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setSubscribers(data || [])
        setLoading(false)
      })
  }, [creatorId])

  return { subscribers, loading }
}