import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import { useStaff } from './AdminStaffContext'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  bg: '#F8FAF6',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
}

type Props = {
  audience: 'user' | 'company'
  // profiles.user_id for a user, companies.id for a company
  targetId: string
  targetName: string
  isPremium: boolean
  premiumUntil?: string | null
  // refresh the page's data after a change
  onDone?: () => void
  label?: string
}

const MONTH_OPTIONS = [1, 3, 6, 12]

function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

// Drop this next to a user or a company in the admin pages. It only shows for staff who have the
// users.manage_premium / companies.manage_premium permission; the database checks it again.
export default function PremiumGrantButton({ audience, targetId, targetName, isPremium, premiumUntil, onDone, label }: Props) {
  const { permissions } = useStaff() as { permissions: Set<string> }
  const perm = audience === 'company' ? 'companies.manage_premium' : 'users.manage_premium'

  const [open, setOpen] = useState(false)
  const [months, setMonths] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!permissions?.has(perm)) return null

  const close = () => {
    if (busy) return
    setOpen(false)
    setError(null)
    setNote('')
    setConfirmRemove(false)
  }

  const grant = async () => {
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.rpc('admin_grant_premium', {
      p_audience: audience,
      p_target: targetId,
      p_months: months,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (e) { setError(e.message); return }
    setOpen(false)
    setNote('')
    onDone?.()
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.rpc('admin_revoke_premium', {
      p_audience: audience,
      p_target: targetId,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (e) { setError(e.message); return }
    setOpen(false)
    setNote('')
    setConfirmRemove(false)
    onDone?.()
  }

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 13px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.greenDark, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
        <Icon name="crown" size={14} color={COLORS.green} />
        {label || (isPremium ? 'Manage Premium' : 'Give Premium')}
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{ position: 'relative', background: COLORS.card, borderRadius: '16px', padding: '22px', width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto' }}>
            <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>
              {isPremium ? 'Manage Premium' : 'Give Premium for free'}
            </p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: '4px 0 16px' }}>
              {audience === 'company' ? 'Company' : 'User'}: <b>{targetName}</b>
              {isPremium && ` · Premium ${premiumUntil ? `until ${fmt(premiumUntil)}` : 'is active'}`}
            </p>

            {error && <div style={{ background: '#FEF2F2', color: COLORS.red, borderRadius: '10px', padding: '9px 11px', fontSize: '12.5px', marginBottom: '12px' }}>{error}</div>}

            <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
              {isPremium ? 'Add more time' : 'Duration'}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {MONTH_OPTIONS.map((m) => {
                const sel = m === months
                return (
                  <div
                    key={m}
                    onClick={() => setMonths(m)}
                    style={{ padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, border: `2px solid ${sel ? COLORS.green : COLORS.border}`, background: sel ? COLORS.greenSoft : COLORS.card, color: sel ? COLORS.greenDark : COLORS.text }}>
                    {m === 12 ? '12 Months' : m === 1 ? '1 Month' : `${m} Months`}
                  </div>
                )
              })}
            </div>

            <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Note (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Why is this being given or removed? (saved in the audit log)"
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '10px', fontSize: '12.5px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', marginBottom: '14px' }}
            />

            <div
              onClick={busy ? undefined : grant}
              style={{ textAlign: 'center', padding: '12px', borderRadius: '10px', background: busy ? '#A7D7B4' : COLORS.green, color: 'white', fontWeight: 800, fontSize: '13.5px', cursor: busy ? 'default' : 'pointer' }}>
              {busy ? 'Please wait…' : isPremium ? `Add ${months} ${months === 1 ? 'month' : 'months'}` : `Give ${months} ${months === 1 ? 'month' : 'months'} free`}
            </div>

            {isPremium && (
              confirmRemove ? (
                <div style={{ marginTop: '12px', background: '#FEF2F2', borderRadius: '10px', padding: '12px' }}>
                  <p style={{ fontSize: '12.5px', color: COLORS.red, lineHeight: 1.5 }}>
                    This removes Premium now, even if it was paid for. All data stays. Continue?
                  </p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <div onClick={busy ? undefined : remove} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: COLORS.red, color: 'white', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Yes, remove</div>
                    <div onClick={() => setConfirmRemove(false)} style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', background: COLORS.card, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>No</div>
                  </div>
                </div>
              ) : (
                <div onClick={() => setConfirmRemove(true)} style={{ textAlign: 'center', padding: '11px', marginTop: '10px', borderRadius: '10px', color: COLORS.red, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', border: '1px solid #FECACA' }}>
                  Remove Premium
                </div>
              )
            )}

            <div onClick={close} style={{ textAlign: 'center', padding: '11px', marginTop: '8px', fontSize: '12.5px', fontWeight: 700, color: COLORS.textMuted, cursor: 'pointer' }}>Close</div>
          </div>
        </div>
      )}
    </>
  )
}
