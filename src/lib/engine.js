import { uid, getCurrentMonth } from './helpers'

const ROUND_UNIT = 5000

function roundToUnit(value) {
  return Math.round(value / ROUND_UNIT) * ROUND_UNIT
}

function distributeRounded(amount, targets) {
  if (!targets.length) return {}
  const raw = distributeParallel(amount, targets)
  const ids = targets.map(t => t.id)
  const rounded = {}
  let runningTotal = 0
  for (let i = 0; i < ids.length - 1; i++) {
    const r = roundToUnit(raw[ids[i]])
    rounded[ids[i]] = r
    runningTotal += r
  }
  const lastId = ids[ids.length - 1]
  rounded[lastId] = Math.max(0, amount - runningTotal)
  return rounded
}

export function distributeParallel(amount, targets) {
  const result = {}
  targets.forEach(t => { result[t.id] = 0 })
  let remaining = amount
  let active = targets.map(t => ({
    ...t,
    space: t.limit === null ? Infinity : t.limit - t.current
  })).filter(t => t.space > 0.01)
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
  return result
}

export function distributeToGroup(amount, group, ratioOverride) {
  if (!group.children?.length) return {}
  const targets = group.children.map(jar => ({
    id: jar.id,
    ratio: ratioOverride ? (ratioOverride[jar.id] || 0) : jar.ratio,
    limit: jar.limitAmount,
    current: jar.currentAmount || 0,
  }))
  return distributeRounded(amount, targets)
}

function buildBackbone(nodes, pipes) {
  const income = nodes.find(n => n.type === 'income')
  const remainder = nodes.find(n => n.type === 'remainder')
  if (!income || !remainder) return []

  // Flat map gồm cả jar con trong group
  const allNodes = []
  nodes.forEach(n => {
    allNodes.push(n)
    if (n.children) n.children.forEach(c => allNodes.push(c))
  })

  const remOutTargets = new Set(pipes.filter(p => p.fromId === remainder.id).map(p => p.toId))
  const chain = []
  let cur = income
  const visited = new Set()
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id)
    if (cur.id !== income.id && cur.id !== remainder.id) chain.push(cur)
    if (cur.id === remainder.id) break

    const outPipes = pipes.filter(p => p.fromId === cur.id && allNodes.find(n => n.id === p.toId))
    let chosen = outPipes.find(p => p.toId === remainder.id)
    if (!chosen) chosen = outPipes.find(p => !remOutTargets.has(p.toId))
    if (!chosen) chosen = outPipes.find(p => !visited.has(p.toId))
    if (!chosen) break
    const next = allNodes.find(n => n.id === chosen.toId)
    if (!next) break
    cur = next
  }
  return chain
}

export function runFlowEngine(inputAmount, nodes, pipes, monthlyReceived = {}) {
  // added: tổng cộng dồn dùng để tính space, KHÔNG dùng để hiển thị UI
  const added = {}
  // steps: mảng theo thứ tự flow, mỗi step là một lần tiền đổ vào node
  // step = { nodeId, originalId, name, color, type, parentName, amount, phase: 'backbone'|'remainder' }
  const steps = []

  const setAdded = (id, v) => { added[id] = (added[id] || 0) + v }
  const pushStep = (node, amount, phase, parentName) => {
    if (amount < 1) return
    steps.push({
      nodeId: node.id,
      originalId: node.originalId || node.id,
      name: node.name,
      color: node.color,
      type: node.type,
      parentName: parentName || null,
      amount,
      phase,
    })
  }

  let pool = inputAmount
  const income = nodes.find(n => n.type === 'income')
  const remainder = nodes.find(n => n.type === 'remainder')
  if (!income || !remainder) return { added, steps }

  const backboneNodes = buildBackbone(nodes, pipes)
  const nodeMap = {}
  nodes.forEach(n => {
    nodeMap[n.id] = n
    if (n.children) n.children.forEach(c => { nodeMap[c.id] = c })
  })

  // Helper: lấy node thực tế (resolve clone → original) để đọc currentAmount
  function resolveNode(node) {
    if (node.originalId) {
      return nodeMap[node.originalId] || node
    }
    return node
  }

  let prevNode = income
  for (const currentNode of backboneNodes) {
    if (pool <= 0.01) break
    const pipe = pipes.find(p => p.fromId === prevNode.id && p.toId === currentNode.id)
    if (!pipe) continue

    if (currentNode.type === 'group') {
      // Với clone node: đọc currentAmount từ node gốc để tính space đúng
      const realNode = resolveNode(currentNode)
      const realChildren = realNode.children || currentNode.children || []

      let savAmt
      if (pipe.ratio > 0) {
        savAmt = pool * (pipe.ratio / 100)
      } else if (pipe.monthlyCapAmount) {
        // ratio=0 nhưng có cap tháng → nhận tối đa cap
        savAmt = pool
      } else {
        // ratio=0, không cap → nhận tối đa đến limit của group (fill behavior)
        // Nếu group không có limit → bỏ qua (tránh hút hết pool)
        if (!realNode.limitAmount) {
          prevNode = currentNode
          continue
        }
        savAmt = pool
      }

      if (pipe.monthlyCapAmount) {
        const received = monthlyReceived[currentNode.id] || 0
        const cap = pipe.monthlyCapAmount - received
        savAmt = Math.min(savAmt, Math.max(0, cap))
      }
      if (realNode.limitAmount !== null && realNode.limitAmount !== undefined) {
        const grpCurrent = realChildren.reduce((s, c) => s + (c.currentAmount || 0) + (added[c.id] || 0), 0)
        const grpSpace = realNode.limitAmount - grpCurrent
        savAmt = Math.min(savAmt, Math.max(0, grpSpace))
      }
      savAmt = Math.min(savAmt, pool)
      if (savAmt > 0.01) {
        // Truyền children với currentAmount đã cộng added để distributeToGroup tính space đúng
        const childrenWithAdded = realChildren.map(c => ({ ...c, currentAmount: (c.currentAmount || 0) + (added[c.id] || 0) }))
        const dist = distributeToGroup(savAmt, { ...realNode, children: childrenWithAdded }, pipe.childRatioOverride)
        let actualTotal = 0
        Object.entries(dist).forEach(([id, v]) => {
          const jarNode = nodeMap[id] || realChildren.find(c => c.id === id)
          setAdded(id, v)
          if (jarNode) pushStep(jarNode, v, 'backbone', realNode.name)
          actualTotal += v
        })
        pool -= actualTotal
      }
    } else if (currentNode.type === 'expense' || currentNode.type === 'jar') {
      const realNode = resolveNode(currentNode)
      const writeId = realNode.id
      const alreadyAdded = added[writeId] || 0
      let space = (realNode.limitAmount || 0) - (realNode.currentAmount || 0) - alreadyAdded
      if (!realNode.limitAmount || space <= 0.01) {
        prevNode = currentNode
        continue
      }
      // Giới hạn theo monthlyCapAmount — per-pipe, tính theo currentNode.id (clone id giữ riêng)
      if (pipe.monthlyCapAmount) {
        const received = monthlyReceived[currentNode.id] || 0
        const capSpace = pipe.monthlyCapAmount - received
        space = Math.min(space, Math.max(0, capSpace))
      }
      if (space <= 0.01) { prevNode = currentNode; continue }
      const give = Math.min(pool, space)
      if (give > 0.01) {
        setAdded(writeId, give)
        // Nếu là clone, ghi thêm theo currentNode.id để monthlyReceived tracking đúng per-pipe
        if (currentNode.id !== writeId) setAdded(currentNode.id, give)
        pushStep(realNode, give, 'backbone', null)
        pool -= give
      }
    }
    prevNode = currentNode
  }

  // Xử lý remainder và các con của nó
  if (pool > 0.01) {
    const remPipe = pipes.find(p => p.fromId === prevNode.id && p.toId === remainder.id)
    if (remPipe) {
      const remChildrenPipes = pipes.filter(p => p.fromId === remainder.id).sort((a, b) => a.sortOrder - b.sortOrder)
      if (remChildrenPipes.length === 0) {
        setAdded(remainder.id, pool)
        pushStep(remainder, pool, 'remainder', null)
      } else {
        let remAmount = pool
        let totalAllocated = 0
        const totalRatio = remChildrenPipes.reduce((s, p) => s + (p.ratio || 0), 0)
        for (let i = 0; i < remChildrenPipes.length; i++) {
          const pipe = remChildrenPipes[i]
          const child = nodeMap[pipe.toId]
          if (!child) continue
          // Resolve clone → original để đọc currentAmount đúng
          const realChild = resolveNode(child)
          const realChildChildren = realChild.children || child.children || []
          let share = 0
          if (totalRatio > 0) {
            if (i === remChildrenPipes.length - 1) {
              // Item cuối: lấy phần còn lại sau khi đã phân bổ các item trước
              share = Math.max(0, remAmount - totalAllocated)
            } else {
              share = roundToUnit(remAmount * (pipe.ratio / totalRatio))
            }
          } else {
            // Nếu tất cả ratio = 0 thì không phân bổ, giữ lại ở remainder
            continue
          }
          if (share <= 0) continue
          // Giới hạn — cap per-pipe, tính theo child.id (clone id giữ riêng)
          let limitSpace = Infinity
          if (pipe.monthlyCapAmount != null && pipe.monthlyCapAmount > 0) {
            const received = monthlyReceived[child.id] || 0
            limitSpace = Math.max(0, pipe.monthlyCapAmount - received)
          }
          if (child.type === 'group' && realChild.limitAmount != null) {
            const grpCurrent = realChildChildren.reduce((s, c) => s + (c.currentAmount || 0) + (added[c.id] || 0), 0)
            const grpSpace = realChild.limitAmount - grpCurrent
            limitSpace = Math.min(limitSpace, Math.max(0, grpSpace))
          }
          if ((child.type === 'jar' || child.type === 'expense') && realChild.limitAmount != null) {
            const current = realChild.currentAmount || 0
            const alreadyAdded = added[realChild.id] || 0
            limitSpace = Math.min(limitSpace, Math.max(0, realChild.limitAmount - current - alreadyAdded))
          }
          const give = Math.min(share, limitSpace)
          if (give <= 0) continue
          if (child.type === 'group') {
            const childrenWithAdded = realChildChildren.map(c => ({ ...c, currentAmount: (c.currentAmount || 0) + (added[c.id] || 0) }))
            const dist = distributeToGroup(give, { ...realChild, children: childrenWithAdded }, pipe.childRatioOverride)
            let actualTotal = 0
            Object.entries(dist).forEach(([id, v]) => {
              const jarNode = nodeMap[id] || realChildChildren.find(c => c.id === id)
              setAdded(id, v)
              if (jarNode) pushStep(jarNode, v, 'remainder', realChild.name)
              actualTotal += v
            })
            totalAllocated += actualTotal
          } else {
            setAdded(realChild.id, give)
            // Nếu child là clone, ghi thêm theo child.id để monthlyReceived tracking đúng per-pipe
            if (child.id !== realChild.id) setAdded(child.id, give)
            pushStep(realChild, give, 'remainder', null)
            totalAllocated += give
          }
        }
        const remLeft = Math.max(0, remAmount - totalAllocated)
        if (remLeft > 0.01) { setAdded(remainder.id, remLeft); pushStep(remainder, remLeft, 'remainder', null) }
      }
    } else {
      setAdded(remainder.id, pool)
      pushStep(remainder, pool, 'remainder', null)
    }
  }

  return { added, steps }
}

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
  const byAcc = {}
  Object.entries(added).forEach(([nodeId, amount]) => {
    if (amount < 1) return
    const node = nodeMap[nodeId]
    if (!node?.accountId) return
    const accId = node.accountId
    if (!byAcc[accId]) byAcc[accId] = { accountId: accId, totalAmount: 0, jars: [], done: false }
    byAcc[accId].totalAmount += amount
    byAcc[accId].jars.push({
      nodeId, name: node.name, parentName: node.parentName || null,
      color: node.color, amount,
    })
  })
  return Object.values(byAcc).filter(g => g.totalAmount >= 1)
}

export function calcBackward(jar, parentGroup, nodes, pipes) {
  const needed = (jar.limitAmount || 0) - (jar.currentAmount || 0)
  if (needed <= 0) return null
  const result = { jarNeeded: needed }
  if (!parentGroup) {
    result.incomeNeeded = needed
    return result
  }
  const jarRatio = (jar.ratio || 0) / 100
  if (jarRatio <= 0) return result
  const groupNeeded = needed / jarRatio
  result.groupNeeded = groupNeeded
  const remNode = nodes.find(n => n.type === 'remainder')
  if (!remNode) return result
  const remToGroupPipe = pipes.find(p => p.fromId === remNode.id && p.toId === parentGroup.id)
  if (!remToGroupPipe || !remToGroupPipe.ratio) return result
  const remRatio = remToGroupPipe.ratio / 100
  const remNeeded = groupNeeded / remRatio
  result.remNeeded = remNeeded
  const incomePipes = pipes.filter(p => {
    const n = nodes.find(x => x.id === p.toId)
    return p.fromId === 'income' && n?.type !== 'remainder'
  })
  const deductRatio = incomePipes.reduce((s, p) => s + (p.ratio || 0), 0) / 100
  const incomeNeeded = deductRatio < 1 ? remNeeded / (1 - deductRatio) : remNeeded
  result.incomeNeeded = incomeNeeded
  return result
}

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
    if (node.repeatUntil && currentMonth > node.repeatUntil) {
      newNodes.push(node)
      return
    }
    if (node.monthRef !== null) {
      newNodes.push(node)
      return
    }
    if ((node.currentAmount || 0) >= node.limitAmount) {
      newNodes.push({ ...node, status: 'closed' })
      toAdd.push({
        ...node, id: uid(), currentAmount: 0, monthRef: null,
        status: 'active', parentExpenseId: node.id, sortOrder: node.sortOrder,
      })
    } else {
      newNodes.push({ ...node, monthRef: getPrevMonth(currentMonth), status: 'carryover' })
      toAdd.push({
        ...node, id: uid(), currentAmount: 0, monthRef: null,
        status: 'active', parentExpenseId: node.id, sortOrder: node.sortOrder + 0.1,
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