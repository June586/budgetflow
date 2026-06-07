const KEY = 'budgetflow_v1'

export const loadState = () => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const saveState = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {}
}

export const clearState = () => {
  localStorage.removeItem(KEY)
}