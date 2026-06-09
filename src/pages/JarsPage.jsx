import { useState } from 'react'
import useStore from '../store/useStore'
import Sheet from '../components/ui/Sheet'
import Field from '../components/ui/Field'
import Button from '../components/ui/Button'
import ColorPicker from '../components/ui/ColorPicker'
import { Input, Select } from '../components/ui/Input'
import { fmt, fmtShort, daysUntil, daysLeftInMonth, getCurrentMonth } from '../lib/helpers'
import { calcBackward } from '../lib/engine'
import { COLORS, REPEAT_OPTIONS } from '../constants'
import { uid, formatMonthLabel  } from '../lib/helpers'

// ── Progress Bar ──────────────────────────────────────────────
function ProgressBar({ current, limit, color, height = 6 }) {
  const pct = limit ? Math.min(current / limit * 100, 100) : 0
  return (
    <div style={{ background: '#1e293b', borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{
        width: pct + '%', height: '100%',
        background: color, borderRadius: 99,
        transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }} />
    </div>
  )
}

// ── Liquid Fill (cho Chai) ────────────────────────────────────
function LiquidFill({ current, limit, color, height = 56 }) {
  const pct = limit ? Math.min(current / limit * 100, 100) : 0
  const full = pct >= 100
  return (
    <div style={{
      position: 'relative', background: '#0f172a',
      borderRadius: 10, height, overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: pct + '%',
        background: `linear-gradient(180deg, ${color}66, ${color})`,
        transition: 'height 0.6s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          position: 'absolute', top: -4, left: '-10%', right: '-10%',
          height: 8, background: color + '88', borderRadius: '50%',
          animation: 'liquidWave 2s ease-in-out infinite',
        }} />
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: pct > 55 ? '#fff' : '#94a3b8',
        fontSize: 13, fontWeight: 800,
      }}>
        {full ? '🔒' : Math.round(pct) + '%'}
      </div>
    </div>
  )
}

// ── Jar Detail Modal ──────────────────────────────────────────
function JarDetail({ jar, parentGroup, onClose, onViewHistory }) {
  const { nodes, pipes, accounts, transactions, setTab } = useStore()
  const account = accounts.find(a => a.id === jar.accountId)
  const backward = jar.limitAmount
    ? calcBackward(jar, parentGroup, nodes, pipes)
    : null

  // Lịch sử 3 giao dịch gần nhất liên quan đến jar này
  const relatedTxs = transactions
    .filter(t => t.splits?.some(s => s.nodeId === jar.id))
    .slice(-3).reverse()

  return (
    <Sheet open onClose={onClose} title={jar.name} height="90vh">
      {/* Header info */}
      <div style={{
        background: jar.color + '15',
        border: `1px solid ${jar.color}33`,
        borderRadius: 14, padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>Hiện có</div>
            <div style={{ color: jar.color, fontSize: 22, fontWeight: 800 }}>
              {fmt(jar.currentAmount || 0)}đ
            </div>
          </div>
          {jar.limitAmount && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Hạn mức</div>
              <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700 }}>
                {fmt(jar.limitAmount)}đ
              </div>
            </div>
          )}
        </div>
        {jar.limitAmount && (
          <ProgressBar current={jar.currentAmount || 0} limit={jar.limitAmount} color={jar.color} height={8} />
        )}
        {!jar.limitAmount && (
          <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
            📈 Tài khoản đầu tư — không giới hạn
          </div>
        )}
      </div>

      {/* TK liên kết */}
      {account && (
        <div style={{
          background: '#0f172a', borderRadius: 12, padding: 12,
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: account.color + '22',
            border: `1px solid ${account.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🏦</div>
          <div>
            <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>{account.name}</div>
            {account.accountNumber && (
              <div style={{ color: '#64748b', fontSize: 11 }}>{account.accountNumber}</div>
            )}
          </div>
        </div>
      )}

      {/* Tính ngược deadline */}
      {backward && backward.incomeNeeded > 0 && (
        <div style={{
          background: '#0f172a', borderRadius: 12, padding: 14,
          marginBottom: 14, border: '1px solid #1e293b',
        }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 10, letterSpacing: '0.05em' }}>
            📊 CẦN NẠP THÊM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Row label={`Hũ "${jar.name}" cần thêm`} value={fmt(backward.jarNeeded) + 'đ'} color={jar.color} />
            {backward.groupNeeded && (
              <Row label={`Xô "${parentGroup?.name}" cần`} value={fmt(backward.groupNeeded) + 'đ'} />
            )}
            <Row label="Cần thu nhập thêm" value={fmt(backward.incomeNeeded) + 'đ'} color="#10B981" bold />
            <Row
              label={`Còn ${daysLeftInMonth()} ngày trong tháng`}
              value={'~' + fmtShort(backward.incomeNeeded / daysLeftInMonth()) + 'đ/ngày'}
              color="#F59E0B"
            />
          </div>
        </div>
      )}

      {/* Lịch sử gần nhất */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          color: '#64748b', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.05em', marginBottom: 10,
        }}>
          LỊCH SỬ GẦN ĐÂY
        </div>
        {relatedTxs.length === 0 && (
          <div style={{ color: '#334155', fontSize: 13 }}>Chưa có giao dịch</div>
        )}
        {relatedTxs.map(tx => {
          const split = tx.splits.find(s => s.nodeId === jar.id)
          return (
            <div key={tx.id} style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', padding: '9px 0',
              borderBottom: '1px solid #0f172a',
            }}>
              <div>
                <div style={{ color: '#cbd5e1', fontSize: 13 }}>
                  {tx.type === 'income' ? '💰' : '💸'} {tx.note || (tx.type === 'income' ? 'Khoản thu' : 'Khoản chi')}
                </div>
                <div style={{ color: '#475569', fontSize: 11 }}>
                  {new Date(tx.date).toLocaleDateString('vi-VN')}
                </div>
              </div>
              <div style={{
                color: tx.type === 'income' ? '#10B981' : '#EF4444',
                fontWeight: 700, fontSize: 14,
              }}>
                {tx.type === 'income' ? '+' : '-'}{fmt(split?.amount)}đ
              </div>
            </div>
          )
        })}
        {relatedTxs.length > 0 && (
          <button
            onClick={() => { onClose(); onViewHistory(jar.id) }}
            style={{
              background: 'none', border: 'none', color: '#3B82F6',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              padding: '8px 0', width: '100%', textAlign: 'center',
            }}
          >
            Xem đầy đủ →
          </button>
        )}
      </div>
    </Sheet>
  )
}

function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
      <span style={{ color: color || '#f1f5f9', fontSize: 13, fontWeight: bold ? 800 : 600 }}>
        {value}
      </span>
    </div>
  )
}

// ── Expense Detail Modal ──────────────────────────────────────
function ExpenseDetail({ node, onClose, onViewHistory }) {
  const { accounts, transactions, setTab } = useStore()
  const account = accounts.find(a => a.id === node.accountId)
  const pct = node.limitAmount
    ? Math.min((node.currentAmount || 0) / node.limitAmount * 100, 100)
    : 0
  const days = daysUntil(node.deadline)

  const relatedTxs = transactions
    .filter(t => t.splits?.some(s => s.nodeId === node.id))
    .slice(-3).reverse()

  return (
    <Sheet open onClose={onClose} title={node.name} height="85vh">
      {/* Status badge */}
      {node.status === 'carryover' && (
        <div style={{
          background: '#F59E0B22', border: '1px solid #F59E0B44',
          borderRadius: 8, padding: '6px 12px', marginBottom: 12,
          color: '#F59E0B', fontSize: 12, fontWeight: 700,
        }}>
          ⏳ Carry-over từ {node.monthRef} — chưa đầy
        </div>
      )}

      {/* Liquid fill */}
      <LiquidFill
        current={node.currentAmount || 0}
        limit={node.limitAmount}
        color={node.color}
        height={80}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 10, marginBottom: 16,
      }}>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>
          {fmt(node.currentAmount || 0)}đ
        </span>
        <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>
          / {fmt(node.limitAmount)}đ
        </span>
      </div>

      {/* Info */}
      {node.description && (
        <div style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>
          {node.description}
        </div>
      )}

      {/* Deadline */}
      {node.deadline && (
        <div style={{
          background: days !== null && days < 7 ? '#EF444422' : '#0f172a',
          border: `1px solid ${days !== null && days < 7 ? '#EF4444' : '#1e293b'}`,
          borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>⏰ Deadline</span>
          <span style={{
            color: days !== null && days < 7 ? '#EF4444' : '#f1f5f9',
            fontSize: 13, fontWeight: 700,
          }}>
            {node.deadline} {days !== null ? `(còn ${days} ngày)` : ''}
          </span>
        </div>
      )}

      {/* Lặp lại */}
      {node.repeat && node.repeat !== 'none' && (
        <div style={{
          background: '#0f172a', borderRadius: 10,
          padding: '10px 14px', marginBottom: 12,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>🔄 Lặp lại</span>
          <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
            {REPEAT_OPTIONS.find(r => r.id === node.repeat)?.label}
            {node.repeatUntil ? ` đến ${node.repeatUntil}` : ' (mãi mãi)'}
          </span>
        </div>
      )}

      {/* TK */}
      {account && (
        <div style={{
          background: '#0f172a', borderRadius: 12, padding: 12,
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: account.color + '22',
            border: `1px solid ${account.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>🏦</div>
          <div>
            <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>{account.name}</div>
            {account.accountNumber && (
              <div style={{ color: '#64748b', fontSize: 11 }}>{account.accountNumber}</div>
            )}
          </div>
        </div>
      )}

      {/* Lịch sử */}
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
        LỊCH SỬ NẠP VÀO
      </div>
      {relatedTxs.length === 0 && (
        <div style={{ color: '#334155', fontSize: 13 }}>Chưa có giao dịch</div>
      )}
      {relatedTxs.map(tx => {
        const split = tx.splits.find(s => s.nodeId === node.id)
        const label = node.monthRef
          ? `[${node.monthRef}] ${tx.note || 'Khoản thu'}`
          : tx.note || 'Khoản thu'
        return (
          <div key={tx.id} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '9px 0', borderBottom: '1px solid #0f172a',
          }}>
            <div>
              <div style={{ color: '#cbd5e1', fontSize: 13 }}>
                {tx.type === 'income' ? '💰' : '💸'} {label}
              </div>
              <div style={{ color: '#475569', fontSize: 11 }}>
                {new Date(tx.date).toLocaleDateString('vi-VN')}
              </div>
            </div>
            <div style={{ color: '#10B981', fontWeight: 700 }}>
              +{fmt(split?.amount)}đ
            </div>
          </div>
        )
      })}
      {relatedTxs.length > 0 && (
        <button
          onClick={() => { onClose(); onViewHistory(node.id) }}
          style={{
            background: 'none', border: 'none', color: '#3B82F6',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            padding: '8px 0', width: '100%', textAlign: 'center',
          }}
        >
          Xem đầy đủ →
        </button>
      )}
    </Sheet>
  )
}

// ── Form tạo Hũ đơn ───────────────────────────────────────────
function CreateJarForm({ onDone }) {
  const { addNode, addPipe, nodes, pipes, accounts } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [limitAmount, setLimitAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [description, setDescription] = useState('')
  const [isInvestment, setIsInvestment] = useState(false)

  const submit = () => {
    if (!name) return
    const node = {
      id: uid(), type: 'jar',
      name, color,
      limitAmount: isInvestment ? null : (parseFloat(limitAmount) || 0),
      currentAmount: 0,
      accountId: accountId || null,
      description,
      x: 300, y: 200,
    }
    addNode(node)
    // Tự kết nối với income
    const income = nodes.find(n => n.type === 'income')
    if (income) {
      addPipe({
        id: uid(), fromId: income.id, toId: node.id,
        ratio: 0, sortOrder: pipes.length,
        monthlyCapAmount: null, childRatioOverride: null,
      })
    }
    onDone()
  }

  return (
    <div>
      <Field label="Tên hũ">
        <Input value={name} onChange={setName} placeholder="Khẩn cấp, Du lịch..." />
      </Field>
      <Field label="Màu">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Loại">
        <div style={{ display: 'flex', gap: 8 }}>
          {[false, true].map(inv => (
            <button key={String(inv)}
              onClick={() => setIsInvestment(inv)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10,
                border: `1px solid ${isInvestment === inv ? '#3B82F6' : '#1e293b'}`,
                background: isInvestment === inv ? '#3B82F622' : '#0f172a',
                color: isInvestment === inv ? '#3B82F6' : '#64748b',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {inv ? '📈 Đầu tư' : '🎯 Mục tiêu'}
            </button>
          ))}
        </div>
      </Field>
      {!isInvestment && (
        <Field label="Hạn mức (đ)">
          <Input type="number" value={limitAmount} onChange={setLimitAmount} placeholder="0" />
        </Field>
      )}
      <Field label="Tài khoản">
        <Select value={accountId} onChange={setAccountId}>
          <option value="">— Chưa gắn —</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Mô tả">
        <Input value={description} onChange={setDescription} placeholder="Ghi chú..." />
      </Field>
      <Button onClick={submit} full style={{ marginTop: 8 }}>Tạo Hũ</Button>
    </div>
  )
}

// ── Form tạo Xô nhóm ─────────────────────────────────────────
function CreateGroupForm({ onDone }) {
  const { addNode, addPipe, nodes, pipes, accounts } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[1])
  const [limitAmount, setLimitAmount] = useState('')
  const [children, setChildren] = useState([
    { id: uid(), name: 'Hũ 1', ratio: 50, limitAmount: '', accountId: '', color: COLORS[0] },
    { id: uid(), name: 'Hũ 2', ratio: 50, limitAmount: '', accountId: '', color: COLORS[4] },
  ])

  const totalRatio = children.reduce((s, c) => s + (parseFloat(c.ratio) || 0), 0)

  const updateChild = (idx, field, val) => {
    setChildren(cs => cs.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }

  const addChild = () => {
    setChildren(cs => [...cs, {
      id: uid(), name: `Hũ ${cs.length + 1}`,
      ratio: 0, limitAmount: '', accountId: '',
      color: COLORS[cs.length % COLORS.length],
    }])
  }

  const removeChild = (idx) => {
    setChildren(cs => cs.filter((_, i) => i !== idx))
  }

  const submit = () => {
    if (!name || totalRatio !== 100) return
    const node = {
      id: uid(), type: 'group',
      name, color,
      limitAmount: parseFloat(limitAmount) || null,
      currentAmount: 0,
      outputMode: 'parallel',
      children: children.map(c => ({
        ...c,
        limitAmount: parseFloat(c.limitAmount) || null,
        currentAmount: 0,
        accountId: c.accountId || null,
      })),
      x: 300, y: 100,
    }
    addNode(node)
    const income = nodes.find(n => n.type === 'income')
    if (income) {
      addPipe({
        id: uid(), fromId: income.id, toId: node.id,
        ratio: 0, sortOrder: pipes.length,
        monthlyCapAmount: null, childRatioOverride: null,
      })
    }
    onDone()
  }

  return (
    <div>
      <Field label="Tên xô">
        <Input value={name} onChange={setName} placeholder="Tiết kiệm, Quỹ..." />
      </Field>
      <Field label="Màu xô">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Hạn mức tổng (đ)" hint="Để trống = không giới hạn">
        <Input type="number" value={limitAmount} onChange={setLimitAmount} placeholder="0" />
      </Field>

      {/* Children */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10, marginTop: 4,
      }}>
        <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
          HŨ BÊN TRONG
        </span>
        <span style={{
          color: totalRatio === 100 ? '#10B981' : '#EF4444',
          fontSize: 12, fontWeight: 700,
        }}>
          ∑ {totalRatio}% {totalRatio !== 100 ? '⚠️' : '✓'}
        </span>
      </div>

      {children.map((c, idx) => (
        <div key={c.id} style={{
          background: '#0f172a', borderRadius: 12,
          padding: 12, marginBottom: 10,
          border: `1px solid ${c.color}22`,
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: c.color, flexShrink: 0,
            }} />
            <Input value={c.name} onChange={v => updateChild(idx, 'name', v)} style={{ flex: 1 }} />
            {children.length > 1 && (
              <button onClick={() => removeChild(idx)} style={{
                background: 'none', border: 'none',
                color: '#EF4444', cursor: 'pointer', fontSize: 18, padding: 0,
              }}>×</button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ color: '#475569', fontSize: 10, marginBottom: 3 }}>Tỷ lệ (%)</div>
              <Input type="number" value={c.ratio}
                onChange={v => updateChild(idx, 'ratio', parseFloat(v) || 0)} />
            </div>
            <div>
              <div style={{ color: '#475569', fontSize: 10, marginBottom: 3 }}>Hạn mức (đ)</div>
              <Input type="number" value={c.limitAmount}
                onChange={v => updateChild(idx, 'limitAmount', v)}
                placeholder="Không giới hạn" />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: '#475569', fontSize: 10, marginBottom: 3 }}>Tài khoản</div>
            <Select value={c.accountId} onChange={v => updateChild(idx, 'accountId', v)}>
              <option value="">— Chưa gắn —</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <ColorPicker value={c.color} onChange={v => updateChild(idx, 'color', v)} />
        </div>
      ))}

      <button onClick={addChild} style={{
        width: '100%', padding: '10px 0',
        background: 'none', border: '1px dashed #1e293b',
        borderRadius: 10, color: '#475569',
        fontSize: 13, cursor: 'pointer', marginBottom: 16,
      }}>
        + Thêm hũ
      </button>

      <Button
        onClick={submit} full
        disabled={!name || totalRatio !== 100}
      >
        Tạo Xô nhóm
      </Button>
      {totalRatio !== 100 && (
        <div style={{ color: '#EF4444', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Tổng tỷ lệ phải = 100%
        </div>
      )}
    </div>
  )
}

// ── Form tạo Chai ─────────────────────────────────────────────
function CreateExpenseForm({ onDone }) {
  const { addNode, addPipe, nodes, pipes, accounts } = useStore()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[3])
  const [limitAmount, setLimitAmount] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState('')
  const [repeat, setRepeat] = useState('monthly')
  const [repeatUntil, setRepeatUntil] = useState('')

  const submit = () => {
    if (!name || !limitAmount) return
    const sortOrder = nodes.filter(n => n.type === 'expense').length
    const node = {
      id: uid(), type: 'expense',
      name, color,
      limitAmount: parseFloat(limitAmount),
      currentAmount: 0,
      deadline, description,
      accountId: accountId || null,
      repeat, repeatUntil: repeatUntil || null,
      monthRef: null, status: 'active',
      sortOrder,
      x: 300, y: 300 + sortOrder * 80,
    }
    addNode(node)
    const income = nodes.find(n => n.type === 'income')
    if (income) {
      addPipe({
        id: uid(), fromId: income.id, toId: node.id,
        ratio: 0, sortOrder: pipes.length,
        monthlyCapAmount: null, childRatioOverride: null,
      })
    }
    onDone()
  }

  return (
    <div>
      <Field label="Tên chi phí">
        <Input value={name} onChange={setName} placeholder="Tiền nhà, Điện nước..." />
      </Field>
      <Field label="Màu">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Hạn mức (đ)">
        <Input type="number" value={limitAmount} onChange={setLimitAmount} placeholder="0" />
      </Field>
      <Field label="Deadline">
        <Input type="date" value={deadline} onChange={setDeadline} />
      </Field>
      <Field label="Mô tả">
        <Input value={description} onChange={setDescription} placeholder="Ghi chú..." />
      </Field>
      <Field label="Tài khoản">
        <Select value={accountId} onChange={setAccountId}>
          <option value="">— Chưa gắn —</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </Field>

      {/* Lặp lại */}
      <Field label="Lặp lại">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {REPEAT_OPTIONS.map(r => (
            <button key={r.id} onClick={() => setRepeat(r.id)} style={{
              padding: '9px 0', borderRadius: 10,
              border: `1px solid ${repeat === r.id ? '#3B82F6' : '#1e293b'}`,
              background: repeat === r.id ? '#3B82F622' : '#0f172a',
              color: repeat === r.id ? '#3B82F6' : '#64748b',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </Field>

      {repeat !== 'none' && (
        <Field label="Lặp đến (tháng/năm)" hint="Để trống = lặp mãi mãi">
          <Input
            type="month" value={repeatUntil} onChange={setRepeatUntil}
            placeholder="yyyy-mm"
          />
        </Field>
      )}

      <Button onClick={submit} full disabled={!name || !limitAmount} style={{ marginTop: 8 }}>
        Tạo Chai chi phí
      </Button>
    </div>
  )
}

// ── Edit Forms ────────────────────────────────────────────────
function EditJarForm({ jar, parentGroup, onDone }) {
  const { updateNode } = useStore()
  const { accounts } = useStore()
  const [name, setName] = useState(jar.name)
  const [color, setColor] = useState(jar.color)
  const [limitAmount, setLimitAmount] = useState(jar.limitAmount || '')
  const [accountId, setAccountId] = useState(jar.accountId || '')
  const [description, setDescription] = useState(jar.description || '')
  const [ratio, setRatio] = useState(jar.ratio || 0)

  const submit = () => {
    if (!name) return
    const updatedJar = {
      ...jar,
      name, color, description,
      limitAmount: limitAmount ? parseFloat(limitAmount) : null,
      accountId: accountId || null,
      ratio: parseFloat(ratio) || 0,
    }
    // Cập nhật jar trong group cha
    if (parentGroup) {
      const updatedGroup = {
        ...parentGroup,
        children: parentGroup.children.map(c =>
          c.id === jar.id ? updatedJar : c
        ),
      }
      updateNode(updatedGroup)
    } else {
      updateNode(updatedJar)
    }
    onDone()
  }

  return (
    <div>
      <Field label="Tên hũ">
        <Input value={name} onChange={setName} />
      </Field>
      {parentGroup && (
        <Field label="Tỷ lệ (%)" hint="Tổng các hũ trong xô phải = 100%">
          <Input type="number" value={ratio} onChange={setRatio} />
        </Field>
      )}
      <Field label="Màu">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Hạn mức (đ)" hint="Để trống = không giới hạn (đầu tư)">
        <Input type="number" value={limitAmount} onChange={setLimitAmount} placeholder="Không giới hạn" />
      </Field>
      <Field label="Tài khoản">
        <Select value={accountId} onChange={setAccountId}>
          <option value="">— Chưa gắn —</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Mô tả">
        <Input value={description} onChange={setDescription} placeholder="Ghi chú..." />
      </Field>
      <Button onClick={submit} full>💾 Lưu thay đổi</Button>
    </div>
  )
}

function EditGroupForm({ group, onDone }) {
  const { updateNode, accounts } = useStore()
  const [name, setName] = useState(group.name)
  const [color, setColor] = useState(group.color)
  const [limitAmount, setLimitAmount] = useState(group.limitAmount || '')
  const [children, setChildren] = useState(
    group.children.map(c => ({ ...c, limitAmount: c.limitAmount || '' }))
  )

  const totalRatio = children.reduce((s, c) => s + (parseFloat(c.ratio) || 0), 0)

  const updateChild = (idx, field, val) => {
    setChildren(cs => cs.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }

  const submit = () => {
    if (!name || totalRatio !== 100) return
    updateNode({
      ...group,
      name, color,
      limitAmount: limitAmount ? parseFloat(limitAmount) : null,
      children: children.map(c => ({
        ...c,
        ratio: parseFloat(c.ratio) || 0,
        limitAmount: c.limitAmount ? parseFloat(c.limitAmount) : null,
        accountId: c.accountId || null,
      })),
    })
    onDone()
  }

  return (
    <div>
      <Field label="Tên xô">
        <Input value={name} onChange={setName} />
      </Field>
      <Field label="Màu">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label="Hạn mức tổng (đ)" hint="Để trống = không giới hạn">
        <Input type="number" value={limitAmount} onChange={setLimitAmount} placeholder="Không giới hạn" />
      </Field>

      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10, marginTop:4 }}>
        <span style={{ color:'#64748b', fontSize:11, fontWeight:700, letterSpacing:'0.05em' }}>
          HŨ BÊN TRONG
        </span>
        <span style={{ color: totalRatio===100?'#10B981':'#EF4444', fontSize:12, fontWeight:700 }}>
          ∑ {totalRatio}% {totalRatio!==100?'⚠️':'✓'}
        </span>
      </div>

      {children.map((c, idx) => (
        <div key={c.id} style={{
          background:'#0f172a', borderRadius:12,
          padding:12, marginBottom:10,
          border:`1px solid ${c.color||group.color}22`,
        }}>
          <div style={{ color:'#94a3b8', fontSize:12, fontWeight:700, marginBottom:8 }}>
            {c.name}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <div style={{ color:'#475569', fontSize:10, marginBottom:3 }}>Tỷ lệ (%)</div>
              <Input type="number" value={c.ratio}
                onChange={v => updateChild(idx, 'ratio', parseFloat(v)||0)} />
            </div>
            <div>
              <div style={{ color:'#475569', fontSize:10, marginBottom:3 }}>Hạn mức (đ)</div>
              <Input type="number" value={c.limitAmount}
                onChange={v => updateChild(idx, 'limitAmount', v)}
                placeholder="Không giới hạn" />
            </div>
          </div>
          <div>
            <div style={{ color:'#475569', fontSize:10, marginBottom:3 }}>Tài khoản</div>
            <Select value={c.accountId||''} onChange={v => updateChild(idx, 'accountId', v)}>
              <option value="">— Chưa gắn —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div style={{ marginTop:8 }}>
            <ColorPicker value={c.color||group.color} onChange={v => updateChild(idx, 'color', v)} />
          </div>
        </div>
      ))}

      <Button onClick={submit} full disabled={totalRatio!==100}>
        💾 Lưu thay đổi
      </Button>
    </div>
  )
}

function EditExpenseForm({ node, onDone }) {
  const { updateNode, accounts } = useStore()
  const [name, setName] = useState(node.name)
  const [color, setColor] = useState(node.color)
  const [limitAmount, setLimitAmount] = useState(node.limitAmount || '')
  const [deadline, setDeadline] = useState(node.deadline || '')
  const [description, setDescription] = useState(node.description || '')
  const [accountId, setAccountId] = useState(node.accountId || '')
  const [repeat, setRepeat] = useState(node.repeat || 'monthly')
  const [repeatUntil, setRepeatUntil] = useState(node.repeatUntil || '')

  const isCarryover = node.status === 'carryover'

  const submit = () => {
    if (!name) return
    updateNode({
      ...node,
      name, color, deadline, description,
      accountId: accountId || null,
      repeat, repeatUntil: repeatUntil || null,
      // Không cho sửa limitAmount nếu là carryover
      limitAmount: isCarryover ? node.limitAmount : (parseFloat(limitAmount) || node.limitAmount),
    })
    onDone()
  }

  return (
    <div>
      <Field label="Tên chi phí">
        <Input value={name} onChange={setName} />
      </Field>
      <Field label="Màu">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      {!isCarryover && (
        <Field label="Hạn mức (đ)">
          <Input type="number" value={limitAmount} onChange={setLimitAmount} />
        </Field>
      )}
      {isCarryover && (
        <div style={{
          background:'#F59E0B11', border:'1px solid #F59E0B33',
          borderRadius:10, padding:'10px 14px', marginBottom:14,
          color:'#F59E0B', fontSize:12,
        }}>
          ⚠️ Chai carry-over — không thể sửa hạn mức
        </div>
      )}
      <Field label="Deadline">
        <Input type="date" value={deadline} onChange={setDeadline} />
      </Field>
      <Field label="Mô tả">
        <Input value={description} onChange={setDescription} placeholder="Ghi chú..." />
      </Field>
      <Field label="Tài khoản">
        <Select value={accountId} onChange={setAccountId}>
          <option value="">— Chưa gắn —</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      {!isCarryover && (
        <Field label="Lặp lại">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {REPEAT_OPTIONS.map(r => (
              <button key={r.id} onClick={() => setRepeat(r.id)} style={{
                padding:'9px 0', borderRadius:10,
                border:`1px solid ${repeat===r.id?'#3B82F6':'#1e293b'}`,
                background: repeat===r.id?'#3B82F622':'#0f172a',
                color: repeat===r.id?'#3B82F6':'#64748b',
                fontSize:12, fontWeight:600, cursor:'pointer',
              }}>
                {r.label}
              </button>
            ))}
          </div>
        </Field>
      )}
      {!isCarryover && repeat !== 'none' && (
        <Field label="Lặp đến" hint="Để trống = mãi mãi">
          <Input type="month" value={repeatUntil} onChange={setRepeatUntil} />
        </Field>
      )}
      <Button onClick={submit} full style={{ marginTop:8 }}>
        💾 Lưu thay đổi
      </Button>
    </div>
  )
}


// ── Main JarsPage ─────────────────────────────────────────────
export default function JarsPage() {
  const { nodes, setTab, reorderExpense, deleteNode } = useStore()
  const [createSheet, setCreateSheet] = useState(null) // 'jar'|'group'|'expense'
  const [detailJar, setDetailJar] = useState(null)     // { jar, parentGroup }
  const [detailExp, setDetailExp] = useState(null)
  const [editSheet, setEditSheet] = useState(null)   // { type, node, parentGroup }
  const [confirmDel, setConfirmDel] = useState(null) // node to delete

  const groups = nodes.filter(n => n.type === 'group')
  const jars = nodes.filter(n => n.type === 'jar')
  const expenses = nodes.filter(n => n.type === 'expense' && n.status !== 'closed')
  const carryovers = expenses.filter(n => n.status === 'carryover')
  const actives = expenses.filter(n => n.status === 'active')

  const handleViewHistory = (nodeId) => {
    // Switch to history tab with filter
    setTab('history')
    // Store filter in sessionStorage
    sessionStorage.setItem('historyFilter', nodeId)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 12px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
          🪣 Hũ & Chai
        </h1>
      </div>

      {/* Section: Xô nhóm */}
      {groups.length > 0 && (
        <Section title="Xô nhóm">
        {groups.map(grp => (
          <GroupCard
            key={grp.id}
            group={grp}
            onJarPress={(jar) => setDetailJar({ jar, parentGroup: grp })}
            onEdit={(g) => setEditSheet({ type:'group', node:g })}
            onDelete={(g) => setConfirmDel(g)}
          />
        ))}
        </Section>
      )}

      {/* Section: Hũ đơn */}
      {jars.length > 0 && (
        <Section title="Hũ đơn">
          {jars.map(jar => (
            <JarCard key={jar.id} jar={jar}
              onPress={() => setDetailJar({ jar, parentGroup: null })} />
          ))}
        </Section>
      )}

      {/* Section: Chai carry-over */}
      {carryovers.length > 0 && (
        <Section title="⏳ Tháng trước chưa xong">
        {carryovers.map(exp => (
          <ExpenseCard
            key={exp.id}
            node={exp}
            onPress={() => setDetailExp(exp)}
            onEdit={(n) => setEditSheet({ type: 'expense', node: n })}
            onDelete={undefined}        // hoặc bỏ hẳn nếu không muốn cho phép xóa carryover
            onReorder={undefined}       // carryover thường không reorder
          />
        ))}
        </Section>
      )}

      {/* Section: Chai tháng này */}
      <Section title="🍶 Chi phí tháng này">
        {actives.length === 0 && (
          <div style={{ color: '#334155', fontSize: 13, padding: '8px 0' }}>
            Chưa có chai nào
          </div>
        )}
      {actives.map(exp => (
        <ExpenseCard
          key={exp.id}
          node={exp}
          onPress={() => setDetailExp(exp)}
          onEdit={(n) => setEditSheet({ type: 'expense', node: n })}
          onDelete={(n) => setConfirmDel(n)}
          onReorder={(dir) => reorderExpense(exp.id, dir)}
        />
      ))}
      </Section>

      {/* FAB tạo mới */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { id: 'jar', label: '+ Hũ', color: '#3B82F6' },
            { id: 'group', label: '+ Xô', color: '#10B981' },
            { id: 'expense', label: '+ Chai', color: '#EF4444' },
          ].map(btn => (
            <button key={btn.id} onClick={() => setCreateSheet(btn.id)} style={{
              padding: '12px 0',
              background: btn.color + '15',
              border: `1px solid ${btn.color}44`,
              borderRadius: 12,
              color: btn.color, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Create sheets */}
      <Sheet
        open={createSheet === 'jar'}
        onClose={() => setCreateSheet(null)}
        title="🪣 Tạo Hũ mới"
        height="90vh"
      >
        <CreateJarForm onDone={() => setCreateSheet(null)} />
      </Sheet>
      <Sheet
        open={createSheet === 'group'}
        onClose={() => setCreateSheet(null)}
        title="🪣 Tạo Xô nhóm"
        height="95vh"
      >
        <CreateGroupForm onDone={() => setCreateSheet(null)} />
      </Sheet>
      <Sheet
        open={createSheet === 'expense'}
        onClose={() => setCreateSheet(null)}
        title="🍶 Tạo Chai chi phí"
        height="95vh"
      >
        <CreateExpenseForm onDone={() => setCreateSheet(null)} />
      </Sheet>

      {/* Detail modals */}
      {detailJar && (
        <JarDetail
          jar={detailJar.jar}
          parentGroup={detailJar.parentGroup}
          onClose={() => setDetailJar(null)}
          onViewHistory={handleViewHistory}
        />
      )}
      {detailExp && (
        <ExpenseDetail
          node={detailExp}
          onClose={() => setDetailExp(null)}
          onViewHistory={handleViewHistory}
        />
      )}
    </div>
  )
}

// ── Sub components ────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ padding: '0 20px', marginBottom: 20 }}>
      <div style={{
        color: '#475569', fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function GroupCard({ group, onJarPress, onEdit, onDelete, onJarEdit }) {
  const [open, setOpen] = useState(false)
  const total = group.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0
  const limit = group.limitAmount

  return (
    <div style={{
      background: '#0a0f1e',
      border: `1px solid ${open ? group.color + '66' : '#1e293b'}`,
      borderRadius: 14, marginBottom: 10, overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: group.color + '22',
          border: `2px solid ${group.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>🪣</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{group.name}</div>
          <ProgressBar current={total} limit={limit || total + 1} color={group.color} height={4} />
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
            {fmt(total)}đ {limit ? `/ ${fmt(limit)}đ` : ''}
          </div>
        </div>
        <span style={{ color: '#475569', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
        
        {/* Thêm sau dòng hiện số tiền */}
        <div style={{ display:'flex', gap:6, marginTop:6 }}>
          <button onClick={e => { e.stopPropagation(); onEdit?.(group) }} style={{
            background:'#1e293b', border:'none', borderRadius:6,
            color:'#94a3b8', cursor:'pointer',
            padding:'4px 10px', fontSize:11,
          }}>✏️ Sửa</button>
          <button onClick={e => { e.stopPropagation(); onDelete?.(group) }} style={{
            background:'#1e293b', border:'none', borderRadius:6,
            color:'#EF4444', cursor:'pointer',
            padding:'4px 10px', fontSize:11,
          }}>🗑 Xoá</button>
        </div>

      </div>

      {/* Jar list */}
      {open && group.children?.map(jar => (
        <div
          key={jar.id}
          onClick={() => onJarPress(jar)}
          style={{
            padding: '10px 16px 10px 24px',
            borderTop: '1px solid #0f172a',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: jar.color || group.color, flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: '#cbd5e1', fontSize: 13 }}>{jar.name}</span>
              <span style={{ color: jar.color || group.color, fontSize: 12, fontWeight: 700 }}>
                {jar.ratio}%
              </span>
            </div>
            <ProgressBar
              current={jar.currentAmount || 0}
              limit={jar.limitAmount || (jar.currentAmount || 0) + 1}
              color={jar.color || group.color}
              height={3}
            />
            <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
              {fmt(jar.currentAmount || 0)}đ
              {jar.limitAmount ? ` / ${fmt(jar.limitAmount)}đ` : ' (đầu tư)'}
            </div>
          </div>
          <span style={{ color: '#334155', fontSize: 12 }}>›</span>
        </div>
      ))}
    </div>
  )
}

function JarCard({ jar, onPress }) {
  return (
    <div
      onClick={onPress}
      style={{
        background: '#0a0f1e',
        border: '1px solid #1e293b',
        borderRadius: 14, padding: '14px 16px',
        marginBottom: 10, display: 'flex',
        alignItems: 'center', gap: 12, cursor: 'pointer',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: jar.color + '22',
        border: `2px solid ${jar.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>🫙</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14, marginBottom: 5 }}>
          {jar.name}
        </div>
        {jar.limitAmount ? (
          <>
            <ProgressBar current={jar.currentAmount || 0} limit={jar.limitAmount} color={jar.color} height={4} />
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
              {fmt(jar.currentAmount || 0)} / {fmt(jar.limitAmount)}đ
            </div>
          </>
        ) : (
          <div style={{ color: '#64748b', fontSize: 11 }}>
            📈 {fmt(jar.currentAmount || 0)}đ tích lũy
          </div>
        )}
      </div>
      <span style={{ color: '#334155', fontSize: 16 }}>›</span>
    </div>
  )
}

function ExpenseCard({ node, onPress, onEdit, onDelete, onReorder }) {
  const isCarryover = node.status === 'carryover'
  const pct = node.limitAmount
    ? Math.min((node.currentAmount || 0) / node.limitAmount * 100, 100)
    : 0

  return (
    <div style={{
      background: '#0a0f1e',
      border: `1px solid ${isCarryover ? '#F59E0B44' : '#1e293b'}`,
      borderRadius: 14, marginBottom: 10,
      opacity: isCarryover ? 0.85 : 1,
    }}>
      <div
        onClick={onPress}
        style={{
          background: '#0a0f1e',
          border: `1px solid ${isCarryover ? '#F59E0B44' : '#1e293b'}`,
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          opacity: isCarryover ? 0.85 : 1,
        }}
      >
        {/* Mini liquid */}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#0f172a', overflow: 'hidden',
          border: `2px solid ${node.color}44`,
          position: 'relative', flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: pct + '%',
            background: node.color,
            transition: 'height 0.5s',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
            color: pct > 50 ? '#fff' : '#94a3b8',
          }}>
            {Math.round(pct)}%
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{node.name}</span>
            {isCarryover && (
              <span style={{
                background: '#F59E0B22', color: '#F59E0B',
                fontSize: 9, fontWeight: 700, padding: '1px 6px',
                borderRadius: 4,
              }}>
                {node.monthRef}
              </span>
            )}
          </div>
          <ProgressBar current={node.currentAmount || 0} limit={node.limitAmount} color={node.color} height={4} />
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
            {fmt(node.currentAmount || 0)} / {fmt(node.limitAmount)}đ
            {node.deadline && ` · ⏰ ${node.deadline}`}
          </div>
        </div>
        <span style={{ color: '#334155', fontSize: 16 }}>›</span>
      </div>

      {/* Controls */}
      {!isCarryover && (
        <div style={{
          display: 'flex', gap: 6, padding: '0 16px 12px',
          justifyContent: 'flex-end',
        }}>
          <button onClick={() => onReorder?.('up')} style={{
            background: '#1e293b', border: 'none', borderRadius: 6,
            color: '#64748b', cursor: 'pointer',
            width: 28, height: 28, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>↑</button>
          <button onClick={() => onReorder?.('down')} style={{
            background: '#1e293b', border: 'none', borderRadius: 6,
            color: '#64748b', cursor: 'pointer',
            width: 28, height: 28, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>↓</button>
          <button onClick={() => onEdit?.(node)} style={{
            background: '#1e293b', border: 'none', borderRadius: 6,
            color: '#94a3b8', cursor: 'pointer',
            width: 28, height: 28, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✏️</button>
          <button onClick={() => onDelete?.(node)} style={{
            background: '#1e293b', border: 'none', borderRadius: 6,
            color: '#EF4444', cursor: 'pointer',
            width: 28, height: 28, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🗑</button>
        </div>
      )}
    </div>
  )
}