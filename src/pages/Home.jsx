import { useRef, useEffect, useState } from 'react'
import useStore from '../store/useStore'
import { fmt, fmtShort, getCurrentMonth } from '../lib/helpers'

// ── Mini Flow Canvas ──────────────────────────────────────────
// Layout constants (mirror FlowPage)
const MINI_INC_W = 136, MINI_INC_H = 108
const MINI_GRP_W = 180, MINI_EXP_W = 148, MINI_REM_W = 136, MINI_JAR_W = 160
const MINI_START_X = 60, MINI_START_Y = 60
const MINI_HORIZ_X = 220, MINI_DIAG_X = 200, MINI_DIAG_Y = 110, MINI_REM_Y = 120
const MINI_REM_CHILD_X = 200

function miniGetW(node) {
  if (!node) return 120
  if (node.type === 'income') return MINI_INC_W
  if (node.type === 'expense') return MINI_EXP_W
  if (node.type === 'remainder') return MINI_REM_W
  if (node.type === 'jar') return MINI_JAR_W
  return MINI_GRP_W
}
function miniGetH(node) {
  if (!node) return 100
  if (node.type === 'income') return MINI_INC_H
  if (node.type === 'group') return 100 + (node.children?.length || 0) * 28
  return 100
}

function miniComputeLayout(nodes, pipes) {
  const positions = {}
  const income = nodes.find(n => n.type === 'income')
  const remainder = nodes.find(n => n.type === 'remainder')
  if (!income || !remainder) return positions

  const allNodes = []
  nodes.forEach(n => { allNodes.push(n); if (n.children) n.children.forEach(c => allNodes.push(c)) })
  const remOutTargets = new Set(pipes.filter(p => p.fromId === remainder.id).map(p => p.toId))

  const backbone = []
  let cur = income
  const visited = new Set()
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id)
    backbone.push(cur)
    if (cur.id === remainder.id) break
    const outPipes = pipes.filter(p => p.fromId === cur.id && allNodes.find(n => n.id === p.toId))
    let chosen = outPipes.find(p => p.toId === remainder.id)
    if (!chosen) chosen = outPipes.find(p => !remOutTargets.has(p.toId))
    if (!chosen) chosen = outPipes.find(p => !visited.has(p.toId))
    if (!chosen) break
    cur = allNodes.find(n => n.id === chosen.toId)
    if (!cur) break
  }

  let cx = MINI_START_X, cy = MINI_START_Y
  for (let i = 0; i < backbone.length; i++) {
    const node = backbone[i]
    if (node.type === 'remainder') {
      const prev = backbone[i - 1]
      const prevPos = prev ? positions[prev.id] : null
      if (prevPos) {
        positions[node.id] = {
          x: prevPos.x + miniGetW(prev) / 2 - MINI_REM_W / 2,
          y: prevPos.y + miniGetH(prev) + MINI_REM_Y,
        }
      } else {
        positions[node.id] = { x: cx, y: cy + 200 }
      }
    } else {
      positions[node.id] = { x: cx, y: cy }
    }
    if (i < backbone.length - 1) {
      const next = backbone[i + 1]
      if (next.type !== 'remainder') {
        if (next.type === 'expense') { cx += MINI_DIAG_X; cy += MINI_DIAG_Y }
        else { cx += MINI_HORIZ_X }
      }
    }
  }

  if (!positions[remainder.id]) {
    const last = backbone[backbone.length - 1]
    const lp = last && positions[last.id] ? positions[last.id] : { x: MINI_START_X, y: MINI_START_Y }
    positions[remainder.id] = { x: lp.x + miniGetW(last) / 2 - MINI_REM_W / 2, y: lp.y + miniGetH(last) + MINI_REM_Y }
  }

  // Remainder children
  const remPos = positions[remainder.id]
  if (remPos) {
    const remChildren = pipes
      .filter(p => p.fromId === remainder.id)
      .map(p => ({ pipe: p, node: nodes.find(n => n.id === p.toId) }))
      .filter(item => item.node)
      .sort((a, b) => (a.pipe.sortOrder || 0) - (b.pipe.sortOrder || 0))
    if (remChildren.length > 0) {
      const remCX = remPos.x + MINI_REM_W / 2
      const childY = remPos.y + 100 + 70
      const totalW = (remChildren.length - 1) * MINI_REM_CHILD_X
      const startX = remCX - totalW / 2
      remChildren.forEach(({ node }, idx) => {
        if (!positions[node.id]) {
          positions[node.id] = { x: startX + idx * MINI_REM_CHILD_X - miniGetW(node) / 2, y: childY }
        }
      })
    }
  }

  return positions
}

function MiniCanvas({ nodes, pipes }) {
  const nm = {}
  nodes.forEach(n => {
    nm[n.id] = n
    if (n.children) n.children.forEach(c => { nm[c.id] = { ...c, parentId: n.id } })
  })

  const SCALE = 0.38
  const positions = miniComputeLayout(nodes, pipes)

  const getC = (node) => {
    const pos = positions[node.id] || (node.parentId && positions[node.parentId])
    if (!pos) return { x: 0, y: 0 }
    const w = miniGetW(node)
    const h = miniGetH(node)
    return {
      x: (pos.x + w / 2) * SCALE,
      y: (pos.y + h / 2) * SCALE,
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
        const pos = positions[node.id]
        if (!pos) return null
        const x = pos.x * SCALE
        const y = pos.y * SCALE
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