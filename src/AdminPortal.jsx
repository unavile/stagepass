import { useState, useEffect } from 'react'

// ─── Design tokens ──────────────────────────────────────────────────────────
const BG     = '#09090b'
const BG2    = '#0e0e11'
const BG3    = '#14141a'
const BORDER = 'rgba(255,255,255,0.08)'
const BORDER2= 'rgba(255,255,255,0.04)'
const TEXT1  = '#f4f0e8'
const TEXT2  = '#9a9690'
const TEXT3  = '#555250'
const ACCENT = '#c9a84c'
const RED    = '#e84545'
const GREEN  = '#6dbf8a'
const PLATFORM_FEE = 0.15

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {}),
    }
  })
  return res.json()
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⬡' },
  { id: 'creators',  label: 'Creators',  icon: '♪'  },
  { id: 'revenue',   label: 'Revenue',   icon: '◇'  },
  { id: 'notify',    label: 'Notify',    icon: '◎'  },
  { id: 'import',    label: 'Import',    icon: '↑'  },
]

// ─── CSV helpers ─────────────────────────────────────────────────────────────
const CREATOR_TEMPLATE = [
  'display_name,handle,email,category,monthly_price,bio',
  'Mara Voss,maravoss,mara@example.com,Music,9,"Singer-songwriter from Berlin"',
  'DJ Kemi,djkemi,kemi@example.com,Dance,12,"House and afrobeats DJ"',
].join('\n')

const EVENT_TEMPLATE = [
  'creator_handle,name,description,event_date,event_type,access_type,ticket_price,venue',
  'maravoss,Acoustic Session,"Intimate live set",2026-07-15,virtual,free,,',
  'djkemi,Summer Dance Night,"Dance workshop and set",2026-07-20,in_person,subscribers,,Fabric London',
  'nalini,Bharatanatyam Masterclass,"Full 90-min workshop",2026-08-01,in_person,ticketed,25.00,Arts Centre London',
].join('\n')

const CONTENT_TEMPLATE = [
  'creator_handle,title,description,type,access',
  'maravoss,Studio Diaries Ep1,"Behind the scenes in the studio",video,subscribers',
  'maravoss,Free Intro Track,"Sample my new EP",audio,free',
].join('\n')

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows = lines.slice(1).map(line => {
    const fields = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
      else { current += ch }
    }
    fields.push(current.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = fields[i] || '' })
    return obj
  })
  return { headers, rows }
}

function validateCreatorRow(row) {
  const errors = []
  if (!row.display_name) errors.push('Missing display_name')
  if (!row.handle) errors.push('Missing handle')
  if (!row.email || !row.email.includes('@')) errors.push('Invalid email')
  if (!['Music','Dance','Comedy'].includes(row.category)) errors.push('Category must be Music, Dance, or Comedy')
  if (!row.monthly_price || isNaN(parseFloat(row.monthly_price))) errors.push('Invalid monthly_price')
  return errors
}

function validateEventRow(row) {
  const errors = []
  if (!row.creator_handle) errors.push('Missing creator_handle')
  if (!row.name) errors.push('Missing name')
  if (!row.event_date) errors.push('Missing event_date')
  if (!['virtual','in_person'].includes(row.event_type)) errors.push('event_type must be virtual or in_person')
  if (!['free','subscribers','ticketed'].includes(row.access_type)) errors.push('access_type must be free, subscribers, or ticketed')
  if (row.access_type === 'ticketed' && (!row.ticket_price || isNaN(parseFloat(row.ticket_price)))) errors.push('ticket_price required for ticketed events')
  return errors
}

function validateContentRow(row) {
  const errors = []
  if (!row.creator_handle) errors.push('Missing creator_handle')
  if (!row.title) errors.push('Missing title')
  if (!['video','audio','text'].includes(row.type)) errors.push('type must be video, audio, or text')
  if (!['free','subscribers'].includes(row.access)) errors.push('access must be free or subscribers')
  return errors
}

// ─── Login screen ────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'stagepass-admin-2026'

  function handleLogin() {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('sp_admin', '1')
      onLogin()
    } else {
      setError('Incorrect password.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: 360, background: BG2, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: ACCENT, marginBottom: 4 }}>StagePass</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.2em' }}>ADMIN PORTAL</div>
        </div>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ width: '100%', background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '11px 14px', color: TEXT1, fontFamily: "'DM Mono', monospace", fontSize: 12, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
        />
        {error && <div style={{ color: RED, fontSize: 11, fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>{error}</div>}
        <button onClick={handleLogin} style={{ width: '100%', background: ACCENT, color: '#080808', border: 'none', borderRadius: 8, padding: '12px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', cursor: 'pointer', boxShadow: `0 4px 16px ${ACCENT}40` }}>
          SIGN IN
        </button>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, textDecoration: 'none' }}>← Back to StagePass</a>
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: accent || TEXT1, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: TEXT3, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Main portal ─────────────────────────────────────────────────────────────
export default function AdminPortal() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('sp_admin'))
  const [tab, setTab] = useState('dashboard')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [creators, setCreators] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [creatorSearch, setCreatorSearch] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Actions
  const [actionCreator, setActionCreator] = useState(null)
  const [actionType, setActionType] = useState(null)
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyAll, setNotifyAll] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionResult, setActionResult] = useState(null)

  // Import tab state
  const [importType, setImportType] = useState('creators')
  const [importRows, setImportRows] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  useEffect(() => {
    if (authed) loadData()
  }, [authed])

  async function loadData() {
    setLoading(true)
    const [creatorsData, subsData] = await Promise.all([
      sbFetch('creators?select=*,profiles(display_name,handle,bio,avatar_url)&order=created_at.desc'),
      sbFetch('subscriptions?select=creator_id&status=eq.active'),
    ])

    const creators = Array.isArray(creatorsData) ? creatorsData : []
    const subs = Array.isArray(subsData) ? subsData : []

    // Count active subscriptions per creator
    const subCounts = {}
    subs.forEach(s => {
      subCounts[s.creator_id] = (subCounts[s.creator_id] || 0) + 1
    })

    // Attach count to each creator
    const enriched = creators.map(c => ({
      ...c,
      subCount: subCounts[c.id] || 0,
    }))

    setCreators(enriched)
    setLoading(false)
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const totalGross = creators.reduce((s, c) => s + (c.subCount || 0) * (c.monthly_price || 0), 0)
  const platformRevenue = totalGross * PLATFORM_FEE
  const creatorPayouts = totalGross * (1 - PLATFORM_FEE)
  const totalSubs = creators.reduce((s, c) => s + (c.subCount || 0), 0)
  const activeCreators = creators.filter(c => !c.suspended).length
  const suspendedCount = creators.filter(c => c.suspended).length

  const filteredCreators = creators.filter(c => {
    if (!creatorSearch.trim()) return true
    const q = creatorSearch.toLowerCase()
    return c.profiles?.display_name?.toLowerCase().includes(q) || c.profiles?.handle?.toLowerCase().includes(q)
  })

  const filteredStats = {
    gross: filteredCreators.reduce((s, c) => s + (c.subCount || 0) * (c.monthly_price || 0), 0),
  }

  // ── Actions ────────────────────────────────────────────────────────────
  async function handleSuspend(c) {
    setActionLoading(true)
    await sbFetch(`creators?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ suspended: true, suspended_at: new Date().toISOString() }) })
    setActionResult({ type: 'success', message: `${c.profiles?.display_name} has been suspended.` })
    setActionCreator(null); setActionType(null); setActionLoading(false)
    loadData()
  }

  async function handleResume(c) {
    setActionLoading(true)
    await sbFetch(`creators?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify({ suspended: false, suspended_at: null }) })
    setActionResult({ type: 'success', message: `${c.profiles?.display_name} has been reinstated.` })
    setActionCreator(null); setActionType(null); setActionLoading(false)
    loadData()
  }

  async function handleResetPassword(c) {
    setActionLoading(true)
    // Supabase admin password reset requires service role — use email reset instead
    const res = await fetch(`${SB_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
      body: JSON.stringify({ email: c.profiles?.email || '' })
    })
    setActionResult({ type: 'success', message: `Password reset email sent to ${c.profiles?.display_name}. They will receive a reset link.` })
    setActionCreator(null); setActionType(null); setActionLoading(false)
  }

  async function handleSendNotification() {
    if (!notifyMessage.trim()) return
    setActionLoading(true)
    const targets = notifyAll ? creators : [actionCreator].filter(Boolean)
    const inserts = targets.map(c => ({ creator_id: c.id, message: notifyMessage.trim() }))
    await sbFetch('admin_notifications', { method: 'POST', body: JSON.stringify(inserts), headers: { 'Prefer': 'return=minimal' } })
    setActionResult({ type: 'success', message: `Notification sent to ${notifyAll ? `all ${creators.length} creators` : actionCreator?.profiles?.display_name}.` })
    setNotifyMessage(''); setActionCreator(null); setActionLoading(false)
  }

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />

  const input = {
    background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8,
    padding: '9px 12px', color: TEXT1, fontFamily: "'DM Mono', monospace",
    fontSize: 12, outline: 'none', boxSizing: 'border-box',
  }

  const sortedByRevenue = [...filteredCreators].sort((a, b) => {
    return ((b.subscriptions?.[0]?.count || 0) * (b.monthly_price || 0)) -
           ((a.subscriptions?.[0]?.count || 0) * (a.monthly_price || 0))
  })

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT1, display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 56, background: BG2, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 100, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: ACCENT }}>StagePass</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: RED, letterSpacing: '0.2em', background: RED + '18', border: `1px solid ${RED}40`, borderRadius: 4, padding: '2px 8px' }}>ADMIN</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!isMobile && <>
            <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, textDecoration: 'none' }}>Fan Page</a>
            <a href="/creator" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, textDecoration: 'none' }}>Creator Portal</a>
          </>}
          <button onClick={() => { sessionStorage.removeItem('sp_admin'); setAuthed(false) }} style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 12px', color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer' }}>SIGN OUT</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Sidebar (desktop) ── */}
        {!isMobile && (
          <div style={{ width: 192, background: BG2, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '18px 16px 10px', borderBottom: `1px solid ${BORDER2}`, marginBottom: 8 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em' }}>ADMIN CONSOLE</div>
            </div>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: tab === t.id ? ACCENT + '14' : 'transparent',
                border: 'none', borderLeft: tab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
                color: tab === t.id ? ACCENT : TEXT2,
                padding: '11px 16px', cursor: 'pointer', width: '100%', textAlign: 'left',
                fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: '0.08em', transition: 'all 0.15s',
              }}>
                <span style={{ opacity: tab === t.id ? 1 : 0.5 }}>{t.icon}</span>
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '28px 32px' }}>

          {/* Toast */}
          {actionResult && (
            <div style={{ background: actionResult.type === 'success' ? GREEN + '15' : RED + '15', border: `1px solid ${actionResult.type === 'success' ? GREEN + '40' : RED + '40'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: actionResult.type === 'success' ? GREEN : RED }}>{actionResult.message}</div>
              <button onClick={() => setActionResult(null)} style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontSize: 16, marginLeft: 12 }}>✕</button>
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: TEXT1, marginBottom: 4 }}>Dashboard</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.16em', marginBottom: 24 }}>PLATFORM OVERVIEW</div>

              {loading ? <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div> : <>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  <StatCard label="Total Creators" value={creators.length} accent={ACCENT} />
                  <StatCard label="Active" value={activeCreators} accent={GREEN} />
                  <StatCard label="Suspended" value={suspendedCount} accent={suspendedCount > 0 ? RED : TEXT3} />
                  <StatCard label="Total Subscribers" value={totalSubs.toLocaleString()} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                  <StatCard label="Platform Gross (Monthly)" value={`$${totalGross.toLocaleString()}`} sub="All creator subscriptions" accent={ACCENT} />
                  <StatCard label="StagePass Revenue (15%)" value={`$${platformRevenue.toFixed(2)}`} sub="Platform net" accent={GREEN} />
                  <StatCard label="Creator Payouts (85%)" value={`$${creatorPayouts.toFixed(2)}`} sub="Paid to creators" />
                </div>

                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.2em', marginBottom: 12 }}>TOP CREATORS BY REVENUE</div>
                <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: `1px solid ${BORDER2}` }}>
                    {(isMobile ? ['Creator', 'Subs', 'Revenue'] : ['Creator', 'Subscribers', 'Gross/mo', 'Platform Cut']).map(h => (
                      <div key={h} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.12em' }}>{h.toUpperCase()}</div>
                    ))}
                  </div>
                  {sortedByRevenue.slice(0, 8).map((c, i) => {
                    const subs = c.subCount || 0
                    const gross = subs * (c.monthly_price || 0)
                    return (
                      <div key={c.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: i < 7 ? `1px solid ${BORDER2}` : 'none', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, color: TEXT1 }}>{c.profiles?.display_name || 'Unknown'}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3 }}>@{c.profiles?.handle}</div>
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: TEXT2 }}>{subs}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: TEXT1 }}>${gross}</div>
                        {!isMobile && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: ACCENT }}>${(gross * PLATFORM_FEE).toFixed(2)}</div>}
                      </div>
                    )
                  })}
                </div>
              </>}
            </div>
          )}

          {/* ── CREATORS ── */}
          {tab === 'creators' && (
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: TEXT1, marginBottom: 4 }}>Creators</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.16em', marginBottom: 20 }}>{creators.length} REGISTERED</div>

              <input value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} placeholder="Search by name or handle..." style={{ ...input, width: '100%', marginBottom: 20 }} />

              {loading ? <div style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>Loading...</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredCreators.map(c => {
                    const subs = c.subCount || 0
                    const gross = subs * (c.monthly_price || 0)
                    const isSuspended = c.suspended
                    return (
                      <div key={c.id} style={{ background: BG2, border: `1px solid ${isSuspended ? RED + '30' : BORDER}`, borderRadius: 12, padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, color: isSuspended ? TEXT3 : TEXT1, fontWeight: 500 }}>{c.profiles?.display_name || 'Unknown'}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 2 }}>@{c.profiles?.handle} · {c.category || '—'}</div>
                          </div>
                          <span style={{ background: isSuspended ? RED + '18' : GREEN + '18', color: isSuspended ? RED : GREEN, border: `1px solid ${isSuspended ? RED + '40' : GREEN + '40'}`, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.12em', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                            {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.14em' }}>SUBSCRIBERS</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: TEXT1, marginTop: 2 }}>{subs}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.14em' }}>GROSS/MO</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: ACCENT, marginTop: 2 }}>${gross}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.14em' }}>PLATFORM CUT</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: GREEN, marginTop: 2 }}>${(gross * PLATFORM_FEE).toFixed(2)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {isSuspended ? (
                            <button onClick={() => { setActionCreator(c); setActionType('resume') }} style={{ background: GREEN + '18', color: GREEN, border: `1px solid ${GREEN}40`, borderRadius: 6, padding: '6px 14px', fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer', fontWeight: 700, letterSpacing: '0.08em' }}>RESUME ACCESS</button>
                          ) : (
                            <button onClick={() => { setActionCreator(c); setActionType('suspend') }} style={{ background: RED + '18', color: RED, border: `1px solid ${RED}40`, borderRadius: 6, padding: '6px 14px', fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer', fontWeight: 700, letterSpacing: '0.08em' }}>SUSPEND</button>
                          )}
                          <button onClick={() => { setActionCreator(c); setActionType('reset') }} style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 6, padding: '6px 14px', fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em' }}>RESET PASSWORD</button>
                          <button onClick={() => { setActionCreator(c); setNotifyAll(false); setTab('notify') }} style={{ background: BG3, color: TEXT2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 14px', fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em' }}>SEND NOTIFICATION</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── REVENUE ── */}
          {tab === 'revenue' && (
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: TEXT1, marginBottom: 4 }}>Revenue</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.16em', marginBottom: 24 }}>PLATFORM EARNINGS REPORT</div>

              {/* Date range filter */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {['all', 'month', 'year', 'custom'].map(r => (
                  <button key={r} onClick={() => setDateRange(r)} style={{
                    background: dateRange === r ? ACCENT : BG2,
                    color: dateRange === r ? '#080808' : TEXT3,
                    border: dateRange === r ? 'none' : `1px solid ${BORDER}`,
                    borderRadius: 20, padding: '6px 14px',
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    fontWeight: dateRange === r ? 700 : 400,
                    letterSpacing: '0.1em', cursor: 'pointer',
                    boxShadow: dateRange === r ? `0 4px 12px ${ACCENT}40` : 'none',
                  }}>{r === 'all' ? 'ALL TIME' : r === 'month' ? 'THIS MONTH' : r === 'year' ? 'THIS YEAR' : 'CUSTOM'}</button>
                ))}
                {dateRange === 'custom' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...input, width: 150 }} />
                    <span style={{ color: TEXT3, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>to</span>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...input, width: 150 }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
                <StatCard label="Total Gross" value={`$${totalGross.toLocaleString()}`} sub="All subscriptions" accent={ACCENT} />
                <StatCard label="StagePass (15%)" value={`$${platformRevenue.toFixed(2)}`} accent={GREEN} />
                <StatCard label="Creator Payouts (85%)" value={`$${creatorPayouts.toFixed(2)}`} />
              </div>

              {/* Search */}
              <input value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} placeholder="Filter by creator name..." style={{ ...input, width: '100%', marginBottom: 16 }} />

              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.2em', marginBottom: 12 }}>REVENUE BY CREATOR</div>
              <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', padding: '10px 16px', borderBottom: `1px solid ${BORDER2}` }}>
                  {(isMobile ? ['Creator', 'Subs', 'Gross'] : ['Creator', 'Category', 'Subscribers', 'Gross/mo', 'Platform (15%)']).map(h => (
                    <div key={h} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.12em' }}>{h.toUpperCase()}</div>
                  ))}
                </div>
                {sortedByRevenue.map((c, i) => {
                  const subs = c.subCount || 0
                  const gross = subs * (c.monthly_price || 0)
                  const cut = gross * PLATFORM_FEE
                  return (
                    <div key={c.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', padding: '12px 16px', borderBottom: i < sortedByRevenue.length - 1 ? `1px solid ${BORDER2}` : 'none', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, color: TEXT1 }}>{c.profiles?.display_name || 'Unknown'}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3 }}>@{c.profiles?.handle}</div>
                      </div>
                      {!isMobile && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: TEXT3 }}>{c.category || '—'}</div>}
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: TEXT2 }}>{subs}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: TEXT1 }}>${gross}</div>
                      {!isMobile && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: ACCENT }}>${cut.toFixed(2)}</div>}
                    </div>
                  )
                })}
                {/* Totals */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '2fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', padding: '14px 16px', borderTop: `1px solid ${BORDER}`, background: BG3 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: TEXT1, fontWeight: 700 }}>TOTAL</div>
                  {!isMobile && <div />}
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: TEXT1, fontWeight: 700 }}>{totalSubs}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: TEXT1, fontWeight: 700 }}>${totalGross}</div>
                  {!isMobile && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: ACCENT, fontWeight: 700 }}>${platformRevenue.toFixed(2)}</div>}
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFY ── */}
          {tab === 'notify' && (
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: TEXT1, marginBottom: 4 }}>Notifications</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.16em', marginBottom: 24 }}>SEND NOTIFICATIONS TO CREATORS</div>

              <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, maxWidth: 560 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 12 }}>RECIPIENTS</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <button onClick={() => setNotifyAll(true)} style={{ flex: 1, background: notifyAll ? ACCENT + '18' : BG3, color: notifyAll ? ACCENT : TEXT3, border: notifyAll ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`, borderRadius: 8, padding: '10px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em' }}>
                    ALL CREATORS ({creators.length})
                  </button>
                  <button onClick={() => setNotifyAll(false)} style={{ flex: 1, background: !notifyAll ? ACCENT + '18' : BG3, color: !notifyAll ? ACCENT : TEXT3, border: !notifyAll ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`, borderRadius: 8, padding: '10px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em' }}>
                    SPECIFIC CREATOR
                  </button>
                </div>

                {!notifyAll && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 8 }}>SELECT CREATOR</div>
                    <select value={actionCreator?.id || ''} onChange={e => setActionCreator(creators.find(c => c.id === e.target.value) || null)} style={{ ...input, width: '100%' }}>
                      <option value="">Choose a creator...</option>
                      {creators.map(c => (
                        <option key={c.id} value={c.id}>{c.profiles?.display_name} (@{c.profiles?.handle})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 8 }}>MESSAGE</div>
                <textarea
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  placeholder="Write your notification message to creators..."
                  rows={5}
                  style={{ ...input, width: '100%', resize: 'vertical', marginBottom: 8 }}
                />
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginBottom: 20, lineHeight: 1.6 }}>
                  Notifications are stored in the database. Creators will see them the next time they log in.
                </div>

                <button
                  onClick={handleSendNotification}
                  disabled={actionLoading || !notifyMessage.trim() || (!notifyAll && !actionCreator)}
                  style={{
                    width: '100%', background: ACCENT, color: '#080808',
                    border: 'none', borderRadius: 8, padding: '13px',
                    fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.14em', cursor: actionLoading ? 'not-allowed' : 'pointer',
                    opacity: (!notifyMessage.trim() || (!notifyAll && !actionCreator)) ? 0.5 : 1,
                    boxShadow: `0 4px 20px ${ACCENT}40`,
                  }}
                >
                  {actionLoading ? 'SENDING...' : `SEND TO ${notifyAll ? 'ALL CREATORS' : (actionCreator?.profiles?.display_name?.toUpperCase() || 'CREATOR')}`}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── IMPORT TAB ── */}
      {tab === 'import' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '28px 32px' }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: TEXT1, marginBottom: 4 }}>Bulk Import</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, letterSpacing: '0.16em', marginBottom: 24 }}>IMPORT CREATORS, EVENTS OR CONTENT FROM CSV</div>

          {importResult && (
            <div style={{ background: importResult.type === 'success' ? GREEN + '15' : RED + '15', border: `1px solid ${importResult.type === 'success' ? GREEN + '40' : RED + '40'}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: importResult.type === 'success' ? GREEN : RED }}>{importResult.message}</div>
              <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          )}

          {/* Type selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { id: 'creators', label: '♪ Creators' },
              { id: 'events',   label: '◈ Events'   },
              { id: 'content',  label: '▤ Content'  },
            ].map(t => (
              <button key={t.id} onClick={() => { setImportType(t.id); setImportRows([]); setImportErrors([]); setImportResult(null) }} style={{
                background: importType === t.id ? ACCENT + '18' : BG2,
                color: importType === t.id ? ACCENT : TEXT3,
                border: importType === t.id ? `1px solid ${ACCENT}55` : `1px solid ${BORDER}`,
                borderRadius: 8, padding: '8px 18px',
                fontFamily: "'DM Mono', monospace", fontSize: 11,
                letterSpacing: '0.08em', cursor: 'pointer',
                boxShadow: importType === t.id ? `0 0 12px ${ACCENT}20` : 'none',
              }}>{t.label.toUpperCase()}</button>
            ))}
          </div>

          {/* CSV format info */}
          <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em', marginBottom: 8 }}>REQUIRED CSV COLUMNS</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: ACCENT, wordBreak: 'break-all' }}>
              {importType === 'creators' && 'display_name, handle, email, category, monthly_price, bio'}
              {importType === 'events'   && 'creator_handle, name, description, event_date, event_type, access_type, ticket_price, venue'}
              {importType === 'content'  && 'creator_handle, title, description, type, access'}
            </div>
            {importType === 'creators' && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 6 }}>category: Music / Dance / Comedy · monthly_price: number · A password reset email will be sent to each creator</div>}
            {importType === 'events'   && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 6 }}>event_date: YYYY-MM-DD · event_type: virtual / in_person · access_type: free / subscribers / ticketed · ticket_price: required when ticketed</div>}
            {importType === 'content'  && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: TEXT3, marginTop: 6 }}>type: video / audio / text · access: free / subscribers</div>}
          </div>

          {/* Download template + upload */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => {
              const templates = { creators: CREATOR_TEMPLATE, events: EVENT_TEMPLATE, content: CONTENT_TEMPLATE }
              downloadCSV(templates[importType], `stagepass-${importType}-template.csv`)
            }} style={{ background: BG2, color: TEXT2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 16px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
              ↓ DOWNLOAD TEMPLATE
            </button>
            <label style={{ background: ACCENT + '18', color: ACCENT, border: `1px solid ${ACCENT}40`, borderRadius: 8, padding: '9px 16px', fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em' }}>
              ↑ UPLOAD CSV
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  const { rows } = parseCSV(ev.target.result)
                  const validators = { creators: validateCreatorRow, events: validateEventRow, content: validateContentRow }
                  const errs = rows.map(r => validators[importType](r))
                  setImportRows(rows)
                  setImportErrors(errs)
                  setImportResult(null)
                }
                reader.readAsText(file)
                e.target.value = ''
              }} />
            </label>
          </div>

          {/* Preview table */}
          {importRows.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.18em' }}>
                  PREVIEW — {importRows.length} ROWS · {importErrors.filter(e => e.length === 0).length} VALID · {importErrors.filter(e => e.length > 0).length} ERRORS
                </div>
                <button onClick={() => { setImportRows([]); setImportErrors([]) }} style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 10 }}>CLEAR</button>
              </div>

              <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: BG3 }}>
                        {Object.keys(importRows[0]).map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.12em', borderBottom: `1px solid ${BORDER2}`, fontWeight: 400 }}>{h.toUpperCase()}</th>
                        ))}
                        <th style={{ textAlign: 'left', padding: '9px 14px', fontFamily: "'DM Mono', monospace", fontSize: 9, color: TEXT3, letterSpacing: '0.12em', borderBottom: `1px solid ${BORDER2}`, fontWeight: 400 }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row, i) => {
                        const errs = importErrors[i] || []
                        const isValid = errs.length === 0
                        return (
                          <tr key={i} style={{ borderBottom: i < importRows.length - 1 ? `1px solid ${BORDER2}` : 'none', background: isValid ? 'transparent' : RED + '08' }}>
                            {Object.values(row).map((val, j) => (
                              <td key={j} style={{ padding: '9px 14px', color: TEXT2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || <span style={{ color: TEXT3 }}>—</span>}</td>
                            ))}
                            <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                              {isValid
                                ? <span style={{ color: GREEN, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>✓ Valid</span>
                                : <span style={{ color: RED, fontFamily: "'DM Mono', monospace", fontSize: 10 }} title={errs.join(', ')}>✕ {errs[0]}</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import button */}
              {importErrors.filter(e => e.length === 0).length > 0 && (
                <button
                  onClick={async () => {
                    setImportLoading(true)
                    const validRows = importRows.filter((_, i) => importErrors[i].length === 0)
                    try {
                      if (importType === 'creators') {
                        // Call Netlify function to create users server-side
                        const res = await fetch('/.netlify/functions/bulk-create-creators', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ creators: validRows }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Import failed')
                        setImportResult({ type: 'success', message: `${data.created} creator${data.created !== 1 ? 's' : ''} created. Password reset emails sent.` })
                      } else if (importType === 'events') {
                        // Look up creator IDs by handle
                        const handles = [...new Set(validRows.map(r => r.creator_handle))]
                        const creatorsData = await sbFetch(`creators?select=id,profiles(handle)&profiles.handle=in.(${handles.join(',')})`)
                        const handleToId = {}
                        ;(Array.isArray(creatorsData) ? creatorsData : []).forEach(c => {
                          if (c.profiles?.handle) handleToId[c.profiles.handle] = c.id
                        })
                        const inserts = validRows.map(r => ({
                          creator_id: handleToId[r.creator_handle],
                          name: r.name,
                          description: r.description || '',
                          event_date: r.event_date,
                          event_type: r.event_type,
                          access_type: r.access_type,
                          is_free: r.access_type === 'free',
                          ticket_price: r.access_type === 'ticketed' ? parseFloat(r.ticket_price) : null,
                          venue: r.venue || null,
                        })).filter(r => r.creator_id)
                        await sbFetch('events', { method: 'POST', body: JSON.stringify(inserts), headers: { 'Prefer': 'return=minimal' } })
                        setImportResult({ type: 'success', message: `${inserts.length} event${inserts.length !== 1 ? 's' : ''} created successfully.` })
                      } else if (importType === 'content') {
                        const handles = [...new Set(validRows.map(r => r.creator_handle))]
                        const creatorsData = await sbFetch(`creators?select=id,profiles(handle)&profiles.handle=in.(${handles.join(',')})`)
                        const handleToId = {}
                        ;(Array.isArray(creatorsData) ? creatorsData : []).forEach(c => {
                          if (c.profiles?.handle) handleToId[c.profiles.handle] = c.id
                        })
                        const emojiMap = { video: '🎛️', audio: '🎵', text: '📖' }
                        const inserts = validRows.map(r => ({
                          creator_id: handleToId[r.creator_handle],
                          title: r.title,
                          description: r.description || '',
                          type: r.type,
                          is_locked: r.access === 'subscribers',
                          thumbnail_emoji: emojiMap[r.type] || '✦',
                        })).filter(r => r.creator_id)
                        await sbFetch('posts', { method: 'POST', body: JSON.stringify(inserts), headers: { 'Prefer': 'return=minimal' } })
                        setImportResult({ type: 'success', message: `${inserts.length} content item${inserts.length !== 1 ? 's' : ''} created successfully.` })
                      }
                      setImportRows([])
                      setImportErrors([])
                    } catch (err) {
                      setImportResult({ type: 'error', message: err.message })
                    }
                    setImportLoading(false)
                  }}
                  disabled={importLoading}
                  style={{
                    background: ACCENT, color: '#080808', border: 'none',
                    borderRadius: 8, padding: '12px 28px',
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    fontWeight: 700, letterSpacing: '0.14em',
                    cursor: importLoading ? 'not-allowed' : 'pointer',
                    opacity: importLoading ? 0.7 : 1,
                    boxShadow: `0 4px 20px ${ACCENT}40`,
                  }}
                >
                  {importLoading ? 'IMPORTING...' : `IMPORT ${importErrors.filter(e => e.length === 0).length} ${importType.toUpperCase()}`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Mobile bottom tabs ── */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: BG2 + 'f4', backdropFilter: 'blur(20px)', borderTop: `1px solid ${BORDER}`, display: 'flex', zIndex: 100, height: 60 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              background: 'none', border: 'none',
              borderTop: tab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
              color: tab === t.id ? ACCENT : TEXT3,
              cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: '0.08em',
            }}>
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label.slice(0, 4).toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* ── Confirmation modal ── */}
      {actionType && actionCreator && actionType !== 'notify' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24 }}>
          <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, maxWidth: 400, width: '100%' }}>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: TEXT1, marginBottom: 8 }}>
              {actionType === 'suspend' ? 'Suspend Creator' : actionType === 'resume' ? 'Resume Creator' : 'Reset Password'}
            </div>
            <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.7, marginBottom: 22 }}>
              {actionType === 'suspend' && `Suspend ${actionCreator.profiles?.display_name}? Their profile will be hidden from fans and they cannot log in.`}
              {actionType === 'resume' && `Reinstate ${actionCreator.profiles?.display_name}? Their profile will become visible and accessible again.`}
              {actionType === 'reset' && `Send a password reset email to ${actionCreator.profiles?.display_name}? They will receive a link to set a new password.`}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setActionCreator(null); setActionType(null) }} style={{ flex: 1, background: 'transparent', color: TEXT3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '11px', fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: 'pointer' }}>CANCEL</button>
              <button
                onClick={() => {
                  if (actionType === 'suspend') handleSuspend(actionCreator)
                  else if (actionType === 'resume') handleResume(actionCreator)
                  else if (actionType === 'reset') handleResetPassword(actionCreator)
                }}
                disabled={actionLoading}
                style={{
                  flex: 2, color: '#080808', border: 'none', borderRadius: 8, padding: '11px',
                  fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.1em', cursor: actionLoading ? 'not-allowed' : 'pointer',
                  opacity: actionLoading ? 0.7 : 1,
                  background: actionType === 'suspend' ? RED : actionType === 'resume' ? GREEN : ACCENT,
                }}
              >
                {actionLoading ? 'PROCESSING...' : `CONFIRM ${actionType.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
