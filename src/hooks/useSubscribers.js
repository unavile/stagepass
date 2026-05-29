import { useState, useEffect } from 'react'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function useSubscribers(creatorId, accessToken) {
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchSubscribers() {
    if (!creatorId) { setLoading(false); return }
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/subscriptions?creator_id=eq.${creatorId}&status=eq.active&select=*,profiles!subscriptions_fan_id_fkey(display_name,handle,avatar_url)`,
        {
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${accessToken || SB_KEY}`,
          }
        }
      )
      const data = await res.json()
      if (Array.isArray(data)) setSubscribers(data)
      else console.error('useSubscribers unexpected response:', data)
    } catch (e) {
      console.error('useSubscribers error:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchSubscribers() }, [creatorId])
  return { subscribers, loading, refetch: fetchSubscribers }
}
