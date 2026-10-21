import { useCallback, useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'
import { BarChart, CHART } from '../AnalyticsCharts'
import type { CompanyCtx } from './CompanyLayout'
import AdsTabs from './AdsTabs'
import { HISTORY_LABELS, PLACEMENTS, adError, ctr, displayStatus, fmtDate, fmtDateTime, money, placementLabel } from './adShared'
import type { AdRow } from './adShared'

const COLORS = {
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-dark)',
  greenSoft: 'var(--fx-tint-green)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
  red: 'var(--fx-red-text)',
}

type Stats = { impressions: number; clicks: number; reach: number; series: { day: string; impressions: number; clicks: number }[] }
type Full = AdRow & { audience_roles: string[]; locations: string[]; listing_id: string | null; paid_at: string | null }
type Hist = { action: string; note: string | null; created_at: string }

// Route: /company/ads/:id  (status, preview, payment and performance of one ad)
export default function CompanyAdDetailPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [ad, setAd] = useState<Full | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<Hist[]>([])
  const [listing, setListing] = useState<AdData['listing']>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(
    params.get('submitted') === '1' ? { kind: 'ok', text: 'Your ad was submitted. Farmxie will review it, and you will be able to pay once it is approved.' } : null,
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data } = await supabase.from('ad_campaigns').select('*').eq('id', id).eq('company_id', company.id).maybeSingle()
    const row = data as Full | null
    setAd(row)
    if (row) {
      if (row.paid_at) {
        const { data: s } = await supabase.rpc('ad_stats', { p_ad: row.id })
        setStats(s as Stats)
      } else setStats(null)
      const { data: h } = await supabase.rpc('ad_history_list', { p_ad: row.id })
      setHistory((h || []) as Hist[])
      if (row.listing_id) {
        const { data: l } = await supabase.from('marketplace_listings').select('id, title, price, currency, unit, images, location, contact_for_price').eq('id', row.listing_id).maybeSingle()
        setListing((l as any) || null)
      }
    }
    setLoading(false)
  }, [id, company.id])

  useEffect(() => { load() }, [load])

  const pay = async () => {
    if (!ad || busy) return
    setBusy(true)
    setMessage(null)
    const { data, error } = await supabase.functions.invoke('ads-checkout', { body: { ad_id: ad.id } })
    if (error || !data?.authorization_url) {
      setBusy(false)
      return setMessage({ kind: 'error', text: data?.error || 'Could not start the payment. Please try again.' })
    }
    window.location.href = data.authorization_url
  }

  const cancel = async () => {
    if (!ad || busy || !window.confirm('Cancel this ad?')) return
    setBusy(true)
    const { error } = await supabase.rpc('ad_cancel', { p_ad: ad.id })
    setBusy(false)
    if (error) return setMessage({ kind: 'error', text: adError(error) })
    await load()
  }

  const act = async (fn: 'ad_pause' | 'ad_resume', confirmText?: string) => {
    if (!ad || busy || (confirmText && !window.confirm(confirmText))) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.rpc(fn, { p_ad: ad.id })
    setBusy(false)
    if (error) return setMessage({ kind: 'error', text: adError(error) })
    await load()
  }

  if (loading) return <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
  if (!ad) {
    return (
      <div style={{ maxWidth: 1000 }}>
        <AdsTabs active="detail" />
        <p style={{ fontSize: '13px', color: COLORS.textMuted, marginTop: 12 }}>This ad was not found.</p>
      </div>
    )
  }

  const st = displayStatus(ad)
  const preview: AdData = {
    id: ad.id, target_type: ad.target_type, headline: ad.headline, body: ad.body, image_url: ad.image_url,
    company: { id: company.id, name: company.name, logo_url: company.logo_url, is_premium: company.is_premium, premium_until: company.premium_until },
    listing,
  }
  const imp = stats?.impressions ?? 0
  const clk = stats?.clicks ?? 0
  const labels = (stats?.series || []).map((s) => new Date(s.day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
  const similarTo = ad.listing_id ? `/company/ads/new?listing=${ad.listing_id}` : '/company/ads/new'
  const finished = ad.status === 'completed' || st.key === 'ended'
  const primary: CSSProperties = { padding: '10px 22px', borderRadius: 10, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }

  return (
    <div style={{ maxWidth: 1000 }}>
      <AdsTabs active="detail" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span onClick={() => navigate('/company/ads/campaigns')} style={{ fontSize: '13px', fontWeight: 700, color: COLORS.green, cursor: 'pointer' }}>‹ Campaigns</span>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: COLORS.text, flex: 1, minWidth: 200 }}>{ad.headline}</h2>
        <span style={{ fontSize: '12px', fontWeight: 800, padding: '6px 14px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
      </div>

      {message && (
        <div style={{ background: message.kind === 'ok' ? COLORS.greenSoft : 'var(--fx-tint-red)', color: message.kind === 'ok' ? COLORS.greenDark : COLORS.red, borderRadius: 12, padding: '12px 16px', fontSize: '13px', fontWeight: 600, marginBottom: 14 }}>{message.text}</div>
      )}

      {ad.status === 'approved' && (
        <Banner tone="blue">
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>Your ad is approved</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 3 }}>Pay {money(ad.amount, ad.currency)} to start it now. It will run for {ad.days} days. If a payment did not go through earlier, you were not charged and you can try again.</p>
          </div>
          <div role="button" onClick={pay} style={primary}>{busy ? 'Please wait…' : `Pay ${money(ad.amount, ad.currency)}`}</div>
        </Banner>
      )}
      {ad.status === 'pending_review' && <Banner tone="amber"><p style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--fx-amber-text)' }}>Farmxie is reviewing your ad. You will be notified when the review is complete, and you pay only after it is approved.</p></Banner>}
      {ad.status === 'rejected' && (
        <Banner tone="red">
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.red }}>This ad was not approved</p>
            {ad.review_note && <p style={{ fontSize: '12.5px', color: COLORS.text, marginTop: 4, lineHeight: 1.5 }}>{ad.review_note}</p>}
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 4 }}>You were not charged. Create a new ad with the changes.</p>
          </div>
          <div role="button" onClick={() => navigate(similarTo)} style={primary}>Create similar ad</div>
        </Banner>
      )}
      {ad.status === 'active' && !finished && (
        <Banner tone="green">
          <p style={{ flex: 1, minWidth: 220, fontSize: '12.5px', fontWeight: 600, color: COLORS.greenDark }}>Your ad is running until {fmtDate(ad.ends_at)}. You can pause it at any time. Paused time is not counted, so the end date moves forward when you resume.</p>
          <div role="button" onClick={() => act('ad_pause', 'Pause this ad? It will stop showing until you resume it.')} style={{ ...primary, background: '#9A3412' }}>Pause</div>
        </Banner>
      )}
      {ad.status === 'paused' && (
        <Banner tone="amber">
          <p style={{ flex: 1, minWidth: 220, fontSize: '12.5px', fontWeight: 600, color: 'var(--fx-amber-text)' }}>This ad is paused and is not being shown. When you resume, the time it was paused is added back to the end date.</p>
          <div role="button" onClick={() => act('ad_resume')} style={primary}>Resume</div>
        </Banner>
      )}
      {finished && (
        <Banner tone="blue">
          <p style={{ flex: 1, minWidth: 220, fontSize: '12.5px', fontWeight: 600, color: COLORS.text }}>This campaign has finished. Run it again with the same details.</p>
          <div role="button" onClick={() => navigate(similarTo)} style={primary}>Create similar ad</div>
        </Banner>
      )}
      {ad.status === 'cancelled' && (
        <Banner tone="red">
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>This ad was cancelled</p>
            {ad.review_note && <p style={{ fontSize: '12.5px', color: COLORS.text, marginTop: 4, lineHeight: 1.5 }}>{ad.review_note}</p>}
          </div>
          <div role="button" onClick={() => navigate(similarTo)} style={primary}>Create similar ad</div>
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 460px', minWidth: 0 }}>
          {stats && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
                <Kpi label="Impressions" value={imp} />
                <Kpi label="Clicks" value={clk} />
                <Kpi label="Click rate" value={ctr(imp, clk)} />
                <Kpi label="People reached" value={stats.reach} />
              </div>
              <Card title="Impressions per day">
                <BarChart series={stats.series.map((s) => s.impressions)} labels={labels} color={CHART.green} height={120} />
              </Card>
              <div style={{ height: 14 }} />
              <Card title="Clicks per day">
                <BarChart series={stats.series.map((s) => s.clicks)} labels={labels} color={CHART.blue} height={120} />
              </Card>
              <div style={{ height: 14 }} />
            </>
          )}

          <Card title="Details">
            <Row label="Campaign ID" value={'AD-' + ad.id.replace(/-/g, '').slice(0, 8).toUpperCase()} />
            <Row label="Promoting" value={ad.target_type === 'listing' ? `Listing${listing ? `: ${listing.title}` : ''}` : 'My company'} />
            <Row label="Placements" value={(ad.placements || []).map((p) => PLACEMENTS.find((x) => x.key === p)?.label ?? placementLabel(p)).join(', ')} />
            <Row label="Audience" value={ad.audience_roles.length ? ad.audience_roles.map((r) => (r === 'agribusiness' ? 'Agribusinesses' : r === 'farmer' ? 'Farmers' : r === 'company' ? 'Agricultural companies' : 'Buyers')).join(', ') : 'Everyone'} />
            <Row label="Location" value={ad.locations.length ? ad.locations.join(', ') : 'Everywhere'} />
            <Row label="Duration" value={`${ad.days} days`} />
            <Row label="Total" value={money(ad.amount, ad.currency)} />
            {ad.starts_at && <Row label="Runs" value={`${fmtDate(ad.starts_at)} to ${fmtDate(ad.ends_at)}`} />}
            <Row label="Created" value={fmtDate(ad.created_at)} />
          </Card>

          <div style={{ height: 14 }} />
          <Card title="History">
            {history.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No activity yet.</p>
            ) : (
              history.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid #F1F5EF' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.green, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{HISTORY_LABELS[h.action] ?? h.action}</p>
                    <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 1 }}>{fmtDateTime(h.created_at)}</p>
                    {h.note && <p style={{ fontSize: '12px', color: COLORS.text, marginTop: 3, lineHeight: 1.4 }}>{h.note}</p>}
                  </div>
                </div>
              ))
            )}
          </Card>

          {(ad.status === 'pending_review' || ad.status === 'approved') && (
            <p onClick={cancel} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.red, cursor: 'pointer', marginTop: 14 }}>Cancel this ad</p>
          )}
        </div>

        <div style={{ flex: '0 0 250px' }}>
          <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>How it looks</p>
          <SponsoredCard ad={preview} layout="grid" preview />
        </div>
      </div>
    </div>
  )
}

function Banner({ tone, children }: { tone: 'blue' | 'amber' | 'red' | 'green'; children: ReactNode }) {
  const map = { blue: ['#EFF6FF', '#BFDBFE'], amber: ['var(--fx-tint-amber)', 'var(--fx-bd-amber)'], red: ['var(--fx-tint-red)', 'var(--fx-bd-red)'], green: ['var(--fx-tint-green3)', 'var(--fx-bd-green)'] }[tone]
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: map[0], border: `1px solid ${map[1]}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>{children}</div>
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.textMuted }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: 4 }}>{value}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderTop: '1px solid #F1F5EF', fontSize: '13px' }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: COLORS.text, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
