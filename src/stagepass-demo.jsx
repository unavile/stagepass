import { useState } from "react";

const CREATORS = [
  {
    id: 1,
    name: "Mara Voss",
    handle: "@maravoss",
    genre: "Electronic / Ambient",
    avatar: "MV",
    avatarBg: "#1a1a2e",
    avatarAccent: "#c9a84c",
    bio: "Berlin-based producer blending modular synthesis with field recordings. Touring Europe & releasing exclusive studio sessions here.",
    coverGradient: "linear-gradient(135deg, #0d0d1a 0%, #1a1040 50%, #2a0a30 100%)",
    accentColor: "#c9a84c",
    subscribers: 2847,
    monthlyPrice: 8,
    posts: [
      { id: 1, type: "video", title: "Live Studio Session #12 — Korg Modular", date: "May 8, 2026", locked: false, thumbnail: "🎛️", desc: "45 min improvisational session with the Korg system. Patch notes included." },
      { id: 2, type: "audio", title: "Unreleased Track: 'Fog Protocol'", date: "May 3, 2026", locked: true, thumbnail: "🎵", desc: "First look at the B-side from the upcoming LP. Subscriber exclusive." },
      { id: 3, type: "video", title: "Behind the Mix — Mastering with Weiss", date: "Apr 28, 2026", locked: true, thumbnail: "🎚️", desc: "Full walkthrough of my mastering chain for the new album." },
      { id: 4, type: "event", title: "Listening Party — Berlin (June 14)", date: "Apr 20, 2026", locked: false, thumbnail: "🎟️", desc: "Free subscriber event. Limited to 120 seats — RSVP via link below." },
    ],
    stats: { revenue: 22776, streams: 48200, newSubs: 312, posts: 24 },
    upcomingEvents: [
      { name: "Berlin Listening Party", date: "Jun 14", venue: "Tresor, Berlin" },
      { name: "Virtual Synth Masterclass", date: "Jun 28", venue: "StagePass Live" },
    ]
  },
  {
    id: 2,
    name: "DJ Ronin",
    handle: "@djronin",
    genre: "Hip-Hop / Beats",
    avatar: "DR",
    avatarBg: "#0f0f0f",
    avatarAccent: "#e84545",
    bio: "Producer & DJ from Atlanta. Weekly beat drops, sample flips, and exclusive instrumentals for producers and fans alike.",
    coverGradient: "linear-gradient(135deg, #1a0000 0%, #2d0a0a 50%, #0f0f0f 100%)",
    accentColor: "#e84545",
    subscribers: 5120,
    monthlyPrice: 6,
    posts: [
      { id: 1, type: "audio", title: "Beat Tape Vol. 3 — Full Download", date: "May 9, 2026", locked: false, thumbnail: "📀", desc: "20 beats, royalty-free for subscribers. All stems included." },
      { id: 2, type: "video", title: "Sample Flip Tutorial: 'Soul Chops'", date: "May 5, 2026", locked: true, thumbnail: "🎬", desc: "I break down how I flipped a 70s soul record into a modern trap hit." },
      { id: 3, type: "audio", title: "Unreleased: Collab w/ Olu (Feat. Ready Roc)", date: "Apr 30, 2026", locked: true, thumbnail: "🎵", desc: "Exclusive preview of our collab EP dropping this summer." },
    ],
    stats: { revenue: 30720, streams: 91400, newSubs: 540, posts: 38 },
    upcomingEvents: [
      { name: "Live Beat Battle", date: "May 22", venue: "StagePass Live" },
      { name: "Atlanta Pop-Up Show", date: "Jul 4", venue: "Terminal West, ATL" },
    ]
  },
  {
    id: 3,
    name: "Celeste Nair",
    handle: "@celestenair",
    genre: "Indie Folk / Singer-Songwriter",
    avatar: "CN",
    avatarBg: "#0a1a0f",
    avatarAccent: "#6dbf8a",
    bio: "Writing songs from a cabin in Vermont. Sharing demos, lyric journals, and monthly live sessions with people who care about the craft.",
    coverGradient: "linear-gradient(135deg, #071209 0%, #0d2015 50%, #152b1a 100%)",
    accentColor: "#6dbf8a",
    subscribers: 1634,
    monthlyPrice: 5,
    posts: [
      { id: 1, type: "video", title: "May Live Session — Vermont Cabin", date: "May 7, 2026", locked: false, thumbnail: "🌿", desc: "One-hour live acoustic session. Took requests from the chat all night." },
      { id: 2, type: "text", title: "Lyric Journal: 'Almanac'", date: "May 1, 2026", locked: true, thumbnail: "📖", desc: "Full handwritten lyrics + notes on the song's meaning. PDF attached." },
      { id: 3, type: "audio", title: "Early Demo — 'October Kept'", date: "Apr 22, 2026", locked: true, thumbnail: "🎵", desc: "Recorded on my phone during a hike. Raw and unpolished." },
    ],
    stats: { revenue: 8170, streams: 22100, newSubs: 178, posts: 19 },
    upcomingEvents: [
      { name: "Monthly Live Q&A", date: "May 30", venue: "StagePass Live" },
      { name: "Northampton Show", date: "Jun 20", venue: "Iron Horse, MA" },
    ]
  }
];

const typeIcons = { video: "▶", audio: "♪", event: "🎟", text: "✦" };
const typeLabels = { video: "VIDEO", audio: "AUDIO", event: "EVENT", text: "JOURNAL" };

function Avatar({ creator, size = 56 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: creator.avatarBg,
      border: `2px solid ${creator.accentColor}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Serif Display', Georgia, serif",
      fontSize: size * 0.3, fontWeight: 700,
      color: creator.accentColor, flexShrink: 0,
      letterSpacing: "0.05em"
    }}>
      {creator.avatar}
    </div>
  );
}

function Pill({ color, children }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, fontSize: 10, fontWeight: 700,
      padding: "2px 8px", letterSpacing: "0.12em",
      textTransform: "uppercase", fontFamily: "'DM Mono', monospace"
    }}>
      {children}
    </span>
  );
}

// ─── LANDING / DISCOVERY ───────────────────────────────────────────────────
function LandingView({ onSelect, onCreatorDash }) {
  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e8e2d6" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 64,
        borderBottom: "1px solid #ffffff12",
        position: "sticky", top: 0, background: "#080808cc",
        backdropFilter: "blur(12px)", zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, fontFamily: "'DM Serif Display', Georgia, serif", color: "#c9a84c", letterSpacing: "0.02em" }}>StagePass</span>
          <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "#666", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Beta</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCreatorDash} style={navBtn("#c9a84c")}>Creator Dashboard ↗</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: "80px 48px 48px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.25em", color: "#c9a84c", textTransform: "uppercase", marginBottom: 20 }}>
          Direct from Artist to Fan
        </div>
        <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 400, lineHeight: 1.1, margin: "0 0 24px", color: "#f0ebe0" }}>
          Your front row seat<br />
          <span style={{ color: "#c9a84c" }}>to the creative process.</span>
        </h1>
        <p style={{ fontSize: 18, color: "#888", lineHeight: 1.7, maxWidth: 520, margin: "0 0 40px" }}>
          Subscribe to independent musicians, producers, and artists. Get exclusive content, early access, and a real connection.
        </p>
      </div>

      {/* Creators */}
      <div style={{ padding: "0 48px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", marginBottom: 28 }}>
          Featured Creators
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {CREATORS.map(c => (
            <CreatorCard key={c.id} creator={c} onClick={() => onSelect(c)} />
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", padding: "32px 0", borderTop: "1px solid #ffffff08", color: "#333", fontSize: 12, fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em" }}>
        STAGEPASS DEMO · PROTOTYPE v0.1
      </div>
    </div>
  );
}

function CreatorCard({ creator, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#111" : "#0c0c0c",
        border: `1px solid ${hov ? creator.accentColor + "55" : "#ffffff10"}`,
        borderRadius: 12, cursor: "pointer", overflow: "hidden",
        transition: "all 0.2s ease",
        transform: hov ? "translateY(-2px)" : "none",
      }}
    >
      {/* Cover */}
      <div style={{ height: 100, background: creator.coverGradient, position: "relative" }}>
        <div style={{ position: "absolute", bottom: -28, left: 24 }}>
          <Avatar creator={creator} size={56} />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "36px 24px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: "#f0ebe0" }}>{creator.name}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: creator.accentColor, letterSpacing: "0.1em", marginTop: 2 }}>{creator.handle}</div>
          </div>
          <Pill color={creator.accentColor}>{creator.genre.split(" / ")[0]}</Pill>
        </div>

        <p style={{ fontSize: 13, color: "#777", lineHeight: 1.6, margin: "12px 0 16px" }}>{creator.bio}</p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: "#e8e2d6" }}>{creator.subscribers.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Subscribers</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: creator.accentColor }}>${creator.monthlyPrice}/mo</div>
            <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>to subscribe</div>
          </div>
        </div>

        <div style={{
          marginTop: 18, background: creator.accentColor, color: "#080808",
          borderRadius: 6, padding: "10px 0", textAlign: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
          letterSpacing: "0.15em", textTransform: "uppercase"
        }}>
          View Page
        </div>
      </div>
    </div>
  );
}

// ─── CREATOR DASHBOARD ─────────────────────────────────────────────────────
const TABS = [
  { id: "overview",     label: "Overview",     icon: "⬡" },
  { id: "content",      label: "Content",      icon: "▤" },
  { id: "subscribers",  label: "Subs",         icon: "◎" },
  { id: "events",       label: "Events",       icon: "◈" },
  { id: "earnings",     label: "Earnings",     icon: "◇" },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useState(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  });
  return mobile;
}

function CreatorDashboard({ creator, onBack }) {
  const [tab, setTab] = useState("overview");
  const c = creator || CREATORS[0];
  const isMobile = useIsMobile();

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e8e2d6", display: "flex", flexDirection: "column" }}>

      {/* ── Mobile top bar ── */}
      {isMobile && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", height: 56,
          background: "#0a0a0a", borderBottom: "1px solid #ffffff0a",
          position: "sticky", top: 0, zIndex: 100, flexShrink: 0
        }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar creator={c} size={28} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: c.accentColor }}>{c.handle}</span>
          </div>
          <button style={{
            background: c.accentColor, color: "#080808",
            border: "none", borderRadius: 5, padding: "6px 12px",
            fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.12em", cursor: "pointer"
          }}>+ POST</button>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* ── Desktop sidebar ── */}
        {!isMobile && (
          <div style={{ width: 220, background: "#0a0a0a", borderRight: "1px solid #ffffff0a", padding: "0 0 32px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "20px 20px 0", borderBottom: "1px solid #ffffff08", marginBottom: 8 }}>
              <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", padding: "8px 0", marginBottom: 12 }}>← Back to Discover</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0 20px" }}>
                <Avatar creator={c} size={36} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ebe0" }}>{c.name}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: c.accentColor }}>{c.handle}</div>
                </div>
              </div>
            </div>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: tab === t.id ? c.accentColor + "15" : "none",
                border: "none", borderLeft: tab === t.id ? `2px solid ${c.accentColor}` : "2px solid transparent",
                color: tab === t.id ? c.accentColor : "#555",
                padding: "12px 20px", cursor: "pointer", width: "100%", textAlign: "left",
                fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.08em",
                transition: "all 0.15s"
              }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                {t.label.toUpperCase()}
              </button>
            ))}
            <div style={{ marginTop: "auto", padding: "20px" }}>
              <button style={{
                width: "100%", background: c.accentColor, color: "#080808",
                border: "none", borderRadius: 6, padding: "10px 0",
                fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.15em", cursor: "pointer", textTransform: "uppercase"
              }}>+ New Post</button>
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: isMobile ? 72 : 0 }}>
          {tab === "overview"    && <DashOverview c={c} isMobile={isMobile} />}
          {tab === "content"     && <DashContent c={c} isMobile={isMobile} />}
          {tab === "subscribers" && <DashSubscribers c={c} isMobile={isMobile} />}
          {tab === "events"      && <DashEvents c={c} isMobile={isMobile} />}
          {tab === "earnings"    && <DashEarnings c={c} isMobile={isMobile} />}
        </div>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      {isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#0a0a0a", borderTop: "1px solid #ffffff0a",
          display: "flex", zIndex: 100, height: 64
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 4,
              background: "none", border: "none",
              borderTop: tab === t.id ? `2px solid ${c.accentColor}` : "2px solid transparent",
              color: tab === t.id ? c.accentColor : "#444",
              cursor: "pointer", padding: "8px 4px",
              fontFamily: "'DM Mono', monospace", fontSize: 9,
              letterSpacing: "0.06em", transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#0e0e0e", border: "1px solid #ffffff0a", borderRadius: 10, padding: "20px 24px" }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 32, color: accent || "#f0ebe0" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DashOverview({ c, isMobile }) {
  const monthRevenue = (c.subscribers * c.monthlyPrice).toLocaleString();
  const p = isMobile ? "20px 16px" : "40px 48px";
  return (
    <div style={{ padding: p }}>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: "#f0ebe0", marginBottom: 4 }}>Good morning, {c.name.split(" ")[0]}.</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.15em", marginBottom: 24 }}>MAY 10, 2026 · YOUR DASHBOARD</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 28 }}>
        <StatCard label="Subscribers" value={c.subscribers.toLocaleString()} sub={`+${c.stats.newSubs} this month`} accent={c.accentColor} />
        <StatCard label="Monthly Revenue" value={`$${monthRevenue}`} sub="Before platform fee (8%)" />
        <StatCard label="Posts" value={c.stats.posts} sub="All time" />
        <StatCard label="Total Streams" value={(c.stats.streams / 1000).toFixed(1) + "k"} sub="This month" />
      </div>

      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Recent Posts</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {c.posts.map(post => (
          <div key={post.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0e0e0e", border: "1px solid #ffffff08", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>{post.thumbnail}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#e8e2d6", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.title}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555" }}>{typeLabels[post.type]} · {post.date}</div>
            </div>
            {post.locked && !isMobile && <Pill color={c.accentColor}>EXCLUSIVE</Pill>}
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.2em", textTransform: "uppercase", margin: "28px 0 12px" }}>Upcoming Events</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {c.upcomingEvents.map((e, i) => (
          <div key={i} style={{ background: "#0e0e0e", border: `1px solid ${c.accentColor}22`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: c.accentColor, fontWeight: 700, marginBottom: 2 }}>{e.date}</div>
            <div style={{ fontSize: 14, color: "#e8e2d6", marginBottom: 2 }}>{e.name}</div>
            <div style={{ fontSize: 12, color: "#555" }}>{e.venue}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashContent({ c, isMobile }) {
  const p = isMobile ? "20px 16px" : "40px 48px";
  return (
    <div style={{ padding: p }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: "#f0ebe0" }}>Content</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.1em", marginTop: 2 }}>{c.posts.length} POSTS · {c.posts.filter(post => post.locked).length} SUBSCRIBER-ONLY</div>
        </div>
        {!isMobile && (
          <button style={{ background: c.accentColor, color: "#080808", border: "none", borderRadius: 6, padding: "10px 20px", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", textTransform: "uppercase" }}>+ New Post</button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {c.posts.map(post => (
          <div key={post.id} style={{ background: "#0e0e0e", border: "1px solid #ffffff08", borderRadius: 10, padding: isMobile ? "14px" : "20px 24px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, background: "#161616", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{post.thumbnail}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "#f0ebe0", marginBottom: 4, lineHeight: 1.4 }}>{post.title}</div>
                {!isMobile && <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, marginBottom: 6 }}>{post.desc}</div>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill color="#888">{typeLabels[post.type]}</Pill>
                  {post.locked && <Pill color={c.accentColor}>EXCL.</Pill>}
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", paddingTop: 2 }}>{post.date}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={ghostBtn()}>Edit</button>
                {!isMobile && <button style={ghostBtn()}>⋯</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SUB_DATA = [
  { name: "Amara O.", tier: "Supporter", since: "Jan 2026", country: "🇨🇦" },
  { name: "Luis F.", tier: "Supporter", since: "Mar 2026", country: "🇲🇽" },
  { name: "Priya K.", tier: "Supporter", since: "Feb 2025", country: "🇬🇧" },
  { name: "Noah W.", tier: "Supporter", since: "Dec 2024", country: "🇺🇸" },
  { name: "Selin D.", tier: "Supporter", since: "Apr 2026", country: "🇩🇪" },
  { name: "Jin H.", tier: "Supporter", since: "Jan 2025", country: "🇰🇷" },
];

function DashSubscribers({ c, isMobile }) {
  const p = isMobile ? "20px 16px" : "40px 48px";
  return (
    <div style={{ padding: p }}>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: "#f0ebe0", marginBottom: 4 }}>Subscribers</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.1em", marginBottom: 20 }}>{c.subscribers.toLocaleString()} ACTIVE · +{c.stats.newSubs} THIS MONTH</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
        <StatCard label="Active" value={c.subscribers.toLocaleString()} accent={c.accentColor} />
        <StatCard label="New" value={`+${c.stats.newSubs}`} />
        <StatCard label="Churn" value="2.1%" sub="vs avg 3.8%" />
      </div>

      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Recent Subscribers</div>
      <div style={{ border: "1px solid #ffffff08", borderRadius: 10, overflow: "hidden" }}>
        {SUB_DATA.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < SUB_DATA.length - 1 ? "1px solid #ffffff06" : "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#161616", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: "1px solid #ffffff10", flexShrink: 0 }}>
              {s.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#e8e2d6" }}>{s.country} {s.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444" }}>Since {s.since}</div>
            </div>
            {!isMobile && <Pill color={c.accentColor}>{s.tier}</Pill>}
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444", flexShrink: 0 }}>${c.monthlyPrice}/mo</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: 14 }}>
        <button style={ghostBtn()}>View all {c.subscribers.toLocaleString()} →</button>
      </div>
    </div>
  );
}

function DashEvents({ c, isMobile }) {
  const p = isMobile ? "20px 16px" : "40px 48px";
  return (
    <div style={{ padding: p }}>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: "#f0ebe0", marginBottom: 20 }}>Events</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {c.upcomingEvents.map((e, i) => (
          <div key={i} style={{ background: "#0e0e0e", border: `1px solid ${c.accentColor}33`, borderRadius: 12, padding: isMobile ? "20px" : "28px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, color: c.accentColor, fontWeight: 700, marginBottom: 6 }}>{e.date}</div>
            <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, color: "#f0ebe0", marginBottom: 4 }}>{e.name}</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>{e.venue}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "#161616", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: "#e8e2d6" }}>—</div>
                <div style={{ fontSize: 11, color: "#444" }}>RSVPs</div>
              </div>
              <div style={{ flex: 1, background: "#161616", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: "#e8e2d6" }}>—</div>
                <div style={{ fontSize: 11, color: "#444" }}>Capacity</div>
              </div>
            </div>
            <button style={{ ...ghostBtn(), width: "100%", padding: "10px", justifyContent: "center" }}>Manage Event →</button>
          </div>
        ))}
        <div style={{ background: "#0e0e0e", border: "1px dashed #ffffff10", borderRadius: 12, padding: "28px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 100 }}>
          <div style={{ fontSize: 28, color: "#333" }}>+</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444", letterSpacing: "0.12em" }}>SCHEDULE NEW EVENT</div>
        </div>
      </div>
    </div>
  );
}

function DashEarnings({ c, isMobile }) {
  const net = Math.round(c.subscribers * c.monthlyPrice * 0.92);
  const gross = c.subscribers * c.monthlyPrice;
  const bars = [0.55, 0.62, 0.70, 0.75, 0.82, 0.90, 1.0];
  const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  const p = isMobile ? "20px 16px" : "40px 48px";
  return (
    <div style={{ padding: p }}>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: isMobile ? 22 : 28, color: "#f0ebe0", marginBottom: 20 }}>Earnings</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
        <StatCard label="Gross (May)" value={`$${gross.toLocaleString()}`} accent={c.accentColor} />
        <StatCard label="Net (May)" value={`$${net.toLocaleString()}`} sub="After 8% fee" />
        <StatCard label="All-time" value={`$${c.stats.revenue.toLocaleString()}`} />
      </div>

      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Monthly Revenue (Last 7 Months)</div>
      <div style={{ background: "#0e0e0e", border: "1px solid #ffffff08", borderRadius: 10, padding: isMobile ? "16px" : "28px 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 6 : 12, height: 120 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: "100%", background: i === 6 ? c.accentColor : c.accentColor + "33", borderRadius: "3px 3px 0 0", height: `${Math.round(b * 100)}px` }} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: isMobile ? 8 : 10, color: "#444" }}>{months[i]}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #ffffff08", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 12, color: "#444" }}>Growth: <span style={{ color: c.accentColor }}>+82%</span></div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555" }}>PAYOUT: 1ST OF MONTH</div>
        </div>
      </div>
    </div>
  );
}

// ─── AUDIENCE / FAN VIEW ────────────────────────────────────────────────────
function AudienceView({ creator, onBack }) {
  const [subscribed, setSubscribed] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const c = creator;

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e8e2d6" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 64,
        borderBottom: "1px solid #ffffff12",
        position: "sticky", top: 0, background: "#080808cc",
        backdropFilter: "blur(12px)", zIndex: 100
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>← Discover</button>
        <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: "#c9a84c" }}>StagePass</span>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444" }}>Signed in as Fan</div>
      </nav>

      {/* Cover */}
      <div style={{ height: 220, background: c.coverGradient, position: "relative" }}>
        <div style={{ position: "absolute", bottom: -44, left: 64 }}>
          <Avatar creator={c} size={88} />
        </div>
      </div>

      {/* Profile header */}
      <div style={{ padding: "56px 64px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #ffffff08" }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 36, color: "#f0ebe0", marginBottom: 4 }}>{c.name}</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: c.accentColor, letterSpacing: "0.1em", marginBottom: 8 }}>{c.handle} · {c.genre}</div>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6, maxWidth: 500, margin: "0 0 16px" }}>{c.bio}</p>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "#e8e2d6" }}>{c.subscribers.toLocaleString()}</span>
              <span style={{ fontSize: 12, color: "#444", marginLeft: 6 }}>subscribers</span>
            </div>
            <div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: "#e8e2d6" }}>{c.posts.length}</span>
              <span style={{ fontSize: 12, color: "#444", marginLeft: 6 }}>posts</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {subscribed ? (
            <div>
              <Pill color={c.accentColor}>✓ Subscribed</Pill>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444", marginTop: 8 }}>${c.monthlyPrice}/month</div>
              <button onClick={() => setSubscribed(false)} style={{ ...ghostBtn(), marginTop: 10, fontSize: 11 }}>Manage</button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSubscribed(true)}
                style={{
                  background: c.accentColor, color: "#080808",
                  border: "none", borderRadius: 8, padding: "14px 32px",
                  fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700,
                  letterSpacing: "0.15em", cursor: "pointer", textTransform: "uppercase",
                  display: "block", marginBottom: 8
                }}
              >
                Subscribe · ${c.monthlyPrice}/mo
              </button>
              <div style={{ fontSize: 12, color: "#444", textAlign: "center" }}>Cancel anytime</div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "40px 64px", maxWidth: 900 }}>
        {!subscribed && (
          <div style={{ background: "#0e0e0e", border: `1px solid ${c.accentColor}22`, borderRadius: 10, padding: "20px 24px", marginBottom: 28, display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 20 }}>🔒</span>
            <div>
              <div style={{ fontSize: 14, color: "#e8e2d6", marginBottom: 2 }}>{c.posts.filter(p => p.locked).length} exclusive posts locked</div>
              <div style={{ fontSize: 13, color: "#555" }}>Subscribe for ${c.monthlyPrice}/month to unlock all content.</div>
            </div>
            <button onClick={() => setSubscribed(true)} style={{
              marginLeft: "auto", background: c.accentColor, color: "#080808",
              border: "none", borderRadius: 6, padding: "8px 20px",
              fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.12em", cursor: "pointer", flexShrink: 0
            }}>Subscribe</button>
          </div>
        )}

        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>Posts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {c.posts.map(p => {
            const canView = !p.locked || subscribed;
            return (
              <div
                key={p.id}
                onClick={() => canView && setActivePost(activePost?.id === p.id ? null : p)}
                style={{
                  background: "#0e0e0e", border: `1px solid ${activePost?.id === p.id ? c.accentColor + "44" : "#ffffff08"}`,
                  borderRadius: 10, padding: "20px 24px", cursor: canView ? "pointer" : "default",
                  transition: "border-color 0.15s", opacity: canView ? 1 : 0.7
                }}
              >
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ width: 48, height: 48, background: "#161616", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{p.thumbnail}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: canView ? "#f0ebe0" : "#666", marginBottom: 4 }}>{p.title}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Pill color="#555">{typeLabels[p.type]}</Pill>
                      {p.locked && !subscribed && <Pill color={c.accentColor}>EXCLUSIVE</Pill>}
                      {p.locked && subscribed && <Pill color={c.accentColor}>✓ UNLOCKED</Pill>}
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#333" }}>{p.date}</span>
                    </div>
                  </div>
                  {p.locked && !subscribed ? (
                    <span style={{ fontSize: 20, color: "#333" }}>🔒</span>
                  ) : (
                    <span style={{ fontSize: 14, color: "#444" }}>{activePost?.id === p.id ? "▲" : "▼"}</span>
                  )}
                </div>
                {activePost?.id === p.id && canView && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #ffffff08" }}>
                    <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, margin: "0 0 16px" }}>{p.desc}</p>
                    {p.type === "video" && (
                      <div style={{ background: "#161616", borderRadius: 8, height: 180, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ffffff0a" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 40, marginBottom: 8 }}>▶</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444" }}>VIDEO PLAYER (DEMO)</div>
                        </div>
                      </div>
                    )}
                    {p.type === "audio" && (
                      <div style={{ background: "#161616", borderRadius: 8, padding: "16px 20px", border: "1px solid #ffffff0a", display: "flex", alignItems: "center", gap: 16 }}>
                        <button style={{ background: c.accentColor, color: "#080808", border: "none", borderRadius: "50%", width: 40, height: 40, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>▶</button>
                        <div style={{ flex: 1, height: 4, background: "#333", borderRadius: 2 }}>
                          <div style={{ width: "30%", height: "100%", background: c.accentColor, borderRadius: 2 }} />
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444" }}>3:24 / 4:47</div>
                      </div>
                    )}
                    {p.type === "event" && (
                      <button style={{ background: c.accentColor + "22", color: c.accentColor, border: `1px solid ${c.accentColor}44`, borderRadius: 6, padding: "10px 20px", fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer", letterSpacing: "0.12em" }}>
                        RSVP TO EVENT →
                      </button>
                    )}
                    {p.type === "text" && (
                      <div style={{ background: "#161616", borderRadius: 8, padding: "16px 20px", border: "1px solid #ffffff0a", fontSize: 13, color: "#666", lineHeight: 1.8, fontStyle: "italic" }}>
                        "This one started in October, on a drive through the mountains. I had my voice memo app open the whole time..."<br />
                        <span style={{ fontSize: 11, color: c.accentColor, fontStyle: "normal", fontFamily: "'DM Mono', monospace" }}>PDF attached (12 pages)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Events section */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: "0.2em", textTransform: "uppercase", margin: "40px 0 16px" }}>Upcoming Events</div>
        <div style={{ display: "flex", gap: 16 }}>
          {c.upcomingEvents.map((e, i) => (
            <div key={i} style={{ flex: 1, background: "#0e0e0e", border: `1px solid ${c.accentColor}22`, borderRadius: 10, padding: "20px 24px" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: c.accentColor, marginBottom: 6 }}>{e.date}</div>
              <div style={{ fontSize: 15, color: "#e8e2d6", marginBottom: 4 }}>{e.name}</div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>{e.venue}</div>
              <button style={{ background: c.accentColor + "22", color: c.accentColor, border: `1px solid ${c.accentColor}44`, borderRadius: 6, padding: "8px 16px", fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer", letterSpacing: "0.1em", width: "100%" }}>
                {subscribed ? "RSVP (FREE)" : `SUBSCRIBE TO ACCESS`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function navBtn(accent) {
  return {
    background: accent + "18", color: accent,
    border: `1px solid ${accent}40`, borderRadius: 6,
    padding: "8px 16px", cursor: "pointer",
    fontFamily: "'DM Mono', monospace", fontSize: 11,
    letterSpacing: "0.12em", fontWeight: 600,
    textTransform: "uppercase"
  };
}

function ghostBtn() {
  return {
    background: "none", color: "#555",
    border: "1px solid #ffffff10", borderRadius: 6,
    padding: "8px 14px", cursor: "pointer",
    fontFamily: "'DM Mono', monospace", fontSize: 11,
    letterSpacing: "0.1em", display: "inline-flex",
    alignItems: "center", gap: 6
  };
}

// ─── ROOT ────────────────────────────────────────────────────────────────────
export default function StagePass() {
  const [view, setView] = useState("landing");
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [dashCreator, setDashCreator] = useState(CREATORS[0]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      {view === "landing" && (
        <LandingView
          onSelect={c => { setSelectedCreator(c); setView("audience"); }}
          onCreatorDash={() => setView("creator")}
        />
      )}
      {view === "audience" && (
        <AudienceView creator={selectedCreator || CREATORS[0]} onBack={() => setView("landing")} />
      )}
      {view === "creator" && (
        <CreatorDashboard creator={dashCreator} onBack={() => setView("landing")} />
      )}
    </>
  );
}
