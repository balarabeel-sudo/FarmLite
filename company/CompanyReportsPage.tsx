import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import { BarChart, TrendBadge, CHART, PALETTE } from '../AnalyticsCharts'
import { compact, dayLabels, sumSeries } from '../analyticsShared'
import { formatMoney } from '../premiumShared'
import type { CompanyCtx } from './CompanyLayout'

type M = { series: number[]; total: number; prev: number }
type Report = {
  locked: boolean
  period?: 'week' | 'month'
  days?: number
  offset?: number
  start?: string
  end?: string
  views?: M
  listing_views?: M
  followers?: M
  likes?: M
  comments?: M
  saves?: M
  sales?: M
  revenue?: Record<string, number>
  revenue_prev?: Record<string, number>
  visitors?: { total: number; prev: number }
  posts?: { total: number; prev: number }
  top_listings?: { id: string; title: string; image: string | null; views: number; saves: number }[]
  top_posts?: { id: string; snippet: string; image: string | null; likes_count: number; comments_count: number }[]
  growth?: { start: string; end: string; views: number; followers: number }[]
  totals?: { followers: number; listings: number; posts: number }
}

const EMPTY: M = { series: [], total: 0, prev: 0 }

const sampleSeries = (a: number[]): M => ({ series: a, total: a.reduce((s, x) => s + x, 0), prev: Math.round(a.reduce((s, x) => s + x, 0) * 0.8) })

// Blurred behind the upgrade card for Free companies. Clearly sample data.
const SAMPLE: Report = {
  locked: false, period: 'week', days: 7, offset: 0,
  start: '2026-10-01', end: '2026-10-07',
  views: sampleSeries([32, 41, 38, 52, 61, 47, 55]),
  listing_views: sampleSeries([60, 72, 66, 90, 101, 84, 96]),
  followers: sampleSeries([2, 3, 1, 4, 6, 3, 5]),
  likes: sampleSeries([8, 11, 6, 14, 17, 10, 13]),
  comments: sampleSeries([1, 2, 0, 3, 4, 2, 2]),
  saves: sampleSeries([3, 5, 4, 7, 9, 6, 8]),
  sales: sampleSeries([0, 1, 0, 2, 1, 1, 2]),
  revenue: { NGN: 640000 }, revenue_prev: { NGN: 410000 },
  visitors: { total: 214, prev: 171 },
  posts: { total: 5, prev: 3 },
  top_listings: [
    { id: 'a', title: 'Hybrid maize seed 10kg', image: null, views: 188, saves: 21 },
    { id: 'b', title: 'NPK fertilizer 50kg', image: null, views: 140, saves: 14 },
  ],
  top_posts: [{ id: 'p', snippet: 'New stock of certified seed has arrived…', image: null, likes_count: 34, comments_count: 6 }],
  growth: [
    { start: '2026-08-27', end: '2026-09-02', views: 210, followers: 12 },
    { start: '2026-09-03', end: '2026-09-09', views: 260, followers: 15 },
    { start: '2026-09-10', end: '2026-09-16', views: 310, followers: 19 },
    { start: '2026-09-17', end: '2026-09-23', views: 340, followers: 22 },
    { start: '2026-09-24', end: '2026-09-30', views: 395, followers: 20 },
    { start: '2026-10-01', end: '2026-10-07', views: 440, followers: 24 },
  ],
  totals: { followers: 318, listings: 14, posts: 42 },
}

const fmtDate = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const pctChange = (now: number, prev: number) => (prev === 0 ? (now > 0 ? null : 0) : Math.round(((now - prev) / prev) * 100))

// Route: /company/reports  (Company Premium)
// Weekly (7 days) or monthly (30 days) summary, compared with the period before it, with PDF (print) and CSV export.
export default function CompanyReportsPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: d, error: e } = await supabase.rpc('report_company', { p_company: company.id, p_period: period, p_offset: offset })
    if (e) setError('Could not load the report. Please try again.')
    else setData(d as Report)
    setLoading(false)
  }, [company.id, period, offset])

  useEffect(() => { load() }, [load])

  const locked = !!data?.locked
  const r = locked ? SAMPLE : data

  const downloadCsv = () => {
    if (!r) return
    const g = (m?: M) => m || EMPTY
    const rows: (string | number)[][] = [
      ['FarmLite company report', company.name],
      ['Period', `${r.start} to ${r.end}`],
      [],
      ['Metric', 'This period', 'Previous period', 'Change %'],
      ...([
        ['Page views', g(r.views).total, g(r.views).prev],
        ['Listing views', g(r.listing_views).total, g(r.listing_views).prev],
        ['Unique visitors', r.visitors?.total ?? 0, r.visitors?.prev ?? 0],
        ['New followers', g(r.followers).total, g(r.followers).prev],
        ['Post likes', g(r.likes).total, g(r.likes).prev],
        ['Post comments', g(r.comments).total, g(r.comments).prev],
        ['Saves', g(r.saves).total, g(r.saves).prev],
        ['Orders', g(r.sales).total, g(r.sales).prev],
        ['Posts published', r.posts?.total ?? 0, r.posts?.prev ?? 0],
      ] as [string, number, number][]).map(([label, now, prev]) => [label, now, prev, pctChange(now, prev) ?? 'new']),
      [],
      ['Revenue', ...Object.entries(r.revenue || {}).map(([c, a]) => `${c} ${a}`)],
      [],
      ['Top listings', 'Views', 'Saves'],
      ...(r.top_listings || []).map((l) => [l.title, l.views, l.saves]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${company.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report-${r.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #company-report, #company-report * { visibility: visible !important; }
        #company-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12px; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: CHART.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company Premium</p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: CHART.text, marginTop: 2 }}>Reports</h1>
          <p style={{ fontSize: '12.5px', color: CHART.textMuted, marginTop: 3 }}>A clear summary of how {company.name} is doing</p>
        </div>
        {!locked && r && (
          <>
            <Seg value={period} onChange={(p) => { setPeriod(p); setOffset(0) }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Nav label="Previous period" onClick={() => setOffset((o) => Math.min(o + 1, 52))}>‹</Nav>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: CHART.text, minWidth: 170, textAlign: 'center' }}>{shortDate(r.start || '')} – {fmtDate(r.end)}</span>
              <Nav label="Next period" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(o - 1, 0))}>›</Nav>
            </div>
            <div onClick={downloadCsv} style={ghost}>Download CSV</div>
            <div onClick={() => window.print()} style={ghost}>Print / Save PDF</div>
          </>
        )}
      </div>

      {error && (
        <Box>
          <p style={{ fontSize: '13px', color: CHART.red, marginBottom: 10 }}>{error}</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: CHART.green, cursor: 'pointer' }}>Try again</span>
        </Box>
      )}
      {loading && !data && <p style={{ fontSize: '13px', color: CHART.textMuted, padding: '20px 0' }}>Loading…</p>}

      {r && (
        <div style={{ position: 'relative' }}>
          <div style={locked ? { filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.85 } : undefined} aria-hidden={locked}>
            <ReportBody r={r} company={company.name} />
          </div>
          {locked && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingTop: 70 }}>
              <div style={{ background: CHART.card, border: `1px solid ${CHART.border}`, borderRadius: 18, padding: '26px 28px', maxWidth: 440, textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}>
                <p style={{ fontSize: '17px', fontWeight: 800, color: CHART.text }}>Weekly and monthly reports</p>
                <p style={{ fontSize: '13px', color: CHART.textMuted, lineHeight: 1.55, marginTop: 8 }}>
                  See views, listings, customer activity and growth in one simple report, then download it as PDF or CSV. This preview shows sample data.
                </p>
                <div onClick={() => navigate('/company/premium')} style={{ marginTop: 16, padding: 12, borderRadius: 12, background: '#1877F2', color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
                  Upgrade to Company Premium
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ReportBody({ r, company }: { r: Report; company: string }) {
  const g = (m?: M) => m || EMPTY
  const views = g(r.views), lv = g(r.listing_views), fol = g(r.followers), likes = g(r.likes), com = g(r.comments), sav = g(r.saves), sales = g(r.sales)
  const labels = dayLabels(r.start || '', views.series.length)
  const interactions = likes.total + com.total + sav.total + fol.total
  const interactionsPrev = likes.prev + com.prev + sav.prev + fol.prev
  const revenue = Object.entries(r.revenue || {})
  const growth = r.growth || []
  const growthLabels = growth.map((x) => shortDate(x.start))
  const periodName = r.period === 'month' ? 'month' : 'week'

  // Plain-language summary of what changed.
  const lines: string[] = []
  const vTotal = views.total + lv.total
  const vPrev = views.prev + lv.prev
  const vc = pctChange(vTotal, vPrev)
  if (vTotal === 0 && vPrev === 0) lines.push(`No views were recorded this ${periodName} yet.`)
  else if (vc === null) lines.push(`Your company got its first ${vTotal} views this ${periodName}.`)
  else lines.push(`Total views ${vc >= 0 ? 'rose' : 'fell'} ${Math.abs(vc)}% compared with the previous ${periodName} (${vTotal} vs ${vPrev}).`)
  if (fol.total > 0) lines.push(`${fol.total} new follower${fol.total === 1 ? '' : 's'} joined.`)
  if (sales.total > 0) lines.push(`${sales.total} order${sales.total === 1 ? '' : 's'} completed${revenue.length ? ', earning ' + revenue.map(([c, a]) => formatMoney(Number(a), c)).join(' and ') : ''}.`)
  const top = (r.top_listings || [])[0]
  if (top && top.views > 0) lines.push(`Top listing: ${top.title} (${top.views} views).`)

  return (
    <div id="company-report" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: CHART.card, borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: CHART.green, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.period === 'month' ? 'Monthly' : 'Weekly'} report · FarmLite</p>
        <p style={{ fontSize: '19px', fontWeight: 800, color: CHART.text, marginTop: 4 }}>{company}</p>
        <p style={{ fontSize: '12.5px', color: CHART.textMuted, marginTop: 2 }}>{fmtDate(r.start)} to {fmtDate(r.end)} · compared with the {r.days} days before</p>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map((l) => (
            <div key={l} style={{ display: 'flex', gap: 10, fontSize: '13px', color: CHART.text, lineHeight: 1.5 }}>
              <span style={{ marginTop: 2, display: 'flex' }}><Icon name="leaf" size={14} color={CHART.green} /></span><span>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Kpi label="Page views" total={views.total} prev={views.prev} />
        <Kpi label="Listing views" total={lv.total} prev={lv.prev} />
        <Kpi label="Unique visitors" total={r.visitors?.total ?? 0} prev={r.visitors?.prev ?? 0} />
        <Kpi label="New followers" total={fol.total} prev={fol.prev} />
        <Kpi label="Orders" total={sales.total} prev={sales.prev} />
      </div>

      <Card title="Views over time" subtitle="Company page and listing views per day">
        <BarChart series={sumSeries(views.series, lv.series)} labels={labels} color={CHART.green} height={140} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card title="Listings performance" subtitle="Your top listings in this period">
          {(r.top_listings || []).filter((l) => l.views > 0 || l.saves > 0).length === 0 ? (
            <Empty text="Listings are ranked here once they receive views." />
          ) : (
            (r.top_listings || []).filter((l) => l.views > 0 || l.saves > 0).map((l, i) => (
              <Row key={l.id} rank={i + 1} image={l.image} title={l.title} meta={`${l.views} views · ${l.saves} saves`} />
            ))
          )}
        </Card>

        <Card title="Customer interactions" subtitle="How people engaged with your company">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: '26px', fontWeight: 800, color: CHART.text }}>{compact(interactions)}</span>
            <TrendBadge total={interactions} prev={interactionsPrev} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Mini label="Post likes" value={likes.total} color={PALETTE[4]} />
            <Mini label="Comments" value={com.total} color={PALETTE[3]} />
            <Mini label="Saves" value={sav.total} color={PALETTE[2]} />
            <Mini label="New followers" value={fol.total} color={PALETTE[0]} />
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card title="Sales" subtitle="Completed orders and earnings">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip>{sales.total} {sales.total === 1 ? 'order' : 'orders'}</Chip>
            {revenue.length === 0 ? <span style={{ fontSize: '12.5px', color: CHART.textMuted, padding: '5px 0' }}>No earnings in this period</span>
              : revenue.map(([c, a]) => <Chip key={c} green>{formatMoney(Number(a), c)}</Chip>)}
          </div>
        </Card>

        <Card title="Content" subtitle="Posts published as your company">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: CHART.text }}>{r.posts?.total ?? 0}</span>
            <TrendBadge total={r.posts?.total ?? 0} prev={r.posts?.prev ?? 0} />
          </div>
          {(r.top_posts || []).length === 0 ? <Empty text="No company posts in this period." /> : (r.top_posts || []).map((p, i) => (
            <Row key={p.id} rank={i + 1} image={p.image} title={p.snippet || 'Post'} meta={`${p.likes_count} likes · ${p.comments_count} comments`} />
          ))}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card title="Growth over time: views" subtitle={`Last 6 ${periodName}s`}>
          <BarChart series={growth.map((x) => x.views)} labels={growthLabels} color={CHART.blue} height={120} />
        </Card>
        <Card title="Growth over time: new followers" subtitle={`Last 6 ${periodName}s`}>
          <BarChart series={growth.map((x) => x.followers)} labels={growthLabels} color={CHART.green} height={120} />
        </Card>
      </div>

      <Card title="Advertising performance" subtitle="Results of your FarmLite Ads">
        <p style={{ fontSize: '12.5px', color: CHART.textMuted, lineHeight: 1.5 }}>Impressions, clicks and results will appear here once you run an ad. FarmLite Ads is coming soon.</p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Total label="Total followers" value={r.totals?.followers ?? 0} />
        <Total label="Active listings" value={r.totals?.listings ?? 0} />
        <Total label="Total posts" value={r.totals?.posts ?? 0} />
      </div>

      <p style={{ fontSize: '10.5px', color: CHART.textMuted, textAlign: 'center', padding: '4px 10px', lineHeight: 1.5 }}>
        Views are counted from the day tracking started. Your own visits are never counted. Periods are rolling: 7 days for weekly, 30 days for monthly.
      </p>
    </div>
  )
}

function Seg({ value, onChange }: { value: 'week' | 'month'; onChange: (p: 'week' | 'month') => void }) {
  return (
    <div style={{ display: 'inline-flex', background: CHART.card, border: `1px solid ${CHART.border}`, borderRadius: 10, padding: 3 }}>
      {(['week', 'month'] as const).map((p) => (
        <div key={p} onClick={() => onChange(p)} style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: value === p ? CHART.green : 'transparent', color: value === p ? 'white' : CHART.textMuted }}>
          {p === 'week' ? 'Weekly' : 'Monthly'}
        </div>
      ))}
    </div>
  )
}

function Nav({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <div role="button" aria-label={label} onClick={disabled ? undefined : onClick} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${CHART.border}`, background: CHART.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: CHART.text, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      {children}
    </div>
  )
}

function Kpi({ label, total, prev }: { label: string; total: number; prev: number }) {
  return (
    <div style={{ background: CHART.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: CHART.textMuted }}>{label}</p>
      <p style={{ fontSize: '24px', fontWeight: 800, color: CHART.text, margin: '4px 0' }}>{compact(total)}</p>
      <TrendBadge total={total} prev={prev} />
    </div>
  )
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: CHART.bg, borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${color}` }}>
      <p style={{ fontSize: '11px', color: CHART.textMuted, fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: '18px', fontWeight: 800, color: CHART.text, marginTop: 2 }}>{value}</p>
    </div>
  )
}

function Chip({ children, green }: { children: ReactNode; green?: boolean }) {
  return <span style={{ fontSize: '12px', fontWeight: 800, color: green ? CHART.greenDark : CHART.text, background: green ? CHART.greenSoft : CHART.bg, borderRadius: 999, padding: '5px 11px' }}>{children}</span>
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: CHART.card, borderRadius: 12, padding: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '17px', fontWeight: 800, color: CHART.text }}>{compact(value)}</p>
      <p style={{ fontSize: '11px', color: CHART.textMuted, marginTop: 2 }}>{label}</p>
    </div>
  )
}

function Row({ rank, image, title, meta }: { rank: number; image: string | null; title: string; meta: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: rank === 1 ? 'none' : `1px solid ${CHART.bg}` }}>
      <span style={{ width: 20, fontSize: '12px', fontWeight: 800, color: CHART.textMuted }}>{rank}</span>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: CHART.greenSoft, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={16} color={CHART.green} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: CHART.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
        <p style={{ fontSize: '11px', color: CHART.textMuted, marginTop: 2 }}>{meta}</p>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: '12.5px', color: CHART.textMuted, padding: '14px 0', textAlign: 'center' }}>{text}</p>
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ background: CHART.card, borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: CHART.text }}>{title}</p>
      {subtitle && <p style={{ fontSize: '11.5px', color: CHART.textMuted, marginTop: 2, marginBottom: 14 }}>{subtitle}</p>}
      {children}
    </div>
  )
}

function Box({ children }: { children: ReactNode }) {
  return <div style={{ background: CHART.card, border: `1px solid ${CHART.border}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>{children}</div>
}

const ghost = { padding: '9px 14px', borderRadius: 10, background: CHART.card, border: `1px solid ${CHART.border}`, color: CHART.greenDark, fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' } as const
