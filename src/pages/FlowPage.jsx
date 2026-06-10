import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import useStore from '../store/useStore'
import Sheet from '../components/ui/Sheet'
import Field from '../components/ui/Field'
import Button from '../components/ui/Button'
import ColorPicker from '../components/ui/ColorPicker'
import { Input } from '../components/ui/Input'
import { fmt, uid } from '../lib/helpers'

// ── Kích thước node ──
const INC_W = 136, INC_H = 108
const GRP_W = 180, GRP_H = 100
const EXP_W = 148, EXP_H = 128
const REM_W = 136, REM_H = 100
const JAR_W = 160, JAR_H = 86

// ── Layout constants ──
const START_X = 60
const START_Y = 60
const DIAG_X_STEP = 200   // Chai: bước sang phải
const DIAG_Y_STEP = 110   // Chai: bước xuống (chéo)
const HORIZ_X_STEP = 220  // Xô/Hũ: bước sang phải (ngang)
const HORIZ_Y_STEP = 0    // Xô/Hũ: không xuống
const REM_Y_OFFSET = 120  // Còn lại: cách node cuối bao nhiêu px xuống

// Nhánh bên dưới Còn lại
const REM_CHILD_Y_GAP = 30
const REM_CHILD_X_SPREAD = 200

function getNodeW(node) {
  if (!node) return 120
  if (node.type === 'income') return INC_W
  if (node.type === 'expense') return EXP_W
  if (node.type === 'remainder') return REM_W
  if (node.type === 'jar') return JAR_W
  return GRP_W
}
function getNodeH(node) {
  if (!node) return 100
  if (node.type === 'income') return INC_H
  if (node.type === 'expense') return EXP_H
  if (node.type === 'remainder') return REM_H
  if (node.type === 'jar') return JAR_H
  if (node.type === 'group') return GRP_H + (node.children?.length || 0) * 28
  return 100
}

// ────────────────────────────────────────────────────────
// computeLayout
// ────────────────────────────────────────────────────────
function computeLayout(nodes, pipes) {
  const positions = {}
  const income = nodes.find(n => n.type === 'income')
  const remainder = nodes.find(n => n.type === 'remainder')
  if (!income || !remainder) return {}

  // Flat map gồm cả jar con trong group
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

    const outPipes = pipes.filter(p =>
      p.fromId === cur.id &&
      p.fromId !== remainder.id &&
      allNodes.find(n => n.id === p.toId)
    )

    let chosenPipe = outPipes.find(p => p.toId === remainder.id)
    if (!chosenPipe) chosenPipe = outPipes.find(p => !remOutTargets.has(p.toId))
    if (!chosenPipe) chosenPipe = outPipes.find(p => !visited.has(p.toId))
    if (!chosenPipe) break
    const next = allNodes.find(n => n.id === chosenPipe.toId)
    if (!next) break
    cur = next
  }

  // Fallback nếu backbone không hợp lệ
  if (backbone.length < 2) {
    positions[income.id] = { x: START_X, y: START_Y }
    positions[remainder.id] = { x: START_X, y: START_Y + INC_H + REM_Y_OFFSET }
    return positions
  }

  // Place each node in backbone
  let cx = START_X, cy = START_Y
  for (let i = 0; i < backbone.length; i++) {
    const node = backbone[i]
    const isRemainder = node.type === 'remainder'

    if (isRemainder) {
      // Còn lại: thẳng dọc xuống node trước
      const prev = backbone[i - 1]
      const prevPos = prev ? positions[prev.id] : null
      if (prevPos) {
        const prevH = getNodeH(prev)
        positions[node.id] = {
          x: prevPos.x + getNodeW(prev) / 2 - REM_W / 2,
          y: prevPos.y + prevH + REM_Y_OFFSET
        }
      } else {
        // Fallback: income chưa có pos (trường hợp income là node đầu tiên chưa được đặt)
        positions[node.id] = { x: cx + HORIZ_X_STEP / 2 - REM_W / 2, y: cy + 200 }
      }
    } else {
      positions[node.id] = { x: cx, y: cy }
    }

    // Bước sang node tiếp theo
    if (i < backbone.length - 1) {
      const next = backbone[i + 1]
      if (next.type === 'remainder') {
        // Không cần bước, remainder tự tính ở trên
      } else if (next.type === 'expense') {
        // Chai: chéo xuống
        cx += DIAG_X_STEP
        cy += DIAG_Y_STEP
      } else {
        // Xô/Hũ: ngang
        cx += HORIZ_X_STEP
        cy += HORIZ_Y_STEP
      }
    }
  }

  // Đảm bảo remainder luôn có position (kể cả khi backbone traversal thất bại)
  if (!positions[remainder.id]) {
    const lastBackboneNode = backbone[backbone.length - 1]
    const refPos = lastBackboneNode && positions[lastBackboneNode.id]
      ? positions[lastBackboneNode.id]
      : { x: START_X, y: START_Y }
    const refNode = lastBackboneNode || income
    positions[remainder.id] = {
      x: refPos.x + getNodeW(refNode) / 2 - REM_W / 2,
      y: refPos.y + getNodeH(refNode) + REM_Y_OFFSET,
    }
  }

  // Nhánh con từ Còn lại (tỏa ngang bên dưới)
  const remChildren = pipes
    .filter(p => p.fromId === remainder.id)
    .map(p => ({ pipe: p, node: nodes.find(n => n.id === p.toId) }))
    .filter(item => item.node)
    .sort((a, b) => (a.pipe.sortOrder || 0) - (b.pipe.sortOrder || 0))

if (remChildren.length > 0) {
  const remPos = positions[remainder.id]
  if (!remPos) return positions
  const remCenterX = remPos.x + REM_W / 2
  const childY = remPos.y + REM_H + REM_CHILD_Y_GAP + 40

  const totalWidth = (remChildren.length - 1) * REM_CHILD_X_SPREAD
  const startX = remCenterX - totalWidth / 2

  remChildren.forEach(({ node }, idx) => {
    // Chỉ đặt vị trí nếu node chưa được đặt (tránh ghi đè backbone)
    if (!positions[node.id]) {
      positions[node.id] = {
        x: startX + idx * REM_CHILD_X_SPREAD - getNodeW(node) / 2,
        y: childY
      }
    }
  })
}

  return positions
}

function canvasSize(positions, nodes) {
  let w = 1800, h = 900
  Object.entries(positions).forEach(([id, { x, y }]) => {
    const node = nodes?.find(n => n.id === id)
    w = Math.max(w, x + getNodeW(node) + 150)
    h = Math.max(h, y + getNodeH(node) + 150)
  })
  return { w, h }
}

// ────────────────────────────────────────────────────────
// getConnectPoints – điểm nối của mỗi node
// fromSide: 'right' | 'bottom-right'
// toSide: 'left' | 'top'
// ────────────────────────────────────────────────────────
function getNodeExitPoint(node, pos) {
  // Đầu ra: mép phải giữa
  const w = getNodeW(node), h = getNodeH(node)
  return { x: pos.x + w, y: pos.y + h / 2 }
}
function getNodeEntryPoint(node, pos, fromNode) {
  const w = getNodeW(node), h = getNodeH(node)
  // Còn lại: vào từ trên (top center)
  if (node.type === 'remainder') {
    return { x: pos.x + w / 2, y: pos.y }
  }
  // Chai nhận từ bên trái
  if (node.type === 'expense') {
    return { x: pos.x, y: pos.y + h / 2 }
  }
  // Mặc định: mép trái giữa
  return { x: pos.x, y: pos.y + h / 2 }
}

// ────────────────────────────────────────────────────────
// FlowSVG
// ────────────────────────────────────────────────────────
function FlowSVG({ nodes, pipes, positions, cSize, editMode, onPipeAddClick }) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  // Thêm jar children vào nodeMap để backbone traversal tìm được
  nodes.forEach(n => {
    if (n.children) n.children.forEach(c => {
      if (!nodeMap.has(c.id)) nodeMap.set(c.id, { ...c, parentName: n.name, parentId: n.id })
    })
  })
  const remainder = nodes.find(n => n.type === 'remainder')

  // Build backbone pipe ids
  const backbonePipeIds = new Set()
  const remOutTargetsSvg = new Set(pipes.filter(p => p.fromId === remainder?.id).map(p => p.toId))
  let cur = nodes.find(n => n.type === 'income')
  const visitedSvg = new Set()
  while (cur && !visitedSvg.has(cur.id)) {
    visitedSvg.add(cur.id)
    const outPipes = pipes.filter(p => p.fromId === cur.id && nodeMap.get(p.toId))
    const pipe = outPipes.find(p => p.toId === remainder?.id)
      || outPipes.find(p => !remOutTargetsSvg.has(p.toId))
      || outPipes.find(p => !visitedSvg.has(p.toId))
    if (!pipe) break
    backbonePipeIds.add(pipe.id)
    if (pipe.toId === remainder?.id) break
    cur = nodeMap.get(pipe.toId)
  }

  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }} width={cSize.w} height={cSize.h}>
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#334155" />
        </marker>
      </defs>
      {pipes.map(pipe => {
        const fromNode = nodeMap.get(pipe.fromId)
        const toNode = nodeMap.get(pipe.toId)
        if (!fromNode || !toNode) return null
        // Jar con trong group không có position riêng → fallback về parent group
        const resolvePos = (node) => {
          if (positions[node.id]) return positions[node.id]
          if (node.parentId && positions[node.parentId]) return positions[node.parentId]
          return null
        }
        const fromPos = resolvePos(fromNode)
        const toPos = resolvePos(toNode)
        if (!fromPos || !toPos) return null

        const isBackbone = backbonePipeIds.has(pipe.id)
        const isRemChild = fromNode.type === 'remainder'

        let d
        if (isRemChild) {
          // Từ Còn lại xuống các con
          const fx = fromPos.x + REM_W / 2
          const fy = fromPos.y + REM_H
          const tx = toPos.x + getNodeW(toNode) / 2
          const ty = toPos.y
          d = `M${fx} ${fy} C${fx} ${fy + 40}, ${tx} ${ty - 40}, ${tx} ${ty}`
        } else if (toNode.type === 'remainder') {
          // Đi từ đáy dưới của fromNode xuống đỉnh remainder
          const fx = fromPos.x + getNodeW(fromNode) / 2
          const fy = fromPos.y + getNodeH(fromNode)
          const tx = toPos.x + REM_W / 2
          const ty = toPos.y
          // Đường cong thẳng đứng rồi lượn nhẹ
          d = `M${fx} ${fy} C${fx} ${fy + 40}, ${tx} ${ty - 40}, ${tx} ${ty}`
        } else {
          // Backbone pipe thường: mép phải → mép trái, bezier ngang/chéo
          const from = getNodeExitPoint(fromNode, fromPos)
          const to = getNodeEntryPoint(toNode, toPos, fromNode)
          const cx1 = from.x + (to.x - from.x) * 0.5
          const cy1 = from.y
          const cx2 = from.x + (to.x - from.x) * 0.5
          const cy2 = to.y
          d = `M${from.x} ${from.y} C${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`
        }

        const col = toNode.color || (toNode.type === 'remainder' ? '#06B6D4' : '#3B82F6')

        return (
          <g key={pipe.id}>
            <path d={d} fill="none" stroke={col + '44'} strokeWidth={8} strokeLinecap="round" />
            <path d={d} fill="none" stroke={col} strokeWidth={3} strokeLinecap="round" strokeDasharray={isBackbone ? 'none' : '6 4'} />
          </g>
        )
      })}

      {/* Dấu + trên từng đoạn pipe khi editMode */}
      {editMode && (() => {
        const btns = []
        const remOutTargetsSvg2 = new Set(pipes.filter(p => p.fromId === remainder?.id).map(p => p.toId))
        let cur2 = nodes.find(n => n.type === 'income')
        const vis2 = new Set()
        while (cur2 && !vis2.has(cur2.id)) {
          vis2.add(cur2.id)
          const outPipes2 = pipes.filter(p => p.fromId === cur2.id && nodeMap.get(p.toId))
          const pipe = outPipes2.find(p => p.toId === remainder?.id)
            || outPipes2.find(p => !remOutTargetsSvg2.has(p.toId))
            || outPipes2.find(p => !vis2.has(p.toId))
          if (!pipe) break
          const toNode = nodeMap.get(pipe.toId)
          if (!toNode) break
          const fromPos2 = positions[cur2.id]
          const toPos2 = positions[toNode.id]
          if (fromPos2 && toPos2) {
            let mx, my
            if (toNode.type === 'remainder') {
            const fx = fromPos2.x + getNodeW(cur2) / 2
            const fy = fromPos2.y + getNodeH(cur2)
            const tx = toPos2.x + REM_W / 2
            const ty = toPos2.y
            mx = (fx + tx) / 2
            my = (fy + ty) / 2
          } else {
              const from = getNodeExitPoint(cur2, fromPos2)
              const to = getNodeEntryPoint(toNode, toPos2, cur2)
              mx = (from.x + to.x) / 2
              my = (from.y + to.y) / 2
            }
            btns.push(
              <g key={pipe.id + '-add'} style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onPipeAddClick?.(pipe.fromId) }}>
                <circle cx={mx} cy={my} r={13} fill="#0d1829" stroke="#3B82F6" strokeWidth={1.5} />
                <text x={mx} y={my + 5} textAnchor="middle" fill="#3B82F6" fontSize={16} fontWeight={700}>+</text>
              </g>
            )
          }
          if (toNode.type === 'remainder') break
          cur2 = toNode
        }
        return btns
      })()}
    </svg>
  )
}

// ────────────────────────────────────────────────────────
// AddBtn – nút + cố định trước Còn lại (khi không edit mode)
// ────────────────────────────────────────────────────────
function AddBtn({ x, y, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: x - 14,
        top: y - 14,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: hover ? '#0f2040' : '#0d1829',
        border: `1.5px dashed ${hover ? '#3B82F6' : '#334155'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: 6,
        color: hover ? '#3B82F6' : '#475569',
        fontSize: 18, fontWeight: 700,
        transition: 'all .15s',
      }}
    >+</div>
  )
}

// ────────────────────────────────────────────────────────
// EditModeOverlay – hiển thị ✕ trên các node khi edit mode
// ────────────────────────────────────────────────────────
function DeleteBadge({ x, y, onClick }) {
  return (
    <div onClick={e => { e.stopPropagation(); onClick() }} style={{
      position: 'absolute',
      left: x - 11, top: y - 11,
      width: 22, height: 22,
      borderRadius: '50%',
      background: '#EF4444',
      color: '#fff',
      fontSize: 13, fontWeight: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', zIndex: 10,
      boxShadow: '0 2px 8px #EF444466',
    }}>✕</div>
  )
}

// ────────────────────────────────────────────────────────
// Card components
// ────────────────────────────────────────────────────────
function IncomeCard({ node, pos, selected, onSelect, onHoldStart, onHoldEnd }) {
  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, width: INC_W, zIndex: 2, cursor: 'pointer', userSelect: 'none' }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      onMouseDown={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onMouseUp={e => { e.stopPropagation(); onHoldEnd() }}
      onMouseLeave={() => onHoldEnd()}
      onTouchStart={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onTouchEnd={() => onHoldEnd()}>
      <div style={{
        background: 'linear-gradient(135deg,#064e3b,#065f46)',
        border: `2px solid ${selected ? '#10B981' : '#065f46'}`,
        borderRadius: 16, padding: '11px 13px',
        boxShadow: selected ? '0 0 0 3px #10B98130' : '0 4px 20px #00000066',
      }}>
        <div style={{ fontSize: 20 }}>💧</div>
        <div style={{ color: '#6ee7b7', fontSize: 9, fontWeight: 700, marginTop: 4 }}>Nguồn thu</div>
        <div style={{ color: '#ecfdf5', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
        <div style={{ color: '#34d399', fontSize: 15, fontWeight: 800, marginTop: 5 }}>{fmt(node.amount || 0)}đ</div>
      </div>
    </div>
  )
}

function GroupCard({ node, pos, selected, onSelect, onHoldStart, onHoldEnd }) {
  const { nodes } = useStore() // lấy toàn bộ nodes
  const realNode = node.originalId ? nodes.find(n => n.id === node.originalId) : node
  const total = realNode?.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0
  const pct = realNode?.limitAmount ? Math.min(total / realNode.limitAmount * 100, 100) : 0
  const col = node.color || '#3B82F6'
  const limitAmount = realNode?.limitAmount ?? node.limitAmount

  // Phần render giữ nguyên, chỉ thay đổi các biến total, pct, limitAmount
  // Thêm badge nếu là clone
  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, width: GRP_W, zIndex: 2, cursor: 'pointer', userSelect: 'none' }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      onMouseDown={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onMouseUp={() => onHoldEnd()}
      onMouseLeave={() => onHoldEnd()}
      onTouchStart={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onTouchEnd={() => onHoldEnd()}>
      <div style={{ position: 'relative', background: '#0a0f1e', border: `2px solid ${selected ? col : '#1e293b'}`, borderRadius: 14, overflow: 'hidden', boxShadow: selected ? `0 0 0 3px ${col}22` : '0 4px 16px #00000066' }}>
        {node.originalId && (
          <div style={{ position: 'absolute', top: 4, right: 4, background: '#F59E0B', color: '#000', fontSize: 9, padding: '1px 5px', borderRadius: 12, fontWeight: 'bold', zIndex: 3 }}>
            ⤴️ clone
          </div>
        )}
        {/* Phần nội dung card giữ nguyên, dùng total, pct, limitAmount */}
        <div style={{ background: col + '18', padding: '8px 12px 7px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ color: col, fontSize: 9, fontWeight: 700 }}>🪣 Xô nhóm</div>
          <div style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
          <div style={{ background: '#1e293b', borderRadius: 3, height: 3, marginTop: 5 }}>
            <div style={{ width: pct + '%', height: '100%', background: col, borderRadius: 3 }} />
          </div>
          <div style={{ color: '#64748b', fontSize: 9, marginTop: 2 }}>{fmt(total)} / {fmt(limitAmount || 0)}đ</div>
        </div>
        {realNode?.children?.map(jar => (
          <div key={jar.id} style={{ padding: '5px 12px', borderBottom: '1px solid #0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: '#94a3b8', fontSize: 10 }}>{jar.name}</span>
              <span style={{ color: jar.color || col, fontSize: 9, fontWeight: 700 }}>{jar.ratio}%</span>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 2, height: 2 }}>
              <div style={{ width: `${Math.min((jar.currentAmount || 0) / (jar.limitAmount || 1) * 100, 100)}%`, height: '100%', background: jar.color || col }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExpenseCard({ node, pos, selected, onSelect, onHoldStart, onHoldEnd }) {
  const pct = node.limitAmount ? Math.min((node.currentAmount || 0) / node.limitAmount * 100, 100) : 0
  const col = node.color || '#EF4444'
  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, width: EXP_W, zIndex: 2, cursor: 'pointer', userSelect: 'none' }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      onMouseDown={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onMouseUp={() => onHoldEnd()}
      onMouseLeave={() => onHoldEnd()}
      onTouchStart={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onTouchEnd={() => onHoldEnd()}>
      <div style={{
        background: '#0a0f1e',
        border: `2px solid ${selected ? col : '#1e293b'}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: selected ? `0 0 0 3px ${col}22` : '0 4px 14px #00000055',
      }}>
        <div style={{ height: 5, background: col + '22' }}>
          <div style={{ width: pct + '%', height: '100%', background: col }} />
        </div>
        <div style={{ padding: '7px 10px' }}>
          <div style={{ color: col, fontSize: 9, fontWeight: 700 }}>🍶 Chai chi phí</div>
          <div style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700, marginTop: 1 }}>{node.name}</div>
          <div style={{
            position: 'relative', background: '#0f172a', borderRadius: 6, height: 34, overflow: 'hidden', marginTop: 5,
            border: `1px solid ${col}22`,
          }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: pct + '%', background: `linear-gradient(180deg,${col}55,${col})` }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pct > 55 ? '#fff' : '#94a3b8', fontSize: 11, fontWeight: 800 }}>
              {Math.round(pct)}%
            </div>
          </div>
          <div style={{ color: '#475569', fontSize: 9, marginTop: 4, textAlign: 'right' }}>
            {fmt(node.currentAmount || 0)} / {fmt(node.limitAmount)}đ
          </div>
        </div>
      </div>
    </div>
  )
}

function RemainderCard({ node, pos, selected, onSelect, onHoldStart, onHoldEnd, onAddChild }) {
  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, width: REM_W, zIndex: 2 }}>
      <div
        onClick={e => { e.stopPropagation(); onSelect(node.id) }}
        onMouseDown={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
        onMouseUp={() => onHoldEnd()}
        onMouseLeave={() => onHoldEnd()}
        onTouchStart={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
        onTouchEnd={() => onHoldEnd()}
        style={{ cursor: 'pointer', userSelect: 'none' }}>
        <div style={{
          background: 'linear-gradient(135deg,#0c4a6e,#075985)',
          border: `2px solid ${selected ? '#06B6D4' : '#0369a1'}`,
          borderRadius: 16, overflow: 'hidden',
          boxShadow: selected ? '0 0 0 3px #06B6D430' : '0 4px 20px #00000066',
        }}>
          <div style={{ padding: '10px 13px' }}>
            <div style={{ fontSize: 18 }}>🌊</div>
            <div style={{ color: '#7dd3fc', fontSize: 9, fontWeight: 700, marginTop: 3 }}>Còn lại</div>
            <div style={{ color: '#e0f2fe', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
            <div style={{ color: '#38bdf8', fontSize: 14, fontWeight: 800, marginTop: 4 }}>{fmt(node.currentAmount || 0)}đ</div>
          </div>
          <div
            onClick={e => { e.stopPropagation(); onAddChild() }}
            style={{
              borderTop: '1px dashed #0369a1',
              padding: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#38bdf8', fontSize: 20, fontWeight: 700, cursor: 'pointer',
              background: '#0c1a2e',
            }}>+</div>
        </div>
      </div>
    </div>
  )
}

function RemChildCard({ node, pos, selected, onSelect, onHoldStart, onHoldEnd }) {
  const { nodes: allNodes } = useStore()
  const isGroup = node.type === 'group'
  // Resolve clone → original để đọc currentAmount đúng
  const realNode = node.originalId ? (allNodes.find(n => n.id === node.originalId) || node) : node
  const total = isGroup
    ? (realNode.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0)
    : (realNode.currentAmount || 0)
  const pct = realNode.limitAmount ? Math.min(total / realNode.limitAmount * 100, 100) : 0
  const col = node.color || '#3B82F6'
  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, width: GRP_W, zIndex: 2, cursor: 'pointer', userSelect: 'none' }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      onMouseDown={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onMouseUp={() => onHoldEnd()}
      onMouseLeave={() => onHoldEnd()}
      onTouchStart={e => { e.stopPropagation(); onHoldStart(e, node.id) }}
      onTouchEnd={() => onHoldEnd()}>
      <div style={{
        background: '#0a0f1e',
        border: `2px solid ${selected ? col : '#1e293b'}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: selected ? `0 0 0 3px ${col}22` : '0 4px 14px #00000055',
      }}>
        <div style={{ background: col + '18', padding: '8px 12px 7px', borderBottom: isGroup ? '1px solid #1e293b' : 'none' }}>
          <div style={{ color: col, fontSize: 9, fontWeight: 700 }}>{isGroup ? '🪣 Xô' : '🫙 Hũ'}</div>
          <div style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
          <div style={{ background: '#1e293b', borderRadius: 3, height: 3, marginTop: 5 }}>
            <div style={{ width: pct + '%', height: '100%', background: col }} />
          </div>
          <div style={{ color: '#64748b', fontSize: 9, marginTop: 2 }}>{fmt(total)}đ{realNode.limitAmount ? ` / ${fmt(realNode.limitAmount)}đ` : ''}</div>
        </div>
        {isGroup && realNode.children?.map(jar => (
          <div key={jar.id} style={{ padding: '4px 12px', borderBottom: '1px solid #0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ color: '#94a3b8', fontSize: 10 }}>{jar.name}</span>
              <span style={{ color: jar.color || col, fontSize: 9, fontWeight: 700 }}>{jar.ratio}%</span>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 2, height: 2 }}>
              <div style={{ width: `${Math.min((jar.currentAmount || 0) / (jar.limitAmount || 1) * 100, 100)}%`, height: '100%', background: jar.color || col }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// AddToFlowSheet
// ────────────────────────────────────────────────────────
function AddToFlowSheet({ open, onClose, mode, nodes, pipes, onAdd }) {
  const [step, setStep] = useState('type')
  const [selType, setSelType] = useState(null)
  const [selNodeId, setSelNodeId] = useState(null)
  const [ratio, setRatio] = useState('0')
  const [monthlyCap, setMonthlyCap] = useState('')

  const reset = () => { setStep('type'); setSelType(null); setSelNodeId(null); setRatio('0'); setMonthlyCap('') }

  // Nodes đang có trong backbone (để cho phép dùng lại)
  const typeOpts = mode === 'backbone'
    ? [{ v: 'group', icon: '🪣', label: 'Xô / Hũ' }, { v: 'jar', icon: '🫙', label: 'Hũ đơn' }, { v: 'expense', icon: '🍶', label: 'Chai chi phí' }]
    : [{ v: 'group', icon: '🪣', label: 'Xô nhóm' }, { v: 'jar', icon: '🫙', label: 'Hũ đơn' }]

  const pickList = useMemo(() => {
    if (selType === 'group') return nodes.filter(n => n.type === 'group' && !n.originalId)
    if (selType === 'expense') return nodes.filter(n => n.type === 'expense' && n.status !== 'closed' && !n.originalId)
    if (selType === 'jar') {
      const jars = []
      // Backbone: hũ đơn top-level + hũ con trong group (giống Còn lại)
      nodes.forEach(n => { if (n.type === 'jar' && !n.originalId) jars.push(n) })
      nodes.forEach(n => {
        if (n.type === 'group' && !n.originalId && n.children) {
          n.children.forEach(c => jars.push({ ...c, parentName: n.name, parentColor: n.color }))
        }
      })
      if (mode !== 'backbone') {
        // Còn lại đã include hết rồi, không cần thêm
      }
      return jars
    }
    return []
  }, [selType, nodes])

  const submit = () => {
    if (!selNodeId) return
    onAdd({ nodeId: selNodeId, ratio: parseFloat(ratio) || 0, monthlyCapAmount: monthlyCap ? parseFloat(monthlyCap) : null })
    reset(); onClose()
  }

  return (
    <Sheet open={open} onClose={() => { reset(); onClose() }} title="➕ Thêm vào flow" height="80vh">
      {step === 'type' && (
        <>
          <div style={{ color: '#64748b', fontSize: 12, marginBottom: 14 }}>
            {mode === 'backbone' ? 'Thêm vào dây chuyền chính' : 'Thêm nhận tiền từ Còn lại'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {typeOpts.map(opt => (
              <button key={opt.v} onClick={() => { setSelType(opt.v); setStep('pick') }} style={{
                flex: 1, padding: '16px 10px', borderRadius: 12,
                border: '1.5px solid #1e293b', background: '#0a0f1e',
                color: '#cbd5e1', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 24 }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'pick' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setStep('type')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 13, cursor: 'pointer' }}>← Quay lại</button>
            <span style={{ color: '#64748b', fontSize: 12 }}>Chọn {selType === 'group' ? 'Xô / Hũ' : selType === 'expense' ? 'Chai' : 'Hũ'}</span>
          </div>
          {pickList.length === 0 && (
            <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
              Không có node nào khả dụng.<br />
              <span style={{ color: '#475569', fontSize: 11 }}>Tạo mới trong tab Hũ & Chai trước.</span>
            </div>
          )}
          {pickList.map(n => {
            const col = n.color || '#3B82F6'
            const total = n.type === 'group' ? n.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0 : n.currentAmount || 0
            // Kiểm tra đã kết nối từ Còn lại chưa (qua clone hoặc pipe trực tiếp)
            const remainder = nodes.find(x => x.type === 'remainder')
            const alreadyConnected = mode === 'remainder' && remainder && (
              pipes.some(p => p.fromId === remainder.id && p.toId === n.id) ||
              nodes.some(clone => clone.originalId === n.id && pipes.some(p => p.fromId === remainder.id && p.toId === clone.id))
            )
            return (
              <div key={n.id} onClick={() => { setSelNodeId(n.id); setStep('config') }} style={{
                background: '#0a0f1e',
                border: `1.5px solid ${selNodeId === n.id ? col : alreadyConnected ? col + '55' : '#1e293b'}`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: col }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>{n.name}</span>
                    {alreadyConnected && <span style={{ background: col + '33', color: col, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8 }}>đã kết nối</span>}
                  </div>
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                    {n.parentName && <span style={{ color: '#334155' }}>{n.parentName} › </span>}
                    {n.type === 'group' && `${n.children?.length || 0} hũ con · `}
                    {fmt(total)}đ hiện có{n.limitAmount ? ` / ${fmt(n.limitAmount)}đ` : ''}
                  </div>
                </div>
                <span style={{ color: '#334155' }}>›</span>
              </div>
            )
          })}
        </>
      )}

      {step === 'config' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 13, cursor: 'pointer' }}>← Quay lại</button>
          </div>
          <Field label="Tỷ lệ nhận (%)" hint="0 = nhận phần dư còn lại">
            <Input type="number" value={ratio} onChange={v => setRatio(v)} />
          </Field>
          {mode === 'backbone' && (
            <Field label="Giới hạn / tháng (đ)" hint="Tùy chọn">
              <Input type="number" value={monthlyCap} onChange={v => setMonthlyCap(v)} placeholder="Không giới hạn" />
            </Field>
          )}
          <Button onClick={submit} full>✅ Xác nhận thêm</Button>
        </>
      )}
    </Sheet>
  )
}

// ────────────────────────────────────────────────────────
// PipePanel
// ────────────────────────────────────────────────────────
function PipePanel({ pipe, nodes, onClose }) {
  const { updatePipe, deletePipe } = useStore()
  const [form, setForm] = useState({ ...pipe })
  const toNode = nodes.find(n => n.id === pipe.toId)
  const fromNode = nodes.find(n => n.id === pipe.fromId)

  const save = () => {
    updatePipe({ ...form, ratio: parseFloat(form.ratio) || 0, sortOrder: parseInt(form.sortOrder) || 0, monthlyCapAmount: form.monthlyCapAmount ? parseFloat(form.monthlyCapAmount) : null })
    onClose()
  }
  const removeFromFlow = () => { deletePipe(pipe.id); onClose() }

  return (
    <Sheet open={true} onClose={onClose} title="🔧 Chỉnh ống nối" height="60vh">
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: fromNode?.color || '#64748b', fontWeight: 700 }}>{fromNode?.name}</span>
        <span style={{ color: '#475569' }}>→</span>
        <span style={{ color: toNode?.color || '#64748b', fontWeight: 700 }}>{toNode?.name}</span>
      </div>
      <Field label="Tỷ lệ (%)" hint="% thu nhập / còn lại chảy vào đây. 0 = nhận phần dư">
        <Input type="number" value={form.ratio ?? ''} onChange={v => setForm(f => ({ ...f, ratio: v }))} />
      </Field>
      <Field label="Giới hạn nhận / tháng (đ)" hint="Chỉ áp dụng trong flow">
        <Input type="number" value={form.monthlyCapAmount ?? ''} onChange={v => setForm(f => ({ ...f, monthlyCapAmount: v }))} placeholder="Không giới hạn" />
      </Field>
      <Field label="Thứ tự ưu tiên" hint="Số nhỏ = nhận trước">
        <Input type="number" value={form.sortOrder ?? 0} onChange={v => setForm(f => ({ ...f, sortOrder: v }))} />
      </Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Button onClick={removeFromFlow} variant="danger" size="sm">🗑 Gỡ khỏi flow</Button>
        <Button onClick={save} full>💾 Lưu</Button>
      </div>
    </Sheet>
  )
}

// ────────────────────────────────────────────────────────
// NodeInfoPanel
// ────────────────────────────────────────────────────────
function NodeInfoPanel({ node, pipes, onClose, onEditPipe }) {
  const pipe = pipes.find(p => p.toId === node.id)
  const col = node.color || '#3B82F6'
  const total = node.type === 'group' ? node.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0 : node.currentAmount || 0
  const pct = node.limitAmount ? Math.min(total / node.limitAmount * 100, 100) : 0

  return (
    <Sheet open onClose={onClose} title={node.name} height="60vh">
      {node.limitAmount && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#1e293b', borderRadius: 99, height: 8, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ width: pct + '%', height: '100%', background: col }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: 12 }}>{fmt(total)}đ</span>
            <span style={{ color: col, fontSize: 12, fontWeight: 700 }}>{Math.round(pct)}% / {fmt(node.limitAmount)}đ</span>
          </div>
        </div>
      )}
      {pipe && (
        <div style={{ background: '#0f172a', borderRadius: 12, padding: '12px 14px', marginBottom: 16, border: '1px solid #1e293b' }}>
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, marginBottom: 8 }}>CÀI ĐẶT TRONG FLOW</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Tỷ lệ</span>
            <span style={{ color: col, fontWeight: 700 }}>{pipe.ratio > 0 ? `${pipe.ratio}%` : 'Nhận phần dư'}</span>
          </div>
          {pipe.monthlyCapAmount && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>Giới hạn / tháng</span>
              <span style={{ color: '#F59E0B', fontWeight: 700 }}>{fmt(pipe.monthlyCapAmount)}đ</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Thứ tự ưu tiên</span>
            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>#{pipe.sortOrder}</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        {pipe && <Button onClick={() => { onClose(); onEditPipe(pipe.id) }} full>🔧 Chỉnh ống nối</Button>}
      </div>
    </Sheet>
  )
}

// ────────────────────────────────────────────────────────
// MAIN FlowPage
// ────────────────────────────────────────────────────────
const HOLD_DURATION = 3500 // ms để vào edit mode

export default function FlowPage() {
  const { nodes, pipes, addPipe, deletePipe, updatePipe, spliceIntoPipe, removeFromPipe, addRemainderChild } = useStore()
  const canvasRef = useRef(null)
  const [editPipeId, setEditPipeId] = useState(null)
  const [infoNodeId, setInfoNodeId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState('backbone')
  const [insertAfter, setInsertAfter] = useState(null)

  // Edit mode (hold to activate)
  const [editMode, setEditMode] = useState(false)
  const holdTimer = useRef(null)
  const holdNodeId = useRef(null)

  // Drag & drop (chỉ trong edit mode)
  const dragging = useRef(null)
  const dragTarget = useRef(null)

  const positions = useMemo(() => computeLayout(nodes, pipes), [nodes, pipes])
  const cSize = canvasSize(positions, nodes)
  const remainder = nodes.find(n => n.type === 'remainder')


  // ── Hold gesture ──
  const handleHoldStart = useCallback((e, nodeId) => {
    if (editMode) {
      // Trong edit mode: bắt đầu drag
      const node = nodes.find(n => n.id === nodeId)
      if (!node || node.type === 'income' || node.type === 'remainder') return
      e.preventDefault()
      dragging.current = { nodeId, startX: e.clientX || e.touches?.[0]?.clientX, startY: e.clientY || e.touches?.[0]?.clientY }
      dragTarget.current = nodeId
      return
    }
    holdNodeId.current = nodeId
    holdTimer.current = setTimeout(() => {
      setEditMode(true)
      holdNodeId.current = null
    }, HOLD_DURATION)
  }, [editMode, nodes])

  const handleHoldEnd = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  // ── Drag logic ──
  const onMouseMove = useCallback((e) => {
    // Chỉ dùng cho visual feedback nếu cần sau
  }, [])

  const onMouseUp = useCallback((e) => {
    if (!dragging.current || !editMode) return
    const { nodeId, startX, startY } = dragging.current
    const endX = e.clientX
    const endY = e.clientY
    if (Math.hypot(endX - startX, endY - startY) < 10) {
      dragging.current = null; dragTarget.current = null; return
    }

    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    const mx = endX - canvasRect.left
    const my = endY - canvasRect.top

    // Tìm backbone nodes (không kể income, remainder)
    const remChildIds = new Set(pipes.filter(p => p.fromId === remainder?.id).map(p => p.toId))
    const backboneNodes = []
    let cur = nodes.find(n => n.type === 'income')
    while (cur) {
      if (cur.type !== 'income' && cur.type !== 'remainder') backboneNodes.push(cur)
      const outPipe = pipes.find(p => p.fromId === cur.id && !remChildIds.has(p.toId))
      if (!outPipe) break
      const next = nodes.find(n => n.id === outPipe.toId)
      if (!next) break
      cur = next
    }

    let targetIndex = -1
    for (let i = 0; i < backboneNodes.length; i++) {
      const n = backboneNodes[i]
      const pos = positions[n.id]
      if (!pos) continue
      const w = getNodeW(n), h = getNodeH(n)
      if (mx >= pos.x && mx <= pos.x + w && my >= pos.y && my <= pos.y + h) {
        targetIndex = i; break
      }
    }

    if (targetIndex !== -1 && backboneNodes[targetIndex].id !== nodeId) {
      const draggedNode = backboneNodes.find(n => n.id === nodeId)
      const targetNode = backboneNodes[targetIndex]
      if (!draggedNode || !targetNode) return

      // Xóa dragged khỏi vị trí cũ (nối lại)
      removeFromPipe(nodeId)

      // Chèn vào trước targetNode (tức là sau node trước targetNode)
      // Sau removeFromPipe, pipes đã thay đổi trong store — dùng getState
      const freshPipes2 = useStore.getState().pipes
      const freshRem = useStore.getState().nodes.find(n => n.type === 'remainder')
      const remCIds = new Set(freshPipes2.filter(p => p.fromId === freshRem?.id).map(p => p.toId))

      const fromIdx = backboneNodes.findIndex(n => n.id === draggedNode.id)
      let insertAfterId
      if (targetIndex < fromIdx) {
        // Kéo lên trên: chèn sau node trước targetNode
        const prevOfTarget = freshPipes2.find(p => p.toId === targetNode.id && p.fromId !== freshRem?.id)
        insertAfterId = prevOfTarget?.fromId
      } else {
        // Kéo xuống dưới: chèn sau targetNode
        insertAfterId = targetNode.id
      }
      if (insertAfterId) spliceIntoPipe(insertAfterId, nodeId)
    }
    dragging.current = null; dragTarget.current = null
  }, [editMode, nodes, pipes, positions, addPipe, deletePipe])

  // ── Xóa node khỏi pipe (edit mode) ──
  const handleRemoveFromPipe = useCallback((nodeId) => {
    removeFromPipe(nodeId)
  }, [removeFromPipe])

  // ── Thêm node vào flow ──
const handleAdd = ({ nodeId, ratio, monthlyCapAmount }) => {
  if (addMode === 'remainder') {
    const currentNodes = useStore.getState().nodes
    const currentPipes = useStore.getState().pipes
    const rem = currentNodes.find(n => n.type === 'remainder')

    // Kiểm tra đã có clone hoặc pipe trực tiếp từ remainder đến node này chưa
    const existingPipe = currentPipes.find(p => p.fromId === rem?.id && p.toId === nodeId)
    const existingClone = currentNodes.find(n => n.originalId === nodeId)
    const clonePipe = existingClone
      ? currentPipes.find(p => p.fromId === rem?.id && p.toId === existingClone.id)
      : null

    if (existingPipe) {
      useStore.getState().updatePipe({ ...existingPipe, ratio: ratio || 0, monthlyCapAmount: monthlyCapAmount || null })
    } else if (clonePipe) {
      useStore.getState().updatePipe({ ...clonePipe, ratio: ratio || 0, monthlyCapAmount: monthlyCapAmount || null })
    } else {
      // cloneNode đã hỗ trợ cả jar con lẫn group
      useStore.getState().cloneNode(nodeId, ratio, monthlyCapAmount)
    }
    setShowAdd(false)
    return
  }
  // backbone: spliceIntoPipe tự xử lý jar con
  if (insertAfter) {
    spliceIntoPipe(insertAfter, nodeId, ratio || 0, monthlyCapAmount || null)
  }
  setShowAdd(false)
  setInsertAfter(null)
}

  // ── Vị trí dấu + cố định (giữa node cuối và Còn lại) ──
const getFixedAddBtnPos = () => {
  const incomeNode = nodes.find(n => n.type === 'income')
  const remainderNode = remainder
  if (!incomeNode || !remainderNode) return null
  const incomePos = positions[incomeNode.id]
  const remPos = positions[remainderNode.id]
  if (!incomePos || !remPos) return null

  // Tìm pipe cuối cùng đến remainder
  const lastPipe = pipes.find(p => p.toId === remainderNode.id)
  if (lastPipe) {
    const fromNode = nodes.find(n => n.id === lastPipe.fromId)
    if (fromNode && positions[fromNode.id]) {
      const fromPos = positions[fromNode.id]
      // Điểm từ đáy dưới
      const fx = fromPos.x + getNodeW(fromNode) / 2
      const fy = fromPos.y + getNodeH(fromNode)
      const tx = remPos.x + REM_W / 2
      const ty = remPos.y
      return { x: (fx + tx) / 2, y: (fy + ty) / 2 }
    }
  }

  // Fallback: giữa income và remainder (cũng dùng đáy income)
  const fx = incomePos.x + getNodeW(incomeNode) / 2
  const fy = incomePos.y + getNodeH(incomeNode)
  const tx = remPos.x + REM_W / 2
  const ty = remPos.y
  return { x: (fx + tx) / 2, y: (fy + ty) / 2 }
}



  const addBtnPos = !editMode ? getFixedAddBtnPos() : null

  // Build backbone node list (để hiển thị ✕)
  const backboneNodeIds = useMemo(() => {
    const ids = new Set()
    const allNodes = []
    nodes.forEach(n => { allNodes.push(n); if (n.children) n.children.forEach(c => allNodes.push(c)) })
    const remOutTargets = new Set(
      pipes.filter(p => p.fromId === remainder?.id).map(p => p.toId)
    )
    let cur = nodes.find(n => n.type === 'income')
    const visited = new Set()
    while (cur && !visited.has(cur.id)) {
      visited.add(cur.id)
      ids.add(cur.id)
      if (cur.type === 'remainder') break
      const outPipes = pipes.filter(p => p.fromId === cur.id && p.fromId !== remainder?.id && allNodes.find(n => n.id === p.toId))
      let next = outPipes.find(p => p.toId === remainder?.id)
        || outPipes.find(p => !remOutTargets.has(p.toId))
        || outPipes.find(p => !visited.has(p.toId))
      if (!next) break
      cur = allNodes.find(n => n.id === next.toId)
    }
    return ids
  }, [nodes, pipes, remainder])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid #0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, color: '#f1f5f9' }}>⚙️ Sơ đồ Flow</h1>
        {editMode && (
          <button
            onClick={() => setEditMode(false)}
            style={{
              background: '#10B981', border: 'none', borderRadius: 8,
              color: '#fff', padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >✓ Xong</button>
        )}
      </div>

      {editMode && (
        <div style={{ background: '#0f2a1a', borderBottom: '1px solid #134e2a', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12 }}>🖊️</span>
          <span style={{ color: '#6ee7b7', fontSize: 12 }}>Chế độ chỉnh sửa — kéo để đổi vị trí, bấm ✕ để xóa, bấm + để thêm giữa</span>
        </div>
      )}

      <div
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={() => editMode && setEditMode(false)}
        style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#050a14' }}
      >
        <div style={{ position: 'relative', width: cSize.w, minHeight: cSize.h }} onClick={e => e.stopPropagation()}>
          <FlowSVG
            nodes={nodes} pipes={pipes} positions={positions} cSize={cSize}
            editMode={editMode}
            onPipeAddClick={(afterNodeId) => {
              setInsertAfter(afterNodeId)
              setAddMode('backbone')
              setShowAdd(true)
            }}
          />

          {nodes.map(n => {
            const pos = positions[n.id]
            if (!pos) return null
            const isBackboneNode = backboneNodeIds.has(n.id)
            const canDelete = editMode && isBackboneNode && n.type !== 'income' && n.type !== 'remainder'

            return (
              <div key={n.id} style={{ opacity: dragTarget.current === n.id ? 0.5 : 1, transition: 'opacity 0.1s' }}>
                {n.type === 'income' && (
                  <IncomeCard node={n} pos={pos} selected={infoNodeId === n.id}
                    onSelect={id => !editMode && setInfoNodeId(id)}
                    onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
                )}
                {n.type === 'remainder' && (
                  <RemainderCard node={n} pos={pos} selected={infoNodeId === n.id}
                    onSelect={id => !editMode && setInfoNodeId(id)}
                    onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd}
                    onAddChild={() => { setAddMode('remainder'); setShowAdd(true); setInsertAfter(null) }} />
                )}
                {n.type === 'group' && isBackboneNode && (
                  <GroupCard node={n} pos={pos} selected={infoNodeId === n.id}
                    onSelect={id => !editMode && setInfoNodeId(id)}
                    onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
                )}
                {n.type === 'expense' && isBackboneNode && (
                  <ExpenseCard node={n} pos={pos} selected={infoNodeId === n.id}
                    onSelect={id => !editMode && setInfoNodeId(id)}
                    onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
                )}
                {n.type === 'jar' && isBackboneNode && (
                  <RemChildCard node={n} pos={pos} selected={infoNodeId === n.id}
                    onSelect={id => !editMode && setInfoNodeId(id)}
                    onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
                )}
                {!isBackboneNode && (n.type === 'group' || n.type === 'jar') && (
                  <RemChildCard node={n} pos={pos} selected={infoNodeId === n.id}
                    onSelect={id => !editMode && setInfoNodeId(id)}
                    onHoldStart={handleHoldStart} onHoldEnd={handleHoldEnd} />
                )}

                {/* Dấu ✕ trên góc trên phải của node khi edit mode */}
                {canDelete && (
                  <DeleteBadge
                    x={pos.x + getNodeW(n)}
                    y={pos.y}
                    onClick={() => handleRemoveFromPipe(n.id)}
                  />
                )}
              </div>
            )
          })}

          {addBtnPos && (
            <AddBtn
              x={addBtnPos.x}
              y={addBtnPos.y}
              onClick={() => {
                const lastPipe = pipes.find(p => p.toId === remainder?.id)
                const insertAfterId  = lastPipe ? lastPipe.fromId : nodes.find(n => n.type === 'income')?.id
                if (insertAfterId ) {
                  setInsertAfter(insertAfterId)
                  setAddMode('backbone')
                  setShowAdd(true)
                }
              }}
            />
          )}

        </div>
      </div>

      <AddToFlowSheet
        open={showAdd}
        onClose={() => { setShowAdd(false); setInsertAfter(null) }}
        mode={addMode}
        nodes={nodes}
        pipes={pipes}
        onAdd={handleAdd}
      />

      {editPipeId && <PipePanel pipe={pipes.find(p => p.id === editPipeId)} nodes={nodes} onClose={() => setEditPipeId(null)} />}
      {infoNodeId && !editMode && (
        <NodeInfoPanel
          node={nodes.find(n => n.id === infoNodeId)}
          pipes={pipes}
          onClose={() => setInfoNodeId(null)}
          onEditPipe={(id) => { setInfoNodeId(null); setEditPipeId(id) }}
        />
      )}
    </div>
  )
}