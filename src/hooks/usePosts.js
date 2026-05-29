import { useState, useEffect } from 'react'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export function usePosts(creatorId, accessToken) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchPosts() {
    if (!creatorId) { setLoading(false); return }
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/posts?creator_id=eq.${creatorId}&order=published_at.desc`,
        {
          headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${accessToken || SB_KEY}`,
          }
        }
      )
      const data = await res.json()
      if (Array.isArray(data)) setPosts(data)
      else console.error('usePosts unexpected response:', data)
    } catch (e) {
      console.error('usePosts error:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchPosts() }, [creatorId])
  return { posts, loading, refetch: fetchPosts }
}
