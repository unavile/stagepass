import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { usePublicEvents } from './hooks/useEvents'
import { useFanEvents } from './hooks/useFanEvents'
import LiveRoom from './LiveRoom'
import FanLoginModal from './FanLoginModal'

// Parse YYYY-MM-DD as local date — avoids UTC timezone shift
function parseLocalDate(s) { if (!s) return new Date(); const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }

// ─── Design tokens ──────────────────────────────────────────────────────────
const BG      = '#09090b'
const BG2     = '#111114'
const BG3     = '#18181c'
const BORDER  = 'rgba(255,255,255,0.08)'
const BORDER2 = 'rgba(255,255,255,0.04)'
const TEXT1   = '#f4f0e8'
const TEXT2   = '#9a9690'
const TEXT3   = '#8c8883'
const ACCENT  = '#c9a84c'
const IMG_STAGE = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1920&q=80'

const card = (extra = {}) => ({
  background: 'rgba(17,17,20,0.75)',
  backdropFilter: 'blur(12px)',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  ...extra,
})

function Pill({ color, children }) {
  return (
    <span style={{
      background: color + '1a', color,
      border: `1px solid ${color}40`,
      borderRadius: 4, fontSize: 9, fontWeight: 700,
      padding: '2px 7px', letterSpacing: '0.14em',
      textTransform: 'uppercase', fontFamily: "'DM Mono', monospace"
    }}>{children}</span>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3,
      letterSpacing: '0.22em', textTransform: 'uppercase',
      marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10
    }}>
      {children}
      <div style={{ flex: 1, height: 1, background: BORDER2 }} />
    </div>
  )
}

// Returns the event's full start datetime
function eventStartDateTime(event) {
  if (!event?.event_date) return null
  const time = event.start_time || '00:00'
  const [h, m] = time.split(':').map(Number)
  const d = parseLocalDate(event.event_date)
  d.setHours(h, m, 0, 0)
  return d
}

// Returns how many minutes until the event starts (negative = already started)
function minutesUntilStart(event) {
  const start = eventStartDateTime(event)
  if (!start) return null
  return Math.round((start - new Date()) / 60000)
}

// Event is "active" (fan can join) if it started up to 24 hours ago
// or starts within the next 30 minutes
function isEventActive(event) {
  const mins = minutesUntilStart(event)
  if (mins === null) return false
  return mins <= 30 && mins >= -24 * 60
}

// Human-readable label for when the event starts
function eventStartsInLabel(event) {
  const mins = minutesUntilStart(event)
  if (mins === null) return ''
  if (mins <= 0) return 'Live now'
  if (mins < 60) return `Starts in ${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `Starts in ${hrs}h ${rem}m` : `Starts in ${hrs}h`
}

function Avatar({ c, size = 50 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: BG3, border: `2px solid ${ACCENT}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Serif Display', Georgia, serif",
      fontSize: Math.round(size * 0.34), color: ACCENT,
      overflow: 'hidden', flexShrink: 0,
      boxShadow: `0 0 16px ${ACCENT}22`,
    }}>
      {c.profiles?.avatar_url ? (
        <img src={c.profiles.avatar_url} alt={c.profiles?.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        (c.profiles?.display_name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2)
      )}
    </div>
  )
}

const TABS = [
  { id: 'search',   icon: '⊕', label: 'Discover' },
  { id: 'artists',  icon: '♪',  label: 'Artists'  },
  { id: 'myevents', icon: '◈',  label: 'Events'   },
  { id: 'profile',  icon: '◉',  label: 'Me'       },
]

const CATEGORIES = ['All', 'Music', 'Dance', 'Comedy', 'Modeling', 'Art', 'Other']
const typeLabels = { video: 'VIDEO', audio: 'AUDIO', event: 'EVENT', text: 'JOURNAL' }

// ─── Main component (no props required — public page) ────────────────────────
export default function FanApp({ deepHandle }) {
  // Optional fan session — fans can browse without logging in
  const [fanSession, setFanSession] = useState(null)
  const [fanProfile, setFanProfile] = useState(null)

  // Navigation
  const [activeTab, setActiveTab] = useState('search')
  const [selected, setSelected] = useState(null)

  // Creator data
  const [allCreators, setAllCreators] = useState([])
  const [subscribedIds, setSubscribedIds] = useState(new Set())
  const [creatorLoading, setCreatorLoading] = useState(true)

  // Creator page state
  const [posts, setPosts] = useState([])
  const [subscribed, setSubscribed] = useState(false)
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [eventRsvps, setEventRsvps] = useState({})

  // Search / filter
  const [searchQuery, setSearchQuery] = useState('')
  const [searchCategory, setSearchCategory] = useState('All')

  // Login modal
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginModalMessage, setLoginModalMessage] = useState('')
  const [pendingAction, setPendingAction] = useState(null) // 'subscribe' | 'buyTicket' | 'rsvp'
  const [pendingEventId, setPendingEventId] = useState(null)
  const [pendingEventAccessType, setPendingEventAccessType] = useState(null)
  const [fanEventFilter, setFanEventFilter] = useState('current')
  const [creatorEventFilter, setCreatorEventFilter] = useState('current')

  // Live room
  const [liveEvent, setLiveEvent] = useState(null)
  const [guestJoinEvent, setGuestJoinEvent] = useState(null)
  const [showDonateModal, setShowDonateModal] = useState(false)
  const [videoPost, setVideoPost] = useState(null) // post object for video popup
  const [donateAmount, setDonateAmount] = useState('10')
  const [donateLoading, setDonateLoading] = useState(false) // event pending guest name entry
  const [guestName, setGuestName] = useState('')

  const { events: creatorEvents } = usePublicEvents(selected?.id)
  const { events: fanEvents, loading: fanEventsLoading, refetch: refetchFanEvents } = useFanEvents(fanSession?.user?.id, fanSession?.access_token)

  // ── Fan session — restore from localStorage on mount, persist across refreshes ─
  useEffect(() => {
    // ── Restore session from localStorage on mount ────────────────────────────
    async function tryRestoreSession() {
      try {
        const projectRef = import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]
        const storageKey = `sb-${projectRef}-auth-token`
        const stored = localStorage.getItem(storageKey)
        if (!stored) return

        const tokenData = JSON.parse(stored)
        const expiresAt = tokenData.expires_at || 0
        const nowSecs = Math.floor(Date.now() / 1000)

        // Check if token is still valid
        if (!tokenData?.access_token || !tokenData?.user || expiresAt <= nowSecs) {
          localStorage.removeItem(storageKey)
          return
        }

        // Reject creator accounts in fan portal
        const sbUrl = import.meta.env.VITE_SUPABASE_URL
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const res = await fetch(
          `${sbUrl}/rest/v1/profiles?select=*&id=eq.${tokenData.user.id}&limit=1`,
          { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${tokenData.access_token}` } }
        )
        const profiles = await res.json()
        const profile = profiles?.[0]
        if (profile?.role === 'creator') {
          console.log('Creator account detected in fan portal — clearing session')
          localStorage.removeItem(storageKey)
          return
        }

        // Restore the session
        setFanSession({ user: tokenData.user, access_token: tokenData.access_token })
        if (profile) setFanProfile(profile)
      } catch (e) {
        console.error('Fan session restore error:', e)
      }
    }

    tryRestoreSession()

    // Listen for sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const sbUrl = import.meta.env.VITE_SUPABASE_URL
        const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const res = await fetch(
          `${sbUrl}/rest/v1/profiles?select=*&id=eq.${session.user.id}&limit=1`,
          { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${session.access_token}` } }
        )
        const profiles = await res.json()
        const profile = profiles?.[0]
        if (profile?.role === 'creator') {
          console.log('Creator account detected in fan portal — ignoring session')
          await supabase.auth.signOut()
          return
        }
        setFanSession(session)
        if (profile) setFanProfile(profile)
      }
      if (event === 'SIGNED_OUT') {
        setFanSession(null)
        setFanProfile(null)
        setSubscribedIds(new Set())
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  /* ── Load all creators (public, no auth needed) ───────────────────────────
  useEffect(() => {
    supabase
      .from('creators')
      .select('*, profiles(display_name, handle, bio, avatar_url)')
      .then(({ data, error }) => {
        if (error) console.error('creators error:', error.message)
        setAllCreators(data || [])
        setCreatorLoading(false)
      })
  }, []) */

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/creators?select=*,profiles(display_name,handle,bio,avatar_url)`
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      }
    })
      .then(r => r.json())
      .then(data => {
        console.log('creators loaded:', data?.length)
        setAllCreators(Array.isArray(data) ? data : [])
        setCreatorLoading(false)
      })
      .catch(err => {
        console.error('creators fetch error:', err)
        setCreatorLoading(false)
      })
  }, [])

  // ── Deep link: auto-open creator if handle in URL ────────────────────────
  useEffect(() => {
    if (!deepHandle || creatorLoading || allCreators.length === 0) return
    const match = allCreators.find(c =>
      c.profiles?.handle?.toLowerCase() === deepHandle.toLowerCase()
    )
    if (match) selectCreator(match)
  }, [deepHandle, creatorLoading, allCreators])

  // ── Load subscriptions when fan logs in ─────────────────────────────────
  useEffect(() => {
    if (!fanSession) { setSubscribedIds(new Set()); return }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/subscriptions?select=creator_id&fan_id=eq.${fanSession.user.id}&status=eq.active`
    fetch(url, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${fanSession.access_token}`,
      }
    })
      .then(r => r.json())
      .then(data => setSubscribedIds(new Set((Array.isArray(data) ? data : []).map(s => s.creator_id))))
      .catch(() => setSubscribedIds(new Set()))
  }, [fanSession])

  // ── Reset loading states when user navigates back from external pages ──────
  // Stripe redirects back via browser history — React state is preserved
  // so donateLoading / subscribeLoading stay true unless we reset them here
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setDonateLoading(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // ── Select a creator to view their page ─────────────────────────────────
  async function selectCreator(c) {
    setSelected(c)
    setPosts([])
    setSubscribed(false)
    setEventRsvps({})
    setCreatorEventFilter('current')

    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    // Fetch posts (public)
    const postsRes = await fetch(
      `${sbUrl}/rest/v1/posts?creator_id=eq.${c.id}&order=published_at.desc`,
      { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` } }
    )
    const postsData = await postsRes.json()
    setPosts(Array.isArray(postsData) ? postsData : [])

    if (fanSession) {
      const fanHeaders = { 'apikey': sbKey, 'Authorization': `Bearer ${fanSession.access_token}` }

      // Check subscription status — use subscribedIds first (already fetched), fall back to DB
      if (subscribedIds.has(c.id)) {
        setSubscribed(true)
      } else {
        const subRes = await fetch(
          `${sbUrl}/rest/v1/subscriptions?fan_id=eq.${fanSession.user.id}&creator_id=eq.${c.id}&status=eq.active&select=id&limit=1`,
          { headers: fanHeaders }
        )
        const subData = await subRes.json()
        setSubscribed(Array.isArray(subData) && subData.length > 0)
      }

      // Fetch RSVPs for this fan
      const rsvpRes = await fetch(
        `${sbUrl}/rest/v1/rsvps?fan_id=eq.${fanSession.user.id}&select=event_id`,
        { headers: fanHeaders }
      )
      const rsvpData = await rsvpRes.json()
      const rsvpMap = {}
      if (Array.isArray(rsvpData)) rsvpData.forEach(r => { rsvpMap[r.event_id] = true })
      setEventRsvps(rsvpMap)
    }
  }

  async function handleSubscribe() {
    if (!fanSession) {
      setLoginModalMessage('Sign in to subscribe to this creator.')
      setPendingAction('subscribe')
      setShowLoginModal(true)
      return
    }
    if (!selected) return
    setSubscribeLoading(true)
    try {
      const res = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: selected.id,
          creatorName: selected.profiles?.display_name,
          monthlyPrice: selected.monthly_price,
          fanId: fanSession.user.id,
          fanEmail: fanSession.user.email,
        })
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
    }
    setSubscribeLoading(false)
  }

  async function handleDonate() {
    if (!fanSession) {
      setLoginModalMessage('Sign in to support this creator.')
      setShowLoginModal(true)
      return
    }
    setDonateAmount('10')
    setShowDonateModal(true)
  }

  async function submitDonation() {
    const amount = parseFloat(donateAmount)
    if (!amount || amount < 1) return
    setDonateLoading(true)
    try {
      const res = await fetch('/.netlify/functions/create-donation-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: selected.id,
          creatorName: selected.profiles?.display_name,
          fanId: fanSession.user.id,
          fanEmail: fanSession.user.email,
          amountCents: Math.round(amount * 100),
        }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error('Donate error:', err)
      setDonateLoading(false)
    }
  }

  async function handleUnsubscribe() {
    if (!fanSession || !selected) return
    try {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const authHeaders = {
        'apikey': sbKey,
        'Authorization': `Bearer ${fanSession.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      }

      // 1. Fetch the stripe_subscription_id for this subscription
      const res = await fetch(
        `${sbUrl}/rest/v1/subscriptions?fan_id=eq.${fanSession.user.id}&creator_id=eq.${selected.id}&status=eq.active&select=stripe_subscription_id&limit=1`,
        { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${fanSession.access_token}` } }
      )
      const rows = await res.json()
      const stripeSubId = rows?.[0]?.stripe_subscription_id

      // 2. Cancel in Stripe (via netlify function) if we have a stripe sub id
      if (stripeSubId) {
        await fetch('/.netlify/functions/cancel-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripeSubscriptionId: stripeSubId }),
        })
      }

      // 3. Update status in Supabase via native fetch
      // Use service role key via Netlify function to ensure RLS doesn't block the update
      const cancelDbRes = await fetch('/.netlify/functions/cancel-fan-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fanId: fanSession.user.id,
          creatorId: selected.id,
        }),
      })
      const cancelDbData = await cancelDbRes.json().catch(() => ({}))
      if (!cancelDbRes.ok) {
        console.error('Subscription DB cancel failed:', cancelDbData)
      } else {
        console.log('Subscription cancelled in DB successfully')
      }

      // 4. Cancel RSVPs for non-free events from this creator
      const eventsRes = await fetch(
        `${sbUrl}/rest/v1/events?creator_id=eq.${selected.id}&access_type=not.eq.free&select=id`,
        { headers: authHeaders }
      )
      const nonFreeEvents = await eventsRes.json()
      if (Array.isArray(nonFreeEvents) && nonFreeEvents.length > 0) {
        const eventIds = nonFreeEvents.map(e => e.id)
        await fetch(
          `${sbUrl}/rest/v1/rsvps?fan_id=eq.${fanSession.user.id}&event_id=in.(${eventIds.join(',')})`,
          { method: 'DELETE', headers: { ...authHeaders, 'Prefer': 'return=minimal' } }
        )
        console.log('Cancelled RSVPs for non-free events:', eventIds.length, 'events:', eventIds)
      }

      // 5. Update local state
      setSubscribed(false)
      setSubscribedIds(prev => { const n = new Set(prev); n.delete(selected.id); return n })
    } catch (err) {
      console.error('Unsubscribe error:', err)
    }
  }

  async function handleBuyTicket(event) {
    if (!fanSession) {
      setLoginModalMessage('Sign in to purchase a ticket.')
      setShowLoginModal(true)
      return
    }
    try {
      const res = await fetch('/.netlify/functions/create-ticket-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventName: event.name,
          ticketPrice: event.ticket_price,
          fanId: fanSession.user.id,
          fanEmail: fanSession.user.email,
        })
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      console.error('Ticket checkout error:', err)
    }
  }

  async function handleRsvp(eventId, eventAccessType) {
    if (!fanSession) {
      setLoginModalMessage('Sign in to RSVP to events.')
      setPendingAction('rsvp')
      setPendingEventId(eventId)
      setPendingEventAccessType(eventAccessType)
      setShowLoginModal(true)
      return
    }

    // Re-check subscription status before allowing RSVP for non-free events
    // This prevents stale state from allowing free RSVPs after unsubscribing
    if (eventAccessType && eventAccessType !== 'free') {
      const creatorId = selected?.id
      if (creatorId && !subscribedIds.has(creatorId)) {
        console.warn('RSVP blocked: fan is not subscribed to this creator')
        return
      }
    }

    const sbUrl = import.meta.env.VITE_SUPABASE_URL
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const authHeaders = {
      'apikey': sbKey,
      'Authorization': `Bearer ${fanSession.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    }

    const already = eventRsvps[eventId]
    if (already) {
      await fetch(
        `${sbUrl}/rest/v1/rsvps?event_id=eq.${eventId}&fan_id=eq.${fanSession.user.id}`,
        { method: 'DELETE', headers: authHeaders }
      )
      setEventRsvps(prev => ({ ...prev, [eventId]: false }))
    } else {
      const res = await fetch(`${sbUrl}/rest/v1/rsvps`, {
        method: 'POST',
        headers: { ...authHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ event_id: eventId, fan_id: fanSession.user.id }),
      })
      if (res.ok) setEventRsvps(prev => ({ ...prev, [eventId]: true }))
    }
    refetchFanEvents()
  }

  // Derived lists
  const subscribedCreators = allCreators.filter(c => subscribedIds.has(c.id))
  const unsubscribedCreators = allCreators
    .filter(c => !subscribedIds.has(c.id))
    .filter(c => {
      if (searchCategory === 'All') return true
      if (searchCategory === 'Other') {
        const known = ['Music','Dance','Comedy','Modeling','Art','Other']
        return !known.includes(c.category) || c.category === 'Other'
      }
      return c.category === searchCategory
    })
    .filter(c => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        c.profiles?.display_name?.toLowerCase().includes(q) ||
        c.profiles?.handle?.toLowerCase().includes(q) ||
        c.profiles?.bio?.toLowerCase().includes(q)
      )
    })

  // ─── Creator page ─────────────────────────────────────────────────────────
  function CreatorPage() {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 16px 80px' }}>
        {/* Header */}
        <div style={{
          background: 'rgba(17,17,20,0.82)', backdropFilter: 'blur(20px)',
          border: `1px solid ${ACCENT}22`, borderRadius: 16, padding: '20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <Avatar c={selected} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: TEXT1, lineHeight: 1.2 }}>{selected.profiles?.display_name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, marginTop: 2 }}>@{selected.profiles?.handle}</div>
              {selected.category && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, marginTop: 4 }}>{selected.category.toUpperCase()}</div>}
              {selected.profiles?.bio && <p style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6, margin: '8px 0 0' }}>{selected.profiles.bio}</p>}
            </div>
          </div>
          {/* Subscribe block — only shown if creator has paid_subscribers enabled */}
          {selected?.paid_subscribers !== false && (
            subscribed ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ background: ACCENT + '14', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 7, padding: '7px 14px', fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.1em' }}>✓ SUBSCRIBED</div>
                <button onClick={handleUnsubscribe} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '7px 14px', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: '0.1em' }}>CANCEL</button>
              </div>
            ) : (
              <button onClick={handleSubscribe} disabled={subscribeLoading} style={{
                width: '100%', background: ACCENT, color: '#080808',
                border: 'none', borderRadius: 8, padding: '12px',
                fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
                letterSpacing: '0.12em', cursor: subscribeLoading ? 'not-allowed' : 'pointer',
                opacity: subscribeLoading ? 0.7 : 1, boxShadow: `0 4px 24px ${ACCENT}50`,
              }}>
                {subscribeLoading ? 'REDIRECTING...' : `SUBSCRIBE · $${selected.monthly_price}/mo`}
              </button>
            )
          )}
          {/* Donate button — only shown if creator has accept_donations enabled */}
          {selected?.accept_donations && (
            <button onClick={handleDonate} style={{
              width: '100%', background: 'transparent',
              border: `1px solid ${ACCENT}55`, borderRadius: 8, padding: '11px',
              fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
              letterSpacing: '0.12em', cursor: 'pointer', color: ACCENT,
              marginTop: selected?.paid_subscribers !== false ? 8 : 0,
            }}>
              💛 SUPPORT / DONATE
            </button>
          )}
        </div>

        {/* Posts */}
        <SectionLabel>Posts</SectionLabel>
        {posts.length === 0 ? (
          <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: 'center', padding: '32px 0' }}>No posts yet.</div>
        ) : posts.map(post => {
          const canView = !post.is_locked || subscribed
          return (
            <div key={post.id} style={{ ...card({ padding: '14px 16px', marginBottom: 10 }), opacity: canView ? 1 : 0.55 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 38, height: 38, background: BG3, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{post.thumbnail_emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: canView ? TEXT1 : TEXT3, marginBottom: 4 }}>{post.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Pill color={TEXT2}>{typeLabels[post.type]}</Pill>
                    {post.is_locked ? (!subscribed ? <Pill color={ACCENT}>SUBSCRIBERS ONLY</Pill> : <Pill color={ACCENT}>✓ UNLOCKED</Pill>) : <Pill color='#6dbf8a'>FREE</Pill>}
                  </div>
                </div>
                {post.is_locked && !subscribed && <span style={{ color: TEXT3, fontSize: 15 }}>🔒</span>}
              </div>
              {canView && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER2}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Left column: play/media button */}
                  {post.file_url && (
                    <div style={{ flexShrink: 0 }}>
                      {post.type === 'video' && (
                        <button
                          onClick={() => setVideoPost(post)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            cursor: 'pointer', display: 'inline-flex',
                            flexDirection: 'column', alignItems: 'center', gap: 4,
                          }}
                        >
                          <img
                            src="data:image/png;base64,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"
                            alt="Play video"
                            style={{ width: 44, height: 44, borderRadius: 10 }}
                          />
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: 9,
                            color: ACCENT, letterSpacing: '0.08em',
                          }}>PLAY</span>
                        </button>
                      )}
                      {post.type === 'audio' && <audio controls src={post.file_url} style={{ width: 180 }} />}
                      {post.type === 'text' && (
                        <a href={post.file_url} target="_blank" rel="noreferrer" style={{
                          color: ACCENT, fontFamily: "'DM Mono', monospace", fontSize: 11,
                          display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{ fontSize: 28 }}>📖</span>
                          <span style={{ fontSize: 9, letterSpacing: '0.08em' }}>OPEN PDF</span>
                        </a>
                      )}
                    </div>
                  )}
                  {/* Right column: description */}
                  {post.description && (
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: TEXT2, lineHeight: 1.7, paddingTop: 2 }}>
                      {post.description}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Events */}
        {creatorEvents.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <SectionLabel>Events</SectionLabel>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['current', 'past'].map(f => (
                <button key={f} onClick={() => setCreatorEventFilter(f)} style={{
                  background: creatorEventFilter === f ? ACCENT : 'rgba(17,17,20,0.7)',
                  color: creatorEventFilter === f ? '#080808' : TEXT3,
                  border: creatorEventFilter === f ? 'none' : `1px solid ${BORDER}`,
                  borderRadius: 20, padding: '5px 14px',
                  fontFamily: "'DM Mono', monospace", fontSize: 9,
                  fontWeight: creatorEventFilter === f ? 700 : 400,
                  letterSpacing: '0.1em', cursor: 'pointer',
                  boxShadow: creatorEventFilter === f ? `0 4px 12px ${ACCENT}40` : 'none',
                }}>{f === 'current' ? 'CURRENT & UPCOMING' : 'PAST'}</button>
              ))}
            </div>
            {(() => {
              const todayStr = new Date().toISOString().split('T')[0]
              const filtered = creatorEvents.filter(e =>
                creatorEventFilter === 'current' ? e.event_date >= todayStr : e.event_date < todayStr
              )
              if (filtered.length === 0) return (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, padding: '12px 0' }}>
                  No {creatorEventFilter === 'current' ? 'upcoming' : 'past'} events.
                </div>
              )
              return filtered.map(event => (
              <div key={event.id} style={{
                background: 'rgba(17,17,20,0.75)', backdropFilter: 'blur(16px)',
                border: `1px solid ${ACCENT}22`, borderRadius: 12, padding: '16px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 16, color: TEXT1, marginBottom: 2 }}>{event.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: ACCENT, fontWeight: 700 }}>
                      {parseLocalDate(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <span style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                    {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                  </span>
                </div>
                {event.description && <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.55, marginBottom: 10 }}>{event.description}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Access badge */}
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: event.access_type === 'free' ? '#6dbf8a' : event.access_type === 'ticketed' ? ACCENT : TEXT2, marginRight: 4 }}>
                    {event.access_type === 'free' ? '🌐 Free for All' : event.access_type === 'ticketed' ? `🎟 $${event.ticket_price} / ticket` : '🔑 Subscribers Only'}
                  </div>
                  {/* Subscriber: can always RSVP free */}
                  {subscribed && (
                    <button onClick={() => handleRsvp(event.id, event.access_type)} style={{
                      background: eventRsvps[event.id] ? 'rgba(255,255,255,0.06)' : ACCENT,
                      color: eventRsvps[event.id] ? TEXT2 : '#080808',
                      border: `1px solid ${eventRsvps[event.id] ? BORDER : 'transparent'}`,
                      borderRadius: 7, padding: '7px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
                    }}>
                      {eventRsvps[event.id] ? "✓ RSVP'D — CANCEL" : 'RSVP (FREE)'}
                    </button>
                  )}
                  {/* Non-subscriber: options depend on access_type */}
                  {!subscribed && event.access_type === 'free' && (
                    <button onClick={() => handleRsvp(event.id, 'free')} style={{
                      background: eventRsvps[event.id] ? 'rgba(255,255,255,0.06)' : ACCENT,
                      color: eventRsvps[event.id] ? TEXT2 : '#080808',
                      border: `1px solid ${eventRsvps[event.id] ? BORDER : 'transparent'}`,
                      borderRadius: 7, padding: '7px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
                    }}>
                      {eventRsvps[event.id] ? "✓ RSVP'D — CANCEL" : 'RSVP FREE'}
                    </button>
                  )}
                  {!subscribed && event.access_type === 'subscribers' && selected?.paid_subscribers !== false && (
                    <button onClick={handleSubscribe} style={{
                      background: ACCENT + '14', color: ACCENT, border: `1px solid ${ACCENT}40`,
                      borderRadius: 7, padding: '7px 14px', fontFamily: "'DM Mono', monospace",
                      fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em',
                    }}>SUBSCRIBE TO ATTEND · ${selected?.monthly_price}/mo</button>
                  )}
                  {!subscribed && event.access_type === 'ticketed' && (
                    <button onClick={() => handleBuyTicket(event)} style={{
                      background: ACCENT, color: '#080808', border: 'none',
                      borderRadius: 7, padding: '7px 14px', fontFamily: "'DM Mono', monospace",
                      fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
                      boxShadow: `0 4px 14px ${ACCENT}40`,
                    }}>BUY TICKET · ${event.ticket_price}</button>
                  )}
                  {/* Join Live button — logged in fans with RSVP */}
                  {event.daily_room_name && eventRsvps[event.id] && isEventActive(event) && fanSession && (
                    <button onClick={() => setLiveEvent(event)} style={{
                      background: ACCENT, color: '#080808', border: 'none',
                      borderRadius: 7, padding: '7px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
                      boxShadow: `0 4px 14px ${ACCENT}50`,
                    }}>🎙 JOIN LIVE</button>
                  )}
                  {/* Guest JOIN LIVE — free events, no login required */}
                  {event.daily_room_name && event.access_type === 'free' && isEventActive(event) && !fanSession && (
                    <button onClick={() => { setGuestJoinEvent(event); setGuestName('') }} style={{
                      background: ACCENT, color: '#080808', border: 'none',
                      borderRadius: 7, padding: '7px 14px',
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em',
                      boxShadow: `0 4px 14px ${ACCENT}50`,
                    }}>🎙 JOIN LIVE (FREE)</button>
                  )}
                </div>
              </div>
              ))
            })()}
          </div>
        )}
      </div>
    )
  }

  // ─── Page render ──────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', color: TEXT1,
      backgroundImage: `
        linear-gradient(to bottom,
          rgba(9,9,11,0.72) 0%,
          rgba(9,9,11,0.88) 40%,
          rgba(9,9,11,0.97) 100%
        ),
        url('${IMG_STAGE}')
      `,
      backgroundSize: 'cover',
      backgroundPosition: 'center 30%',
      backgroundAttachment: 'scroll',
      overflowX: 'hidden', width: '100%',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Accent glow */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: 400, background: `radial-gradient(ellipse at 20% 0%, ${ACCENT}08 0%, transparent 60%)`, pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Top nav ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 56,
        borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 0,
        background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(24px)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selected && (
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: TEXT3, fontSize: 18, cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>←</button>
          )}
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: ACCENT }}>Coveted Stage</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {fanSession && fanProfile && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3 }}>@{fanProfile.handle}</span>
          )}
          {fanSession && (
            <button onClick={() => supabase.auth.signOut()} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '5px 10px', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.08em', cursor: 'pointer' }}>
              SIGN OUT
            </button>
          )}
          <a href="/creator" style={{ background: ACCENT + '14', color: ACCENT, border: `1px solid ${ACCENT}35`, borderRadius: 7, padding: '5px 12px', fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            🎤 CREATOR
          </a>
        </div>
      </nav>

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, paddingBottom: 70 }}>

        {/* Creator page overlay */}
        {selected ? <CreatorPage /> : (
          <>

          {/* ── DISCOVER / SEARCH ── */}
          {activeTab === 'search' && (
            <div style={{ padding: '20px 16px', maxWidth: 960, margin: '0 auto' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1, lineHeight: 1.2, marginBottom: 4 }}>
                  Discover <span style={{ color: ACCENT }}>Artists</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.18em' }}>FIND CREATORS TO SUPPORT</div>
              </div>

              {/* Search input */}
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, handle or bio..."
                style={{
                  width: '100%', background: 'rgba(17,17,20,0.8)',
                  backdropFilter: 'blur(8px)', border: `1px solid ${BORDER}`,
                  borderRadius: 9, padding: '11px 16px', color: TEXT1,
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                  outline: 'none', marginBottom: 12, boxSizing: 'border-box',
                }}
              />

              {/* Category filters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSearchCategory(cat)} style={{
                    background: searchCategory === cat ? ACCENT : 'rgba(17,17,20,0.7)',
                    color: searchCategory === cat ? '#080808' : TEXT3,
                    border: searchCategory === cat ? 'none' : `1px solid ${BORDER}`,
                    borderRadius: 20, padding: '6px 14px',
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    fontWeight: searchCategory === cat ? 700 : 400,
                    letterSpacing: '0.1em', cursor: 'pointer',
                    boxShadow: searchCategory === cat ? `0 4px 14px ${ACCENT}40` : 'none',
                    transition: 'all 0.15s',
                  }}>{cat.toUpperCase()}</button>
                ))}
              </div>

              {creatorLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading artists...</div>
              ) : unsubscribedCreators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                  {allCreators.length === 0 ? 'No artists yet. Check back soon.' : 'No artists found for this filter.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {unsubscribedCreators.map(c => (
                    <div key={c.id} onClick={() => selectCreator(c)}
                      style={{ background: 'rgba(17,17,20,0.72)', backdropFilter: 'blur(16px)', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT + '55'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                        <Avatar c={c} size={72} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: TEXT1, marginBottom: 2 }}>{c.profiles?.display_name || 'Creator'}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, marginBottom: 4, letterSpacing: '0.08em' }}>@{c.profiles?.handle || 'creator'}</div>
                          {c.category && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, marginBottom: 6, letterSpacing: '0.1em' }}>{c.category.toUpperCase()}</div>}
                          {c.profiles?.bio && (
                          <div style={{
                            fontSize: 11, color: TEXT3, lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>{c.profiles.bio}</div>
                        )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${BORDER2}` }}>
                        {c.paid_subscribers !== false ? (
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: ACCENT, fontWeight: 700 }}>${c.monthly_price}<span style={{ fontSize: 9, color: TEXT3, fontWeight: 400 }}>/mo</span></div>
                        ) : (
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.1em' }}>FREE</div>
                        )}
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.1em' }}>VIEW →</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MY ARTISTS ── */}
          {activeTab === 'artists' && (
            <div style={{ padding: '20px 16px', maxWidth: 960, margin: '0 auto' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1 }}>
                  My <span style={{ color: ACCENT }}>Artists</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.18em', marginTop: 4 }}>
                  {subscribedCreators.length} SUBSCRIPTION{subscribedCreators.length !== 1 ? 'S' : ''}
                </div>
              </div>
              {!fanSession ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, color: TEXT3 }}>♪</div>
                  <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 20 }}>Sign in to see your subscriptions.</div>
                  <button onClick={() => { setLoginModalMessage('Sign in to see your subscribed artists.'); setShowLoginModal(true) }} style={{ background: ACCENT, color: '#080808', border: 'none', borderRadius: 7, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em', boxShadow: `0 4px 16px ${ACCENT}40` }}>SIGN IN</button>
                </div>
              ) : subscribedCreators.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, color: TEXT3 }}>♪</div>
                  <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 20 }}>No subscriptions yet.</div>
                  <button onClick={() => setActiveTab('search')} style={{ background: ACCENT, color: '#080808', border: 'none', borderRadius: 7, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em', boxShadow: `0 4px 16px ${ACCENT}40` }}>FIND ARTISTS</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {subscribedCreators.map(c => (
                    <div key={c.id} onClick={() => selectCreator(c)}
                      style={{ background: 'rgba(17,17,20,0.72)', backdropFilter: 'blur(16px)', border: `1px solid ${ACCENT}30`, borderRadius: 16, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = ACCENT + '30'; e.currentTarget.style.transform = 'translateY(0)' }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                        <Avatar c={c} size={72} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: TEXT1, marginBottom: 2 }}>{c.profiles?.display_name || 'Creator'}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: ACCENT, marginBottom: 4, letterSpacing: '0.08em' }}>@{c.profiles?.handle}</div>
                          {c.category && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, marginBottom: 6, letterSpacing: '0.1em' }}>{c.category.toUpperCase()}</div>}
                          {c.profiles?.bio && (
                          <div style={{
                            fontSize: 11, color: TEXT3, lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>{c.profiles.bio}</div>
                        )}
                        </div>
                      </div>
                      <div style={{ paddingTop: 12, borderTop: `1px solid ${BORDER2}` }}>
                        <Pill color={ACCENT}>✓ SUBSCRIBED</Pill>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MY EVENTS ── */}
          {activeTab === 'myevents' && (
            <div style={{ padding: '20px 16px', maxWidth: 820, margin: '0 auto' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1 }}>
                  My <span style={{ color: ACCENT }}>Events</span>
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.18em', marginTop: 4 }}>YOUR RSVPS</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {['current', 'past'].map(f => (
                  <button key={f} onClick={() => setFanEventFilter(f)} style={{
                    background: fanEventFilter === f ? ACCENT : 'rgba(17,17,20,0.7)',
                    color: fanEventFilter === f ? '#080808' : TEXT3,
                    border: fanEventFilter === f ? 'none' : `1px solid ${BORDER}`,
                    borderRadius: 20, padding: '6px 18px',
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    fontWeight: fanEventFilter === f ? 700 : 400,
                    letterSpacing: '0.1em', cursor: 'pointer',
                    boxShadow: fanEventFilter === f ? `0 4px 12px ${ACCENT}40` : 'none',
                  }}>{f === 'current' ? 'CURRENT & UPCOMING' : 'PAST'}</button>
                ))}
              </div>
              {!fanSession ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, color: TEXT3 }}>◈</div>
                  <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 20 }}>Sign in to see your events.</div>
                  <button onClick={() => { setLoginModalMessage('Sign in to see your RSVPd events.'); setShowLoginModal(true) }} style={{ background: ACCENT, color: '#080808', border: 'none', borderRadius: 7, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em', boxShadow: `0 4px 16px ${ACCENT}40` }}>SIGN IN</button>
                </div>
              ) : fanEventsLoading ? (
                <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div>
              ) : fanEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, color: TEXT3 }}>◈</div>
                  <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 20 }}>No upcoming events.</div>
                  <button onClick={() => setActiveTab('artists')} style={{ background: ACCENT, color: '#080808', border: 'none', borderRadius: 7, padding: '10px 20px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.12em', boxShadow: `0 4px 16px ${ACCENT}40` }}>BROWSE ARTISTS</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(() => {
                    const todayStr = new Date().toISOString().split('T')[0]
                    const filteredRsvps = fanEvents.filter(r => {
                      const d = r.events?.event_date
                      return d ? (fanEventFilter === 'current' ? d >= todayStr : d < todayStr) : false
                    })
                    if (filteredRsvps.length === 0) return (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        No {fanEventFilter === 'current' ? 'upcoming' : 'past'} events.
                      </div>
                    )
                    return filteredRsvps.map(rsvp => {
                    const event = rsvp.events
                    if (!event) return null
                    const active = isEventActive(event)
                    return (
                      <div key={rsvp.id} style={{ background: 'rgba(17,17,20,0.75)', backdropFilter: 'blur(16px)', border: `1px solid ${active ? ACCENT + '55' : ACCENT + '22'}`, borderRadius: 14, padding: '18px 20px', boxShadow: active ? `0 4px 24px ${ACCENT}18` : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 17, color: TEXT1, marginBottom: 3 }}>{event.name}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: ACCENT, fontWeight: 700 }}>
                              {parseLocalDate(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                            {active && <span style={{ background: '#e8454518', color: '#e84545', border: '1px solid #e8454540', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>● LIVE NOW</span>}
                            <span style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>
                              {event.event_type === 'virtual' ? '💻 VIRTUAL' : '📍 IN PERSON'}
                            </span>
                            <span style={{ background: '#6dbf8a18', color: '#6dbf8a', border: '1px solid #6dbf8a40', borderRadius: 5, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace" }}>✓ RSVP'D</span>
                          </div>
                        </div>
                        {event.description && <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.55, marginBottom: 10 }}>{event.description}</div>}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                          {event.venue && <div style={{ fontSize: 11, color: TEXT3 }}>📍 {event.venue}</div>}
                          <div style={{ fontSize: 11, color: TEXT3 }}>By <span style={{ color: TEXT2 }}>{event.creators?.profiles?.display_name || 'Creator'}</span></div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {event.daily_room_name && (() => {
                            const mins = minutesUntilStart(rsvp.events)
                            const tooEarly = mins !== null && mins > 30
                            if (tooEarly) {
                              // Show countdown — don't allow entry yet
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ background: ACCENT + '14', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 7, padding: '9px 18px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.6 }}>
                                    🕐 {eventStartsInLabel(rsvp.events)}
                                  </div>
                                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.1em', paddingLeft: 4 }}>
                                    ROOM OPENS 30 MINS BEFORE START
                                  </div>
                                </div>
                              )
                            }
                            if (active) {
                              return <button onClick={() => setLiveEvent(rsvp.events)} style={{ background: ACCENT, color: '#080808', border: 'none', borderRadius: 7, padding: '9px 18px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em', boxShadow: `0 4px 16px ${ACCENT}50` }}>🎙 JOIN LIVE</button>
                            }
                            return <button onClick={() => setLiveEvent(rsvp.events)} style={{ background: ACCENT + '14', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 7, padding: '9px 18px', fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em' }}>🎙 ENTER ROOM</button>
                          })()}
                          <button onClick={async () => {
                              const sbUrl = import.meta.env.VITE_SUPABASE_URL
                              const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
                              await fetch(`${sbUrl}/rest/v1/rsvps?id=eq.${rsvp.id}&fan_id=eq.${fanSession.user.id}`, {
                                method: 'DELETE',
                                headers: { 'apikey': sbKey, 'Authorization': `Bearer ${fanSession.access_token}`, 'Prefer': 'return=minimal' }
                              })
                              refetchFanEvents()
                            }}
                            style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 7, padding: '9px 14px', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em' }}>CANCEL RSVP</button>
                        </div>
                      </div>
                    )
                    })
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ── MY PROFILE ── */}
          {activeTab === 'profile' && (
            <div style={{ padding: '20px 16px', maxWidth: 820, margin: '0 auto' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: TEXT1 }}>
                  My <span style={{ color: ACCENT }}>Profile</span>
                </div>
              </div>
              {fanSession && fanProfile ? (
                <div>
                  <div style={{ background: 'rgba(17,17,20,0.82)', backdropFilter: 'blur(20px)', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <div style={{ width: 60, height: 60, borderRadius: '50%', background: BG3, border: `2px solid ${ACCENT}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: ACCENT, overflow: 'hidden', flexShrink: 0 }}>
                        {fanProfile.avatar_url ? <img src={fanProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (fanProfile.display_name || 'F').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: TEXT1 }}>{fanProfile.display_name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: ACCENT, marginTop: 2 }}>@{fanProfile.handle}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 4 }}>{fanSession.user.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ ...card({ padding: '14px' }) }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 6 }}>SUBSCRIPTIONS</div>
                        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 26, color: ACCENT }}>{subscribedCreators.length}</div>
                      </div>
                      <div style={{ ...card({ padding: '14px' }) }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 6 }}>EVENTS</div>
                        <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 26, color: ACCENT }}>{fanEvents.length}</div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', background: 'transparent', color: TEXT3, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '11px', fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer' }}>SIGN OUT</button>
                </div>
              ) : (
                <div style={{ background: 'rgba(17,17,20,0.82)', backdropFilter: 'blur(20px)', border: `1px solid ${BORDER}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 14, color: TEXT3 }}>◉</div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: TEXT1, marginBottom: 8 }}>Browsing as guest</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: TEXT3, marginBottom: 24, lineHeight: 1.7 }}>
                    Sign in to subscribe to artists,<br />RSVP to events, and access exclusive content.
                  </div>
                  <button onClick={() => { setLoginModalMessage('Sign in to your fan account.'); setShowLoginModal(true) }} style={{ display: 'block', width: '100%', background: ACCENT, color: '#080808', border: 'none', borderRadius: 8, padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer', boxShadow: `0 4px 24px ${ACCENT}40`, marginBottom: 12 }}>
                    SIGN IN
                  </button>
                  <a href="/creator" style={{ display: 'block', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.1em', textDecoration: 'none', marginTop: 8 }}>
                    🎤 I'm a creator — <span style={{ color: ACCENT }}>go to creator portal</span>
                  </a>
                </div>
              )}
            </div>
          )}

          </>
        )}
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(9,9,11,0.96)', backdropFilter: 'blur(24px)',
        borderTop: `1px solid ${BORDER}`,
        display: 'flex', zIndex: 100, height: 60,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelected(null) }} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            background: 'none', border: 'none',
            borderTop: activeTab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
            color: activeTab === t.id ? ACCENT : TEXT3,
            cursor: 'pointer', fontFamily: "'DM Mono', monospace",
            fontSize: 8, letterSpacing: '0.08em', transition: 'color 0.15s',
          }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── Login modal ── */}
      {showLoginModal && (
        <FanLoginModal
          initialMessage={loginModalMessage}
          onSuccess={async () => {
            setShowLoginModal(false)
            // Native fetch bypasses onAuthStateChange — manually read session from localStorage
            try {
              const projectRef = import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]
              const stored = localStorage.getItem(`sb-${projectRef}-auth-token`)
              if (stored) {
                const tokenData = JSON.parse(stored)
                if (tokenData?.user?.id) {
                  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?select=*&id=eq.${tokenData.user.id}&limit=1`
                  const res = await fetch(url, {
                    headers: {
                      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                      'Authorization': `Bearer ${tokenData.access_token}`,
                    }
                  })
                  const profiles = await res.json()
                  const profile = profiles?.[0]
                  // Reject creator accounts — they belong on /creator not the fan portal
                  if (profile?.role === 'creator') {
                    const projectRef2 = import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]
                    localStorage.removeItem(`sb-${projectRef2}-auth-token`)
                    return
                  }
                  const newSession = { user: tokenData.user, access_token: tokenData.access_token }
                  setFanSession(newSession)
                  if (profile) setFanProfile(profile)

                  // ── Resume whatever the fan was trying to do before login ──
                  if (pendingAction === 'subscribe' && selected) {
                    setPendingAction(null)
                    try {
                      const checkoutRes = await fetch('/.netlify/functions/create-checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          creatorId: selected.id,
                          creatorName: selected.profiles?.display_name,
                          monthlyPrice: selected.monthly_price,
                          fanId: tokenData.user.id,
                          fanEmail: tokenData.user.email,
                        })
                      })
                      const { url: checkoutUrl, error: checkoutError } = await checkoutRes.json()
                      if (checkoutError) throw new Error(checkoutError)
                      window.location.href = checkoutUrl
                    } catch (err) {
                      console.error('Post-login checkout error:', err)
                    }
                  } else if (pendingAction === 'rsvp' && pendingEventId) {
                    setPendingAction(null)
                    const evtId = pendingEventId
                    setPendingEventId(null)
                    setPendingEventAccessType(null)
                    const sbUrl = import.meta.env.VITE_SUPABASE_URL
                    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
                    try {
                      // Execute the RSVP with the new session
                      const rsvpRes = await fetch(`${sbUrl}/rest/v1/rsvps`, {
                        method: 'POST',
                        headers: {
                          'apikey': sbKey,
                          'Authorization': `Bearer ${tokenData.access_token}`,
                          'Content-Type': 'application/json',
                          'Prefer': 'resolution=merge-duplicates,return=minimal',
                        },
                        body: JSON.stringify({ event_id: evtId, fan_id: tokenData.user.id }),
                      })
                      if (rsvpRes.ok) {
                        // Update RSVP state immediately so button shows RSVPd
                        setEventRsvps(prev => ({ ...prev, [evtId]: true }))
                      }
                    } catch (err) {
                      console.error('Post-login RSVP error:', err)
                    }
                    // Refresh creator page state so subscription + RSVPs are accurate
                    if (selected) {
                      const newSession = { user: tokenData.user, access_token: tokenData.access_token }
                      const fanHeaders = { 'apikey': sbKey, 'Authorization': `Bearer ${tokenData.access_token}` }
                      // Re-fetch subscription status for this creator
                      try {
                        const subRes = await fetch(
                          `${sbUrl}/rest/v1/subscriptions?fan_id=eq.${tokenData.user.id}&creator_id=eq.${selected.id}&status=eq.active&select=id&limit=1`,
                          { headers: fanHeaders }
                        )
                        const subData = await subRes.json()
                        setSubscribed(Array.isArray(subData) && subData.length > 0)
                      } catch {}
                      // Re-fetch all RSVPs for this fan
                      try {
                        const rsvpRes2 = await fetch(
                          `${sbUrl}/rest/v1/rsvps?fan_id=eq.${tokenData.user.id}&select=event_id`,
                          { headers: fanHeaders }
                        )
                        const rsvpData = await rsvpRes2.json()
                        if (Array.isArray(rsvpData)) {
                          const rsvpMap = {}
                          rsvpData.forEach(r => { rsvpMap[r.event_id] = true })
                          setEventRsvps(rsvpMap)
                        }
                      } catch {}
                    }
                  } else {
                    setPendingAction(null)
                    // Even with no pending action, refresh creator page if one is selected
                    if (selected) {
                      const sbUrl = import.meta.env.VITE_SUPABASE_URL
                      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
                      const fanHeaders = { 'apikey': sbKey, 'Authorization': `Bearer ${tokenData.access_token}` }
                      try {
                        const subRes = await fetch(
                          `${sbUrl}/rest/v1/subscriptions?fan_id=eq.${tokenData.user.id}&creator_id=eq.${selected.id}&status=eq.active&select=id&limit=1`,
                          { headers: fanHeaders }
                        )
                        const subData = await subRes.json()
                        setSubscribed(Array.isArray(subData) && subData.length > 0)
                      } catch {}
                      try {
                        const rsvpRes = await fetch(
                          `${sbUrl}/rest/v1/rsvps?fan_id=eq.${tokenData.user.id}&select=event_id`,
                          { headers: fanHeaders }
                        )
                        const rsvpData = await rsvpRes.json()
                        if (Array.isArray(rsvpData)) {
                          const rsvpMap = {}
                          rsvpData.forEach(r => { rsvpMap[r.event_id] = true })
                          setEventRsvps(rsvpMap)
                        }
                      } catch {}
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Post-login session load error:', e)
            }
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* ── Live room ── */}
      {liveEvent && (
        <LiveRoom
          event={liveEvent}
          profile={fanProfile || { display_name: guestName.trim() || 'Guest' }}
          isCreator={false}
          onLeave={() => setLiveEvent(null)}
          accessToken={fanSession?.access_token || null}
        />
      )}

      {/* ── Video popup player ── */}
      {videoPost && (
        <div
          onClick={() => setVideoPost(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 600,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 780, position: 'relative' }}
          >
            {/* Close button */}
            <button
              onClick={() => setVideoPost(null)}
              style={{
                position: 'absolute', top: -40, right: 0,
                background: 'none', border: 'none', color: TEXT2,
                fontSize: 22, cursor: 'pointer', lineHeight: 1,
              }}
            >✕</button>
            {/* Title */}
            <div style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 16, color: TEXT1, marginBottom: 10,
            }}>{videoPost.title}</div>
            {/* Player */}
            <video
              controls
              autoPlay
              controlsList="nodownload"
              onContextMenu={e => e.preventDefault()}
              src={videoPost.file_url}
              style={{ width: '100%', borderRadius: 10, maxHeight: '70vh', background: '#000' }}
            />
            {videoPost.description && (
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 11,
                color: TEXT3, marginTop: 10, lineHeight: 1.7,
              }}>{videoPost.description}</div>
            )}
          </div>
        </div>
      )}

      {/* ── Donation amount modal ── */}
      {showDonateModal && selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 360,
            background: 'rgba(17,17,20,0.97)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '28px 24px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          }}>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: TEXT1, marginBottom: 4 }}>
              Support {selected.profiles?.display_name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginBottom: 24, letterSpacing: '0.1em' }}>
              ONE-TIME DONATION
            </div>
            {/* Quick amount buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['5', '10', '25', '50'].map(amt => (
                <button key={amt} onClick={() => setDonateAmount(amt)} style={{
                  flex: 1, padding: '10px 0',
                  background: donateAmount === amt ? ACCENT + '22' : 'rgba(9,9,11,0.6)',
                  border: `1px solid ${donateAmount === amt ? ACCENT + '88' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, color: donateAmount === amt ? ACCENT : TEXT2,
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                  fontWeight: donateAmount === amt ? 700 : 400,
                  cursor: 'pointer', letterSpacing: '0.05em',
                }}>
                  ${amt}
                </button>
              ))}
            </div>
            {/* Custom amount input */}
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.1em', marginBottom: 8 }}>
              CUSTOM AMOUNT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <span style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 16 }}>$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={donateAmount}
                onChange={e => setDonateAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitDonation()}
                style={{
                  flex: 1, background: 'rgba(9,9,11,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, padding: '11px 14px', color: TEXT1,
                  fontFamily: "'DM Mono', monospace", fontSize: 14,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDonateModal(false)} style={{
                flex: 1, background: 'none', color: TEXT3,
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px',
                fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer',
              }}>CANCEL</button>
              <button
                onClick={submitDonation}
                disabled={donateLoading || !parseFloat(donateAmount) || parseFloat(donateAmount) < 1}
                style={{
                  flex: 2, background: ACCENT, color: '#080808',
                  border: 'none', borderRadius: 8, padding: '11px',
                  fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em',
                  cursor: (donateLoading || !parseFloat(donateAmount)) ? 'not-allowed' : 'pointer',
                  opacity: (donateLoading || !parseFloat(donateAmount)) ? 0.6 : 1,
                }}
              >
                {donateLoading ? 'REDIRECTING...' : `💛 DONATE $${parseFloat(donateAmount) || 0}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guest name prompt before joining a free live event ── */}
      {guestJoinEvent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            width: '100%', maxWidth: 360,
            background: 'rgba(17,17,20,0.97)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '28px 24px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          }}>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: TEXT1, marginBottom: 6 }}>
              Join Live Event
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: TEXT3, marginBottom: 20 }}>
              {guestJoinEvent.name}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.1em', marginBottom: 8 }}>
              YOUR DISPLAY NAME
            </div>
            <input
              autoFocus
              placeholder="e.g. Alex Chen"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && guestName.trim()) {
                  setLiveEvent(guestJoinEvent)
                  setGuestJoinEvent(null)
                }
              }}
              style={{
                width: '100%', background: 'rgba(9,9,11,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '11px 14px', color: TEXT1,
                fontFamily: "'DM Mono', monospace", fontSize: 12,
                outline: 'none', marginBottom: 16, boxSizing: 'border-box',
              }}
            />
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginBottom: 16, lineHeight: 1.7 }}>
              Joining as a guest — your camera and mic will be off.
              <span
                onClick={() => { setGuestJoinEvent(null); setShowLoginModal(true) }}
                style={{ color: ACCENT, cursor: 'pointer', marginLeft: 4 }}
              >Sign in instead →</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setGuestJoinEvent(null)} style={{
                flex: 1, background: 'none', color: TEXT3,
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px',
                fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer',
              }}>CANCEL</button>
              <button
                onClick={() => {
                  if (guestName.trim()) {
                    setLiveEvent(guestJoinEvent)
                    setGuestJoinEvent(null)
                  }
                }}
                disabled={!guestName.trim()}
                style={{
                  flex: 2, background: guestName.trim() ? ACCENT : ACCENT + '44',
                  color: '#080808', border: 'none', borderRadius: 8, padding: '11px',
                  fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.1em', cursor: guestName.trim() ? 'pointer' : 'not-allowed',
                }}
              >🎙 JOIN LIVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
