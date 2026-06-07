export default function Field({ label, hint, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && (
        <label style={{
          display: 'block',
          color: '#64748b',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      {children}
      {hint && (
        <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  )
}