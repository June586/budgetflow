import { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import Button from '../components/ui/Button'
import Sheet from '../components/ui/Sheet'
import Field from '../components/ui/Field'
import { Input, Select } from '../components/ui/Input'
import { fmt, getCurrentMonth } from '../lib/helpers'

const PAGE_SIZE = 10

// ── Transaction Item ──────────────────────────────────────────
function TxItem({ tx, nodeMap }) {
  const [open, setOpen] = useState(false)
  const isIncome = tx.type === 'income'

  return (
    <div style={{
      background: '#0a0f1e',
      border: '1px solid #1e293b',
      borderRadius: 12, marginBottom: 8, overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: isIncome ? '#10B98122' : '#EF444422',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {isIncome ? '💰' : '💸'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
            {tx.note || (isIncome ? 'Khoản thu' : 'Khoản chi')}
          </div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
            {new Date(tx.date).toLocaleDateString('vi-VN', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
          {/* Chip nodes */}
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {tx.splits?.slice(0, 3).map(s => {
              const node = nodeMap[s.nodeId]
              if (!node) return null
              return (
                <span key={s.nodeId} style={{
                  background: (node.color || '#3B82F6') + '22',
                  color: node.color || '#3B82F6',
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 4,
                }}>
                  {node.name}
                </span>
              )
            })}
            {(tx.splits?.length || 0) > 3 && (
              <span style={{ color: '#475569', fontSize: 10 }}>
                +{tx.splits.length - 3} nữa
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div style={{
          color: isIncome ? '#10B981' : '#EF4444',
          fontWeight: 800, fontSize: 16, flexShrink: 0,
        }}>
          {isIncome ? '+' : '-'}{fmt(tx.amount)}đ
        </div>
      </div>

      {/* Expanded splits */}
      {open && tx.splits?.length > 0 && (
        <div style={{ borderTop: '1px solid #0f172a', padding: '10px 14px 12px 60px' }}>
          {tx.splits.map(s => {
            const node = nodeMap[s.nodeId]
            if (!node) return null
            return (
              <div key={s.nodeId} style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: node.color || '#3B82F6',
                  }} />
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>
                    {node.parentName ? `${node.parentName} › ` : ''}{node.name}
                  </span>
                </div>
                <span style={{
                  color: isIncome ? '#10B981' : '#EF4444',
                  fontSize: 12, fontWeight: 600,
                }}>
                  {isIncome ? '+' : '-'}{fmt(s.amount)}đ
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Add Expense Form ──────────────────────────────────────────
function AddExpenseForm({ onDone }) {
  const { nodes, submitExpense } = useStore()
  const [nodeId, setNodeId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  // Flat list hũ/chai có thể rút — dedupe theo id
  const allNodes = []
  const seen = new Set()
  nodes.forEach(n => {
    if (n.type === 'group' && n.children) {
      n.children.forEach(c => {
        if (!seen.has(c.id)) { seen.add(c.id); allNodes.push({ ...c, parentName: n.name }) }
      })
    } else if (n.type === 'expense' && n.status !== 'closed') {
      if (!seen.has(n.id)) { seen.add(n.id); allNodes.push(n) }
    } else if (n.type === 'jar') {
      if (!n.originalId && !seen.has(n.id)) { seen.add(n.id); allNodes.push(n) }
    } else if (n.type === 'remainder') {
      if (!seen.has(n.id)) { seen.add(n.id); allNodes.push(n) }
    }
  })

  const selectedNode = allNodes.find(n => n.id === nodeId)
  const maxAmount = selectedNode?.currentAmount || 0

  const submit = () => {
    if (!nodeId || !amount || parseFloat(amount) <= 0) return
    submitExpense(nodeId, parseFloat(amount), note)
    onDone()
  }

  return (
    <div>
      <Field label="Rút từ hũ / chai">
        <Select value={nodeId} onChange={setNodeId}>
          <option value="">— Chọn hũ/chai —</option>
          {allNodes.map(n => (
            <option key={n.id} value={n.id}>
              {n.parentName ? `${n.parentName} › ` : ''}{n.name}
              {' '}({fmt(n.currentAmount || 0)}đ)
            </option>
          ))}
        </Select>
      </Field>

      {selectedNode && (
        <div style={{
          background: '#0f172a', borderRadius: 10,
          padding: '10px 14px', marginBottom: 14,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#64748b', fontSize: 12 }}>Hiện có</span>
          <span style={{ color: selectedNode.color || '#10B981', fontWeight: 700, fontSize: 13 }}>
            {fmt(maxAmount)}đ
          </span>
        </div>
      )}

      <Field label="Số tiền (đ)">
        <Input
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="0"
        />
        {selectedNode && parseFloat(amount) > maxAmount && (
          <div style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>
            ⚠️ Vượt quá số tiền hiện có
          </div>
        )}
      </Field>

      <Field label="Ghi chú">
        <Input value={note} onChange={setNote} placeholder="Mua gì, trả ai..." />
      </Field>

      <Button
        onClick={submit} full
        disabled={!nodeId || !amount || parseFloat(amount) <= 0}
        variant="danger"
      >
        💸 Ghi khoản chi
      </Button>
    </div>
  )
}

// ── Main HistoryPage ──────────────────────────────────────────
export default function HistoryPage() {
  const { nodes, transactions } = useStore()
  const [typeFilter, setTypeFilter] = useState('all') // all|income|expense
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth())
  const [nodeFilter, setNodeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showAddExpense, setShowAddExpense] = useState(false)

  // Đọc filter từ sessionStorage (từ JarsPage nhảy sang)
  useEffect(() => {
    const f = sessionStorage.getItem('historyFilter')
    if (f) {
      setNodeFilter(f)
      sessionStorage.removeItem('historyFilter')
    }
  }, [])

  // Build nodeMap flat
  const nodeMap = {}
  nodes.forEach(n => {
    nodeMap[n.id] = n
    if (n.children) {
      n.children.forEach(c => {
        nodeMap[c.id] = { ...c, parentName: n.name }
      })
    }
  })

  // Flat list để filter — dedupe theo id (tránh clone trùng jar gốc)
  const allFilterNodes = []
  const seenFilter = new Set()
  nodes.forEach(n => {
    if (n.type === 'group' && n.children) {
      n.children.forEach(c => {
        if (!seenFilter.has(c.id)) { seenFilter.add(c.id); allFilterNodes.push({ ...c, parentName: n.name }) }
      })
    } else if (!['income', 'remainder'].includes(n.type)) {
      // Bỏ qua clone (có originalId) vì jar gốc đã được push từ group.children
      if (!n.originalId && !seenFilter.has(n.id)) { seenFilter.add(n.id); allFilterNodes.push(n) }
    }
  })

  // Filter transactions
  const filtered = transactions
    .filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (monthFilter && !t.date.startsWith(monthFilter)) return false
      if (nodeFilter && !t.splits?.some(s => s.nodeId === nodeFilter)) return false
      return true
    })
    .slice()
    .reverse() // gần nhất trước

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page khi filter thay đổi
  const resetPage = () => setPage(1)

  // Tổng kỳ
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
            📒 Lịch sử
          </h1>
          <Button onClick={() => setShowAddExpense(true)} variant="danger" size="sm">
            + Chi
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'income', label: '💰 Thu' },
            { id: 'expense', label: '💸 Chi' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => { setTypeFilter(f.id); resetPage() }}
              style={{
                padding: '7px 14px', borderRadius: 20,
                border: `1px solid ${typeFilter === f.id ? '#3B82F6' : '#1e293b'}`,
                background: typeFilter === f.id ? '#3B82F622' : '#0a0f1e',
                color: typeFilter === f.id ? '#3B82F6' : '#64748b',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Month + node filter */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="month"
            value={monthFilter}
            onChange={e => { setMonthFilter(e.target.value); resetPage() }}
            style={{
              flex: 1, background: '#0a0f1e',
              border: '1px solid #1e293b',
              borderRadius: 10, color: '#f1f5f9',
              padding: '8px 12px', fontSize: 12, outline: 'none',
            }}
          />
          <select
            value={nodeFilter}
            onChange={e => { setNodeFilter(e.target.value); resetPage() }}
            style={{
              flex: 1, background: '#0a0f1e',
              border: '1px solid #1e293b',
              borderRadius: 10, color: nodeFilter ? '#f1f5f9' : '#64748b',
              padding: '8px 12px', fontSize: 12, outline: 'none',
            }}
          >
            <option value="">Tất cả hũ</option>
            {allFilterNodes.map(n => (
              <option key={n.id} value={n.id}>
                {n.parentName ? `${n.parentName} › ` : ''}{n.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div style={{
          margin: '0 20px 12px',
          background: '#0a0f1e',
          border: '1px solid #1e293b',
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 10 }}>THU</div>
            <div style={{ color: '#10B981', fontWeight: 700, fontSize: 14 }}>
              +{fmt(totalIncome)}đ
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#64748b', fontSize: 10 }}>GIAO DỊCH</div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>
              {filtered.length}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#64748b', fontSize: 10 }}>CHI</div>
            <div style={{ color: '#EF4444', fontWeight: 700, fontSize: 14 }}>
              -{fmt(totalExpense)}đ
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {paginated.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 0',
            color: '#334155', fontSize: 14,
          }}>
            Không có giao dịch nào
          </div>
        )}

        {paginated.map(tx => (
          <TxItem key={tx.id} tx={tx} nodeMap={nodeMap} />
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center',
            alignItems: 'center', gap: 12,
            padding: '16px 0',
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                background: '#0a0f1e', border: '1px solid #1e293b',
                borderRadius: 8, color: page === 1 ? '#334155' : '#f1f5f9',
                padding: '7px 14px', fontSize: 13, cursor: page === 1 ? 'default' : 'pointer',
              }}
            >
              ← Trước
            </button>
            <span style={{ color: '#64748b', fontSize: 13 }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                background: '#0a0f1e', border: '1px solid #1e293b',
                borderRadius: 8, color: page === totalPages ? '#334155' : '#f1f5f9',
                padding: '7px 14px', fontSize: 13, cursor: page === totalPages ? 'default' : 'pointer',
              }}
            >
              Sau →
            </button>
          </div>
        )}
      </div>

      {/* Add expense sheet */}
      <Sheet
        open={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        title="💸 Thêm khoản chi"
        height="80vh"
      >
        <AddExpenseForm onDone={() => setShowAddExpense(false)} />
      </Sheet>
    </div>
  )
}