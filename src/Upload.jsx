import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { supabase } from './supabaseClient'

const ACCEPTED = {
  video:    { 'video/*': ['.mp4', '.mov', '.webm'] },
  audio:    { 'audio/*': ['.mp3', '.wav', '.m4a'] },
  document: { 'application/pdf': ['.pdf'] },
}

const BUCKET_MAP = { video: 'videos', audio: 'audio', document: 'documents' }
const EMOJI_MAP  = { video: '🎛️', audio: '🎵', document: '📖' }

export default function Upload({ creatorId, accentColor, onPostCreated }) {
  const [step, setStep]         = useState('form')   // 'form' | 'uploading' | 'done'
  const [type, setType]         = useState('video')
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [isLocked, setIsLocked] = useState(true)
  const [file, setFile]         = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError]       = useState(null)

  const onDrop = useCallback(accepted => {
    if (accepted.length > 0) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED[type],
    maxFiles: 1,
  })

  async function handleSubmit() {
    if (!title.trim()) { setError('Please add a title.'); return }
    if (!file) { setError('Please select a file to upload.'); return }
    setError(null)
    setStep('uploading')

    let fileUrl = null

    if (file) {
      const bucket = BUCKET_MAP[type]
      const ext    = file.name.split('.').pop()
      const path   = `${creatorId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        setError(uploadError.message)
        setStep('form')
        return
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      fileUrl = urlData.publicUrl
    }

    // Simulate progress bar (Supabase JS v2 doesn't expose upload progress natively)
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i)
      await new Promise(r => setTimeout(r, 80))
    }

    const { error: insertError } = await supabase.from('posts').insert({
      creator_id:      creatorId,
      title:           title.trim(),
      description:     desc.trim(),
      type:            type === 'document' ? 'text' : type,
      file_url:        fileUrl,
      thumbnail_emoji: EMOJI_MAP[type],
      is_locked:       isLocked,
    })

    if (insertError) {
      setError(insertError.message)
      setStep('form')
      return
    }

    setStep('done')
    onPostCreated?.()
  }

  function reset() {
    setStep('form'); setTitle(''); setDesc(''); setFile(null)
    setProgress(0); setError(null); setIsLocked(true); setType('video')
  }

  const input = {
    //width: '100%', background: '#111', border: '1px solid #ffffff15',
    width: '100%', background: '#7e2c2c', border: '1px solid #ffffff15',
    borderRadius: 8, padding: '12px 16px', color: '#e8e2d6',
    fontFamily: "'DM Mono', monospace", fontSize: 13, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
  }

  if (step === 'done') return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
      <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0', marginBottom: 8 }}>Post published!</div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Your content is now live for {isLocked ? 'subscribers' : 'everyone'}.</div>
      <button onClick={reset} style={{ background: accentColor, color: '#080808', border: 'none', borderRadius: 8, padding: '12px 28px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer' }}>
        + NEW POST
      </button>
    </div>
  )

  if (step === 'uploading') return (
    <div style={{ textAlign: 'center', padding: '40px 0' }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#555', letterSpacing: '0.15em', marginBottom: 24 }}>UPLOADING...</div>
      <div style={{ background: '#1a1a1a', borderRadius: 999, height: 6, overflow: 'hidden', maxWidth: 320, margin: '0 auto 16px' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: accentColor, borderRadius: 999, transition: 'width 0.1s' }} />
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: accentColor }}>{progress}%</div>
    </div>
  )

  return (
    <div>
      {/* Post type selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'video',    label: '▶ Video' },
          { id: 'audio',    label: '♪ Audio' },
          { id: 'document', label: '✦ PDF' },
        ].map(t => (
          <button key={t.id} onClick={() => { setType(t.id); setFile(null) }} style={{
            flex: 1, padding: '9px 4px', borderRadius: 8, cursor: 'pointer',
            background: type === t.id ? accentColor + '18' : 'none',
            border: type === t.id ? `1px solid ${accentColor}66` : '1px solid #ffffff15',
            color: type === t.id ? accentColor : '#555',
            fontFamily: "'DM Mono', monospace", fontSize: 11,
            letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>{t.label}</button>
        ))}
      </div>

      {/* Title */}
      <input
        style={input}
        placeholder="Post title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      {/* Description */}
      <textarea
        style={{ ...input, minHeight: 80, resize: 'vertical', fontFamily: "'DM Mono', monospace" }}
        placeholder="Description (optional)"
        value={desc}
        onChange={e => setDesc(e.target.value)}
      />

      {/* File dropzone */}
      {(
        <div {...getRootProps()} style={{
          border: `1px dashed ${isDragActive ? accentColor : '#ffffff20'}`,
          borderRadius: 10, padding: '28px', textAlign: 'center',
          cursor: 'pointer', marginBottom: 12, background: isDragActive ? accentColor + '08' : 'transparent',
          transition: 'all 0.15s'
        }}>
          <input {...getInputProps()} />
          {file ? (
            <div>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{EMOJI_MAP[type]}</div>
              <div style={{ fontSize: 13, color: '#e8e2d6' }}>{file.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#555', marginTop: 4 }}>
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 28, marginBottom: 8, color: '#333' }}>↑</div>
              <div style={{ fontSize: 13, color: '#555' }}>
                {isDragActive ? 'Drop it here' : 'Drag & drop or click to select'}
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#333', marginTop: 6, letterSpacing: '0.1em' }}>
                {type === 'video' ? 'MP4, MOV, WEBM' : type === 'audio' ? 'MP3, WAV, M4A' : 'PDF'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Access toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #ffffff10', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: '#e8e2d6' }}>Subscribers Only</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#444', marginTop: 2 }}>
            {isLocked ? 'Only subscribers can view this content' : 'Free — anyone can view'}
          </div>
        </div>
        <div
          onClick={() => setIsLocked(!isLocked)}
          style={{
            width: 44, height: 24, borderRadius: 999, cursor: 'pointer',
            background: isLocked ? accentColor : '#2a2a2a',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: isLocked ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s'
          }} />
        </div>
      </div>

      {error && (
        <div style={{ color: '#e84545', fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 12 }}>{error}</div>
      )}

      <button onClick={handleSubmit} style={{
        width: '100%', background: accentColor, color: '#080808',
        border: 'none', borderRadius: 8, padding: '14px',
        fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700,
        letterSpacing: '0.15em', cursor: 'pointer', textTransform: 'uppercase'
      }}>
        Publish Post
      </button>
    </div>
  )
}