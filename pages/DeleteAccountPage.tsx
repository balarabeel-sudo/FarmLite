import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import NetworkError from '../NetworkError'
import Icon from '../Icons'
import { COLORS } from '../shared'

type State = { pending: boolean; requested_at?: string; scheduled_for?: string; blockers: string[] }

const BLOCKER_TEXT: Record<string, string> = {
  wallet_balance: 'Your wallet still has money in it. Withdraw or spend it first.',
  open_orders: 'You have an open order (money held in escrow). Finish or cancel it first.',
  active_ads: 'You have a running or paused ad. Cancel or finish it first.',
  owns_company: 'You own a company profile. Contact Help & Support to close it before deleting your account.',
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '')

// Route: /delete-account
export default function DeleteAccountPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setNetError(false)
    setLoading(true)
    const { data, error: e } = await supabase.rpc('my_account_deletion')
    if (e) setNetError(true)
    else setState(data as State)
    setLoading(false)
  }, [])

  useEffect(() => { if (user) load() }, [user?.id, load])

  const request = async () => {
    if (busy || typed.trim().toUpperCase() !== 'DELETE') return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('request_account_deletion', { p_reason: reason.trim() || null })
    setBusy(false)
    if (e) {
      if (e.message?.includes('deletion_blocked')) { setError('Some things must be settled first. See the list above.'); load() }
      else setError('Could not send your request. Please try again.')
      return
    }
    setTyped('')
    load()
  }

  const cancel = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    const { error: e } = await supabase.rpc('cancel_account_deletion')
    setBusy(false)
    if (e) { setError('Could not cancel the request. Please try again.'); return }
    load()
  }

  const blockers = state?.blockers || []
  const canSend = !busy && typed.trim().toUpperCase() === 'DELETE' && blockers.length === 0

  const box = { background: COLORS.card, borderRadius: '14px', padding: '16px', marginBottom: '12px', border: `1px solid ${COLORS.border}` } as const

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div onClick={() => navigate(-1)} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="arrowLeft" size={22} color={COLORS.text} /></div>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, margin: 0 }}>Delete account</p>
      </div>

      <div style={{ padding: '16px' }}>
        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading || !state ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p>
        ) : state.pending ? (
          <>
            <div style={{ ...box, borderColor: 'var(--fx-bd-amber)', background: 'var(--fx-tint-amber)' }}>
              <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--fx-amber-text)', margin: 0 }}>Your account is scheduled for deletion</p>
              <p style={{ fontSize: '12.5px', color: 'var(--fx-amber-text)', lineHeight: 1.6, margin: '6px 0 0' }}>
                Requested on {fmtDate(state.requested_at)}. Your account will be deleted on or after <strong>{fmtDate(state.scheduled_for)}</strong>. Until then you can keep using Farmxie and change your mind at any time.
              </p>
            </div>
            {blockers.length > 0 && (
              <div style={box}>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.red, margin: '0 0 6px' }}>Needs your attention before deletion</p>
                {blockers.map((b) => <p key={b} style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.55, margin: '4px 0 0' }}>{BLOCKER_TEXT[b] || b}</p>)}
              </div>
            )}
            <div onClick={cancel} role="button" style={{ padding: '13px', borderRadius: '12px', background: COLORS.green, color: 'white', textAlign: 'center', fontWeight: 800, fontSize: '14px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Please wait...' : 'Keep my account (cancel deletion)'}
            </div>
            <div onClick={async () => { await signOut(); navigate('/login', { replace: true }) }} style={{ textAlign: 'center', marginTop: 14, fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Log out</div>
          </>
        ) : (
          <>
            <div style={box}>
              <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, margin: 0 }}>Before you go</p>
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12.5px', color: COLORS.text, lineHeight: 1.65 }}>
                <li>Your profile, posts, videos, listings and messages will be removed when the account is deleted.</li>
                <li>Some records, such as payments and orders, may be kept where the law or security requires it.</li>
                <li>Deletion happens after <strong>30 days</strong>. During that time you can cancel and keep your account.</li>
                <li>This cannot be undone after the 30 days.</li>
              </ul>
            </div>

            {blockers.length > 0 && (
              <div style={{ ...box, borderColor: 'var(--fx-bd-red)', background: 'var(--fx-tint-red)' }}>
                <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.red, margin: '0 0 6px' }}>You cannot request deletion yet</p>
                {blockers.map((b) => <p key={b} style={{ fontSize: '12.5px', color: COLORS.text, lineHeight: 1.55, margin: '4px 0 0' }}>{BLOCKER_TEXT[b] || b}</p>)}
              </div>
            )}

            <div style={box}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: '0 0 6px' }}>Why are you leaving? (optional)</p>
              <textarea value={reason} maxLength={500} rows={3} onChange={(e) => setReason(e.target.value)} disabled={blockers.length > 0}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }} />
              <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: '12px 0 6px' }}>Type DELETE to confirm</p>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={blockers.length > 0} autoCapitalize="characters" autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: '14px', fontFamily: 'inherit' }} />
            </div>

            {error && <p style={{ fontSize: '12.5px', color: COLORS.red, margin: '0 0 10px' }}>{error}</p>}
            <div onClick={canSend ? request : undefined} role="button" style={{ padding: '13px', borderRadius: '12px', background: COLORS.red, color: 'white', textAlign: 'center', fontWeight: 800, fontSize: '14px', cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.45 }}>
              {busy ? 'Please wait...' : 'Request account deletion'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
