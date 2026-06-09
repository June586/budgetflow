import { uid, getCurrentMonth } from './helpers'

// ── Làm tròn đến đơn vị 5.000đ ───────────────────────────────
const ROUND_UNIT = 5000

function roundToUnit(value) {
  return Math.round(value / ROUND_UNIT) * ROUND_UNIT
}

// Chia tiền có làm tròn — hũ cuối nhận phần dư
function distributeRounded(amount, targets) {
  // targets: [{id, ratio, limit, current}]
  if (!targets.length) return {}

  // Chạy parallel distribution bình thường trước
  const raw = distributeParallel(amount, targets)

  const ids = targets.map(t => t.id)
  const rounded = {}
  let runningTotal = 0

  // Làm tròn tất cả trừ hũ cuối
  for (let i = 0; i < ids.length - 1; i++) {
    const r = roundToUnit(raw[ids[i]])
    rounded[ids[i]] = r
    runningTotal += r
  }

  // Hũ cuối nhận toàn bộ phần còn lại (không làm tròn)
  const lastId = ids[ids.length - 1]
  rounded[lastId] = Math.max(0, amount - runningTotal)

  return rounded
}

// ── Parallel distribution với redistribution ──────────────────
export function distributeParallel(amount, targets) {
  // targets: [{ id, ratio, limit, current }]
  // limit = null → investment, không bao giờ đầy
  const result = {}
  targets.forEach(t => { result[t.id] = 0 })

  let remaining = amount
  let active = targets
    .map(t => ({
      ...t,
      space: t.limit === null ? Infinity : t.limit - t.current
    }))
    .filter(t => t.space > 0.01)

  let passes = 0
  while (remaining > 0.01 && active.length > 0 && passes < 20) {
    passes++
    const totalRatio = active.reduce((s, t) => s + t.ratio, 0)
    if (totalRatio <= 0) break

    let totalGiven = 0
    const nextActive = []

    active.forEach(t => {
      const share = (t.ratio / totalRatio) * remaining
      const give = Math.min(share, t.space)
      result[t.id] = (result[t.id] || 0) + give
      totalGiven += give
      t.space -= give
      if (t.space > 0.01) nextActive.push(t)
    })

    remaining -= totalGiven
    active = nextActive
  }

  return result // { nodeId: amount }
}

// ── Phân bổ vào Xô (có thể override tỷ lệ) ───────────────────
export function distributeToGroup(amount, group, ratioOverride) {
  if (!group.children?.length) return {}

  const targets = group.children.map(jar => ({
    id:      jar.id,
    ratio:   ratioOverride ? (ratioOverride[jar.id] || 0) : jar.ratio,
    limit:   jar.limitAmount,
    current: jar.currentAmount || 0,
  }))

  // Dùng distributeRounded thay vì distributeParallel
  return distributeRounded(amount, targets)
}

// ── Flow Engine chính ─────────────────────────────────────────
export function runFlowEngine(inputAmount, nodes, pipes, monthlyReceived = {}) {
  // monthlyReceived: { nodeId: amount } — đã nhận trong tháng này (cho cap)

  const nodeMap = {}
  nodes.forEach(n => {
    nodeMap[n.id] = n
    if (n.children) n.children.forEach(c => { nodeMap[c.id] = c })
  })

  // Kết quả: số tiền thêm vào mỗi node
  const added = {}
  const setAdded = (id, v) => { added[id] = (added[id] || 0) + v }

  let pool = inputAmount

  const incomeNode = nodes.find(n => n.type === 'income')
  if (!incomeNode) return added

  // Pipes từ income, sort theo sortOrder
  const outPipes = pipes
    .filter(p => p.fromId === incomeNode.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // ── Bước 1: Savings (group) với monthlyCapAmount ──────────
  const savPipes = outPipes.filter(p => nodeMap[p.toId]?.type === 'group')

  for (const pipe of savPipes) {
    if (pool <= 0.01) break
    const grp = nodeMap[pipe.toId]
    if (!grp) continue

    let savAmt = pool * (pipe.ratio / 100)

    // Áp dụng monthly cap
    if (pipe.monthlyCapAmount) {
      const received = monthlyReceived[grp.id] || 0
      const cap = pipe.monthlyCapAmount - received
      savAmt = Math.min(savAmt, Math.max(0, cap))
    }

    // Giới hạn space của xô
    if (grp.limitAmount !== null) {
      const grpCurrent = grp.children?.reduce((s, c) => s + (c.currentAmount || 0), 0) || 0
      const grpSpace = grp.limitAmount - grpCurrent
      savAmt = Math.min(savAmt, Math.max(0, grpSpace))
    }

    if (savAmt <= 0.01) continue

    const dist = distributeToGroup(savAmt, grp, pipe.childRatioOverride)
    let actualTotal = 0
    Object.entries(dist).forEach(([id, v]) => {
      setAdded(id, v)
      actualTotal += v
    })
    setAdded(grp.id, actualTotal)
    pool -= actualTotal
  }

  // ── Bước 2: Chai chi phí (sequential) ────────────────────
  const expPipes = outPipes
    .filter(p => nodeMap[p.toId]?.type === 'expense')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  // Carryover trước, rồi active
  const sortedExpPipes = [
    ...expPipes.filter(p => nodeMap[p.toId]?.status === 'carryover'),
    ...expPipes.filter(p => nodeMap[p.toId]?.status !== 'carryover'),
  ]

  for (const pipe of sortedExpPipes) {
    if (pool <= 0.01) break
    const exp = nodeMap[pipe.toId]
    if (!exp || exp.status === 'closed') continue

    const current = exp.currentAmount || 0
    const space = exp.limitAmount - current
    if (space <= 0.01) continue

    const give = Math.min(pool, space)
    setAdded(exp.id, give)
    pool -= give
  }

  // ── Bước 3: Remainder ─────────────────────────────────────
  const remPipe = outPipes.find(p => nodeMap[p.toId]?.type === 'remainder')
  if (remPipe && pool > 0.01) {
    const rem = nodeMap[remPipe.toId]
    if (rem) {
      setAdded(rem.id, pool)

      // Pipes từ remainder → các node khác
      const remOutPipes = pipes
        .filter(p => p.fromId === rem.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const totalRatio = remOutPipes.reduce((s, p) => s + p.ratio, 0)

      if (totalRatio > 0) {
        let remRunning = 0

        for (let ri = 0; ri < remOutPipes.length; ri++) {
          const rp = remOutPipes[ri]
          const isLast = ri === remOutPipes.length - 1
          const target = nodeMap[rp.toId]
          if (!target) continue

          let share = isLast
            ? Math.max(0, pool - remRunning)
            : roundToUnit(pool * (rp.ratio / 100))

          if (!isLast) remRunning += share

          if (target.type === 'group') {
            const dist = distributeToGroup(share, target, rp.childRatioOverride)
            let actualTotal = 0
            Object.entries(dist).forEach(([id, v]) => {
              setAdded(id, v)
              actualTotal += v
            })
            setAdded(target.id, actualTotal)
          } else {
            // Hũ đơn — làm tròn luôn
            const space = target.limitAmount === null
              ? share
              : Math.max(0, target.limitAmount - ((target.currentAmount || 0) + (added[target.id] || 0)))
            const give = Math.min(roundToUnit(share), space)
            setAdded(target.id, give)
          }
        }
      }
    }
  }

  pool = 0
  return added // { nodeId: amountAdded }
  }

// ── Build Todo List từ kết quả phân bổ ───────────────────────
export function buildTodos(added, nodes, accounts) {
  const nodeMap = {}
  nodes.forEach(n => {
    nodeMap[n.id] = { ...n }
    if (n.children) {
      n.children.forEach(c => {
        nodeMap[c.id] = { ...c, parentName: n.name, parentColor: n.color }
      })
    }
  })

  const accMap = {}
  accounts.forEach(a => { accMap[a.id] = a })

  // Group theo accountId
  const byAcc = {}
  Object.entries(added).forEach(([nodeId, amount]) => {
    if (amount < 1) return
    const node = nodeMap[nodeId]
    if (!node?.accountId) return
    const accId = node.accountId
    if (!byAcc[accId]) {
      byAcc[accId] = { accountId: accId, totalAmount: 0, jars: [], done: false }
    }
    byAcc[accId].totalAmount += amount
    byAcc[accId].jars.push({
      nodeId,
      name:       node.name,
      parentName: node.parentName || null,
      color:      node.color,
      amount,
    })
  })

  return Object.values(byAcc).filter(g => g.totalAmount >= 1)
}

// ── Tính ngược: Hũ → cần thu thêm bao nhiêu ─────────────────
export function calcBackward(jar, parentGroup, nodes, pipes) {
  const needed = (jar.limitAmount || 0) - (jar.currentAmount || 0)
  if (needed <= 0) return null

  const result = { jarNeeded: needed }

  if (!parentGroup) {
    result.incomeNeeded = needed
    return result
  }

  // Tỷ lệ jar trong xô (dùng tỷ lệ mặc định)
  const jarRatio = (jar.ratio || 0) / 100
  if (jarRatio <= 0) return result

  const groupNeeded = needed / jarRatio
  result.groupNeeded = groupNeeded

  // Tìm pipe đổ vào xô từ remainder
  const remNode = nodes.find(n => n.type === 'remainder')
  if (!remNode) return result

  const remToGroupPipe = pipes.find(
    p => p.fromId === remNode.id && p.toId === parentGroup.id
  )
  if (!remToGroupPipe || !remToGroupPipe.ratio) return result

  const remRatio = remToGroupPipe.ratio / 100
  const remNeeded = groupNeeded / remRatio
  result.remNeeded = remNeeded

  // Tính income cần thêm
  // Remainder = income - savings_cap - expenses
  // Đơn giản hoá: income cần thêm ≈ remNeeded / (1 - savingsRatio - expensesRatio)
  const incomePipes = pipes.filter(p => {
    const n = nodes.find(x => x.id === p.toId)
    return p.fromId === 'income' && n?.type !== 'remainder'
  })
  const deductRatio = incomePipes.reduce((s, p) => s + (p.ratio || 0), 0) / 100
  const incomeNeeded = deductRatio < 1
    ? remNeeded / (1 - deductRatio)
    : remNeeded

  result.incomeNeeded = incomeNeeded
  return result
}

// ── Carry-over logic (chạy đầu tháng) ────────────────────────
export function processCarryOver(nodes, currentMonth) {
  const newNodes = []
  const toAdd = []

  nodes.forEach(node => {
    if (node.type !== 'expense') {
      newNodes.push(node)
      return
    }

    if (!node.repeat || node.repeat === 'none') {
      newNodes.push(node)
      return
    }

    // Kiểm tra repeatUntil
    if (node.repeatUntil && currentMonth > node.repeatUntil) {
      newNodes.push(node)
      return
    }

    // Chỉ xử lý chai tháng hiện tại (monthRef = null)
    if (node.monthRef !== null) {
      newNodes.push(node)
      return
    }

    if ((node.currentAmount || 0) >= node.limitAmount) {
      // Đã đầy → đóng nắp, tạo chai mới reset
      newNodes.push({ ...node, status: 'closed' })
      toAdd.push({
        ...node,
        id:              uid(),
        currentAmount:   0,
        monthRef:        null,
        status:          'active',
        parentExpenseId: node.id,
        // Giữ nguyên sortOrder → vị trí trong dây chuyền không đổi
        sortOrder:       node.sortOrder,
      })
    } else {
      // Chưa đầy → giữ chai cũ thành carryover
      // Chai mới nằm ngay dưới (sortOrder + 0.1)
      newNodes.push({
        ...node,
        monthRef: getPrevMonth(currentMonth),
        status:   'carryover',
      })
      toAdd.push({
        ...node,
        id:              uid(),
        currentAmount:   0,
        monthRef:        null,
        status:          'active',
        parentExpenseId: node.id,
        sortOrder:       node.sortOrder + 0.1,
      })
    }
  })

  return [...newNodes, ...toAdd]
}

function getPrevMonth(currentMonth) {
  const [y, m] = currentMonth.split('-').map(Number)
  if (m === 1) return `${y-1}-12`
  return `${y}-${String(m-1).padStart(2,'0')}`
}