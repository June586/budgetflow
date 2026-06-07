import { useState, useRef, useCallback } from 'react'
import useStore from '../store/useStore'
import Sheet from '../components/ui/Sheet'
import Field from '../components/ui/Field'
import Button from '../components/ui/Button'
import ColorPicker from '../components/ui/ColorPicker'
import { Input } from '../components/ui/Input'
import { fmt } from '../lib/helpers'
import { uid } from '../lib/helpers'

// ── Node sizing ───────────────────────────────────────────────
function getNodeSize(node) {
  if (node.type === 'income')    return { w: 140, h: 100 }
  if (node.type === 'group')     return { w: 180, h: 110 + (node.children?.length || 0) * 34 }
  if (node.type === 'expense')   return { w: 160, h: 120 }
  if (node.type === 'remainder') return { w: 140, h: 90 }
  if (node.type === 'jar')       return { w: 150, h: 90 }
  return { w: 150, h: 90 }
}

function getCenter(node) {
  const { w, h } = getNodeSize(node)
  return { x: node.x + w / 2, y: node.y + h / 2 }
}

// ── Pipe SVG ──────────────────────────────────────────────────
function PipeSVG({ pipes, nodes }) {
  const nm = {}
  nodes.forEach(n => { nm[n.id] = n })

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      width="100%" height="100%"
    >
      <defs>
        {nodes.map(n => (
          <linearGradient key={n.id} id={`g-${n.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={n.color || '#3B82F6'} stopOpacity="0.9" />
            <stop offset="100%" stopColor={n.color || '#3B82F6'} stopOpacity="0.3" />
          </linearGradient>
        ))}
      </defs>
      {pipes.map(pipe => {
        const f = nm[pipe.fromId]
        const t = nm[pipe.toId]
        if (!f || !t) return null
        const fc = getCenter(f)
        const tc = getCenter(t)
        const dx = tc.x - fc.x
        const d = `M${fc.x} ${fc.y} C${fc.x + dx * 0.55} ${fc.y} ${tc.x - dx * 0.3} ${tc.y} ${tc.x} ${tc.y}`
        const col = f.color || '#3B82F6'
        const mx = (fc.x + tc.x) / 2
        const my = (fc.y + tc.y) / 2 - 14

        return (
          <g key={pipe.id}>
            {/* Glow */}
            <path d={d} fill="none" stroke={col} strokeWidth={10} strokeOpacity={0.08} strokeLinecap="round" />
            {/* Main */}
            <path d={d} fill="none" stroke={col} strokeWidth={2.5} strokeOpacity={0.7}
              strokeLinecap="round"
              strokeDasharray={pipe.ratio === 0 ? '5 4' : 'none'}
            />
            {/* Flow animation */}
            <path d={d} fill="none" stroke="#fff" strokeWidth={1.5} strokeOpacity={0.35}
              strokeLinecap="round" strokeDasharray="7 18"
            >
              <animate attributeName="stroke-dashoffset" from="25" to="0" dur="1.5s" repeatCount="indefinite" />
            </path>
            {/* Ratio badge */}
            {pipe.ratio > 0 && (
              <g>
                <rect x={mx - 18} y={my - 9} width={36} height={17} rx={8}
                  fill="#0a0f1e" stroke={col} strokeWidth={1} />
                <text x={mx} y={my + 4} textAnchor="middle"
                  fill={col} fontSize={10} fontWeight="700"
                  fontFamily="DM Sans, sans-serif"
                >
                  {pipe.ratio}%
                </text>
              </g>
            )}
            {/* Cap badge */}
            {pipe.monthlyCapAmount && (
              <g>
                <rect x={mx - 22} y={my + 10} width={44} height={14} rx={7}
                  fill="#F59E0B22" stroke="#F59E0B" strokeWidth={1} />
                <text x={mx} y={my + 20} textAnchor="middle"
                  fill="#F59E0B" fontSize={8} fontWeight="700"
                  fontFamily="DM Sans, sans-serif"
                >
                  cap
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Node Cards ────────────────────────────────────────────────
function IncomeCard({ node, selected, onDrag, onSelect }) {
  return (
    <div
      onMouseDown={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onTouchStart={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      style={{
        position: 'absolute', left: node.x, top: node.y,
        width: 140, cursor: 'grab', userSelect: 'none', touchAction: 'none',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #064e3b, #065f46)',
        border: `2px solid ${selected ? '#10B981' : '#065f46'}`,
        borderRadius: 16, padding: '12px 14px',
        boxShadow: selected ? '0 0 0 3px rgba(16,185,129,0.2)' : '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>💧</div>
        <div style={{ color: '#6ee7b7', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Nguồn thu</div>
        <div style={{ color: '#ecfdf5', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
        <div style={{ color: '#34d399', fontSize: 14, fontWeight: 800, marginTop: 6 }}>
          {fmt(node.amount || 0)}đ
        </div>
      </div>
    </div>
  )
}

function GroupCard({ node, selected, onDrag, onSelect }) {
  const total = node.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0
  const pct = node.limitAmount ? Math.min(total / node.limitAmount * 100, 100) : 0

  return (
    <div
      onMouseDown={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onTouchStart={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      style={{
        position: 'absolute', left: node.x, top: node.y,
        width: 180, cursor: 'grab', userSelect: 'none', touchAction: 'none',
      }}
    >
      <div style={{
        background: '#0a0f1e',
        border: `2px solid ${selected ? node.color : '#1e293b'}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: selected ? `0 0 0 3px ${node.color}22` : '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ background: node.color + '18', padding: '10px 12px 8px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ color: node.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>🪣 Xô nhóm</div>
          <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
          <div style={{ background: '#1e293b', borderRadius: 3, height: 3, marginTop: 6 }}>
            <div style={{ width: pct + '%', height: '100%', background: node.color, borderRadius: 3 }} />
          </div>
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 3 }}>
            {fmt(total)} / {fmt(node.limitAmount || 0)}đ
          </div>
        </div>
        {node.children?.map(jar => {
          const jp = jar.limitAmount ? Math.min((jar.currentAmount || 0) / jar.limitAmount * 100, 100) : 0
          return (
            <div key={jar.id} style={{ padding: '6px 12px', borderBottom: '1px solid #0f172a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#cbd5e1', fontSize: 11 }}>{jar.name}</span>
                <span style={{ color: jar.color || node.color, fontSize: 10, fontWeight: 700 }}>{jar.ratio}%</span>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 2, height: 2 }}>
                <div style={{ width: jp + '%', height: '100%', background: jar.color || node.color, borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExpenseCard({ node, selected, onDrag, onSelect }) {
  const pct = node.limitAmount ? Math.min((node.currentAmount || 0) / node.limitAmount * 100, 100) : 0
  const full = pct >= 100

  return (
    <div
      onMouseDown={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onTouchStart={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      style={{
        position: 'absolute', left: node.x, top: node.y,
        width: 160, cursor: 'grab', userSelect: 'none',
        touchAction: 'none', opacity: full ? 0.7 : 1,
      }}
    >
      <div style={{
        background: '#0a0f1e',
        border: `2px solid ${selected ? node.color : full ? node.color + '88' : '#1e293b'}`,
        borderRadius: 14, overflow: 'hidden',
        boxShadow: selected ? `0 0 0 3px ${node.color}22` : '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          background: full ? node.color : node.color + '33',
          height: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {full && <span style={{ fontSize: 8, color: '#fff', fontWeight: 700 }}>ĐÓNG NẮP</span>}
        </div>
        <div style={{ padding: '9px 12px' }}>
          <div style={{ color: node.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>🍶 Chi phí</div>
          <div style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
          {node.monthRef && (
            <div style={{ color: '#F59E0B', fontSize: 9, marginTop: 1 }}>{node.monthRef}</div>
          )}
          {/* Liquid */}
          <div style={{
            position: 'relative', background: '#1e293b',
            borderRadius: 8, height: 40, overflow: 'hidden', marginTop: 7,
          }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: pct + '%',
              background: `linear-gradient(180deg, ${node.color}66, ${node.color})`,
              transition: 'height 0.5s',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: pct > 55 ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: 800,
            }}>
              {Math.round(pct)}%
            </div>
          </div>
          <div style={{ color: '#475569', fontSize: 10, marginTop: 5, textAlign: 'right' }}>
            {fmt(node.currentAmount || 0)} / {fmt(node.limitAmount)}đ
          </div>
        </div>
      </div>
    </div>
  )
}

function RemainderCard({ node, selected, onDrag, onSelect }) {
  return (
    <div
      onMouseDown={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onTouchStart={e => { e.stopPropagation(); onDrag(e, node.id) }}
      onClick={e => { e.stopPropagation(); onSelect(node.id) }}
      style={{
        position: 'absolute', left: node.x, top: node.y,
        width: 140, cursor: 'grab', userSelect: 'none', touchAction: 'none',
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #0c4a6e, #075985)',
        border: `2px solid ${selected ? '#06B6D4' : '#0369a1'}`,
        borderRadius: 16, padding: '12px 14px',
        boxShadow: selected ? '0 0 0 3px rgba(6,182,212,0.2)' : '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 18, marginBottom: 4 }}>🌊</div>
        <div style={{ color: '#7dd3fc', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Còn lại</div>
        <div style={{ color: '#e0f2fe', fontSize: 13, fontWeight: 700, marginTop: 2 }}>{node.name}</div>
        <div style={{ color: '#38bdf8', fontSize: 15, fontWeight: 800, marginTop: 6 }}>
          {fmt(node.currentAmount || 0)}đ
        </div>
      </div>
    </div>
  )
}

// ── Edit Panels ───────────────────────────────────────────────
function NodePanel({ node, onClose }) {
  const { updateNode, deleteNode, accounts } = useStore()
  const [form, setForm] = useState({ ...node })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => { updateNode(form); onClose() }
  const del = () => { deleteNode(node.id); onClose() }

  return (
    <Sheet open onClose={onClose} title="✏️ Chỉnh Node" height="85vh">
      <Field label="Tên">
        <Input value={form.name} onChange={v => set('name', v)} />
      </Field>
      <Field label="Màu">
        <ColorPicker value={form.color} onChange={v => set('color', v)} />
      </Field>

      {(node.type === 'expense' || node.type === 'group' || node.type === 'jar') && (
        <Field label="Hạn mức (đ)" hint="Để trống = không giới hạn">
          <Input type="number" value={form.limitAmount || ''}
            onChange={v => set('limitAmount', parseFloat(v) || null)} />
        </Field>
      )}

      {node.type === 'expense' && (
        <>
          <Field label="Deadline">
            <Input type="date" value={form.deadline || ''} onChange={v => set('deadline', v)} />
          </Field>
          <Field label="Mô tả">
            <Input value={form.description || ''} onChange={v => set('description', v)} />
          </Field>
          <Field label="Tài khoản">
            <select value={form.accountId || ''} onChange={e => set('accountId', e.target.value || null)}
              style={{
                width: '100%', background: '#0f172a', border: '1px solid #1e293b',
                borderRadius: 10, color: '#f1f5f9', padding: '10px 12px', fontSize: 13,
              }}>
              <option value="">— Chưa gắn —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Thứ tự ưu tiên" hint="Số nhỏ = đổ trước">
            <Input type="number" value={form.sortOrder ?? 0} onChange={v => set('sortOrder', parseInt(v) || 0)} />
          </Field>
        </>
      )}

      {node.type === 'income' && (
        <Field label="Số tiền tháng này (đ)">
          <Input type="number" value={form.amount || ''} onChange={v => set('amount', parseFloat(v) || 0)} />
        </Field>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {!['income', 'remainder'].includes(node.type) && (
          <Button onClick={del} variant="danger" size="sm">🗑</Button>
        )}
        <Button onClick={save} full>💾 Lưu</Button>
      </div>
    </Sheet>
  )
}

function PipePanel({ pipe, nodes, onClose }) {
  const { updatePipe, deletePipe } = useStore()
  const [form, setForm] = useState({ ...pipe })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toNode = nodes.find(n => n.id === pipe.toId)
  const fromNode = nodes.find(n => n.id === pipe.fromId)
  const isToGroup = toNode?.type === 'group'

  // childRatioOverride state
  const [override, setOverride] = useState(
    pipe.childRatioOverride
      ? toNode?.children?.map(c => ({
          id: c.id, name: c.name,
          ratio: pipe.childRatioOverride[c.id] || c.ratio,
        }))
      : null
  )

  const overrideTotal = override?.reduce((s, c) => s + (parseFloat(c.ratio) || 0), 0) || 0

  const save = () => {
    const updated = {
      ...form,
      ratio: parseFloat(form.ratio) || 0,
      monthlyCapAmount: form.monthlyCapAmount ? parseFloat(form.monthlyCapAmount) : null,
      childRatioOverride: override
        ? Object.fromEntries(override.map(c => [c.id, parseFloat(c.ratio) || 0]))
        : null,
    }
    updatePipe(updated)
    onClose()
  }

  const del = () => { deletePipe(pipe.id); onClose() }

  return (
    <Sheet open onClose={onClose} title="🔧 Chỉnh Ống nối" height="85vh">
      {/* From → To */}
      <div style={{
        background: '#0f172a', borderRadius: 10,
        padding: '10px 14px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: fromNode?.color || '#64748b', fontWeight: 700, fontSize: 13 }}>
          {fromNode?.name}
        </span>
        <span style={{ color: '#475569' }}>→</span>
        <span style={{ color: toNode?.color || '#64748b', fontWeight: 700, fontSize: 13 }}>
          {toNode?.name}
        </span>
      </div>

      <Field label="Tỷ lệ (%)" hint="0 = nhận phần còn lại">
        <Input type="number" value={form.ratio || ''} onChange={v => set('ratio', v)} placeholder="0" />
      </Field>

      <Field label="Giới hạn tháng (đ)" hint="Tối đa nhận bao nhiêu/tháng qua pipe này">
        <Input type="number" value={form.monthlyCapAmount || ''}
          onChange={v => set('monthlyCapAmount', v)} placeholder="Không giới hạn" />
      </Field>

      <Field label="Thứ tự" hint="Số nhỏ = ưu tiên trước">
        <Input type="number" value={form.sortOrder ?? 0} onChange={v => set('sortOrder', parseInt(v) || 0)} />
      </Field>

      {/* Override tỷ lệ hũ con */}
      {isToGroup && toNode.children?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 10,
          }}>
            <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
              OVERRIDE TỶ LỆ HŨ CON
            </span>
            <button
              onClick={() => setOverride(o => o ? null : toNode.children.map(c => ({
                id: c.id, name: c.name, ratio: c.ratio,
              })))}
              style={{
                background: override ? '#3B82F622' : 'none',
                border: `1px solid ${override ? '#3B82F6' : '#1e293b'}`,
                borderRadius: 6, color: override ? '#3B82F6' : '#475569',
                padding: '4px 10px', fontSize: 11, cursor: 'pointer',
              }}
            >
              {override ? 'Đang override' : 'Dùng mặc định'}
            </button>
          </div>

          {override && (
            <div style={{ background: '#0f172a', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <span style={{
                  color: overrideTotal === 100 ? '#10B981' : '#EF4444',
                  fontSize: 12, fontWeight: 700,
                }}>
                  ∑ {overrideTotal}% {overrideTotal !== 100 ? '⚠️' : '✓'}
                </span>
              </div>
              {override.map((c, idx) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, marginBottom: 8,
                }}>
                  <span style={{ color: '#94a3b8', fontSize: 13, flex: 1 }}>{c.name}</span>
                  <Input
                    type="number"
                    value={c.ratio}
                    onChange={v => setOverride(os => os.map((o, i) =>
                      i === idx ? { ...o, ratio: parseFloat(v) || 0 } : o
                    ))}
                    style={{ width: 80 }}
                  />
                  <span style={{ color: '#475569', fontSize: 13 }}>%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button onClick={del} variant="danger" size="sm">🗑</Button>
        <Button
          onClick={save} full
          disabled={override && overrideTotal !== 100}
        >
          💾 Lưu
        </Button>
      </div>
    </Sheet>
  )
}

// ── Main FlowPage ─────────────────────────────────────────────
export default function FlowPage() {
  const { nodes, pipes, updateNode, selectNode, selectPipe, clearSelection, selectedNodeId, selectedPipeId } = useStore()

  const canvasRef = useRef(null)
  const [dragging, setDragging] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [editNodeId, setEditNodeId] = useState(null)
  const [editPipeId, setEditPipeId] = useState(null)

  const editNode = nodes.find(n => n.id === editNodeId)
  const editPipe = pipes.find(p => p.id === editPipeId)

  // ── Drag (mouse + touch) ──────────────────────────────────
  const startDrag = useCallback((e, nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    setDragging(nodeId)
    setDragOffset({
      x: clientX - node.x - rect.left,
      y: clientY - node.y - rect.top,
    })
  }, [nodes])

  const onMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = Math.max(0, clientX - rect.left - dragOffset.x)
    const y = Math.max(0, clientY - rect.top - dragOffset.y)
    const node = nodes.find(n => n.id === dragging)
    if (node) updateNode({ ...node, x, y })
  }, [dragging, dragOffset, nodes, updateNode])

  const onEnd = useCallback(() => setDragging(null), [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
          ⚙️ Sơ đồ Flow
        </h1>
        <div style={{ color: '#475569', fontSize: 11 }}>
          Kéo node · Tap để chỉnh
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchMove={e => { e.preventDefault(); onMove(e) }}
        onTouchEnd={onEnd}
        onClick={() => { setEditNodeId(null); setEditPipeId(null) }}
        style={{
          flex: 1, position: 'relative', overflow: 'auto',
          cursor: dragging ? 'grabbing' : 'default',
          touchAction: 'none',
        }}
      >
        {/* Grid background */}
        <div style={{
          minWidth: 1200, minHeight: 800,
          position: 'relative',
          backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}>
          <PipeSVG pipes={pipes} nodes={nodes} />

          {/* Pipe hit zones */}
          {pipes.map(pipe => {
            const f = nodes.find(n => n.id === pipe.fromId)
            const t = nodes.find(n => n.id === pipe.toId)
            if (!f || !t) return null
            const fc = getCenter(f)
            const tc = getCenter(t)
            const mx = (fc.x + tc.x) / 2
            const my = (fc.y + tc.y) / 2
            const isSel = editPipeId === pipe.id
            return (
              <div
                key={pipe.id + '-hit'}
                onClick={e => { e.stopPropagation(); setEditPipeId(pipe.id); setEditNodeId(null) }}
                style={{
                  position: 'absolute', left: mx - 18, top: my - 18,
                  width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                  background: isSel ? 'rgba(59,130,246,0.2)' : 'transparent',
                  border: isSel ? '2px solid #3B82F6' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, zIndex: 10,
                }}
              >
                {isSel ? '⚙️' : ''}
              </div>
            )
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const props = {
              key: node.id, node,
              selected: editNodeId === node.id,
              onDrag: startDrag,
              onSelect: (id) => { setEditNodeId(id); setEditPipeId(null) },
            }
            if (node.type === 'income')    return <IncomeCard {...props} />
            if (node.type === 'group')     return <GroupCard {...props} />
            if (node.type === 'expense')   return <ExpenseCard {...props} />
            if (node.type === 'remainder') return <RemainderCard {...props} />
            return null
          })}
        </div>
      </div>

      {/* Edit panels */}
      {editNodeId && editNode && (
        <NodePanel node={editNode} onClose={() => setEditNodeId(null)} />
      )}
      {editPipeId && editPipe && (
        <PipePanel pipe={editPipe} nodes={nodes} onClose={() => setEditPipeId(null)} />
      )}
    </div>
  )
}