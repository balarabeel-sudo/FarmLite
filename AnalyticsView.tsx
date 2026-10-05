import { useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import Icon from './Icons'
import { AreaChart, BarChart, Donut, TrendBadge, Sparkline, RangePicker, CHART } from './AnalyticsCharts'
import { compact, dayLabels, sumSeries, EMPTY_METRIC } from './analyticsShared'
import type { AnalyticsData, AnalyticsAudience, Metric } from './analyticsShared'
import { formatMoney } from './premiumShared'

type MetricKey = 'views' | 'listing_views' | 'followers' | 'likes' | 'comments' | 'saves' | 'sales'

const METRICS: Record<AnalyticsAudience, { key: MetricKey; label: string; color: string }[]> = {
  user: [
    { key: 'views', label: 'Profile views', color: '#1D9BF0' },
    { key: 'followers', label: 'New followers', color: '#16A34A' },
    { key: 'likes', label: 'Likes', color: '#DB2777' },
    { key: 'comments', label: 'Comments', color: '#7C3AED' },
    { key: 'saves', label: 'Saves', color: '#D97706' },
    { key: 'sales', label: 'Sales', color: '#0D9488' },
  ],
  company: [
    { key: 'views', label: 'Page views', color: '#1D9BF0' },
    { key: 'listing_views', label: 'Listing views', color: '#7C3AED' },
    { key: 'followers', label: 'New followers', color: '#16A34A' },
    { key: 'saves', label: 'Saves', color: '#D97706' },
    { key: 'sales', label: 'Orders', color: '#0D9488' },
  ],
}

type Props = {
  audience: AnalyticsAudience
  data: AnalyticsData | null
  loading: boolean
  error: string | null
  days: number
  onDays: (d: number) => void
  onRetry: () => void
  onUpgrade: () => void
}

export default function AnalyticsView({ audience, data, loading, error, days, onDays, onRetry, onUpgrade }: Props) {
  const locked = !!data?.locked

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 800, color: CHART.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {audience === 'company' ? 'Company Analytics' : 'Analytics'}
          </p>
          <p style={{ fontSize: '12.5px', color: CHART.textMuted, marginTop: 3 }}>How your {audience === 'company' ? 'company' : 'profile and content'} is performing</p>
        </div>
        {!locked && <RangePicker value={days} onChange={onDays} />}
      </div>

      {error ? (
        <div style={{ background: CHART.card, borderRadius: 14, padding: '28px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: CHART.red, marginBottom: 12 }}>{error}</p>
          <div onClick={onRetry} style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 10, background: CHART.green, color: 'white', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>Try again</div>
        </div>
      ) : loading && !data ? (
        <Skeleton />
      ) : locked ? (
        <LockedPreview audience={audience} onUpgrade={onUpgrade} />
      ) : data ? (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          <DashboardBody audience={audience} data={data} />
        </div>
      ) : null}
    </div>
  )
}

function DashboardBody({ audience, data }: { audience: AnalyticsAudience; data: AnalyticsData }) {
  const defs = METRICS[audience]
  const [selected, setSelected] = useState<MetricKey>('views')
  const def = defs.find((d) => d.key === selected) || defs[0]

  const get = (k: MetricKey): Metric => (data[k] as Metric | undefined) || EMPTY_METRIC
  const main = get(def.key)
  const count = main.series.length
  const labels = dayLabels(data.start, count)
  const days = data.days || count

  const engagement =
    audience === 'company'
      ? sumSeries(get('listing_views').series, get('saves').series, get('followers').series)
      : sumSeries(get('likes').series, get('comments').series, get('saves').series)

  const revenue = Object.entries(data.revenue || {})
  const salesLabel = audience === 'company' ? 'Orders' : 'Sales'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPI cards: tap one to see it in the big chart */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {defs.map((d) => {
          const m = get(d.key)
          const active = d.key === selected
          return (
            <div
              key={d.key}
              onClick={() => setSelected(d.key)}
              style={{
                background: CHART.card, borderRadius: 14, padding: '12px 12px 8px', cursor: 'pointer',
                border: `2px solid ${active ? d.color : 'transparent'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: CHART.textMuted }}>{d.label}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, margin: '4px 0 6px' }}>
                <p style={{ fontSize: '22px', fontWeight: 800, color: CHART.text }}>{compact(m.total)}</p>
                <TrendBadge total={m.total} prev={m.prev} />
              </div>
              <Sparkline series={m.series} color={d.color} />
            </div>
          )
        })}
      </div>

      {/* Main chart */}
      <Card
        title={def.label}
        subtitle={`Last ${days} days · compared with the ${days} days before`}
        right={<TrendBadge total={main.total} prev={main.prev} />}>
        <AreaChart series={main.series} labels={labels} color={def.color} height={230} />
        {main.total === 0 && (
          <p style={{ fontSize: '11.5px', color: CHART.textMuted, marginTop: 10 }}>No activity in this period yet. Numbers appear here as people interact.</p>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
        <Card title="Engagement" subtitle={audience === 'company' ? 'Listing views, saves and new followers per day' : 'Likes, comments and saves per day'}>
          <BarChart series={engagement} labels={labels} color={CHART.green} />
        </Card>

        <Card title="Listings by category" subtitle="Your active listings">
          <Donut data={data.listing_categories || []} centerLabel="Listings" />
        </Card>

        <Card title={salesLabel} subtitle="Completed orders and earnings in this period">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: CHART.text, background: CHART.bg, borderRadius: 999, padding: '5px 11px' }}>
              {get('sales').total} {get('sales').total === 1 ? 'order' : 'orders'}
            </span>
            {revenue.length === 0 ? (
              <span style={{ fontSize: '12px', color: CHART.textMuted, padding: '5px 0' }}>No earnings yet</span>
            ) : (
              revenue.map(([cur, amt]) => (
                <span key={cur} style={{ fontSize: '12px', fontWeight: 800, color: CHART.greenDark, background: CHART.greenSoft, borderRadius: 999, padding: '5px 11px' }}>
                  {formatMoney(Number(amt), cur)}
                </span>
              ))
            )}
          </div>
          <BarChart series={get('sales').series} labels={labels} color="#0D9488" height={110} />
        </Card>
      </div>

      {/* Top content */}
      {audience === 'user' ? (
        <Card title="Top posts" subtitle="By likes and comments">
          {(data.top_posts || []).length === 0 ? (
            <Empty text="Your posts will be ranked here once you start posting." />
          ) : (
            (data.top_posts || []).map((p, i) => (
              <Row key={p.id} rank={i + 1} image={p.image} title={p.snippet || 'Post'} meta={`${p.likes_count} likes · ${p.comments_count} comments`} />
            ))
          )}
        </Card>
      ) : (
        <Card title="Top listings" subtitle="By views in this period">
          {(data.top_listings || []).length === 0 ? (
            <Empty text="Your company listings will be ranked here once they receive views." />
          ) : (
            (data.top_listings || []).map((l, i) => (
              <Row key={l.id} rank={i + 1} image={l.image} title={l.title} meta={`${l.views} views · ${l.saves} saves`} />
            ))
          )}
        </Card>
      )}

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Total label="Total followers" value={data.totals?.followers ?? 0} />
        {audience === 'user' && <Total label="Posts" value={data.totals?.posts ?? 0} />}
        <Total label="Active listings" value={data.totals?.listings ?? 0} />
      </div>

      <p style={{ fontSize: '10.5px', color: CHART.textMuted, textAlign: 'center', padding: '4px 10px' }}>
        Views are counted from the day tracking started, so older visits are not included. Your own visits are never counted.
      </p>
    </div>
  )
}

function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: CHART.card, borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 800, color: CHART.text }}>{title}</p>
          {subtitle && <p style={{ fontSize: '11px', color: CHART.textMuted, marginTop: 2 }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Row({ rank, image, title, meta }: { rank: number; image: string | null; title: string; meta: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: rank === 1 ? 'none' : `1px solid ${CHART.bg}` }}>
      <span style={{ width: 22, fontSize: '12px', fontWeight: 800, color: CHART.textMuted }}>{rank}</span>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: CHART.greenSoft, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={16} color={CHART.green} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: CHART.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
        <p style={{ fontSize: '11px', color: CHART.textMuted, marginTop: 2 }}>{meta}</p>
      </div>
    </div>
  )
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: CHART.card, borderRadius: 14, padding: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '20px', fontWeight: 800, color: CHART.text }}>{compact(value)}</p>
      <p style={{ fontSize: '11px', color: CHART.textMuted, marginTop: 2 }}>{label}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: '12.5px', color: CHART.textMuted, padding: '10px 0' }}>{text}</p>
}

function Skeleton() {
  const block = (h: number): CSSProperties => ({ height: h, borderRadius: 14, background: '#E9F0E9' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={block(84)} />)}
      </div>
      <div style={block(300)} />
      <div style={block(200)} />
    </div>
  )
}

// Free accounts see the layout with example numbers, blurred, plus an upgrade prompt.
// The numbers are only a sample and never come from the account.
function LockedPreview({ audience, onUpgrade }: { audience: AnalyticsAudience; onUpgrade: () => void }) {
  const wave = (seed: number, n = 28): Metric => {
    const series = Array.from({ length: n }, (_, i) => Math.round(8 + 6 * Math.sin(i / 3 + seed) + (i * seed) / 9))
    return { series, total: series.reduce((a, b) => a + b, 0), prev: Math.round(series.reduce((a, b) => a + b, 0) * 0.8) }
  }
  const sample: AnalyticsData = {
    locked: false,
    days: 28,
    start: new Date(Date.now() - 27 * 86_400_000).toISOString().slice(0, 10),
    views: wave(1), listing_views: wave(2), followers: wave(3), likes: wave(4), comments: wave(5), saves: wave(6), sales: wave(7),
    revenue: {},
    top_posts: [], top_listings: [],
    listing_categories: [{ label: 'crop', value: 5 }, { label: 'seed', value: 3 }, { label: 'livestock', value: 2 }],
    totals: { followers: 0, posts: 0, listings: 0 },
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', maxHeight: 640, overflow: 'hidden' }} aria-hidden>
        <DashboardBody audience={audience} data={sample} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 14px 0' }}>
        <div style={{ background: CHART.card, borderRadius: 18, padding: '24px 22px', maxWidth: 360, textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.18)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: CHART.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Icon name="crown" size={24} color={CHART.green} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 800, color: CHART.text }}>
            {audience === 'company' ? 'Company Analytics is a Premium feature' : 'Analytics is a Premium feature'}
          </p>
          <p style={{ fontSize: '12.5px', color: CHART.textMuted, margin: '8px 0 16px', lineHeight: 1.5 }}>
            See who visits you, how your content performs and how your sales grow, with interactive charts. This is a sample preview.
          </p>
          <div onClick={onUpgrade} style={{ padding: '12px', borderRadius: 12, background: CHART.green, color: 'white', fontWeight: 800, fontSize: '13.5px', cursor: 'pointer' }}>
            Upgrade to Premium
          </div>
        </div>
      </div>
    </div>
  )
}
