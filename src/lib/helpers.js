
export const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export const fmt = (n) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(n || 0))

export const fmtShort = (n) => {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace('.0','') + 'tr'
  if (n >= 1_000)     return (n/1_000).toFixed(0) + 'k'
  return String(Math.round(n))
}

export const getCurrentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

export const getPrevMonth = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

export const formatMonthLabel = (ym) => {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `T${parseInt(m)}/${y}`
}

export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000*60*60*24))
}

export const daysLeftInMonth = () => {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth()+1, 0)
  return Math.ceil((end - now) / (1000*60*60*24))
}