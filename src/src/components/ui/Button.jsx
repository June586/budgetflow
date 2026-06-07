export default function Button({
  children, onClick,
  variant = 'primary',
  size = 'md',
  full = false,
  disabled = false,
  style,
}) {
  const bg = {
    primary:  'linear-gradient(135deg, #3B82F6, #2563EB)',
    success:  'linear-gradient(135deg, #10B981, #059669)',
    danger:   'linear-gradient(135deg, #EF4444, #DC2626)',
    ghost:    'transparent',
    dark:     '#0f172a',
  }[variant] || 'transparent'

  const border = variant === 'ghost' ? '1px solid #1e293b' : 'none'

  const pad = { sm: '7px 12px', md: '11px 18px', lg: '14px 22px' }[size]
  const fs  = { sm: 12, md: 14, lg: 15 }[size]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        border,
        borderRadius: 12,
        color: '#fff',
        padding: pad,
        fontSize: fs,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: full ? '100%' : 'auto',
        fontFamily: 'inherit',
        transition: 'opacity 0.15s, transform 0.1s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        ...style,
      }}
      onTouchStart={e => { if (!disabled) e.currentTarget.style.opacity = '0.8' }}
      onTouchEnd={e => { e.currentTarget.style.opacity = '1' }}
    >
      {children}
    </button>
  )
}