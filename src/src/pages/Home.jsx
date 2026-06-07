import { useRef, useEffect, useState } from 'react'
import useStore from '../store/useStore'
import { fmt, fmtShort, getCurrentMonth } from '../lib/helpers'

// ── Mini Flow Canvas ──────────────────────────────────────────
function MiniCanvas({ nodes, pipes }) {
  const nm = {}
  nodes.forEach(n => { nm[n.id] = n })

  const SCALE = 0.38

  const getC = (node) => {
    const w = node.type === 'group' ? 180 : 150
    const h = node.type === 'group' ? 110 + (node.children?.length || 0) * 34 : 100
    return {
      x: (node.x + w / 2) * SCALE,
      y: (node.y + h / 2) * SCALE,
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 180, overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {pipes.map(pipe => {
          const f = nm[pipe.fromId]
          const t = nm[pipe.toId]
          if (!f || !t) return null
          const fc = getC(f)
          const tc = getC(t)
          const dx = tc.x - fc.x
          const d = `M${fc.x} ${fc.y} C${fc.x + dx * 0.5} ${fc.y} ${tc.x - dx * 0.3} ${tc.y} ${tc.x} ${tc.y}`
          const col = f.color || '#3B82F6'
          return (
            <g key={pipe.id}>
              <path d={d} fill="none" stroke={col} strokeWidth={2} strokeOpacity={0.5} strokeLinecap="round" />
              <path d={d} fill="none" stroke="#fff" strokeWidth={1} strokeOpacity={0.25}
                strokeLinecap="round" strokeDasharray="5 12"
              >
                <animate attributeName="stroke-dashoffset" from="17" to="0" dur="1.5s" repeatCount="indefinite" />
              </path>
            </g>
          )
        })}
      </svg>

      {/* Mini nodes */}
      {nodes.map(node => {
        const x = node.x * SCALE
        const y = node.y * SCALE
        if (node.type === 'income') {
          return (
            <div key={node.id} style={{
              position: 'absolute', left: x, top: y,
              background: '#065f46', borderRadius: 8,
              padding: '5px 8px', border: '1px solid #10B981',
            }}>
              <div style={{ fontSize: 12 }}>💧</div>
              <div style={{ color: '#6ee7b7', fontSize: 8, fontWeight: 700 }}>{fmtShort(node.amount || 0)}đ</div>
            </div>
          )
        }
        if (node.type === 'group') {
          const total = node.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0
          const pct = node.limitAmount ? Math.min(total / node.limitAmount * 100, 100) : 0
          return (
            <div key={node.id} style={{
              position: 'absolute', left: x, top: y,
              background: '#0a0f1e', borderRadius: 8,
              padding: '5px 8px', border: `1px solid ${node.color}66`,
              minWidth: 58,
            }}>
              <div style={{ color: node.color, fontSize: 8, fontWeight: 700 }}>🪣 {node.name}</div>
              <div style={{ background: '#1e293b', borderRadius: 2, height: 3, marginTop: 3 }}>
                <div style={{ width: pct + '%', height: '100%', background: node.color, borderRadius: 2 }} />
              </div>
              <div style={{ color: '#64748b', fontSize: 7, marginTop: 2 }}>{fmtShort(total)}đ</div>
            </div>
          )
        }
        if (node.type === 'expense') {
          const pct = node.limitAmount ? Math.min((node.currentAmount || 0) / node.limitAmount * 100, 100) : 0
          return (
            <div key={node.id} style={{
              position: 'absolute', left: x, top: y,
              background: '#0a0f1e', borderRadius: 6,
              width: 50, border: `1px solid ${node.color}44`, overflow: 'hidden',
            }}>
              <div style={{ height: 3, background: node.color + '44' }}>
                <div style={{ width: pct + '%', height: '100%', background: node.color }} />
              </div>
              <div style={{ padding: '3px 6px' }}>
                <div style={{ color: node.color, fontSize: 8, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {node.name}
                </div>
                <div style={{ color: '#64748b', fontSize: 7 }}>{Math.round(pct)}%</div>
              </div>
            </div>
          )
        }
        if (node.type === 'remainder') {
          return (
            <div key={node.id} style={{
              position: 'absolute', left: x, top: y,
              background: '#075985', borderRadius: 8,
              padding: '5px 8px', border: '1px solid #0369a1',
            }}>
              <div style={{ fontSize: 12 }}>🌊</div>
              <div style={{ color: '#7dd3fc', fontSize: 8, fontWeight: 700 }}>{fmtShort(node.currentAmount || 0)}đ</div>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Allocation Bar ────────────────────────────────────────────
function AllocationBar({ nodes, transactions, month }) {
  const income = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0)

  if (income === 0) return null

  // Tính tổng theo nhóm
  const savingsTotal = nodes
    .filter(n => n.type === 'group')
    .reduce((s, n) => s + (n.currentAmount || 0), 0)

  const expenseTotal = nodes
    .filter(n => n.type === 'expense')
    .reduce((s, n) => s + (n.currentAmount || 0), 0)

  const remainderTotal = nodes
    .filter(n => n.type === 'remainder')
    .reduce((s, n) => s + (n.currentAmount || 0), 0)

  const total = savingsTotal + expenseTotal + remainderTotal || 1

  const segments = [
    { label: 'Tiết kiệm', value: savingsTotal, color: '#3B82F6' },
    { label: 'Chi phí',   value: expenseTotal,  color: '#EF4444' },
    { label: 'Còn lại',   value: remainderTotal, color: '#06B6D4' },
  ].filter(s => s.value > 0)

  return (
    <div>
      {/* Bar */}
      <div style={{
        height: 8, borderRadius: 99, overflow: 'hidden',
        display: 'flex', marginBottom: 10,
      }}>
        {segments.map(seg => (
          <div key={seg.label} style={{
            width: (seg.value / total * 100) + '%',
            background: seg.color,
            transition: 'width 0.5s',
          }} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color }} />
            <span style={{ color: '#64748b', fontSize: 11 }}>{seg.label}</span>
            <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>
              {fmt(seg.value)}đ
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Home ─────────────────────────────────────────────────
export default function Home() {
  const { nodes, pipes, transactions, setTab } = useStore()
  const month = getCurrentMonth()
  const [monthLabel] = useState(() => {
    const d = new Date()
    return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`
  })

  const monthIncome = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0)

  const monthExpense = transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0)

  // Active expenses
  const activeExpenses = nodes.filter(n => n.type === 'expense' && n.status !== 'closed')

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 16 }}>
      {/* Mini canvas */}
      <div
        onClick={() => setTab('flow')}
        style={{
          background: '#0a0f1e',
          borderBottom: '1px solid #1e293b',
          padding: '12px 16px 8px',
          cursor: 'pointer', position: 'relative',
        }}
      >
        <MiniCanvas nodes={nodes} pipes={pipes} />
        <div style={{
          position: 'absolute', bottom: 10, right: 12,
          background: '#1e293b', borderRadius: 6,
          padding: '3px 8px', color: '#64748b', fontSize: 10,
        }}>
          Tap để chỉnh ⚙️
        </div>
      </div>

      {/* Tổng thu */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{monthLabel}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div style={{ color: '#475569', fontSize: 11 }}>Tổng thu</div>
            <div style={{ color: '#10B981', fontSize: 28, fontWeight: 800 }}>
              {fmt(monthIncome)}đ
            </div>
          </div>
          {monthExpense > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#475569', fontSize: 11 }}>Đã chi</div>
              <div style={{ color: '#EF4444', fontSize: 18, fontWeight: 700 }}>
                -{fmt(monthExpense)}đ
              </div>
            </div>
          )}
        </div>

        {/* Allocation bar */}
        <div style={{
          background: '#0a0f1e', borderRadius: 14,
          padding: '14px 16px', marginBottom: 20,
          border: '1px solid #1e293b',
        }}>
          <AllocationBar nodes={nodes} transactions={transactions} month={month} />
          {monthIncome === 0 && (
            <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              Chưa có khoản thu nào tháng này
            </div>
          )}
        </div>

        {/* Quick status */}
        <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, marginBottom: 12, letterSpacing: '0.05em' }}>
          TRẠNG THÁI CHI PHÍ
        </div>

        {activeExpenses.length === 0 && (
          <div style={{ color: '#334155', fontSize: 13 }}>Chưa có chai chi phí nào</div>
        )}

        {activeExpenses.map(exp => {
          const pct = exp.limitAmount
            ? Math.min((exp.currentAmount || 0) / exp.limitAmount * 100, 100)
            : 0
          return (
            <div
              key={exp.id}
              onClick={() => setTab('jars')}
              style={{
                background: '#0a0f1e',
                border: `1px solid ${exp.status === 'carryover' ? '#F59E0B33' : '#1e293b'}`,
                borderRadius: 12, padding: '12px 14px',
                marginBottom: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              {/* Mini liquid */}
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: '#0f172a', overflow: 'hidden',
                border: `1.5px solid ${exp.color}44`,
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: pct + '%', background: exp.color,
                  transition: 'height 0.5s',
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800,
                  color: pct > 50 ? '#fff' : '#64748b',
                }}>
                  {Math.round(pct)}%
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>{exp.name}</span>
                  {exp.status === 'carryover' && (
                    <span style={{
                      background: '#F59E0B22', color: '#F59E0B',
                      fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 700,
                    }}>
                      {exp.monthRef}
                    </span>
                  )}
                </div>
                <div style={{
                  background: '#1e293b', borderRadius: 99, height: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    width: pct + '%', height: '100%',
                    background: exp.color, borderRadius: 99,
                    transition: 'width 0.5s',
                  }} />
                </div>
                <div style={{ color: '#475569', fontSize: 10, marginTop: 3 }}>
                  {fmt(exp.currentAmount || 0)} / {fmt(exp.limitAmount)}đ
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}