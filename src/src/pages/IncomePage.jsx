import { useState } from 'react'
import useStore from '../store/useStore'
import Sheet from '../components/ui/Sheet'
import Field from '../components/ui/Field'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { fmt, fmtShort } from '../lib/helpers'
import { runFlowEngine, buildTodos } from '../lib/engine'
import { PLATFORMS } from '../constants'

// ── Preview phân bổ ───────────────────────────────────────────
function PreviewDistribution({ added, nodes }) {
  const nodeMap = {}
  nodes.forEach(n => {
    nodeMap[n.id] = n
    if (n.children) n.children.forEach(c => {
      nodeMap[c.id] = { ...c, parentName: n.name }
    })
  })

  const groups = {
    savings:   [],
    expenses:  [],
    remainder: [],
    other:     [],
  }

  Object.entries(added).forEach(([nodeId, amount]) => {
    if (amount < 1) return
    const node = nodeMap[nodeId]
    if (!node) return
    // Bỏ qua group cha (chỉ hiện hũ con)
    if (node.type === 'group') return
    if (node.type === 'remainder') {
      groups.remainder.push({ node, amount })
    } else if (node.type === 'expense') {
      groups.expenses.push({ node, amount })
    } else {
      // jar hoặc jar đơn
      if (node.parentName) groups.savings.push({ node, amount })
      else groups.other.push({ node, amount })
    }
  })

  const sections = [
    { key: 'savings',   label: '🪣 Tiết kiệm',  color: '#3B82F6', items: groups.savings },
    { key: 'expenses',  label: '🍶 Chi phí',     color: '#EF4444', items: groups.expenses },
    { key: 'remainder', label: '🌊 Còn lại',     color: '#06B6D4', items: groups.remainder },
    { key: 'other',     label: '🫙 Khác',        color: '#8B5CF6', items: groups.other },
  ].filter(s => s.items.length > 0)

  return (
    <div style={{
      background: '#0f172a', borderRadius: 14,
      overflow: 'hidden', marginBottom: 16,
    }}>
      {sections.map((sec, si) => (
        <div key={sec.key}>
          {/* Section header */}
          <div style={{
            padding: '10px 14px 6px',
            background: sec.color + '11',
            borderTop: si > 0 ? '1px solid #1e293b' : 'none',
          }}>
            <div style={{ color: sec.color, fontSize: 11, fontWeight: 700 }}>
              {sec.label}
            </div>
          </div>
          {/* Items */}
          {sec.items.map(({ node, amount }) => (
            <div key={node.id} style={{
              padding: '9px 14px',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #1e293b11',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: node.color || sec.color, flexShrink: 0,
                }} />
                <div>
                  <span style={{ color: '#cbd5e1', fontSize: 13 }}>{node.name}</span>
                  {node.parentName && (
                    <span style={{ color: '#475569', fontSize: 11 }}>
                      {' '}· {node.parentName}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ color: '#10B981', fontSize: 13, fontWeight: 700 }}>
                +{fmt(amount)}đ
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Todo Modal ────────────────────────────────────────────────
function TodoModal({ todo, accounts, onClose }) {
  const { tickTodoItem, tickAllTodoItems } = useStore()
  const [expanded, setExpanded] = useState({})

  const accMap = {}
  accounts.forEach(a => { accMap[a.id] = a })

  const allDone = todo.items.every(i => i.done)
  const doneCount = todo.items.filter(i => i.done).length

  const toggleExp = (accId) => {
    setExpanded(e => ({ ...e, [accId]: !e[accId] }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 300,
      display: 'flex', alignItems: 'flex-end',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div
        className="sheet"
        style={{
          width: '100%',
          maxHeight: '88vh',
          background: '#0a0f1e',
          borderRadius: '20px 20px 0 0',
          border: '1px solid #1e293b',
          borderBottom: 'none',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#1e293b' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 14px', borderBottom: '1px solid #0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: 18, fontWeight: 800 }}>
                📋 Việc cần làm
              </h2>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                Chuyển tiền vào tài khoản tương ứng
              </div>
            </div>
            <div style={{
              background: allDone ? '#10B98122' : '#3B82F622',
              border: `1px solid ${allDone ? '#10B981' : '#3B82F6'}`,
              borderRadius: 20, padding: '4px 12px',
              color: allDone ? '#10B981' : '#3B82F6',
              fontSize: 12, fontWeight: 700,
            }}>
              {doneCount}/{todo.items.length}
            </div>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {todo.items.map(item => {
            const acc = accMap[item.accountId]
            if (!acc) return null
            const isExp = expanded[item.accountId]
            const plat = PLATFORMS.find(p => p.id === acc.platformId)

            return (
              <div key={item.accountId} style={{
                background: '#0f172a',
                borderRadius: 14, marginBottom: 10,
                border: `1px solid ${item.done ? '#10B98133' : acc.color + '33'}`,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                {/* Main row */}
                <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Checkbox */}
                  <div
                    onClick={() => !item.done && tickTodoItem(todo.id, item.accountId)}
                    style={{
                      width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                      border: `2px solid ${item.done ? '#10B981' : acc.color}`,
                      background: item.done ? '#10B981' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: item.done ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {item.done && (
                      <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>✓</span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: acc.color, flexShrink: 0,
                      }} />
                      <span style={{
                        color: item.done ? '#475569' : '#f1f5f9',
                        fontWeight: 700, fontSize: 14,
                        textDecoration: item.done ? 'line-through' : 'none',
                      }}>
                        {acc.name}
                      </span>
                    </div>
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 2, marginLeft: 13 }}>
                      {plat?.icon} {plat?.label}
                      {acc.accountNumber ? ` · ${acc.accountNumber}` : ''}
                    </div>
                    <div style={{ color: '#334155', fontSize: 11, marginTop: 1, marginLeft: 13 }}>
                      {item.jars.map(j => j.name).join(' + ')}
                    </div>
                  </div>

                  {/* Amount + expand */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      color: item.done ? '#475569' : '#10B981',
                      fontWeight: 800, fontSize: 16,
                    }}>
                      {fmt(item.totalAmount)}đ
                    </div>
                    <button
                      onClick={() => toggleExp(item.accountId)}
                      style={{
                        background: 'none', border: 'none',
                        color: '#334155', cursor: 'pointer',
                        fontSize: 11, padding: '2px 0',
                      }}
                    >
                      {isExp ? '▲ ẩn' : '▼ chi tiết'}
                    </button>
                  </div>
                </div>

                {/* Jar breakdown */}
                {isExp && (
                  <div style={{
                    borderTop: '1px solid #1e293b',
                    padding: '10px 16px 12px 52px',
                  }}>
                    {item.jars.map(jar => (
                      <div key={jar.nodeId} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 7,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: jar.color || acc.color,
                          }} />
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>
                            {jar.parentName ? `${jar.parentName} › ` : ''}{jar.name}
                          </span>
                        </div>
                        <span style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 600 }}>
                          {fmt(jar.amount)}đ
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #0f172a', display: 'flex', gap: 10 }}>
          {!allDone && (
            <Button
              onClick={() => tickAllTodoItems(todo.id)}
              variant="ghost" full
            >
              Đánh dấu tất cả xong
            </Button>
          )}
          <Button
            onClick={onClose}
            full
            style={{ background: allDone ? 'linear-gradient(135deg,#10B981,#059669)' : undefined }}
          >
            {allDone ? '✅ Hoàn tất!' : 'Đóng'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main IncomePage ───────────────────────────────────────────
export default function IncomePage() {
  const { nodes, pipes, accounts, transactions, submitIncome, getPendingTodos } = useStore()

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState(null)
  const [step, setStep] = useState('form') // form | preview | confirm
  const [currentTodo, setCurrentTodo] = useState(null)
  const [showPendingTodo, setShowPendingTodo] = useState(null)

  const pendingTodos = getPendingTodos()

  // Tính tổng thu tháng này
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthIncome = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(currentMonth))
    .reduce((s, t) => s + t.amount, 0)

  const handlePreview = () => {
    const v = parseFloat(amount)
    if (!v || v <= 0) return
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthlyReceived = {}
    transactions
      .filter(t => t.type === 'income' && t.date.startsWith(currentMonth))
      .forEach(t => t.splits?.forEach(s => {
        monthlyReceived[s.nodeId] = (monthlyReceived[s.nodeId] || 0) + s.amount
      }))
    const result = runFlowEngine(v, nodes, pipes, monthlyReceived)
    setPreview(result)
    setStep('preview')
  }

  const handleConfirm = () => {
    const v = parseFloat(amount)
    if (!v) return
    const { todo } = submitIncome(v, note)
    setStep('form')
    setAmount('')
    setNote('')
    setPreview(null)
    if (todo) setCurrentTodo(todo)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#f1f5f9' }}>
          💰 Nhập Thu
        </h1>
        <div style={{ color: '#64748b', fontSize: 13 }}>
          Tháng này đã thu: <span style={{ color: '#10B981', fontWeight: 700 }}>
            {fmt(monthIncome)}đ
          </span>
        </div>
      </div>

      {/* Pending todos banner */}
      {pendingTodos.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          {pendingTodos.map(todo => {
            const pendingItems = todo.items.filter(i => !i.done)
            return (
              <div
                key={todo.id}
                onClick={() => setShowPendingTodo(todo)}
                style={{
                  background: '#F59E0B11',
                  border: '1px solid #F59E0B44',
                  borderRadius: 12, padding: '12px 14px',
                  marginBottom: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#F59E0B', fontSize: 13, fontWeight: 700 }}>
                    Còn {pendingItems.length} việc chưa xong
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>
                    {new Date(todo.createdAt).toLocaleDateString('vi-VN')} ·{' '}
                    {pendingItems.map(i => {
                      const acc = accounts.find(a => a.id === i.accountId)
                      return acc?.name
                    }).join(', ')}
                  </div>
                </div>
                <span style={{ color: '#F59E0B', fontSize: 16 }}>›</span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '0 20px' }}>
        {step === 'form' && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            {/* Form card */}
            <div style={{
              background: '#0a0f1e',
              border: '1px solid #1e293b',
              borderRadius: 16, padding: 20, marginBottom: 16,
            }}>
              <Field label="Số tiền (đ)">
                <div style={{ position: 'relative' }}>
                  <Input
                    type="number"
                    value={amount}
                    onChange={setAmount}
                    placeholder="10.000.000"
                    style={{ fontSize: 20, fontWeight: 700, paddingRight: 40 }}
                  />
                  <span style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#475569', fontSize: 13,
                  }}>đ</span>
                </div>
                {/* Quick amounts */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {[5000000, 10000000, 15000000, 20000000].map(v => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      style={{
                        background: amount == v ? '#3B82F622' : '#0f172a',
                        border: `1px solid ${amount == v ? '#3B82F6' : '#1e293b'}`,
                        borderRadius: 8, padding: '6px 12px',
                        color: amount == v ? '#3B82F6' : '#64748b',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {fmtShort(v)}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Ghi chú">
                <Input
                  value={note}
                  onChange={setNote}
                  placeholder="Lương tháng 6, freelance..."
                />
              </Field>
            </div>

            <Button
              onClick={handlePreview}
              full size="lg"
              disabled={!amount || parseFloat(amount) <= 0}
            >
              👁 Xem trước phân bổ
            </Button>
          </div>
        )}

        {step === 'preview' && preview && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            {/* Amount summary */}
            <div style={{
              background: '#0a0f1e',
              border: '1px solid #1e293b',
              borderRadius: 14, padding: '14px 18px',
              marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 12 }}>Số tiền nhập</div>
                <div style={{ color: '#10B981', fontSize: 22, fontWeight: 800 }}>
                  {fmt(parseFloat(amount))}đ
                </div>
              </div>
              {note && (
                <div style={{ color: '#475569', fontSize: 13 }}>
                  "{note}"
                </div>
              )}
            </div>

            {/* Preview */}
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>
              PHÂN BỔ DỰ KIẾN
            </div>
            <PreviewDistribution added={preview} nodes={nodes} />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                onClick={() => setStep('form')}
                variant="ghost" full
              >
                ← Sửa lại
              </Button>
              <Button onClick={handleConfirm} full variant="success">
                ✅ Xác nhận
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Todo modal sau khi confirm */}
      {currentTodo && (
        <TodoModal
          todo={currentTodo}
          accounts={accounts}
          onClose={() => setCurrentTodo(null)}
        />
      )}

      {/* Pending todo modal */}
      {showPendingTodo && (
        <TodoModal
          todo={showPendingTodo}
          accounts={accounts}
          onClose={() => setShowPendingTodo(null)}
        />
      )}
    </div>
  )
}