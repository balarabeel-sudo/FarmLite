import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import { BarChart, Donut, RangePicker, CHART, PALETTE } from '../AnalyticsCharts'
import type { CompanyCtx } from './CompanyLayout'

type Group = { label: string; value: number }
type Insights = {
  locked: boolean
  days?: number
  timezone?: string
  min_group?: number
  totals?: { visitors: number; views: number; new_visitors: number; returning_visitors: number; first_time_buyers: number; repeat_buyers: number }
  funnel?: { key: string; label: string; value: number }[]
  countries?: Group[]
  locations?: Group[]
  roles?: Group[]
  interest?: { label: string; views: number; saves: number; orders: number }[]
  by_weekday?: number[]
  by_hour?: number[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}h`)
const ROLE_LABELS: Record<string, string> = { farmer: 'Farmers', buyer: 'Buyers', agribusiness: 'Agribusinesses' }

// Shown blurred behind the upgrade card for Free companies. It is clearly sample data, never the company's own.
const SAMPLE: Insights = {
  locked: false, days: 28, timezone: 'Africa/Lagos', min_group: 3,
  totals: { visitors: 482, views: 1260, new_visitors: 331, returning_visitors: 151, first_time_buyers: 14, repeat_buyers: 6 },
  funnel: [
    { key: 'reached', label: 'Reached your company', value: 482 },
    { key: 'listings', label: 'Viewed your listings', value: 316 },
    { key: 'saved', label: 'Saved something', value: 74 },
    { key: 'ordered', label: 'Completed an order', value: 20 },
  ],
  countries: [{ label: 'Nigeria', value: 301 }, { label: 'Ghana', value: 88 }, { label: 'Niger', value: 41 }, { label: 'Unknown', value: 36 }, { label: 'Others', value: 16 }],
  locations: [{ label: 'Kaduna', value: 120 }, { label: 'Kano', value: 94 }, { label: 'Abuja', value: 71 }, { label: 'Unknown', value: 120 }, { label: 'Others', value: 77 }],
  roles: [{ label: 'farmer', value: 210 }, { label: 'buyer', value: 190 }, { label: 'agribusiness', value: 82 }],
  interest: [
    { label: 'Seed', views: 420, saves: 51, orders: 11 },
    { label: 'Fertilizer', views: 310, saves: 33, orders: 6 },
    { label: 'Equipment', views: 150, saves: 12, orders: 3 },
  ],
  by_weekday: [60, 210, 240, 230, 220, 190, 110],
  by_hour: [2, 1, 0, 0, 1, 6, 18, 40, 72, 95, 110, 120, 105, 98, 90, 84, 70, 66, 52, 38, 24, 12, 6, 3],
}

// Route: /company/insights  (Company Premium)
// Everything here is aggregated. The company never sees who a visitor is, and groups smaller than the minimum are merged into "Others".
export default function CompanyInsightsPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const [days, setDays] = useState(28)
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: d, error: e } = await supabase.rpc('insights_company', { p_company: company.id, p_days: days })
    if (e) setError('Could not load Customer Insights. Please try again.')
    else setData(d as Insights)
    setLoading(false)
  }, [company.id, days])

  useEffect(() => { load() }, [load])

  const locked = !!data?.locked
  const view: Insights | null = locked ? SAMPLE : data

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: '11px', fontWeight: 800, color: CHART.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company Premium</p>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: CHART.text, marginTop: '2px' }}>Customer Insights</h1>
          <p style={{ fontSize: '12.5px', color: CHART.textMuted, marginTop: '3px' }}>Who is interested in {company.name} and what they want</p>
        </div>
        {!locked && <RangePicker value={days} onChange={setDays} />}
      </div>

      {error && (
        <Box>
          <p style={{ fontSize: '13px', color: CHART.red, marginBottom: '10px' }}>{error}</p>
          <span onClick={load} style={{ fontSize: '13px', fontWeight: 800, color: CHART.green, cursor: 'pointer' }}>Try again</span>
        </Box>
      )}

      {loading && !data && <p style={{ fontSize: '13px', color: CHART.textMuted, padding: '20px 0' }}>Loading…</p>}

      {view && (
        <div style={{ position: 'relative' }}>
          <div style={locked ? { filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.85 } : undefined} aria-hidden={locked}>
            <Content d={view} />
          </div>

          {locked && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingTop: 70 }}>
              <div style={{ background: CHART.card, border: `1px solid ${CHART.border}`, borderRadius: 18, padding: '26px 28px', maxWidth: 440, textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.14)' }}>
                <p style={{ fontSize: '17px', fontWeight: 800, color: CHART.text }}>Know your customers</p>
                <p style={{ fontSize: '13px', color: CHART.textMuted, lineHeight: 1.55, marginTop: '8px' }}>
                  See where your visitors come from, which products they want, and how many go from looking to buying. This preview shows sample data.
                </p>
                <div onClick={() => navigate('/company/premium')} style={{ marginTop: '16px', padding: '12px', borderRadius: 12, background: '#1877F2', color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
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

function Content({ d }: { d: Insights }) {
  const t = d.totals || { visitors: 0, views: 0, new_visitors: 0, returning_visitors: 0, first_time_buyers: 0, repeat_buyers: 0 }
  const funnel = d.funnel || []
  const reached = funnel[0]?.value || 0
  const weekday = d.by_weekday && d.by_weekday.length === 7 ? d.by_weekday : [0, 0, 0, 0, 0, 0, 0]
  const hour = d.by_hour && d.by_hour.length === 24 ? d.by_hour : Array(24).fill(0)
  const tz = d.timezone === 'Africa/Lagos' ? 'West Africa time (WAT)' : d.timezone || ''
  const empty = t.visitors === 0 && t.views === 0

  // Plain-language highlights computed from the numbers above.
  const known = (g?: Group[]) => (g || []).filter((x) => x.label !== 'Unknown' && x.label !== 'Others')
  const topCountry = known(d.countries)[0]
  const topLocation = known(d.locations)[0]
  const topCategory = (d.interest || [])[0]
  const bestDay = weekday.indexOf(Math.max(...weekday))
  const bestHour = hour.indexOf(Math.max(...hour))
  const highlights: string[] = []
  if (topCountry && reached > 0) highlights.push(`${Math.round((topCountry.value / reached) * 100)}% of your audience is in ${topCountry.label}${topLocation ? `, mostly ${topLocation.label}` : ''}.`)
  if (topCategory && topCategory.views > 0) highlights.push(`${topCategory.label} gets the most attention (${topCategory.views} views).`)
  if (Math.max(...weekday) > 0) highlights.push(`Your page is busiest on ${WEEKDAYS_FULL[bestDay]}s, around ${bestHour}:00. That is a good time to post.`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {empty && (
        <Box>
          <p style={{ fontSize: '13.5px', fontWeight: 800, color: CHART.text }}>No visits in this period yet</p>
          <p style={{ fontSize: '12.5px', color: CHART.textMuted, marginTop: 4, lineHeight: 1.5 }}>Insights appear as people visit your company page and listings. Share your page and post regularly to get started.</p>
        </Box>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <Kpi label="Unique visitors" value={t.visitors} />
        <Kpi label="Total views" value={t.views} />
        <Kpi label="New vs returning" value={`${t.new_visitors} / ${t.returning_visitors}`} sub="new / returning visitors" />
        <Kpi label="Repeat buyers" value={t.repeat_buyers} sub={`${t.first_time_buyers} first-time buyers`} />
      </div>

      {highlights.length > 0 && (
        <Card title="Highlights" subtitle="What stands out in this period">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {highlights.map((h) => (
              <div key={h} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '13px', color: CHART.text, lineHeight: 1.5 }}>
                <span style={{ marginTop: 2, display: 'flex' }}><Icon name="leaf" size={14} color={CHART.green} /></span>
                <span>{h}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="From interest to purchase" subtitle="People at each step, and the share of everyone you reached">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {funnel.map((s, i) => {
            const pct = reached > 0 ? Math.round((s.value / reached) * 100) : 0
            return (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: 5 }}>
                  <span style={{ fontWeight: 700, color: CHART.text }}>{s.label}</span>
                  <span style={{ color: CHART.textMuted }}><b style={{ color: CHART.text }}>{s.value}</b>{i > 0 ? ` · ${pct}%` : ''}</span>
                </div>
                <div style={{ height: 12, borderRadius: 6, background: CHART.greenSoft, overflow: 'hidden' }}>
                  <div style={{ width: `${s.value > 0 ? Math.max(pct, 3) : 0}%`, height: '100%', background: PALETTE[i % PALETTE.length], borderRadius: 6 }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <Card title="Where your audience is" subtitle="Countries of the people who visited">
          <Bars data={d.countries || []} />
        </Card>
        <Card title="Locations" subtitle="Towns and states they listed on their profile">
          <Bars data={d.locations || []} />
        </Card>
        <Card title="Who they are" subtitle="Their role on FarmLite">
          <Donut data={(d.roles || []).map((r) => ({ label: ROLE_LABELS[r.label] || r.label.charAt(0).toUpperCase() + r.label.slice(1), value: r.value }))} centerLabel="Visitors" />
        </Card>
      </div>

      <Card title="What they are interested in" subtitle="Your listing categories, by activity in this period">
        {(d.interest || []).length === 0 ? (
          <p style={{ fontSize: '12.5px', color: CHART.textMuted, padding: '10px 0' }}>Category activity appears once your listings are viewed.</p>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 8, fontSize: '11px', fontWeight: 800, color: CHART.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', paddingBottom: 8 }}>
              <span>Category</span><span>Views</span><span>Saves</span><span>Orders</span>
            </div>
            {(d.interest || []).map((c, i) => {
              const max = Math.max(1, ...(d.interest || []).map((x) => x.views))
              return (
                <div key={c.label} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${CHART.bg}`, fontSize: '13px' }}>
                  <span style={{ fontWeight: 700, color: CHART.text }}>{c.label}</span>
                  <span>
                    <b style={{ color: CHART.text }}>{c.views}</b>
                    <div style={{ height: 5, borderRadius: 3, background: CHART.greenSoft, marginTop: 4, overflow: 'hidden', maxWidth: 120 }}>
                      <div style={{ width: `${(c.views / max) * 100}%`, height: '100%', background: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </span>
                  <span style={{ color: CHART.text }}>{c.saves}</span>
                  <span style={{ color: CHART.text }}>{c.orders}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card title="Busiest days" subtitle="Views by day of the week">
          <BarChart series={weekday} labels={WEEKDAYS} color={CHART.blue} height={130} />
        </Card>
        <Card title="Busiest hours" subtitle={`Views by hour of the day, ${tz}`}>
          <BarChart series={hour} labels={HOURS} color={CHART.green} height={130} />
        </Card>
      </div>

      <p style={{ fontSize: '10.5px', color: CHART.textMuted, textAlign: 'center', padding: '4px 10px', lineHeight: 1.5 }}>
        Customer Insights are summaries only. You never see who individual visitors are, and groups with fewer than {d.min_group || 3} people are shown as "Others".
        "Unknown" means visitors who have not filled in that detail on their profile. Your own visits are never counted, and counting began on the day tracking started.
      </p>
    </div>
  )
}

function Bars({ data }: { data: Group[] }) {
  const rows = data.filter((g) => g.value > 0)
  if (rows.length === 0) return <p style={{ fontSize: '12.5px', color: CHART.textMuted, padding: '24px 0', textAlign: 'center' }}>Nothing to show yet.</p>
  const top = rows.slice(0, 6)
  const rest = rows.slice(6).reduce((s, g) => s + g.value, 0)
  const list = rest > 0 ? [...top, { label: 'Others', value: rest }] : top
  const total = rows.reduce((s, g) => s + g.value, 0)
  const max = Math.max(...list.map((g) => g.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((g, i) => (
        <div key={g.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: g.label === 'Unknown' || g.label === 'Others' ? CHART.textMuted : CHART.text }}>{g.label}</span>
            <span style={{ color: CHART.textMuted }}>{g.value} · {Math.round((g.value / total) * 100)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: CHART.bg, overflow: 'hidden' }}>
            <div style={{ width: `${(g.value / max) * 100}%`, height: '100%', borderRadius: 4, background: g.label === 'Unknown' || g.label === 'Others' ? '#CBD5C8' : PALETTE[i % PALETTE.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: CHART.card, borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: CHART.textMuted }}>{label}</p>
      <p style={{ fontSize: '24px', fontWeight: 800, color: CHART.text, marginTop: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: CHART.textMuted, marginTop: 2 }}>{sub}</p>}
    </div>
  )
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
  return <div style={{ background: CHART.card, border: `1px solid ${CHART.border}`, borderRadius: 14, padding: '18px', marginBottom: 14 }}>{children}</div>
}
