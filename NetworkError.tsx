import Icon from './Icons'

const COLORS = {
  card: 'var(--fx-card)',
  green: '#16A34A',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  red: '#DC2626',
}

type NetworkErrorProps = {
  onRetry: () => void
  title?: string
  message?: string
}

export default function NetworkError({
  onRetry,
  title = 'Unable to load this page.',
  message = 'Check your connection and try again.',
}: NetworkErrorProps) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '16px', background: 'var(--fx-tint-red2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
      }}>
        <Icon name="alertTriangle" size={26} color={COLORS.red} />
      </div>
      <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>{title}</p>
      <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginBottom: '20px' }}>{message}</p>
      <div
        onClick={onRetry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px', background: COLORS.green, color: 'white',
          fontWeight: 700, fontSize: '13px', padding: '10px 22px', borderRadius: '10px', cursor: 'pointer',
        }}>
        <Icon name="refresh" size={16} color="white" />
        Try Again
      </div>
    </div>
  )
}
