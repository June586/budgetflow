export default function Sheet({ open, onClose, title, children, height = '85vh' }) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="sheet"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: height,
          background: '#0a0f1e',
          borderRadius: '20px 20px 0 0',
          border: '1px solid #1e293b',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#1e293b' }} />
        </div>

        {/* Header */}
        {title && (
          <div style={{
            padding: '8px 20px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid #0f172a',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 800, fontSize: 17, color: '#f1f5f9' }}>{title}</span>
            <button
              onClick={onClose}
              style={{
                background: '#1e293b', border: 'none', borderRadius: 8,
                color: '#64748b', cursor: 'pointer',
                width: 28, height: 28, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}