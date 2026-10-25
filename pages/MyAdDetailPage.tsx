import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../AuthContext'
import NetworkError from '../NetworkError'
import SponsoredCard from '../SponsoredCard'
import type { AdData } from '../SponsoredCard'
import { BarChart, CHART } from '../AnalyticsCharts'
import { HISTORY_LABELS, adError, ctr, fmtDate, fmtDateTime, money, placementLabel } from '../company/adShared'
import { COLORS, MyAdsHeader, PageShell, Card, Line, Banner, TARGET_LABEL, primaryBtn, statusInfo } from '../MyAdsShared'
import type { UserAdRow } from '../MyAdsShared'

type Stats = { impressions: number; clicks: number; reach: number; series: { day: string; impressions: number; clicks: number }[] }
type Hist = { action: string; note: string | null; created_at: string }

// Route: /my-ads/:id  (status, preview, payment and performance of one of my ads)
export default function MyAdDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const [ad, setAd] = useState<(UserAdRow & { paid_at: string | null }) | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [history, setHistory] = useState<Hist[]>([])
  const [preview, setPreview] = useState<AdData | null>(null)
  const [loading, setLoading] = useState(true)
  const [netError, setNetError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(
    params.get('submitted') === '1' ? { kind: 'ok', text: 'Your ad was submitted. Farmxie will review it, and you can pay once it is approved.' } : null,
  )

  const load = useCallback(async () => {
    if (!id || !user) return
    setNetError(false)
    setLoading(true)
    const { data, error } = await supabase.from('ad_campaigns').select('*').eq('id', id).eq('owner_id', user.id).eq('advertiser_type', 'user').maybeSingle()
    if (error) { setNetError(true); setLoading(false); return }
    const row = data as (UserAdRow & { paid_at: string | null }) | null
    setAd(row)
    if (row) {
      if (row.paid_at) {
        const { data: s } = await supabase.rpc('ad_stats', { p_ad: row.id })
        setStats(s as Stats)
      } else setStats(null)
      const { data: h } = await supabase.rpc('ad_history_list', { p_ad: row.id })
      setHistory((h || []) as Hist[])

      const [{ data: me }, listing, postRow, videoRow] = await Promise.all([
        supabase.from('profiles').select('full_name, username, profile_image, is_premium, premium_until').eq('user_id', user.id).maybeSingle(),
        row.listing_id ? supabase.from('marketplace_listings').select('id, title, price, currency, unit, images, location, contact_for_price').eq('id', row.listing_id).maybeSingle() : Promise.resolve({ data: null }),
        row.post_id ? supabase.from('posts').select('images').eq('id', row.post_id).maybeSingle() : Promise.resolve({ data: null }),
        row.video_id ? supabase.from('short_videos').select('thumbnail_url').eq('id', row.video_id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      const m: any = me
      setPreview({
        id: row.id, target_type: row.target_type, advertiser_type: 'user', post_id: row.post_id, video_id: row.video_id, username: m?.username ?? null,
        headline: row.headline, body: row.body,
        image_url: row.image_url || (postRow.data as any)?.images?.[0] || (videoRow.data as any)?.thumbnail_url || null,
        company: { id: user.id, name: m?.full_name || m?.username || 'You', logo_url: m?.profile_image || null, is_premium: !!m?.is_premium, premium_until: m?.premium_until ?? null },
        listing: (listing.data as any) || null,
      })
    }
    setLoading(false)
  }, [id, user])

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

  if (netError) return <PageShell><MyAdsHeader title="Ad" onBack={() => navigate('/my-ads')} /><div style={{ padding: 16 }}><NetworkError onRetry={load} /></div></PageShell>
  if (loading) return <PageShell><MyAdsHeader title="Ad" onBack={() => navigate('/my-ads')} /><p style={{ padding: 16, fontSize: '12.5px', color: COLORS.textMuted }}>Loading...</p></PageShell>
  if (!ad) return <PageShell><MyAdsHeader title="Ad" onBack={() => navigate('/my-ads')} /><p style={{ padding: 16, fontSize: '12.5px', color: COLORS.textMuted }}>This ad was not found.</p></PageShell>

  const st = statusInfo(ad)
  const finished = ad.status === 'completed' || (ad.status === 'active' && !!ad.ends_at && new Date(ad.ends_at).getTime() <= Date.now())
  const imp = stats?.impressions ?? 0
  const clk = stats?.clicks ?? 0
  const labels = (stats?.series || []).map((s) => new Date(s.day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
  const similar = `/my-ads/new?type=${ad.target_type}${ad.listing_id || ad.post_id || ad.video_id ? `&id=${ad.listing_id || ad.post_id || ad.video_id}` : ''}`
  const text = (t: string, color: string = COLORS.text, w = 600) => <p style={{ margin: 0, fontSize: '12.5px', fontWeight: w, color, flex: 1, minWidth: 180, lineHeight: 1.5 }}>{t}</p>

  return (
    <PageShell>
      <MyAdsHeader title="Ad details" onBack={() => navigate('/my-ads')} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text, margin: 0, flex: 1 }}>{ad.headline}</p>
          <span style={{ fontSize: '11px', fontWeight: 800, padding: '4px 11px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
        </div>

        {message && <Banner tone={message.kind === 'ok' ? 'green' : 'red'}>{text(message.text, message.kind === 'ok' ? COLORS.greenDark : COLORS.red)}</Banner>}

        {ad.status === 'approved' && (
          <Banner tone="blue">
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text, margin: 0 }}>Your ad is approved</p>
              <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: '3px 0 0', lineHeight: 1.5 }}>Pay {money(ad.amount, ad.currency)} to start it now. It will run for {ad.days} days. If a payment did not go through earlier, you were not charged and you can try again.</p>
            </div>
            <div role="button" onClick={pay} style={primaryBtn(busy)}>{busy ? 'Please wait...' : `Pay ${money(ad.amount, ad.currency)}`}</div>
          </Banner>
        )}
        {ad.status === 'pending_review' && <Banner tone="amber">{text('Farmxie is reviewing your ad. You will be notified when the review is complete, and you pay only after it is approved.', 'var(--fx-amber-text)')}</Banner>}
        {ad.status === 'rejected' && (
          <Banner tone="red">
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.red, margin: 0 }}>This ad was not approved</p>
              {ad.review_note && <p style={{ fontSize: '12.5px', color: COLORS.text, margin: '4px 0 0', lineHeight: 1.5 }}>{ad.review_note}</p>}
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '4px 0 0' }}>You were not charged. Create a new ad with the changes.</p>
            </div>
            <div role="button" onClick={() => navigate(similar)} style={primaryBtn()}>Create similar ad</div>
          </Banner>
        )}
        {ad.status === 'active' && !finished && (
          <Banner tone="green">
            {text(`Your ad is running until ${fmtDate(ad.ends_at)}. You can pause it at any time. Paused time is not counted, so the end date moves forward when you resume.`, COLORS.greenDark)}
            <div role="button" onClick={() => act('ad_pause', 'Pause this ad? It will stop showing until you resume it.')} style={{ ...primaryBtn(busy), background: '#9A3412' }}>Pause</div>
          </Banner>
        )}
        {ad.status === 'paused' && (
          <Banner tone="amber">
            {text('This ad is paused and is not being shown. When you resume, the paused time is added back to the end date.', 'var(--fx-amber-text)')}
            <div role="button" onClick={() => act('ad_resume')} style={primaryBtn(busy)}>Resume</div>
          </Banner>
        )}
        {finished && (
          <Banner tone="blue">{text('This campaign has finished. Run it again with the same details.')}<div role="button" onClick={() => navigate(similar)} style={primaryBtn()}>Create similar ad</div></Banner>
        )}
        {ad.status === 'cancelled' && (
          <Banner tone="red">
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text, margin: 0 }}>This ad was cancelled</p>
              {ad.review_note && <p style={{ fontSize: '12.5px', color: COLORS.text, margin: '4px 0 0', lineHeight: 1.5 }}>{ad.review_note}</p>}
            </div>
            <div role="button" onClick={() => navigate(similar)} style={primaryBtn()}>Create similar ad</div>
          </Banner>
        )}

        {stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <Kpi label="Impressions" value={imp} />
              <Kpi label="Clicks" value={clk} />
              <Kpi label="Click rate" value={ctr(imp, clk)} />
              <Kpi label="People reached" value={stats.reach} />
            </div>
            <Card title="Impressions per day"><BarChart series={stats.series.map((s) => s.impressions)} labels={labels} color={CHART.green} height={110} /></Card>
            <Card title="Clicks per day"><BarChart series={stats.series.map((s) => s.clicks)} labels={labels} color={CHART.blue} height={110} /></Card>
          </>
        )}

        {preview && (
          <Card title="How it looks">
            <div style={{ maxWidth: 360 }}><SponsoredCard ad={preview} layout="wide" preview /></div>
          </Card>
        )}

        <Card title="Details">
          <Line label="Ad ID" value={ad.ref || 'AD-' + ad.id.replace(/-/g, '').slice(0, 8).toUpperCase()} />
          <Line label="Promoting" value={TARGET_LABEL[ad.target_type]} />
          <Line label="Appears in" value={(ad.placements || []).map(placementLabel).join(', ')} />
          <Line label="Audience" value={ad.audience_roles.length ? ad.audience_roles.join(', ') : 'Everyone'} />
          <Line label="Location" value={ad.locations.length ? ad.locations.join(', ') : 'Everywhere'} />
          <Line label="Duration" value={`${ad.days} days`} />
          <Line label="Total" value={money(ad.amount, ad.currency)} />
          {ad.starts_at && <Line label="Runs" value={`${fmtDate(ad.starts_at)} to ${fmtDate(ad.ends_at)}`} />}
          <Line label="Created" value={fmtDate(ad.created_at)} />
        </Card>

        <Card title="History">
          {history.length === 0 ? <p style={{ fontSize: '12.5px', color: COLORS.textMuted, margin: 0 }}>No activity yet.</p> : history.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--fx-grey1)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.green, marginTop: 6, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, margin: 0 }}>{HISTORY_LABELS[h.action] ?? h.action}</p>
                <p style={{ fontSize: '11.5px', color: COLORS.textMuted, margin: '1px 0 0' }}>{fmtDateTime(h.created_at)}</p>
                {h.note && <p style={{ fontSize: '12px', color: COLORS.text, margin: '3px 0 0', lineHeight: 1.4 }}>{h.note}</p>}
              </div>
            </div>
          ))}
        </Card>

        {(ad.status === 'pending_review' || ad.status === 'approved') && (
          <p onClick={cancel} style={{ fontSize: '12.5px', fontWeight: 700, color: COLORS.red, cursor: 'pointer', margin: '6px 0 0' }}>Cancel this ad</p>
        )}
      </div>
    </PageShell>
  )
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: '14px', padding: '12px 14px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textMuted, margin: 0 }}>{label}</p>
      <p style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, margin: '4px 0 0' }}>{value}</p>
    </div>
  )
}
