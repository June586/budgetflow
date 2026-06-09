import { create } from 'zustand'
import { uid, getCurrentMonth } from '../lib/helpers'
import { loadState, saveState } from '../lib/storage'
import { runFlowEngine, buildTodos, processCarryOver } from '../lib/engine'
import { COLORS } from '../constants'

// ── Dữ liệu mẫu khởi tạo ─────────────────────────────────────
const INITIAL_ACCOUNTS = [
  { id:'acc1', name:'TK MB',    accountNumber:'1234567890', platformId:'mb',   accountType:'payment',    color:'#3B82F6', note:'' },
  { id:'acc2', name:'Sổ TK MB', accountNumber:'9876543210', platformId:'mb',   accountType:'saving',     color:'#10B981', note:'' },
  { id:'acc3', name:'Quỹ MoMo', accountNumber:'',           platformId:'momo', accountType:'investment',  color:'#EC4899', note:'' },
]

const INITIAL_NODES = [
  {
    id:'income', type:'income', name:'Thu nhập tháng',
    color:'#10B981', x:40, y:240, amount:0,
  },
  {
    id:'savings', type:'group', name:'Tiết kiệm', color:'#3B82F6',
    x:300, y:60, limitAmount:4000000, currentAmount:0,
    outputMode:'parallel',
    children:[
      { id:'jar-1', name:'Khẩn cấp', ratio:40, limitAmount:2000000, currentAmount:0, accountId:'acc2', color:'#3B82F6' },
      { id:'jar-2', name:'Mục tiêu',  ratio:35, limitAmount:1500000, currentAmount:0, accountId:'acc1', color:'#6366F1' },
      { id:'jar-3', name:'Đầu tư',    ratio:25, limitAmount:null,    currentAmount:0, accountId:'acc3', color:'#EC4899' },
    ],
  },
  {
    id:'exp-1', type:'expense', name:'Tiền nhà', color:'#EF4444',
    x:300, y:300, limitAmount:5000000, currentAmount:0,
    deadline:'', monthRef:null, status:'active',
    repeat:'monthly', repeatUntil:null,
    description:'Thuê nhà', accountId:'acc1', sortOrder:0,
  },
  {
    id:'exp-2', type:'expense', name:'Ăn uống', color:'#F59E0B',
    x:300, y:440, limitAmount:3000000, currentAmount:0,
    deadline:'', monthRef:null, status:'active',
    repeat:'monthly', repeatUntil:null,
    description:'', accountId:null, sortOrder:1,
  },
  {
    id:'remainder', type:'remainder', name:'Còn lại', color:'#06B6D4',
    x:580, y:240, currentAmount:0,
  },
]

const INITIAL_PIPES = [
  { id:'p1', fromId:'income',    toId:'savings',   ratio:20, sortOrder:0, monthlyCapAmount:1000000, childRatioOverride:null },
  { id:'p2', fromId:'income',    toId:'exp-1',     ratio:0,  sortOrder:1, monthlyCapAmount:null,    childRatioOverride:null },
  { id:'p3', fromId:'income',    toId:'exp-2',     ratio:0,  sortOrder:2, monthlyCapAmount:null,    childRatioOverride:null },
  { id:'p4', fromId:'income',    toId:'remainder', ratio:0,  sortOrder:3, monthlyCapAmount:null,    childRatioOverride:null },
  { id:'p5', fromId:'remainder', toId:'savings',   ratio:40, sortOrder:0, monthlyCapAmount:null,    childRatioOverride:{ 'jar-1':20, 'jar-2':40, 'jar-3':40 } },
]

// ── Helper: tính monthlyReceived ──────────────────────────────
function calcMonthlyReceived(transactions, month) {
  const received = {}
  transactions
    .filter(t => t.type === 'income' && t.date.startsWith(month))
    .forEach(t => {
      t.splits?.forEach(s => {
        received[s.nodeId] = (received[s.nodeId] || 0) + s.amount
      })
    })
  return received
}

// ── Store ─────────────────────────────────────────────────────
const useStore = create((set, get) => {

  // Load từ localStorage
  const stored = loadState()

  const initialState = {
    nodes:        stored?.nodes        || INITIAL_NODES,
    pipes:        stored?.pipes        || INITIAL_PIPES,
    accounts:     stored?.accounts     || INITIAL_ACCOUNTS,
    transactions: stored?.transactions || [],
    todos:        stored?.todos        || [],
    lastRunMonth: stored?.lastRunMonth || null,
    activeTab:    'home',
    // UI state (không lưu)
    selectedNodeId: null,
    selectedPipeId: null,
  }

  return {
    ...initialState,

    // ── Persist helper ──────────────────────────────────────
    _save() {
      const s = get()
      saveState({
        nodes:        s.nodes,
        pipes:        s.pipes,
        accounts:     s.accounts,
        transactions: s.transactions,
        todos:        s.todos,
        lastRunMonth: s.lastRunMonth,
      })
    },

    // ── Tab navigation ──────────────────────────────────────
    setTab: (tab) => set({ activeTab: tab }),

    // ── Node CRUD ───────────────────────────────────────────
    updateNode: (updated) => {
      set(s => ({ nodes: s.nodes.map(n => n.id === updated.id ? updated : n) }))
      get()._save()
    },

    addNode: (node) => {
      set(s => ({ nodes: [...s.nodes, node] }))
      get()._save()
    },

    deleteNode: (id) => {
      set(s => ({
        nodes: s.nodes.filter(n => n.id !== id),
        pipes: s.pipes.filter(p => p.fromId !== id && p.toId !== id),
      }))
      get()._save()
    },

    // ── Pipe CRUD ───────────────────────────────────────────
    updatePipe: (updated) => {
      set(s => ({ pipes: s.pipes.map(p => p.id === updated.id ? updated : p) }))
      get()._save()
    },

    addPipe: (pipe) => {
      set(s => ({ pipes: [...s.pipes, pipe] }))
      get()._save()
    },

    deletePipe: (id) => {
      set(s => ({ pipes: s.pipes.filter(p => p.id !== id) }))
      get()._save()
    },

    // ── Account CRUD ────────────────────────────────────────
    addAccount: (acc) => {
      set(s => ({ accounts: [...s.accounts, acc] }))
      get()._save()
    },

    updateAccount: (updated) => {
      set(s => ({ accounts: s.accounts.map(a => a.id === updated.id ? updated : a) }))
      get()._save()
    },

    deleteAccount: (id) => {
      // Unlink nodes
      set(s => ({
        accounts: s.accounts.filter(a => a.id !== id),
        nodes: s.nodes.map(n => {
          if (n.accountId === id) return { ...n, accountId: null }
          if (n.children) return {
            ...n,
            children: n.children.map(c => c.accountId === id ? { ...c, accountId: null } : c)
          }
          return n
        }),
      }))
      get()._save()
    },

    // ── Nhập thu (core action) ──────────────────────────────
    submitIncome: (amount, note) => {
      const s = get()
      const month = getCurrentMonth()
      const monthlyReceived = calcMonthlyReceived(s.transactions, month)

      // Chạy engine
      const added = runFlowEngine(amount, s.nodes, s.pipes, monthlyReceived)

      // Cập nhật nodes
      const newNodes = s.nodes.map(node => {
        if (node.type === 'income') return { ...node, amount }

        const nodeAdded = added[node.id] || 0

        if (node.type === 'group') {
          const children = node.children.map(c => {
            const cAdded = added[c.id] || 0
            const newAmt = (c.currentAmount || 0) + cAdded
            const limit = c.limitAmount
            return { ...c, currentAmount: limit === null ? newAmt : Math.min(newAmt, limit) }
          })
          const newGroupAmt = children.reduce((s, c) => s + c.currentAmount, 0)
          return { ...node, children, currentAmount: newGroupAmt }
        }

        if (node.type === 'expense' || node.type === 'remainder') {
          const newAmt = (node.currentAmount || 0) + nodeAdded
          const limit = node.limitAmount
          const newNode = { ...node, currentAmount: limit ? Math.min(newAmt, limit) : newAmt }
          if (limit && newNode.currentAmount >= limit) newNode.status = 'closed'
          return newNode
        }

        return node
      })

      // Build splits cho transaction
      const splits = Object.entries(added)
        .filter(([, v]) => v >= 1)
        .map(([nodeId, amount]) => ({ nodeId, amount }))

      const tx = {
        id:     uid(),
        type:   'income',
        amount,
        note,
        date:   new Date().toISOString(),
        month,
        splits,
      }

      // Build todo list
      const todoItems = buildTodos(added, s.nodes, s.accounts)
      const todo = todoItems.length > 0 ? {
        id:            uid(),
        transactionId: tx.id,
        createdAt:     new Date().toISOString(),
        items:         todoItems,
      } : null

      set({
        nodes:        newNodes,
        transactions: [...s.transactions, tx],
        todos:        todo ? [...s.todos, todo] : s.todos,
      })
      get()._save()

      return { tx, todo, added }
    },

    // ── Thêm khoản chi ──────────────────────────────────────
    submitExpense: (nodeId, amount, note) => {
      const s = get()

      const tx = {
        id:     uid(),
        type:   'expense',
        amount,
        note,
        date:   new Date().toISOString(),
        month:  getCurrentMonth(),
        splits: [{ nodeId, amount }],
      }

      const newNodes = s.nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, currentAmount: Math.max(0, (node.currentAmount||0) - amount) }
        }
        if (node.children) {
          const jar = node.children.find(c => c.id === nodeId)
          if (jar) {
            const children = node.children.map(c =>
              c.id === nodeId
                ? { ...c, currentAmount: Math.max(0, (c.currentAmount||0) - amount) }
                : c
            )
            return { ...node, children, currentAmount: children.reduce((s,c) => s+c.currentAmount, 0) }
          }
        }
        return node
      })

      set({ nodes: newNodes, transactions: [...s.transactions, tx] })
      get()._save()
    },

    // ── Todo actions ─────────────────────────────────────────
    tickTodoItem: (todoId, accountId) => {
      set(s => ({
        todos: s.todos.map(t =>
          t.id === todoId
            ? { ...t, items: t.items.map(item =>
                item.accountId === accountId ? { ...item, done: true } : item
              )}
            : t
        )
      }))
      get()._save()
    },

    tickAllTodoItems: (todoId) => {
      set(s => ({
        todos: s.todos.map(t =>
          t.id === todoId
            ? { ...t, items: t.items.map(item => ({ ...item, done: true })) }
            : t
        )
      }))
      get()._save()
    },

    // ── Carry-over (chạy đầu tháng) ─────────────────────────
checkCarryOver: () => {
  const s = get()
  const currentMonth = getCurrentMonth()

  // Lần đầu dùng app → chỉ set month, không sinh carry-over
  if (!s.lastRunMonth) {
    set({ lastRunMonth: currentMonth })
    get()._save()
    return
  }

  // Đã chạy tháng này rồi → bỏ qua
  if (s.lastRunMonth === currentMonth) return

  const newNodes = processCarryOver(s.nodes, currentMonth)
  set({ nodes: newNodes, lastRunMonth: currentMonth })
  get()._save()
},

// ── Đổi thứ tự chai trong dây chuyền ─────────────────────────
reorderExpense: (expId, direction) => {
  const s = get()

  // Lấy danh sách chai active (không phải carryover)
  // Sắp xếp theo sortOrder
  const activeExps = s.nodes
    .filter(n => n.type === 'expense' && n.status !== 'carryover' && n.status !== 'closed')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const idx = activeExps.findIndex(n => n.id === expId)
  if (idx === -1) return

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= activeExps.length) return

  // Swap sortOrder giữa 2 chai
  const expA = activeExps[idx]
  const expB = activeExps[swapIdx]
  const newSortA = expB.sortOrder
  const newSortB = expA.sortOrder

  const newNodes = s.nodes.map(n => {
    if (n.id === expA.id) return { ...n, sortOrder: newSortA }
    if (n.id === expB.id) return { ...n, sortOrder: newSortB }
    // Carryover của expA cũng đổi theo
    if (n.parentExpenseId === expA.id && n.status === 'carryover') {
      return { ...n, sortOrder: newSortA + 0.1 }
    }
    if (n.parentExpenseId === expB.id && n.status === 'carryover') {
      return { ...n, sortOrder: newSortB + 0.1 }
    }
    return n
  })

  set({ nodes: newNodes })
  get()._save()
},


    // ── Canvas selection ─────────────────────────────────────
    selectNode: (id) => set({ selectedNodeId: id, selectedPipeId: null }),
    selectPipe: (id) => set({ selectedPipeId: id, selectedNodeId: null }),
    clearSelection: () => set({ selectedNodeId: null, selectedPipeId: null }),

    // ── Getters ──────────────────────────────────────────────
    getPendingTodos: () => {
      return get().todos.filter(t => t.items.some(i => !i.done))
    },

    getPendingCount: () => {
      return get().todos.reduce((s, t) => s + t.items.filter(i => !i.done).length, 0)
    },

    getAllNodes: () => {
      // Flat list gồm cả Hũ con
      const result = []
      get().nodes.forEach(n => {
        result.push(n)
        if (n.children) n.children.forEach(c => result.push({ ...c, parentId: n.id, parentName: n.name }))
      })
      return result
    },
  }
})

export default useStore