import { useEffect } from 'react'
import useStore from './store/useStore'
import BottomNav from './components/ui/BottomNav'
import Home from './pages/Home'
import JarsPage from './pages/JarsPage'
import AccountsPage from './pages/AccountsPage'
import IncomePage from './pages/IncomePage'
import HistoryPage from './pages/HistoryPage'
import FlowPage from './pages/FlowPage'

export default function App() {
  const { activeTab, checkCarryOver } = useStore()

  useEffect(() => {
    checkCarryOver()
  }, [])

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: '#020817',
      color: '#f1f5f9',
      fontFamily: "'DM Sans', sans-serif",
      overflow: 'hidden',
     // maxWidth: 480,
     // margin: '0 auto',
      position: 'relative',
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        input, select, textarea { font-family: inherit; }
        @keyframes liquidWave {
          0%,100% { transform: translateX(-10%) scaleY(1); }
          50% { transform: translateX(10%) scaleY(1.05); }
        }
        @keyframes flowDash {
          from { stroke-dashoffset: 30; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes slideUp {
          from { transform:translateY(100%); }
          to   { transform:translateY(0); }
        }
        .page { animation: fadeIn 0.2s ease; }
        .sheet { animation: slideUp 0.25s cubic-bezier(0.32,0.72,0,1); }
      `}</style>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'home'     && <Home />}
        {activeTab === 'jars'     && <JarsPage />}
        {activeTab === 'accounts' && <AccountsPage />}
        {activeTab === 'income'   && <IncomePage />}
        {activeTab === 'history'  && <HistoryPage />}
        {activeTab === 'flow'     && <FlowPage />}
      </div>

      {/* Bottom Nav */}
      <BottomNav />
    </div>
  )
}