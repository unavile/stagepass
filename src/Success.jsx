export default function Success() {
  return (
    <div style={{
      minHeight: '100vh', background: '#080808',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, padding: 24
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 48 }}>✓</div>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: '#c9a84c' }}>
        You're subscribed!
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#444', textAlign: 'center', lineHeight: 1.8 }}>
        Your subscription is now active.<br />
        Exclusive content is now unlocked.
      </div>
      <button
        onClick={() => window.location.href = '/'}
        style={{
          marginTop: 16, background: '#c9a84c', color: '#080808',
          border: 'none', borderRadius: 8, padding: '12px 28px',
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer'
        }}
      >
        BACK TO STAGEPASS
      </button>
    </div>
  )
}