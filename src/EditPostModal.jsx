import { useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { useDropzone } from 'react-dropzone'

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

function ThumbnailDropzone({ thumbnail, thumbnailPreview, onThumbnailChange }) {
  const onDrop = useCallback(accepted => {
    if (!accepted.length) return
    const f = accepted[0]
    onThumbnailChange(f, URL.createObjectURL(f))
  }, [onThumbnailChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif'] },
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: isDragActive ? '#c9a84c10' : '#111',
        border: isDragActive ? '1px dashed #c9a84c' : '1px dashed #ffffff20',
        borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <input {...getInputProps()} />
      {thumbnailPreview ? (
        <>
          <img src={thumbnailPreview} alt="Thumbnail" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, color: '#e8e2d6' }}>{thumbnail?.name || 'Current thumbnail'}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', marginTop: 2 }}>
              {isDragActive ? 'Drop to replace' : 'Click or drag to change'}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: 56, height: 56, background: '#1a1a1a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🖼</div>
          <div>
            <div style={{ fontSize: 12, color: isDragActive ? '#c9a84c' : '#555' }}>
              {isDragActive ? 'Drop image here' : 'Drag & drop or click to add thumbnail'}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#333', marginTop: 2 }}>JPG, PNG, WEBP</div>
          </div>
        </>
      )}
    </div>
  )
}

export default function EditPostModal({ post, accentColor, accessToken, onClose, onSaved }) {
  const [title, setTitle] = useState(post.title || '')
  const [description, setDescription] = useState(post.description || '')
  const [isLocked, setIsLocked] = useState(post.is_locked ?? true)
  const [thumbnail, setThumbnail] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(post.thumbnail_url || null)
  const [videoSource, setVideoSource] = useState(post.video_source || 'upload') // 'upload' | 'youtube'
  const [youtubeUrl, setYoutubeUrl] = useState(post.video_source === 'youtube' ? (post.file_url || '') : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ac = accentColor || '#c9a84c'

  function handleThumbnailChange(file, previewUrl) {
    setThumbnail(file)
    setThumbnailPreview(previewUrl)
  }

  const input = {
    width: '100%', background: '#252530', border: '1px solid #ffffff28',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
    colorScheme: 'dark',
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return }
    if (!description.trim()) { setError('Description is required.'); return }

    const isYoutube = post.type === 'video' && videoSource === 'youtube'
    if (isYoutube && !extractYouTubeId(youtubeUrl.trim())) {
      setError('Please enter a valid YouTube URL.'); return
    }

    setLoading(true)
    setError(null)

    try {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      // Upload new thumbnail if one was selected
      let thumbnailUrl = post.thumbnail_url || null
      if (thumbnail) {
        const thumbExt = thumbnail.name.split('.').pop()
        const thumbPath = `${post.creator_id}/thumb_${Date.now()}.${thumbExt}`
        const thumbRes = await fetch(`${sbUrl}/storage/v1/object/thumbnails/${thumbPath}`, {
          method: 'POST',
          headers: {
            'apikey': sbKey,
            'Authorization': `Bearer ${accessToken || sbKey}`,
            'x-upsert': 'false',
            'Cache-Control': '3600',
          },
          body: thumbnail,
        })
        if (thumbRes.ok) {
          thumbnailUrl = `${sbUrl}/storage/v1/object/public/thumbnails/${thumbPath}`
        } else {
          console.warn('Thumbnail upload failed — keeping existing thumbnail')
        }
      }

      const res = await fetch(`${sbUrl}/rest/v1/posts?id=eq.${post.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': sbKey,
          'Authorization': `Bearer ${accessToken || sbKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          is_locked: isLocked,
          thumbnail_url: thumbnailUrl,
          ...(post.type === 'video' ? {
            video_source: isYoutube ? 'youtube' : 'upload',
            ...(isYoutube ? { file_url: youtubeUrl.trim() } : {}),
          } : {}),
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Update failed (${res.status})`)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const typeLabels = { video: 'VIDEO', audio: 'AUDIO', text: 'PDF', event: 'EVENT' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24,
    }}>
      <div style={{
        background: '#161618', border: '1px solid #ffffff18',
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
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>DESCRIPTION *</div>
        <textarea
          style={{ ...input, minHeight: 100, resize: 'vertical' }}
          placeholder="Description"
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

        {/* Video source toggle — video posts only */}
        {post.type === 'video' && (
          <>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>VIDEO SOURCE</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { id: 'upload',  label: '↑ Uploaded File' },
                { id: 'youtube', label: '▶ YouTube Link' },
              ].map(s => (
                <button key={s.id} onClick={() => setVideoSource(s.id)} style={{
                  flex: 1, padding: '9px 4px', borderRadius: 8, cursor: 'pointer',
                  background: videoSource === s.id ? ac + '18' : 'none',
                  border: videoSource === s.id ? `1px solid ${ac}66` : '1px solid #ffffff15',
                  color: videoSource === s.id ? ac : '#555',
                  fontFamily: "'DM Mono', monospace", fontSize: 11,
                  letterSpacing: '0.08em', textTransform: 'uppercase'
                }}>{s.label}</button>
              ))}
            </div>
            {videoSource === 'youtube' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>YOUTUBE URL</div>
                <input
                  style={input}
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                />
                {youtubeUrl.trim() && !extractYouTubeId(youtubeUrl.trim()) && (
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#e84545', marginTop: -6, marginBottom: 8 }}>
                    Doesn't look like a valid YouTube URL
                  </div>
                )}
              </div>
            )}
            {videoSource === 'upload' && post.video_source === 'youtube' && (
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#e8a545', marginTop: -6, marginBottom: 16, lineHeight: 1.6 }}>
                ⚠ Switching from YouTube to Upload requires the file to already exist — this post has no uploaded file. To use an uploaded file, delete this post and create a new one.
              </div>
            )}
          </>
        )}

        {/* Thumbnail image */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#555', letterSpacing: '0.14em', marginBottom: 8 }}>
            THUMBNAIL IMAGE <span style={{ color: '#333' }}>(OPTIONAL)</span>
          </div>
          <ThumbnailDropzone
            thumbnail={thumbnail}
            thumbnailPreview={thumbnailPreview}
            onThumbnailChange={handleThumbnailChange}
          />
        </div>

        {/* Note: file cannot be replaced */}
        {!(post.type === 'video' && videoSource === 'youtube') && (
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginBottom: 20, lineHeight: 1.6 }}>
            Note: the uploaded file cannot be changed. To replace the file, delete this post and create a new one.
          </div>
        )}

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
