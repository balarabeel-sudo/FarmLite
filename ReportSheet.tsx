import { useEffect, useState } from 'react'
import { reasonsFor, submitReport, typeLabel } from './reportShared'
import type { ReportType } from './reportShared'

type Props = {
  open: boolean
  onClose: () => void
  type: ReportType
  contentId?: string | null
  userId?: string | null
  contentTable?: 'equipment' | null
  // short name of what is being reported, e.g. "Aminu Garba" or the listing title
  targetLabel?: string
}

const G = { green: '#16A34A', text: '#0F1A0F', muted: '#6B7280', border: '#E3E7E3', bg: '#F7F8F7', red: '#B91C1C' }

export default function ReportSheet({ open, onClose, type, contentId, userId, contentTable, targetLabel }: Props) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (open) { setReason(''); setDetails(''); setSending(false); setError(''); setSent(false) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, sending, onClose])

  if (!open) return null

  const needsDetails = reason === 'other'
  const canSend = !!reason && !sending && (!needsDetails || details.trim().length >= 10)

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError('')
    const res = await submitReport({ type, contentId, userId, contentTable, reason, description: details })
    setSending(false)
    if (res.ok) setSent(true)
    else setError(res.message)
  }

  return (
    <div onClick={() => { if (!sending) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-label={`Report ${typeLabel(type).toLowerCase()}`} onClick={(e) => e.stopPropagation()}
        style={{ background: 'white', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: '18px 18px 22px' }}>
        <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: G.border, margin: '0 auto 14px' }} />

        {sent ? (
          <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ECF7EF', color: G.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '10px' }}>✓</div>
            <p style={{ fontSize: '16px', fontWeight: 800, color: G.text, marginBottom: '6px' }}>Report sent</p>
            <p style={{ fontSize: '13px', color: G.muted, lineHeight: 1.5, marginBottom: '16px' }}>
              Thank you. Our team will review it and take action if it breaks Farmxie guidelines.
            </p>
            <button onClick={onClose} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: G.green, color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '16px', fontWeight: 800, color: G.text }}>Report {typeLabel(type).toLowerCase()}</p>
            {targetLabel && <p style={{ fontSize: '12.5px', color: G.muted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{targetLabel}</p>}
            <p style={{ fontSize: '13px', color: G.muted, margin: '10px 0 12px', lineHeight: 1.5 }}>Why are you reporting this? Your report is private.</p>

            <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {reasonsFor(type).map((r) => {
                const on = reason === r.key
                return (
                  <div key={r.key} role="radio" aria-checked={on} tabIndex={0} onClick={() => setReason(r.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReason(r.key) } }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px', borderRadius: '10px', border: `1.5px solid ${on ? G.green : G.border}`, background: on ? '#F3FAF5' : 'white', cursor: 'pointer', fontSize: '14px', color: G.text, fontWeight: on ? 700 : 500 }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${on ? G.green : '#C5CCC6'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {on && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: G.green }} />}
                    </span>
                    {r.label}
                  </div>
                )
              })}
            </div>

            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: G.text, marginBottom: '6px' }}>
              Additional explanation {needsDetails ? '' : '(optional)'}
            </label>
            <textarea
              value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} rows={3}
              placeholder={needsDetails ? 'Tell us what is wrong (at least 10 characters)' : 'Add anything that helps us understand'}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${G.border}`, fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <p style={{ fontSize: '11.5px', color: G.muted, textAlign: 'right', marginTop: '3px' }}>{details.length}/1000</p>

            {error && <p style={{ fontSize: '12.5px', color: G.red, margin: '6px 0 0', lineHeight: 1.4 }}>{error}</p>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button onClick={onClose} disabled={sending} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1px solid ${G.border}`, background: 'white', color: G.text, fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={send} disabled={!canSend} style={{ flex: 1.4, padding: '12px', borderRadius: '12px', border: 'none', background: G.green, color: 'white', fontSize: '14px', fontWeight: 700, cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.5 }}>
                {sending ? 'Sending...' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
