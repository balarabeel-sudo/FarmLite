import type { CSSProperties } from 'react'

export const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  orange: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

export const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`,
  marginBottom: '10px', fontSize: '13px', boxSizing: 'border-box', background: COLORS.bg,
}

export const labelStyle: CSSProperties = { fontSize: '12px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }

export function ErrorBanner({ text }: { text: string }) {
  if (!text) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 12px', marginBottom: '10px' }}>
      <p style={{ fontSize: '11.5px', color: COLORS.red }}>{text}</p>
    </div>
  )
}
