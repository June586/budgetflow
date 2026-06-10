import { useState, useEffect } from 'react'

function formatInteger(value) {
  if (value === undefined || value === null || value === '') return ''
  const num = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, ''), 10)
  if (isNaN(num)) return ''
  return num.toLocaleString('vi-VN')
}

function parseInteger(formatted) {
  if (!formatted) return ''
  const cleaned = formatted.replace(/[^0-9]/g, '')
  if (cleaned === '') return ''
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? '' : num
}

export function Input({ 
  value, 
  onChange, 
  type = 'text', 
  placeholder, 
  style, 
  formatNumber, // nếu không truyền, sẽ tự động true khi type === 'number'
  ...props 
}) {
  const [displayValue, setDisplayValue] = useState('')
  const isControlled = value !== undefined
  
  // Quyết định có format hay không
  const shouldFormat = formatNumber !== undefined ? formatNumber : (type === 'number')
  
  // Cập nhật displayValue khi value prop thay đổi
  useEffect(() => {
    if (shouldFormat) {
      const num = isControlled ? value : displayValue
      setDisplayValue(formatInteger(num))
    } else {
      setDisplayValue(isControlled ? value : displayValue)
    }
  }, [value, shouldFormat, isControlled])

  const handleChange = (e) => {
    let raw = e.target.value
    if (shouldFormat) {
      const digits = raw.replace(/[^0-9]/g, '')
      let num = digits === '' ? '' : parseInt(digits, 10)
      if (isNaN(num)) num = ''
      onChange(num)
      setDisplayValue(formatInteger(num))
    } else {
      onChange(raw)
      setDisplayValue(raw)
    }
  }

  const handleBlur = (e) => {
    if (shouldFormat) {
      const currentNum = parseInteger(displayValue)
      onChange(currentNum)
      setDisplayValue(formatInteger(currentNum))
    }
    if (props.onBlur) props.onBlur(e)
  }

  return (
    <input
      type={shouldFormat ? 'text' : type}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        color: '#f1f5f9',
        padding: '11px 14px',
        fontSize: 14,
        outline: 'none',
        transition: 'border-color 0.15s',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = '#3B82F6'}
      onBlurCapture={e => e.target.style.borderColor = '#1e293b'}
      {...props}
    />
  )
}

export function Select({ value, onChange, children, style }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        color: '#f1f5f9',
        padding: '11px 14px',
        fontSize: 14,
        outline: 'none',
        ...style,
      }}
    >
      {children}
    </select>
  )
}

export function Textarea({ value, onChange, placeholder, rows = 3, style }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        color: '#f1f5f9',
        padding: '11px 14px',
        fontSize: 14,
        outline: 'none',
        resize: 'vertical',
        fontFamily: 'inherit',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = '#3B82F6'}
      onBlur={e => e.target.style.borderColor = '#1e293b'}
    />
  )
}