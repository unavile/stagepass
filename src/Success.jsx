export default function Success() {
  const params = new URLSearchParams(window.location.search)
  const isDonation = params.get('donation') === '1'
  const isTicket   = params.get('ticket') === '1'

  const content = isDonation ? {
    icon: '💛',
    heading: 'Thank you for your support!',
    body: <>Your donation has been received.<br />The artist will receive your support shortly.</>,
    cta: 'BACK TO COVETED STAGE',
  } : isTicket ? {
    icon: '🎟',
    heading: "You're going!",
    body: <>Your ticket has been confirmed.<br />Check your email for details.</>,
    cta: 'BACK TO COVETED STAGE',
  } : {
    icon: '✓',
    heading: "You're subscribed!",
    body: <>Your subscription is now active.<br />Exclusive content is now unlocked.</>,
    cta: 'BACK TO COVETED STAGE',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#080808',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, padding: 24
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 48 }}>{content.icon}</div>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 28, color: '#c9a84c' }}>
        {content.heading}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#444', textAlign: 'center', lineHeight: 1.8 }}>
        {content.body}
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
        {content.cta}
      </button>
    </div>
  )
}
