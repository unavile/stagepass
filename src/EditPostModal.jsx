import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function EditPostModal({ post, accentColor, onClose, onSaved }) {
  const [title, setTitle] = useState(post.title || '')
  const [description, setDescription] = useState(post.description || '')
  const [isLocked, setIsLocked] = useState(post.is_locked ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ac = accentColor || '#c9a84c'

  const input = {
    width: '100%', background: '#111', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return }
    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('posts')
      .update({
        title: title.trim(),
        description: description.trim(),
        is_locked: isLocked,
      })
      .eq('id', post.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', text: 'PDF', event: 'EVENT' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24,
    }}>
      <div style={{
        background: '#0e0e0e', border: '1px solid #ffffff12',
        borderRadius: 14, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', padding: 32,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>Edit Post</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Post type badge */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 20 }}>
          {post.thumbnail_emoji} {typeLabels[post.type] || post.type?.toUpperCase()}
        </div>

        {/* Title */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>TITLE</div>
        <input
          style={input}
          placeholder="Post title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />

        {/* Description */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>DESCRIPTION</div>
        <textarea
          style={{ ...input, minHeight: 100, resize: 'vertical' }}
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        {/* Access toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#111', border: '1px solid #ffffff10',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
        }}>
          <div>
            <div style={{ fontSize: 13, color: '#e8e2d6' }}>
              {isLocked ? '🔑 Subscribers Only' : '🌐 Free for All'}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 2 }}>
              {isLocked ? 'Only subscribers can view this content' : 'Anyone can view this content'}
            </div>
          </div>
          <div
            onClick={() => setIsLocked(!isLocked)}
            style={{
              width: 44, height: 24, borderRadius: 999, cursor: 'pointer',
              background: isLocked ? ac : '#2a2a2a',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 3,
              left: isLocked ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {/* Note: file cannot be replaced */}
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginBottom: 20, lineHeight: 1.6 }}>
          Note: the uploaded file cannot be changed. To replace the file, delete this post and create a new one.
        </div>

        {error && (
          <div style={{ color: '#e84545', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, background: 'transparent', color: '#555',
            border: '1px solid #ffffff15', borderRadius: 8, padding: '12px',
            fontFamily: "'DM Mono', monospace", fontSize: 12, cursor: 'pointer',
          }}>CANCEL</button>
          <button onClick={handleSave} disabled={loading} style={{
            flex: 2, background: ac, color: '#080808',
            border: 'none', borderRadius: 8, padding: '12px',
            fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
            letterSpacing: '0.12em', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: `0 4px 16px ${ac}40`,
          }}>
            {loading ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  )
}
