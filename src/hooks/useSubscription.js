import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useSubscription(fanId, creatorId) {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!fanId || !creatorId) { setLoading(false); return }
    supabase
      .from('subscriptions')
      .select('id')
      .eq('fan_id', fanId)
      .eq('creator_id', creatorId)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        setSubscribed(!!data)
        setLoading(false)
      })
  }, [fanId, creatorId])

  async function subscribe() {
    await supabase.from('subscriptions').insert({
      fan_id: fanId, creator_id: creatorId, status: 'active'
    })
    setSubscribed(true)
  }

  async function unsubscribe() {
    await supabase.from('subscriptions').update({ status: 'cancelled' })
      .eq('fan_id', fanId)
      .eq('creator_id', creatorId)
    setSubscribed(false)
  }

  return { subscribed, loading, subscribe, unsubscribe }
}