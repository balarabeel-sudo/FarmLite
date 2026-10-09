import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import { COLORS } from '../shared'

type Invitation = {
  found: boolean
  status?: 'invited' | 'active' | 'disabled'
  role_name?: string | null
  full_name?: string | null
  inviter_name?: string | null
  email_confirmed?: boolean
}

export default function StaffInvitePage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [invite, setInvite] = useState<Invitation | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)

  // Read the current session directly so this page works whether or not the person is signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadInvite = async () => {
    setLoadError(false)
    const { data, error: e } = await supabase.rpc('my_staff_invitation')
    if (e) { setLoadError(true); return }
    setInvite(data as Invitation)
  }

  useEffect(() => {
    if (session) loadInvite()
    else setInvite(null)
  }, [session?.user?.id])

  const accept = async () => {
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('accept_staff_invitation')
    setBusy(false)
    if (e) { setError(e.message); return }
    setAccepted(true)
  }

  const switchAccount = async () => {
    await supabase.auth.signOut()
    setInvite(null)
  }

  const email = session?.user?.email || ''

  let body: ReactNode
  if (checking || (session && !invite && !loadError)) {
    body = <p style={{ fontSize: '13px', color: COLORS.textMuted, textAlign: 'center' }}>Checking your invitation...</p>
  } else if (!session) {
    body = (
      <>
        <p style={{ fontSize: '13px', color: COLORS.text, lineHeight: 1.6, textAlign: 'center' }}>
          You have been invited to join the Farmxie team. Sign in with the email the invitation was sent to. If you do not have an account yet, create one with that same email and confirm it.
        </p>
        <Button label="Sign in" onClick={() => navigate('/login')} />
        <Button label="Create account" onClick={() => navigate('/register')} secondary />
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '14px', lineHeight: 1.5 }}>
          After you sign in, open the invitation link again (or tap the notification in the app) and accept.
        </p>
      </>
    )
  } else if (loadError) {
    body = (
      <>
        <p style={{ fontSize: '13px', color: '#B91C1C', textAlign: 'center' }}>Could not check your invitation. Check your connection.</p>
        <Button label="Try again" onClick={loadInvite} />
      </>
    )
  } else if (accepted || invite?.status === 'active') {
    body = (
      <>
        <div style={{ textAlign: 'center' }}>
          <Icon name="checkCircle" size={42} color={COLORS.green} />
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, marginTop: '10px' }}>
            {accepted ? 'Invitation accepted' : 'You are already part of the team'}
          </p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: '6px' }}>Your staff access is active.</p>
        </div>
        <Button label="Open admin dashboard" onClick={() => navigate('/admin', { replace: true })} />
      </>
    )
  } else if (invite?.found && invite.status === 'invited') {
    body = (
      <>
        <p style={{ fontSize: '13px', color: COLORS.text, textAlign: 'center', lineHeight: 1.6 }}>
          {invite.inviter_name ? `${invite.inviter_name} invited you` : 'You have been invited'} to join Farmxie as
        </p>
        <p style={{ fontSize: '18px', fontWeight: 800, color: COLORS.green, textAlign: 'center', margin: '6px 0 4px' }}>{invite.role_name || 'Staff'}</p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, textAlign: 'center' }}>Signed in as {email}</p>

        {invite.email_confirmed === false ? (
          <p style={{ fontSize: '12.5px', color: '#B45309', textAlign: 'center', marginTop: '14px', lineHeight: 1.5 }}>
            Confirm your email address first (check your inbox), then come back to this page.
          </p>
        ) : (
          <>
            {error && <p style={{ fontSize: '12px', color: '#DC2626', textAlign: 'center', marginTop: '10px' }}>{error}</p>}
            <Button label={busy ? 'Accepting...' : 'Accept invitation'} onClick={accept} disabled={busy} />
          </>
        )}
      </>
    )
  } else {
    body = (
      <>
        <p style={{ fontSize: '13px', color: COLORS.text, textAlign: 'center', lineHeight: 1.6 }}>
          There is no pending invitation for <b>{email}</b>.
        </p>
        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, textAlign: 'center', marginTop: '6px', lineHeight: 1.5 }}>
          Make sure you are signed in with the same email the invitation was sent to.
        </p>
        <Button label="Sign in with a different account" onClick={switchAccount} secondary />
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: COLORS.card, width: '100%', maxWidth: '400px', borderRadius: '20px', padding: '28px 22px', boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '27px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Icon name="leaf" size={26} color={COLORS.green} />
        </div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, textAlign: 'center', marginBottom: '14px' }}>Farmxie team invitation</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{body}</div>
      </div>
    </div>
  )
}

function Button({ label, onClick, secondary, disabled }: { label: string; onClick: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      textAlign: 'center', padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: 800, marginTop: '8px',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1,
      background: secondary ? COLORS.card : COLORS.green, color: secondary ? COLORS.green : 'white',
      border: `1px solid ${COLORS.green}`,
    }}>
      {label}
    </div>
  )
}
