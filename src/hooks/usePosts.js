import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function usePosts(creatorId) {
  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchPosts() {
    if (!creatorId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('creator_id', creatorId)
      .order('published_at', { ascending: false })

    if (!error) setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchPosts() }, [creatorId])

  return { posts, loading, refetch: fetchPosts }
}