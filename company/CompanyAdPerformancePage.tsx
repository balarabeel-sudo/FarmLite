import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { AreaChart, BarChart, CHART } from '../AnalyticsCharts'
import type { CompanyCtx } from './CompanyLayout'
import AdsTabs from './AdsTabs'
import { ctr, displayStatus, money, placementLabel } from './adShared'
import type { AdStatus, Placement } from './adShared'

const COLORS = { card: 'var(--fx-card)', border: 'var(--fx-border)', green: '#16A34A', text: 'var(--fx-text)', textMuted: 'var(--fx-muted)', red: 'var(--fx-red-text)' }

type Perf = {
  impressions: number
  clicks: number
  series: { day: string; impressions: number; clicks: number }[]
  placements: { placement: string; impressions: number; clicks: number }[]
  campaigns: { id: string; ref: string; headline: string; status: AdStatus; ends_at: string | null; placements: Placement[]; amount: number; currency: string; impressions: number; clicks: number; spend: number }[]
}

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'Lifetime', days: null },
]

// Route: /company/ads/performance
// Real impressions and clicks only; nothing here is estimated.
export default function CompanyAdPerformancePage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [range, setRange] = useState('7')
  const [data, setData] = useState<Perf | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const days = RANGES.find((r) => r.key === range)?.days ?? null
    const { data: d, error: e } = await supabase.rpc('ads_performance', { p_company: company.id, p_days: days })
    if (e) setError(true)
    else setData(d as Perf)
    setLoading(false)
  }, [company.id, range])

  useEffect(() => { load() }, [load])

  const labels = (data?.series || []).map((s) => new Date(s.day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
  const noData = !!data && data.campaigns.length === 0 && data.impressions === 0

  return (
    <div style={{ maxWidth: 1000 }}>
      <AdsTabs active="performance" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {RANGES.map((r) => (
          <span key={r.key} onClick={() => setRange(r.key)} style={{ padding: '7px 14px', borderRadius: 999, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', background: range === r.key ? COLORS.green : COLORS.card, color: range === r.key ? 'white' : COLORS.textMuted, border: `1px solid ${range === r.key ? COLORS.green : COLORS.border}` }}>
            {r.label}
          </span>
        ))}
      </div>

      {error ? (
        <Card>
          <p style={{ fontSize: '13px', color: COLORS.red, marginBottom: 10 }}>Could not load performance.</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: COLORS.green, cursor: 'pointer' }}>Try again</span>
        </Card>
      ) : loading || !data ? (
        <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
      ) : noData ? (
        <Card>
          <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>No performance data yet.</p>
          <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>Numbers appear here once one of your ads has started running and been seen.</p>
          <div role="button" onClick={() => navigate('/company/ads/new')} style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 10, background: COLORS.green, color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>Create Ad</div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
            <Kpi label="Impressions" value={data.impressions.toLocaleString()} />
            <Kpi label="Clicks" value={data.clicks.toLocaleString()} />
            <Kpi label="Click rate" value={ctr(data.impressions, data.clicks)} />
          </div>

          <Card title="Impressions per day">
            <AreaChart series={data.series.map((s) => s.impressions)} labels={labels} color={CHART.green} height={190} />
          </Card>
          <div style={{ height: 14 }} />
          <Card title="Clicks per day">
            <BarChart series={data.series.map((s) => s.clicks)} labels={labels} color={CHART.blue} height={140} />
          </Card>
          {range === 'all' && <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 6 }}>Totals cover your whole history. The charts show the last 90 days.</p>}
          <div style={{ height: 14 }} />

          <Card title="By placement">
            {data.placements.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No views in this period.</p>
            ) : (
              <Table
                head={['Placement', 'Impressions', 'Clicks', 'Click rate']}
                rows={data.placements.map((p) => [placementLabel(p.placement), p.impressions.toLocaleString(), p.clicks.toLocaleString(), ctr(p.impressions, p.clicks)])}
              />
            )}
          </Card>
          <div style={{ height: 14 }} />

          <Card title="By campaign">
            {data.campaigns.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>No paid campaigns yet.</p>
            ) : (
              <Table
                head={['Campaign', 'Status', 'Impressions', 'Clicks', 'Click rate', 'Spend']}
                onRow={(i) => navigate(`/company/ads/${data.campaigns[i].id}`)}
                rows={data.campaigns.map((c) => [c.headline, displayStatus(c).label, c.impressions.toLocaleString(), c.clicks.toLocaleString(), ctr(c.impressions, c.clicks), money(Number(c.spend), c.currency)])}
              />
            )}
          </Card>
          <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: 12, lineHeight: 1.5 }}>
            An impression is counted once per person per ad per day, when the ad is actually on screen. Your own views are not counted.
          </p>
        </>
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

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      {title && <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text, marginBottom: 12 }}>{title}</p>}
      {children}
    </div>
  )
}

function Table({ head, rows, onRow }: { head: string[]; rows: string[][]; onRow?: (i: number) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: 420 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px', color: COLORS.textMuted, fontWeight: 700, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} onClick={onRow ? () => onRow(ri) : undefined} style={{ cursor: onRow ? 'pointer' : 'default' }}>
              {r.map((c, ci) => <td key={ci} style={{ textAlign: ci === 0 ? 'left' : 'right', padding: '9px 8px', color: COLORS.text, fontWeight: ci === 0 ? 700 : 500, borderBottom: '1px solid var(--fx-grey1)' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
