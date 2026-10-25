import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import NetworkError from '../NetworkError'
import { ctr, fmtDate, fmtDateTime, money, placementLabel } from '../company/adShared'
import { COLORS, MyAdsHeader, PageShell, Banner, TARGET_LABEL, primaryBtn, statusInfo } from '../MyAdsShared'
import type { UserAdRow } from '../MyAdsShared'

type Summary = {
  impressions: number
  clicks: number
  active: number
  waiting_payment: number
  in_review: number
  spend: { currency: string; amount: number }[]
}
type Bill = { id: string; reference: string; amount: number; currency: string; payment_status: string; created_at: string; paid_at: string | null; campaign_id: string; campaign_ref: string; headline: string }

// Route: /my-ads  (a person's own ads: promote a post, listing, video or profile)
export default function MyAdsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'ads' | 'billing'>('ads')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [ads, setAds] = useState<UserAdRow[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)

  const load = useCallback(async () => {
    setNetError(false)
    setLoading(true)
    const [s, l, b] = await Promise.all([supabase.rpc('ads_user_summary'), supabase.rpc('ads_user_list'), supabase.rpc('ads_user_billing')])
    if (s.error || l.error || b.error) setNetError(true)
    else {
      setSummary(s.data as Summary)
      setAds((l.data || []) as UserAdRow[])
      setBills((b.data || []) as Bill[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const spend = summary?.spend?.length ? summary.spend.map((x) => money(x.amount, x.currency)).join(' + ') : money(0, 'NGN')

  return (
    <PageShell>
      <MyAdsHeader title="My Ads" onBack={() => navigate('/profile')} />
      <div style={{ padding: '16px' }}>
        {netError ? (
          <NetworkError onRetry={load} />
        ) : loading ? (
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p>
        ) : (
          <>
            {summary && summary.waiting_payment > 0 && (
              <Banner tone="blue"><p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--fx-blue-text2)' }}>{summary.waiting_payment === 1 ? '1 ad is' : `${summary.waiting_payment} ads are`} approved and waiting for payment.</p></Banner>
            )}
            {summary && summary.in_review > 0 && (
              <Banner tone="amber"><p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: 'var(--fx-amber-text)' }}>{summary.in_review === 1 ? '1 ad is' : `${summary.in_review} ads are`} being reviewed by Farmxie.</p></Banner>
            )}

            {summary && ads.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <Kpi label="Running now" value={summary.active} />
                <Kpi label="Impressions" value={summary.impressions.toLocaleString()} />
                <Kpi label="Clicks" value={`${summary.clicks.toLocaleString()} (${ctr(summary.impressions, summary.clicks)})`} />
                <Kpi label="Total spend" value={spend} small />
              </div>
            )}

            <div onClick={() => navigate('/my-ads/new')} role="button" style={{ ...primaryBtn(), marginBottom: '14px' }}>+ Create ad</div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {(['ads', 'billing'] as const).map((t) => (
                <div key={t} onClick={() => setTab(t)} style={{
                  flex: 1, textAlign: 'center', padding: '10px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                  background: tab === t ? COLORS.green : COLORS.card, color: tab === t ? 'white' : COLORS.text, border: `1px solid ${tab === t ? COLORS.green : COLORS.border}`,
                }}>{t === 'ads' ? 'My campaigns' : 'Billing history'}</div>
              ))}
            </div>

            {tab === 'ads' ? (
              ads.length === 0 ? (
                <div style={{ background: COLORS.card, borderRadius: '14px', padding: '24px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, margin: 0 }}>No ads yet</p>
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.6, margin: '6px 0 0' }}>
                    Promote a post, a Marketplace listing, a video or your profile. Choose where it appears and for how long. Farmxie checks every ad before it goes live, and you pay only after it is approved.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {ads.map((a) => {
                    const st = statusInfo(a)
                    return (
                      <div key={a.id} onClick={() => navigate(`/my-ads/${a.id}`)} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                          <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, margin: 0, flex: 1 }}>{a.headline}</p>
                          <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                        </div>
                        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '5px 0 0' }}>
                          {TARGET_LABEL[a.target_type]} · {a.days} days · {(a.placements || []).map(placementLabel).join(', ')}
                        </p>
                        <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '4px 0 0' }}>
                          {a.ref} · {money(a.amount, a.currency)}{a.status === 'active' || a.impressions > 0 ? ` · ${a.impressions} views · ${a.clicks} clicks` : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )
            ) : bills.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted, textAlign: 'center', padding: '20px 0' }}>No payments yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bills.map((b) => (
                  <div key={b.id} onClick={() => navigate(`/my-ads/${b.campaign_id}`)} style={{ background: COLORS.card, borderRadius: '14px', padding: '14px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, margin: 0, flex: 1 }}>{b.headline}</p>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, margin: 0 }}>{money(b.amount, b.currency)}</p>
                    </div>
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '5px 0 0' }}>
                      {b.campaign_ref} · {b.payment_status === 'success' ? 'Paid' : b.payment_status === 'initiated' ? 'Not completed' : b.payment_status === 'cancelled' ? 'Cancelled' : 'Failed'} · {fmtDateTime(b.paid_at ?? b.created_at) || fmtDate(b.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  )
}

function Kpi({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '12px 14px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, margin: 0 }}>{label}</p>
      <p style={{ fontSize: small ? '15px' : '19px', fontWeight: 800, color: COLORS.text, margin: '4px 0 0', wordBreak: 'break-word' }}>{value}</p>
    </div>
  )
}
