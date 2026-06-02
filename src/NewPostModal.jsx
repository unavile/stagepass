import Upload from './Upload'

export default function NewPostModal({ creator, accessToken, onClose, onPostCreated }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 24
    }}>
      <div style={{
        background: '#0e0e0e', border: '1px solid #ffffff12',
        borderRadius: 14, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto', padding: 32
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 22, color: '#f0ebe0' }}>New Post</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <Upload
          creatorId={creator.id}
          accentColor={creator.accentColor || '#c9a84c'}
          accessToken={accessToken}
          onPostCreated={() => { onPostCreated?.(); onClose() }}
        />
      </div>
    </div>
  )
}