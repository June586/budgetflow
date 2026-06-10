import { useState } from 'react'
import useStore from '../store/useStore'
import Sheet from '../components/ui/Sheet'
import Field from '../components/ui/Field'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { fmt, fmtShort } from '../lib/helpers'
import { runFlowEngine, buildTodos } from '../lib/engine'
import { PLATFORMS } from '../constants'

// ── Preview phân bổ – đúng thứ tự dòng tiền ──
function PreviewDistribution({ steps }) {
  if (!steps || steps.length === 0) return null

  // Nhóm các step liên tiếp cùng phase + cùng parent thành section
  // Mỗi section = { phase, label, color, items: [{name, color, amount, parentName}] }
  const sections = []
  let curSection = null

  steps.forEach(step => {
    const sectionKey = step.phase + '|' + (step.parentName || step.nodeId)
    // Xác định label và color cho section header
    let sLabel, sColor
    if (step.phase === 'remainder') {
      sLabel = '🌊 Từ Còn lại'; sColor = '#06B6D4'
    } else if (step.type === 'expense') {
      sLabel = '🍶 Chi phí'; sColor = '#EF4444'
    } else {
      sLabel = `🪣 ${step.parentName || step.name}`; sColor = step.color || '#3B82F6'
    }
    // Gom các jar con cùng group vào một section, expense liên tiếp vào một section
    const groupKey = step.phase === 'remainder' ? 'remainder'
      : step.type === 'expense' ? 'expense'
      : (step.parentName || step.name)
    if (!curSection || curSection.groupKey !== groupKey || curSection.phase !== step.phase) {
      curSection = { groupKey, phase: step.phase, label: sLabel, color: sColor, items: [] }
      sections.push(curSection)
    }
    curSection.items.push(step)
  })

  return (
    <div style={{ background: '#0f172a', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
      {sections.map((sec, si) => (
        <div key={si}>
          <div style={{
            padding: '10px 14px 6px',
            background: sec.color + '11',
            borderTop: si > 0 ? '1px solid #1e293b' : 'none',
          }}>
            <div style={{ color: sec.color, fontSize: 11, fontWeight: 700 }}>{sec.label}</div>
          </div>
          {sec.items.map((item, idx) => (
            <div key={idx} style={{
              padding: '9px 14px 9px ' + (item.parentName ? '28px' : '14px'),
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: idx === 0 ? 'none' : '1px solid #1e293b11',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color || sec.color, flexShrink: 0 }} />
                <span style={{ color: '#cbd5e1', fontSize: 13 }}>{item.name}</span>
              </div>
              <span style={{ color: '#10B981', fontWeight: 700, fontSize: 14 }}>+{fmt(item.amount)}đ</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── TodoModal ─────────────────────────────────────────────────
function TodoModal({ todo, accounts, onClose }) {
  const { tickTodoItem, tickAllTodoItems } = useStore()
  const [expanded, setExpanded] = useState({})
  const accMap = {}
  accounts.forEach(a => { accMap[a.id] = a })

  const pendingItems = todo.items.filter(i => !i.done)
  const doneItems = todo.items.filter(i => i.done)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#00000088', display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxHeight: '80vh', overflowY: 'auto',
        background: '#0a0f1e', borderRadius: '20px 20px 0 0',
        padding: '20px 0 32px',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '0 20px 14px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>📋 Việc cần làm</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
              {doneItems.length}/{todo.items.length} xong
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#94a3b8', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        {/* Items */}
        <div style={{ padding: '10px 20px' }}>
          {todo.items.map(item => {
            const acc = accMap[item.accountId]
            if (!acc) return null
            const isExp = expanded[item.accountId]
            return (
              <div key={item.accountId} style={{ background: '#0f172a', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    onClick={() => !item.done && tickTodoItem(todo.id, item.accountId)}
                    style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${item.done ? '#10B981' : acc.color}`,
                      background: item.done ? '#10B981' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: item.done ? 'default' : 'pointer',
                    }}
                  >
                    {item.done && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: item.done ? '#475569' : '#f1f5f9', fontWeight: 700, fontSize: 14, textDecoration: item.done ? 'line-through' : 'none' }}>
                      {acc.name}
                    </div>
                    <div style={{ color: '#475569', fontSize: 11 }}>{acc.accountNumber || ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: item.done ? '#475569' : '#10B981', fontWeight: 800, fontSize: 15 }}>{fmt(item.totalAmount)}đ</div>
                    <button onClick={() => setExpanded(e => ({ ...e, [item.accountId]: !isExp }))}
                      style={{ background: 'none', border: 'none', color: '#334155', fontSize: 10, cursor: 'pointer', padding: 0 }}>
                      {isExp ? '▲' : '▼ chi tiết'}
                    </button>
                  </div>
                </div>
                {isExp && (
                  <div style={{ padding: '6px 14px 12px 48px', borderTop: '1px solid #1e293b' }}>
                    {item.jars.map(jar => (
                      <div key={jar.nodeId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: jar.color || acc.color }} />
                          <span style={{ color: '#64748b', fontSize: 12 }}>{jar.parentName ? `${jar.parentName} › ` : ''}{jar.name}</span>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>{fmt(jar.amount)}đ</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {pendingItems.length > 0 && (
          <div style={{ padding: '0 20px' }}>
            <Button onClick={() => { tickAllTodoItems(todo.id); onClose() }} variant="ghost" full size="sm">
              ✓ Đánh dấu tất cả xong
            </Button>
          </div>
        )}
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
  const [step, setStep] = useState('form')
  const [currentTodo, setCurrentTodo] = useState(null)
  const [showPendingTodo, setShowPendingTodo] = useState(null)

  const pendingTodos = getPendingTodos()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthIncome = transactions
    .filter(t => t.type === 'income' && t.date.startsWith(currentMonth))
    .reduce((s, t) => s + t.amount, 0)

  const handlePreview = () => {
    const v = parseFloat(amount)
    if (!v || v <= 0) return
    const monthlyReceived = {}
    transactions
      .filter(t => t.type === 'income' && t.date.startsWith(currentMonth))
      .forEach(t => t.splits?.forEach(s => {
        monthlyReceived[s.nodeId] = (monthlyReceived[s.nodeId] || 0) + s.amount
      }))
    const { added, steps } = runFlowEngine(v, nodes, pipes, monthlyReceived)
    setPreview({ added, steps })
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
      <div style={{ padding: '20px 20px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#f1f5f9' }}>💰 Nhập Thu</h1>
        <div style={{ color: '#64748b', fontSize: 13 }}>
          Tháng này đã thu: <span style={{ color: '#10B981', fontWeight: 700 }}>{fmt(monthIncome)}đ</span>
        </div>
      </div>

      {pendingTodos.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          {pendingTodos.map(todo => {
            const pendingItems = todo.items.filter(i => !i.done)
            return (
              <div key={todo.id} onClick={() => setShowPendingTodo(todo)} style={{
                background: '#F59E0B11', border: '1px solid #F59E0B44', borderRadius: 12,
                padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#F59E0B', fontSize: 13, fontWeight: 700 }}>Còn {pendingItems.length} việc chưa xong</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>
                    {new Date(todo.createdAt).toLocaleDateString('vi-VN')} ·{' '}
                    {pendingItems.map(i => { const acc = accounts.find(a => a.id === i.accountId); return acc?.name }).join(', ')}
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
            <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <Field label="Số tiền (đ)">
                <div style={{ position: 'relative' }}>
                  <Input type="number" value={amount} onChange={setAmount} placeholder="10.000.000" style={{ fontSize: 20, fontWeight: 700, paddingRight: 40 }} />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 13 }}>đ</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {[5000000, 10000000, 15000000, 20000000].map(v => (
                    <button key={v} onClick={() => setAmount(String(v))} style={{
                      background: amount == v ? '#3B82F622' : '#0f172a',
                      border: `1px solid ${amount == v ? '#3B82F6' : '#1e293b'}`,
                      borderRadius: 8, padding: '6px 12px',
                      color: amount == v ? '#3B82F6' : '#64748b',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>{fmtShort(v)}</button>
                  ))}
                </div>
              </Field>
              <Field label="Ghi chú">
                <Input value={note} onChange={setNote} placeholder="Lương tháng 6, freelance..." />
              </Field>
            </div>
            <Button onClick={handlePreview} full size="lg" disabled={!amount || parseFloat(amount) <= 0}>👁 Xem trước phân bổ</Button>
          </div>
        )}

        {step === 'preview' && preview && (
          <div style={{ animation: 'fadeIn 0.2s ease' }}>
            <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 12 }}>Số tiền nhập</div>
                <div style={{ color: '#10B981', fontSize: 22, fontWeight: 800 }}>{fmt(parseFloat(amount))}đ</div>
              </div>
              {note && <div style={{ color: '#475569', fontSize: 13 }}>"{note}"</div>}
            </div>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>PHÂN BỔ DỰ KIẾN</div>
            <PreviewDistribution steps={preview.steps} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button onClick={() => setStep('form')} variant="ghost" full>← Sửa lại</Button>
              <Button onClick={handleConfirm} full variant="success">✅ Xác nhận</Button>
            </div>
          </div>
        )}
      </div>

      {currentTodo && <TodoModal todo={currentTodo} accounts={accounts} onClose={() => setCurrentTodo(null)} />}
      {showPendingTodo && <TodoModal todo={showPendingTodo} accounts={accounts} onClose={() => setShowPendingTodo(null)} />}
    </div>
  )
}