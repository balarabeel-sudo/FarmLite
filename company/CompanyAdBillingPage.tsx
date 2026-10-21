import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { CompanyCtx } from './CompanyLayout'
import AdsTabs from './AdsTabs'
import { displayStatus, fmtDateTime, money } from './adShared'
import type { AdStatus } from './adShared'

const COLORS = { card: 'var(--fx-card)', border: 'var(--fx-border)', green: '#16A34A', text: 'var(--fx-text)', textMuted: 'var(--fx-muted)', red: 'var(--fx-red-text)' }

type Row = {
  id: string
  reference: string
  amount: number
  currency: string
  payment_status: 'initiated' | 'success' | 'failed' | 'cancelled'
  created_at: string
  paid_at: string | null
  campaign_id: string
  campaign_ref: string
  headline: string
  campaign_status: AdStatus
}

const PAY: Record<Row['payment_status'], { label: string; bg: string; color: string }> = {
  success: { label: 'Paid', bg: 'var(--fx-tint-green)', color: 'var(--fx-green-dark)' },
  initiated: { label: 'Pending', bg: 'var(--fx-tint-amber)', color: 'var(--fx-amber-text)' },
  failed: { label: 'Failed', bg: 'var(--fx-tint-red)', color: 'var(--fx-red-text)' },
  cancelled: { label: 'Cancelled', bg: 'var(--fx-border3)', color: 'var(--fx-muted3)' },
}

// Route: /company/ads/billing  (every payment attempt for this company's ads)
export default function CompanyAdBillingPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: e } = await supabase.rpc('ads_billing_list', { p_company: company.id })
    if (e) setError(true)
    else setRows((data || []) as Row[])
    setLoading(false)
  }, [company.id])

  useEffect(() => { load() }, [load])

  const paid = rows.filter((r) => r.payment_status === 'success')
  const totals = Object.values(paid.reduce<Record<string, { currency: string; amount: number }>>((acc, r) => {
    acc[r.currency] = { currency: r.currency, amount: (acc[r.currency]?.amount || 0) + Number(r.amount) }
    return acc
  }, {}))

  return (
    <div style={{ maxWidth: 1000 }}>
      <AdsTabs active="billing" />

      {error ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22 }}>
          <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: 10 }}>Could not load your billing history.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>Try again</span>
        </div>
      ) : loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
      ) : rows.length === 0 ? (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22 }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>No payments yet.</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>When you pay for an approved ad, the payment appears here.</p>
        </div>
      ) : (
        <>
          <div style={{ background: COLORS.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 14, display: 'inline-block', minWidth: 200 }}>
            <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>Total paid</p>
            <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: 4 }}>
              {totals.length ? totals.map((t) => money(t.amount, t.currency)).join(' + ') : money(0, 'NGN')}
            </p>
          </div>

          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
            {rows.map((r, i) => {
              const p = PAY[r.payment_status]
              return (
                <div key={r.id} onClick={() => navigate(`/company/ads/${r.campaign_id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid #F1F5EF', cursor: 'pointer', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{r.headline}</p>
                    <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 3 }}>
                      {r.campaign_ref} · {fmtDateTime(r.paid_at || r.created_at)} · Campaign: {displayStatus({ status: r.campaign_status, ends_at: null }).label}
                    </p>
                    <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: 2, wordBreak: 'break-all' }}>Ref {r.reference}</p>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{money(Number(r.amount), r.currency)}</p>
                  <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: p.bg, color: p.color }}>{p.label}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
