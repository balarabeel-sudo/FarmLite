import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import type { CompanyCtx } from './CompanyLayout'
import AdsTabs from './AdsTabs'
import AdCampaignList from './AdCampaignList'
import { ctr, money } from './adShared'
import type { AdRow } from './adShared'

const COLORS = {
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  red: 'var(--fx-red-text)',
}

type Summary = {
  impressions: number
  clicks: number
  active: number
  waiting_payment: number
  in_review: number
  spend: { currency: string; amount: number }[]
}

// Route: /company/ads  (Overview)
// Farmxie Ads = paid promotion, open to every verified company (Premium or not).
// Featured Visibility is the separate free Premium placement.
export default function CompanyAdsPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recent, setRecent] = useState<AdRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const verified = company.status === 'verified'

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const [s, l] = await Promise.all([
      supabase.rpc('ads_company_summary', { p_company: company.id }),
      supabase.rpc('ads_company_list', { p_company: company.id }),
    ])
    if (s.error || l.error) setError(true)
    else {
      setSummary(s.data as Summary)
      const all = (l.data || []) as AdRow[]
      setTotal(all.length)
      setRecent(all.slice(0, 5))
    }
    setLoading(false)
  }, [company.id])

  useEffect(() => { load() }, [load])

  const spend = summary?.spend?.length ? summary.spend.map((x) => money(x.amount, x.currency)).join(' + ') : money(0, 'NGN')

  return (
    <div style={{ maxWidth: 1000 }}>
      <AdsTabs active="overview" />

      {!verified && (
        <div style={{ background: 'var(--fx-tint-amber)', border: '1px solid var(--fx-bd-amber)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: '12.5px', fontWeight: 600, color: 'var(--fx-amber-text)' }}>
          Your company must be verified before you can run ads.
        </div>
      )}

      {error && (
        <Box>
          <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: 10 }}>Could not load your ads.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>Try again</span>
        </Box>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
      ) : !error && summary && (
        <>
          {summary.waiting_payment > 0 && (
            <div onClick={() => navigate('/company/ads/campaigns')} style={{ cursor: 'pointer', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: '12.5px', fontWeight: 700, color: 'var(--fx-blue-text2)' }}>
              {summary.waiting_payment === 1 ? '1 ad is' : `${summary.waiting_payment} ads are`} approved and waiting for payment.
            </div>
          )}
          {summary.in_review > 0 && (
            <div style={{ background: 'var(--fx-tint-amber)', border: '1px solid var(--fx-bd-amber)', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: '12.5px', fontWeight: 700, color: 'var(--fx-amber-text)' }}>
              {summary.in_review === 1 ? '1 ad is' : `${summary.in_review} ads are`} being reviewed by Farmxie.
            </div>
          )}

          {total === 0 ? (
            <Box>
              <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>No advertising campaigns yet.</p>
              <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.6, marginTop: 6, maxWidth: 560 }}>
                Choose a listing or your company, pick who should see it and where, and run it for 3, 7 or 14 days. Every ad is checked by Farmxie before it goes live, and you only pay once it is approved. You will see impressions and clicks as it runs.
              </p>
              {verified && (
                <div role="button" onClick={() => navigate('/company/ads/new')} style={{ display: 'inline-block', marginTop: 14, padding: '11px 22px', borderRadius: 10, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                  Create Your First Ad
                </div>
              )}
            </Box>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
                <Kpi label="Active campaigns" value={summary.active} />
                <Kpi label="Impressions" value={summary.impressions.toLocaleString()} />
                <Kpi label="Clicks" value={summary.clicks.toLocaleString()} />
                <Kpi label="Click rate" value={ctr(summary.impressions, summary.clicks)} />
                <Kpi label="Total spend" value={spend} small />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ flex: 1, fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Recent campaigns</p>
                <span onClick={() => navigate('/company/ads/campaigns')} style={{ fontSize: '12.5px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>View all</span>
              </div>
              <AdCampaignList ads={recent} />
              {verified && (
                <div role="button" onClick={() => navigate('/company/ads/new')} style={{ display: 'inline-block', marginTop: 16, padding: '11px 22px', borderRadius: 10, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                  + Create Ad
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>{label}</p>
      <p style={{ fontSize: small ? '18px' : '24px', fontWeight: 800, color: COLORS.text, marginTop: 4, wordBreak: 'break-word' }}>{value}</p>
    </div>
  )
}

function Box({ children }: { children: ReactNode }) {
  return <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22, marginBottom: 14 }}>{children}</div>
}
