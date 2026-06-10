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

// Chain: income → savings → exp-1 → exp-2 → remainder
const INITIAL_PIPES = [
  {
    id: uid(),
    fromId: 'income',
    toId: 'remainder',
    ratio: 0,
    monthlyCapAmount: null,
    sortOrder: 0,
    childRatioOverride: null,
  }
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

  // ── Migration: parallel → chain ──────────────────────────
  // Nếu data cũ có nhiều pipe từ income đến các node khác nhau (parallel),
  // tự động convert sang chain dựa theo sortOrder
  let migratedPipes = stored?.pipes || INITIAL_PIPES
  if (stored?.pipes) {
    const income = stored.nodes?.find(n => n.type === 'income')
    const remainder = stored.nodes?.find(n => n.type === 'remainder')
    if (income && remainder) {
      const fromIncome = stored.pipes.filter(p => p.fromId === income.id)
      const isParallel = fromIncome.length > 1
      if (isParallel) {
        // Sắp xếp theo sortOrder, loại pipe đến remainder
        const backbonePipes = fromIncome
          .filter(p => p.toId !== remainder.id)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        const remPipes = stored.pipes.filter(p => p.fromId === remainder.id)

        // Build chain: income → n1 → n2 → ... → remainder
        const chainNodes = [income.id, ...backbonePipes.map(p => p.toId), remainder.id]
        const newBackbonePipes = []
        for (let i = 0; i < chainNodes.length - 1; i++) {
          const orig = backbonePipes[i - 1] // lấy ratio từ pipe gốc nếu có
          newBackbonePipes.push({
            id: uid(),
            fromId: chainNodes[i],
            toId: chainNodes[i + 1],
            ratio: orig?.ratio || 0,
            monthlyCapAmount: orig?.monthlyCapAmount || null,
            sortOrder: 0,
            childRatioOverride: orig?.childRatioOverride || null,
          })
        }
        migratedPipes = [...newBackbonePipes, ...remPipes]
      }
    }
  }

  const initialState = {
    nodes:        stored?.nodes        || INITIAL_NODES,
    pipes:        migratedPipes,
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

    // Đảm bảo luôn có pipe income → remainder (không thể bị xóa vĩnh viễn)
    _ensureBaselinePipe() {
      const s = get()
      const income    = s.nodes.find(n => n.type === 'income')
      const remainder = s.nodes.find(n => n.type === 'remainder')
      if (!income || !remainder) return

      // Kiểm tra còn pipe nào trong backbone không (income → ... → remainder)
      // Nếu không còn gì → khôi phục pipe trực tiếp income → remainder
      const remChildIds = new Set(s.pipes.filter(p => p.fromId === remainder.id).map(p => p.toId))
      const backbonePipeFromIncome = s.pipes.find(
        p => p.fromId === income.id && !remChildIds.has(p.toId)
      )
      if (!backbonePipeFromIncome) {
        const restored = {
          id: uid(), fromId: income.id, toId: remainder.id,
          ratio: 0, monthlyCapAmount: null, sortOrder: 0, childRatioOverride: null,
        }
        set({ pipes: [...s.pipes, restored] })
        get()._save()
      }
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

    // ── Chain pipe actions (dùng cho FlowPage) ─────────────
    // Helper: lấy pipe backbone từ một node (không phải pipe con của remainder)
    _getBackbonePipeFrom(fromId) {
      const s = get()
      const rem = s.nodes.find(n => n.type === 'remainder')
      const remChildIds = new Set(s.pipes.filter(p => p.fromId === rem?.id).map(p => p.toId))
      return s.pipes.find(p => p.fromId === fromId && !remChildIds.has(p.toId))
    },

    // Chèn node vào backbone sau insertAfterId
spliceIntoPipe(insertAfterId, newNodeId, ratio = 0, monthlyCapAmount = null) {
  const s = get()
  const rem = s.nodes.find(n => n.type === 'remainder')
  const remChildIds = new Set(s.pipes.filter(p => p.fromId === rem?.id).map(p => p.toId))

  // Nếu newNodeId là jar con trong group → tạo clone top-level trước
  let actualNodeId = newNodeId
  const isJarChild = s.nodes.some(n => n.type === 'group' && n.children?.some(c => c.id === newNodeId))
  const isTopLevel = s.nodes.some(n => n.id === newNodeId)
  if (isJarChild && !isTopLevel) {
    // Tìm xem đã có clone của jar này chưa (không phải từ remainder)
    const existingClone = s.nodes.find(n => n.originalId === newNodeId)
    if (existingClone) {
      actualNodeId = existingClone.id
    } else {
      // Tạo clone top-level
      const jarChild = (() => {
        for (const n of s.nodes) {
          if (n.children) { const c = n.children.find(c => c.id === newNodeId); if (c) return c }
        }
      })()
      if (!jarChild) return
      const clone = { ...jarChild, id: uid(), originalId: jarChild.id, currentAmount: 0, type: 'jar' }
      delete clone.children
      s.nodes = [...s.nodes, clone]
      set({ nodes: s.nodes })
      actualNodeId = clone.id
    }
  }

  // Tìm pipe backbone từ insertAfterId (không phải pipe từ remainder)
  let oldPipes = s.pipes.filter(p => p.fromId === insertAfterId && !remChildIds.has(p.toId))
  let oldToId = null

  if (oldPipes.length > 0) {
    oldToId = oldPipes[0].toId
    s.pipes = s.pipes.filter(p => p.id !== oldPipes[0].id)
  } else {
    const toRemPipe = s.pipes.find(p => p.fromId === insertAfterId && p.toId === rem?.id)
    if (toRemPipe) {
      oldToId = rem.id
      s.pipes = s.pipes.filter(p => p.id !== toRemPipe.id)
    } else {
      oldToId = rem.id
    }
  }

  s.pipes.push({
    id: uid(), fromId: insertAfterId, toId: actualNodeId,
    ratio, monthlyCapAmount, sortOrder: 0, childRatioOverride: null,
  })
  if (oldToId && oldToId !== actualNodeId) {
    s.pipes.push({
      id: uid(), fromId: actualNodeId, toId: oldToId,
      ratio: 0, monthlyCapAmount: null, sortOrder: 0, childRatioOverride: null,
    })
  }
  set({ pipes: s.pipes })
  get()._save()
},

    // Xóa node khỏi backbone, nối lại pipe trước-sau
    removeFromPipe(nodeId) {
      const s = get()
      const rem = s.nodes.find(n => n.type === 'remainder')
      const remChildIds = new Set(s.pipes.filter(p => p.fromId === rem?.id).map(p => p.toId))

      const prevPipe = s.pipes.find(p => p.toId === nodeId && p.fromId !== rem?.id)
      const nextPipe = s.pipes.find(p => p.fromId === nodeId && !remChildIds.has(p.toId))
      if (!prevPipe || !nextPipe) return

      const fromId = prevPipe.fromId
      const toId = nextPipe.toId

      set(st => ({
        pipes: [
          ...st.pipes.filter(p => p.id !== prevPipe.id && p.id !== nextPipe.id),
          { id: uid(), fromId, toId, ratio: 0, monthlyCapAmount: null, sortOrder: 0, childRatioOverride: null },
        ]
      }))
      get()._save()
      get()._ensureBaselinePipe()
    },

    // Thêm node con vào Còn lại
    addRemainderChild(nodeId, ratio = 0, monthlyCapAmount = null) {
  const s = get()
  const rem = s.nodes.find(n => n.type === 'remainder')
  if (!rem) return

  // Xóa tất cả pipe đến nodeId nhưng KHÔNG phải từ remainder
  const conflictingPipes = s.pipes.filter(p => p.toId === nodeId && p.fromId !== rem.id)
  let newPipes = s.pipes
  if (conflictingPipes.length) {
    newPipes = s.pipes.filter(p => !conflictingPipes.some(cp => cp.id === p.id))
  }

  // Thêm pipe mới từ remainder đến node
  const newPipe = {
    id: uid(),
    fromId: rem.id,
    toId: nodeId,
    ratio,
    monthlyCapAmount,
    sortOrder: newPipes.filter(p => p.fromId === rem.id).length,
    childRatioOverride: null,
  }

  set({ pipes: [...newPipes, newPipe] })
  get()._save()
},

cloneNode: (originalId, ratio, monthlyCapAmount) => {
  const s = get()

  // Tìm node: trước tiên top-level, nếu không có thì tìm trong group.children
  let original = s.nodes.find(n => n.id === originalId)
  let isJarChild = false
  if (!original) {
    for (const n of s.nodes) {
      if (n.children) {
        const child = n.children.find(c => c.id === originalId)
        if (child) { original = child; isJarChild = true; break }
      }
    }
  }
  if (!original) return
  if (!['group', 'jar'].includes(original.type) && !isJarChild) return

  // Tạo clone top-level, giữ originalId để resolve tiền sau
  const clone = {
    ...original,
    id: uid(),
    originalId: original.id,
    currentAmount: 0,
    // Jar con clone thành top-level jar
    type: isJarChild ? 'jar' : original.type,
  }
  delete clone.amount
  if (!isJarChild && clone.children) {
    clone.children = clone.children.map(child => ({ ...child }))
  }
  if (isJarChild) delete clone.children

  set({ nodes: [...s.nodes, clone] })

  const remainder = s.nodes.find(n => n.type === 'remainder')
  if (remainder) {
    const conflicting = s.pipes.filter(p => p.toId === clone.id && p.fromId !== remainder.id)
    let newPipes = s.pipes
    if (conflicting.length) newPipes = s.pipes.filter(p => !conflicting.some(cp => cp.id === p.id))

    const newPipe = {
      id: uid(),
      fromId: remainder.id,
      toId: clone.id,
      ratio: ratio || 0,
      monthlyCapAmount: monthlyCapAmount || null,
      sortOrder: newPipes.filter(p => p.fromId === remainder.id).length,
      childRatioOverride: null,
    }
    set({ pipes: [...newPipes, newPipe] })
  }
  get()._save()
},

// Helper để resolve clone id về original id khi phân bổ tiền
_resolveCloneAdded(added) {
  const s = get()
  // Build flat nodeMap kể cả jar con trong group
  const nodeMap = {}
  s.nodes.forEach(n => {
    nodeMap[n.id] = n
    if (n.children) n.children.forEach(c => { nodeMap[c.id] = c })
  })
  const resolved = {}
  Object.entries(added).forEach(([nodeId, amount]) => {
    const node = nodeMap[nodeId]
    if (node && node.originalId) {
      // Clone node: resolve về original, nhưng chỉ tính 1 lần
      // Nếu original id đã có trong added (được ghi trực tiếp), bỏ qua clone để tránh double
      if (!(node.originalId in added)) {
        resolved[node.originalId] = (resolved[node.originalId] || 0) + amount
      }
    } else {
      resolved[nodeId] = (resolved[nodeId] || 0) + amount
    }
  })
  return resolved
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
      get()._ensureBaselinePipe()
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
      const { added } = runFlowEngine(amount, s.nodes, s.pipes, monthlyReceived)
      const addedResolved = get()._resolveCloneAdded(added)

      // Cập nhật nodes — dùng addedResolved (đã gộp clone → original)
      const newNodes = s.nodes.map(node => {
        if (node.type === 'income') return { ...node, amount }

        const nodeAdded = addedResolved[node.id] || 0

        if (node.type === 'group') {
          const children = node.children.map(c => {
            const cAdded = addedResolved[c.id] || 0
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

        // Bỏ qua clone nodes (không phải node gốc trong store)
        return node
      })

      // Build splits từ added gốc (giữ clone id) để monthlyReceived tính đúng per-pipe
      const splits = Object.entries(added)
        .filter(([, v]) => v >= 1)
        .map(([nodeId, amount]) => ({ nodeId, amount }))

      // Cộng thêm group totals vào splits — để cap tháng của pipe → group được tính đúng
      // Key = currentNode.id trong backbone (có thể là clone group hoặc gốc)
      s.nodes.forEach(n => {
        if (n.type !== 'group' || !n.children) return
        const groupTotal = n.children.reduce((sum, c) => sum + (added[c.id] || 0), 0)
        if (groupTotal >= 1) splits.push({ nodeId: n.id, amount: groupTotal })
      })

      const tx = {
        id:     uid(),
        type:   'income',
        amount,
        note,
        date:   new Date().toISOString(),
        month,
        splits,
      }

      // Build todo list — dùng addedResolved
      const todoItems = buildTodos(addedResolved, s.nodes, s.accounts)
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

      return { tx, todo, added: addedResolved }
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

  // Luôn đảm bảo pipe baseline tồn tại khi app khởi động
  get()._ensureBaselinePipe()

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