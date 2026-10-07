import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import type { CompanyCtx } from './CompanyLayout'
import { ctr, displayStatus, fmtDate, money } from './adShared'
import type { AdRow } from './adShared'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#B91C1C',
}

// Route: /company/ads
// FarmLite Ads = paid promotion, open to every verified company (Premium or not).
// Featured Visibility is the separate free Premium placement.
export default function CompanyAdsPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [ads, setAds] = useState<AdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const verified = company.status === 'verified'

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const { data, error: e } = await supabase.rpc('ads_company_list', { p_company: company.id })
    if (e) setError(true)
    else setAds((data || []) as AdRow[])
    setLoading(false)
  }, [company.id])

  useEffect(() => { load() }, [load])

  const running = ads.filter((a) => displayStatus(a).key === 'running').length
  const impressions = ads.reduce((s, a) => s + (a.impressions || 0), 0)
  const clicks = ads.reduce((s, a) => s + (a.clicks || 0), 0)
  const waiting = ads.filter((a) => a.status === 'approved').length

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Business tools</p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: 2 }}>FarmLite Ads</h1>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 3 }}>Promote a listing or your company to the right customers</p>
        </div>
        <div
          onClick={verified ? () => navigate('/company/ads/new') : undefined}
          style={{ padding: '11px 22px', borderRadius: 12, background: verified ? COLORS.green : '#BBD9C3', color: 'white', fontWeight: 800, fontSize: '13px', cursor: verified ? 'pointer' : 'default' }}>
          + Create ad
        </div>
      </div>

      {!verified && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: '12.5px', fontWeight: 600, color: '#92400E' }}>
          Your company must be verified before you can run ads.
        </div>
      )}

      {waiting > 0 && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', marginBottom: 14, fontSize: '12.5px', fontWeight: 700, color: '#1D4ED8' }}>
          {waiting === 1 ? '1 ad is' : `${waiting} ads are`} approved and waiting for payment.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Running now" value={running} />
        <Kpi label="Impressions" value={impressions} />
        <Kpi label="Clicks" value={clicks} />
        <Kpi label="Click rate" value={ctr(impressions, clicks)} />
      </div>

      {error && (
        <Box>
          <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: 10 }}>Could not load your ads.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>Try again</span>
        </Box>
      )}

      {loading ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
      ) : ads.length === 0 && !error ? (
        <Box>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Reach more customers</p>
          <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.6, marginTop: 6, maxWidth: 560 }}>
            Choose a listing or your company, pick who should see it and where, and run it for 3, 7 or 14 days. Every ad is checked by FarmLite before it goes live, and you only pay once it is approved. You will see impressions and clicks as it runs.
          </p>
          {verified && <div onClick={() => navigate('/company/ads/new')} style={{ display: 'inline-block', marginTop: 14, padding: '10px 20px', borderRadius: 10, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>Create your first ad</div>}
        </Box>
      ) : (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
          {ads.map((a, i) => {
            const st = displayStatus(a)
            return (
              <div key={a.id} onClick={() => navigate(`/company/ads/${a.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: i === 0 ? 'none' : `1px solid ${COLORS.bg}`, cursor: 'pointer', flexWrap: 'wrap' }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: COLORS.greenSoft, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.image_url ? <img src={a.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name={a.target_type === 'company' ? 'building' : 'leaf'} size={22} color={COLORS.green} />}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{a.headline}</p>
                  <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 3 }}>
                    {a.target_type === 'listing' ? 'Listing' : 'Company'} · {a.days} days · {money(a.amount, a.currency)}
                    {a.starts_at ? ` · ${fmtDate(a.starts_at)} to ${fmtDate(a.ends_at)}` : ''}
                  </p>
                </div>
                {(a.status === 'active') && (
                  <div style={{ display: 'flex', gap: 18, fontSize: '12px', color: COLORS.textMuted }}>
                    <span><b style={{ color: COLORS.text }}>{a.impressions || 0}</b> views</span>
                    <span><b style={{ color: COLORS.text }}>{a.clicks || 0}</b> clicks</span>
                    <span><b style={{ color: COLORS.text }}>{ctr(a.impressions || 0, a.clicks || 0)}</b> rate</span>
                  </div>
                )}
                <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>{label}</p>
      <p style={{ fontSize: '24px', fontWeight: 800, color: COLORS.text, marginTop: 4 }}>{value}</p>
    </div>
  )
}

function Box({ children }: { children: ReactNode }) {
  return <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22, marginBottom: 14 }}>{children}</div>
}
