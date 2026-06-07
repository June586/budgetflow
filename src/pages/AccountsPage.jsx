import { useState } from 'react'
import useStore from '../store/useStore'
import Sheet from '../components/ui/Sheet'
import Field from '../components/ui/Field'
import Button from '../components/ui/Button'
import ColorPicker from '../components/ui/ColorPicker'
import { Input, Select } from '../components/ui/Input'
import { fmt } from '../lib/helpers'
import { PLATFORMS, ACC_TYPES, COLORS } from '../constants'
import { uid } from '../lib/helpers'

// ── Todo Section ──────────────────────────────────────────────
function TodoSection({ todos, accounts }) {
  const { tickTodoItem, tickAllTodoItems } = useStore()
  const [expanded, setExpanded] = useState({})
  const [openTodo, setOpenTodo] = useState(null)

  const accMap = {}
  accounts.forEach(a => { accMap[a.id] = a })

  const pendingTodos = todos.filter(t => t.items.some(i => !i.done))
  if (pendingTodos.length === 0) return null

  return (
    <div style={{ padding: '0 20px', marginBottom: 24 }}>
      <div style={{ color: '#F59E0B', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10 }}>
        ⚠️ VIỆC CẦN LÀM
      </div>
      {pendingTodos.map(todo => {
        const pendingItems = todo.items.filter(i => !i.done)
        const doneItems = todo.items.filter(i => i.done)
        const isOpen = openTodo === todo.id

        return (
          <div key={todo.id} style={{
            background: '#0a0f1e',
            border: '1px solid #F59E0B33',
            borderRadius: 14, marginBottom: 10, overflow: 'hidden',
          }}>
            {/* Header */}
            <div
              onClick={() => setOpenTodo(isOpen ? null : todo.id)}
              style={{
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18 }}>📋</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>
                  Lần nhập {new Date(todo.createdAt).toLocaleDateString('vi-VN')}
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 1 }}>
                  {doneItems.length}/{todo.items.length} xong ·{' '}
                  còn {pendingItems.length} việc
                </div>
              </div>
              <span style={{ color: '#475569', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Items */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #0f172a' }}>
                {todo.items.map(item => {
                  const acc = accMap[item.accountId]
                  if (!acc) return null
                  const plat = PLATFORMS.find(p => p.id === acc.platformId)
                  const isExp = expanded[`${todo.id}-${item.accountId}`]

                  return (
                    <div key={item.accountId} style={{
                      borderBottom: '1px solid #0f172a',
                    }}>
                      <div style={{
                        padding: '11px 16px',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        {/* Checkbox */}
                        <div
                          onClick={() => !item.done && tickTodoItem(todo.id, item.accountId)}
                          style={{
                            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                            border: `2px solid ${item.done ? '#10B981' : acc.color}`,
                            background: item.done ? '#10B981' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: item.done ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {item.done && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: item.done ? '#475569' : '#f1f5f9',
                            fontSize: 13, fontWeight: 700,
                            textDecoration: item.done ? 'line-through' : 'none',
                          }}>
                            {acc.name}
                          </div>
                          <div style={{ color: '#475569', fontSize: 11, marginTop: 1 }}>
                            {plat?.icon} {plat?.label}
                            {acc.accountNumber ? ` · ${acc.accountNumber}` : ''}
                          </div>
                        </div>

                        {/* Amount */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            color: item.done ? '#475569' : '#10B981',
                            fontWeight: 800, fontSize: 15,
                          }}>
                            {fmt(item.totalAmount)}đ
                          </div>
                          <button
                            onClick={() => setExpanded(e => ({
                              ...e,
                              [`${todo.id}-${item.accountId}`]: !isExp,
                            }))}
                            style={{
                              background: 'none', border: 'none',
                              color: '#334155', fontSize: 10,
                              cursor: 'pointer', padding: 0,
                            }}
                          >
                            {isExp ? '▲' : '▼ chi tiết'}
                          </button>
                        </div>
                      </div>

                      {/* Jar breakdown */}
                      {isExp && (
                        <div style={{
                          padding: '8px 16px 12px 50px',
                          background: '#0f172a11',
                        }}>
                          {item.jars.map(jar => (
                            <div key={jar.nodeId} style={{
                              display: 'flex', justifyContent: 'space-between',
                              marginBottom: 6,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{
                                  width: 5, height: 5, borderRadius: '50%',
                                  background: jar.color || acc.color,
                                }} />
                                <span style={{ color: '#64748b', fontSize: 12 }}>
                                  {jar.parentName ? `${jar.parentName} › ` : ''}{jar.name}
                                </span>
                              </div>
                              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                                {fmt(jar.amount)}đ
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Mark all */}
                <div style={{ padding: '10px 16px' }}>
                  <Button
                    onClick={() => tickAllTodoItems(todo.id)}
                    variant="ghost" full size="sm"
                  >
                    ✓ Đánh dấu tất cả xong
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Account Form ──────────────────────────────────────────────
function AccountForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber || '')
  const [platformId, setPlatformId] = useState(initial?.platformId || 'mb')
  const [accountType, setAccountType] = useState(initial?.accountType || 'payment')
  const [color, setColor] = useState(initial?.color || COLORS[0])
  const [note, setNote] = useState(initial?.note || '')

  const submit = () => {
    if (!name) return
    onSave({
      id: initial?.id || uid(),
      name, accountNumber, platformId,
      accountType, color, note,
    })
  }

  return (
    <div>
      <Field label="Tên hiển thị">
        <Input value={name} onChange={setName} placeholder="Sổ TK MB, Ví MoMo..." />
      </Field>

      <Field label="Số TK / Mã ví" hint="Tuỳ chọn">
        <Input
          value={accountNumber} onChange={setAccountNumber}
          placeholder="1234567890"
        />
      </Field>

      <Field label="Nền tảng">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatformId(p.id)}
              style={{
                padding: '9px 12px', borderRadius: 10,
                border: `1px solid ${platformId === p.id ? '#3B82F6' : '#1e293b'}`,
                background: platformId === p.id ? '#3B82F622' : '#0f172a',
                color: platformId === p.id ? '#3B82F6' : '#64748b',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                textAlign: 'left',
              }}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Loại tài khoản">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ACC_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setAccountType(t.id)}
              style={{
                padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${accountType === t.id ? '#3B82F6' : '#1e293b'}`,
                background: accountType === t.id ? '#3B82F622' : '#0f172a',
                color: accountType === t.id ? '#3B82F6' : '#64748b',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {t.label}
              {t.id === 'investment' && (
                <span style={{ color: '#475569', fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                  (không giới hạn)
                </span>
              )}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Màu">
        <ColorPicker value={color} onChange={setColor} />
      </Field>

      <Field label="Ghi chú">
        <Input value={note} onChange={setNote} placeholder="Ghi chú thêm..." />
      </Field>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {onCancel && (
          <Button onClick={onCancel} variant="ghost" full>Huỷ</Button>
        )}
        <Button onClick={submit} full disabled={!name}>
          {initial ? '💾 Lưu' : '+ Thêm'}
        </Button>
      </div>
    </div>
  )
}

// ── Account Card ──────────────────────────────────────────────
function AccountCard({ account, nodes, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)

  // Tìm tất cả hũ/chai gắn vào TK này
  const linkedNodes = []
  nodes.forEach(n => {
    if (n.type === 'group' && n.children) {
      n.children.forEach(c => {
        if (c.accountId === account.id) {
          linkedNodes.push({ ...c, parentName: n.name })
        }
      })
    } else if (n.accountId === account.id && n.type !== 'income' && n.type !== 'remainder') {
      linkedNodes.push(n)
    }
  })

  const total = linkedNodes.reduce((s, n) => s + (n.currentAmount || 0), 0)
  const plat = PLATFORMS.find(p => p.id === account.platformId)
  const accType = ACC_TYPES.find(t => t.id === account.accountType)

  return (
    <div style={{
      background: '#0a0f1e',
      border: `1px solid ${open ? account.color + '55' : '#1e293b'}`,
      borderRadius: 14, marginBottom: 10, overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: account.color + '22',
          border: `2px solid ${account.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          {plat?.icon || '🏦'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => setOpen(o => !o)}>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15 }}>
            {account.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            {plat && (
              <span style={{ color: '#64748b', fontSize: 11 }}>
                {plat.label}
              </span>
            )}
            {accType && (
              <span style={{
                background: '#1e293b', color: '#64748b',
                fontSize: 10, fontWeight: 600,
                padding: '1px 7px', borderRadius: 4,
              }}>
                {accType.label}
              </span>
            )}
            {account.accountNumber && (
              <span style={{ color: '#334155', fontSize: 11, fontFamily: 'monospace' }}>
                {account.accountNumber}
              </span>
            )}
          </div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
            {linkedNodes.length} hũ/chai gắn vào
          </div>
        </div>

        {/* Amount + controls */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: account.color, fontWeight: 800, fontSize: 16 }}>
            {fmt(total)}đ
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={() => onEdit(account)}
              style={{
                background: '#1e293b', border: 'none', borderRadius: 6,
                color: '#94a3b8', cursor: 'pointer',
                width: 28, height: 28, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✏️</button>
            <button
              onClick={() => onDelete(account.id)}
              style={{
                background: '#1e293b', border: 'none', borderRadius: 6,
                color: '#EF4444', cursor: 'pointer',
                width: 28, height: 28, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >🗑</button>
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                background: '#1e293b', border: 'none', borderRadius: 6,
                color: '#64748b', cursor: 'pointer',
                width: 28, height: 28, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {open ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Linked nodes breakdown */}
      {open && (
        <div style={{ borderTop: '1px solid #0f172a' }}>
          {linkedNodes.length === 0 ? (
            <div style={{ padding: '12px 16px', color: '#334155', fontSize: 13 }}>
              Chưa có hũ/chai nào gắn vào
            </div>
          ) : (
            linkedNodes.map(node => (
              <div key={node.id} style={{
                padding: '10px 16px',
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #0f172a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: node.color || account.color,
                  }} />
                  <div>
                    <div style={{ color: '#cbd5e1', fontSize: 13 }}>{node.name}</div>
                    {node.parentName && (
                      <div style={{ color: '#475569', fontSize: 11 }}>
                        trong {node.parentName}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#10B981', fontWeight: 700, fontSize: 13 }}>
                    {fmt(node.currentAmount || 0)}đ
                  </div>
                  {node.limitAmount && (
                    <div style={{ color: '#334155', fontSize: 11 }}>
                      / {fmt(node.limitAmount)}đ
                    </div>
                  )}
                  {!node.limitAmount && (
                    <div style={{ color: '#475569', fontSize: 10 }}>📈 đầu tư</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main AccountsPage ─────────────────────────────────────────
export default function AccountsPage() {
  const { accounts, nodes, todos, addAccount, updateAccount, deleteAccount } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const pendingCount = todos.reduce((s, t) => s + t.items.filter(i => !i.done).length, 0)

  const handleSave = (data) => {
    if (editAccount) {
      updateAccount(data)
      setEditAccount(null)
    } else {
      addAccount(data)
      setShowForm(false)
    }
  }

  const handleDelete = (id) => {
    setConfirmDelete(id)
  }

  const confirmDeleteAccount = () => {
    if (confirmDelete) {
      deleteAccount(confirmDelete)
      setConfirmDelete(null)
    }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
            💳 Tài khoản
          </h1>
          {pendingCount > 0 && (
            <div style={{ color: '#F59E0B', fontSize: 12, marginTop: 3, fontWeight: 600 }}>
              ⚠️ {pendingCount} việc cần làm
            </div>
          )}
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          + Thêm
        </Button>
      </div>

      {/* Todo section */}
      <TodoSection todos={todos} accounts={accounts} />

      {/* Account list */}
      <div style={{ padding: '0 20px' }}>
        {accounts.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 0',
            color: '#334155', fontSize: 14,
          }}>
            Chưa có tài khoản nào
            <div style={{ marginTop: 8 }}>
              <Button onClick={() => setShowForm(true)} size="sm">
                + Thêm tài khoản đầu tiên
              </Button>
            </div>
          </div>
        )}
        {accounts.map(acc => (
          <AccountCard
            key={acc.id}
            account={acc}
            nodes={nodes}
            onEdit={(a) => setEditAccount(a)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add sheet */}
      <Sheet
        open={showForm}
        onClose={() => setShowForm(false)}
        title="🏦 Thêm Tài khoản"
        height="92vh"
      >
        <AccountForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </Sheet>

      {/* Edit sheet */}
      <Sheet
        open={!!editAccount}
        onClose={() => setEditAccount(null)}
        title="✏️ Chỉnh Tài khoản"
        height="92vh"
      >
        {editAccount && (
          <AccountForm
            initial={editAccount}
            onSave={handleSave}
            onCancel={() => setEditAccount(null)}
          />
        )}
      </Sheet>

      {/* Confirm delete */}
      <Sheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="🗑 Xoá tài khoản?"
        height="30vh"
      >
        <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
          Xoá tài khoản sẽ huỷ liên kết với tất cả hũ/chai đang gắn vào.
          Dữ liệu tiền không bị mất.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={() => setConfirmDelete(null)} variant="ghost" full>Huỷ</Button>
          <Button onClick={confirmDeleteAccount} variant="danger" full>Xoá</Button>
        </div>
      </Sheet>
    </div>
  )
}