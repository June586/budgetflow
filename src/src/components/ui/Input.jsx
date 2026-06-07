export function Input({ value, onChange, type='text', placeholder, style, ...props }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
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
      onBlur={e => e.target.style.borderColor = '#1e293b'}
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

export function Textarea({ value, onChange, placeholder, rows=3, style }) {
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