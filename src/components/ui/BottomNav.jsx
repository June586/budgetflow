import useStore from '../../store/useStore'

const TABS = [
  { id:'jars',     icon:'🧊', label:'Hũ'      },
  { id:'accounts', icon:'💳', label:'TK'       },
  { id:'income',   icon:'➕', label:'',  main:true },
  { id:'history',  icon:'📒', label:'Lịch sử' },
  { id:'flow',     icon:'⚙️', label:'Flow'    },
]

export default function BottomNav() {
  const { activeTab, setTab, getPendingCount } = useStore()
  const pendingCount = getPendingCount()

  return (
    <div style={{
      height: 64,
      background: '#070d1a',
      borderTop: '1px solid #0f1e36',
      display: 'flex',
      alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 50,
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        const isMain = tab.main

        if (isMain) return (
          <div key={tab.id} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setTab(tab.id)}
              style={{
                width: 56, height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(59,130,246,0.5)',
                marginBottom: 12,
                transition: 'transform 0.15s',
              }}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {tab.icon}
            </button>
          </div>
        )

        return (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            style={{
              flex: 1, height: '100%',
              background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', gap: 2,
              position: 'relative',
            }}
          >
            {/* Badge cho TK nếu có pending */}
            {tab.id === 'accounts' && pendingCount > 0 && (
              <div style={{
                position: 'absolute', top: 8, right: '50%',
                transform: 'translateX(10px)',
                background: '#EF4444',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 9, fontWeight: 700, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {pendingCount > 9 ? '9+' : pendingCount}
              </div>
            )}
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: isActive ? '#38bdf8' : '#475569',
              transition: 'color 0.15s',
            }}>
              {tab.label}
            </span>
            {isActive && (
              <div style={{
                position: 'absolute', bottom: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: 20, height: 2,
                background: '#38bdf8',
                borderRadius: 1,
              }} />
            )}
          </button>
        )
      })}
    </div>
  )
}