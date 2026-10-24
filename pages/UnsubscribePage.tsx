import { useNavigate, useSearchParams } from 'react-router-dom'

// Public page: the unsubscribe link in announcement emails ends here (no sign-in needed).
export default function UnsubscribePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const ok = params.get('s') === 'ok'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fx-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: 'var(--fx-card)', border: '1px solid var(--fx-border)', borderRadius: '16px', padding: '26px 22px', textAlign: 'center' }}>
        <p style={{ fontSize: '20px', fontWeight: 800, color: '#16A34A', marginBottom: '14px' }}>Farmxie</p>
        <p style={{ fontSize: '17px', fontWeight: 800, color: 'var(--fx-text)', marginBottom: '8px' }}>
          {ok ? 'You are unsubscribed' : 'This link is not valid'}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--fx-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
          {ok
            ? 'You will no longer get announcement emails from Farmxie. You will still get in-app alerts and important account security messages. You can turn these emails back on any time in Notification settings.'
            : 'The unsubscribe link is invalid or has expired. Sign in to Farmxie and turn off announcement emails in Notification settings.'}
        </p>
        <button
          onClick={() => navigate('/settings/notifications')}
          style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: '#16A34A', color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>
          Notification settings
        </button>
        <button
          onClick={() => navigate('/')}
          style={{ width: '100%', marginTop: '10px', padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--fx-grey1)', color: 'var(--fx-text)', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>
          Go to Farmxie
        </button>
      </div>
    </div>
  )
}
