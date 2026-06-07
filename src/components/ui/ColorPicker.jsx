import { COLORS } from '../../constants'

export default function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {COLORS.map(c => (
        <div
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: c, cursor: 'pointer', flexShrink: 0,
            border: value === c ? '3px solid #fff' : '2px solid transparent',
            transition: 'transform 0.1s',
            transform: value === c ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}