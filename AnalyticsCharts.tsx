import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { compact, trend } from './analyticsShared'

export const CHART = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  bg: '#F8FAF6',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#DC2626',
  blue: '#1D9BF0',
  amber: '#D97706',
}

export const PALETTE = ['#16A34A', '#1D9BF0', '#D97706', '#7C3AED', '#DB2777', '#0D9488', '#65A30D', '#64748B']

function niceMax(v: number): number {
  if (v <= 4) return 4
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

// ---------- Interactive line/area chart ----------
export function AreaChart({
  series,
  labels,
  color = CHART.green,
  height = 220,
}: {
  series: number[]
  labels: string[]
  color?: string
  height?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const gid = useRef(`g${Math.random().toString(36).slice(2, 9)}`).current

  const n = series.length
  const W = 1000
  const H = height
  const topPad = 14
  const max = niceMax(Math.max(1, ...series))
  const xAt = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const yAt = (v: number) => H - (v / max) * (H - topPad)

  let line = ''
  series.forEach((v, i) => {
    const x = xAt(i)
    const y = yAt(v)
    if (i === 0) line = `M ${x} ${y}`
    else {
      const px = xAt(i - 1)
      const py = yAt(series[i - 1])
      const mx = (px + x) / 2
      line += ` C ${mx} ${py} ${mx} ${y} ${x} ${y}`
    }
  })
  const area = n > 0 ? `${line} L ${xAt(n - 1)} ${H} L ${xAt(0)} ${H} Z` : ''

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || n === 0) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHover(n <= 1 ? 0 : Math.round(ratio * (n - 1)))
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
  const hx = hover === null ? 0 : (xAt(hover) / W) * 100
  const hy = hover === null ? 0 : (yAt(series[hover]) / H) * 100

  return (
    <div>
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ position: 'relative', height: H, touchAction: 'pan-y', cursor: 'crosshair' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridLines.map((g) => (
            <line key={g} x1="0" x2={W} y1={yAt(max * g)} y2={yAt(max * g)} stroke={CHART.border} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={g === 0 ? undefined : '4 4'} />
          ))}
          {n > 0 && <path d={area} fill={`url(#${gid})`} />}
          {n > 0 && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        </svg>

        {/* y-axis labels */}
        {gridLines.slice(1).map((g) => (
          <span key={g} style={{ position: 'absolute', left: 0, top: `${(yAt(max * g) / H) * 100}%`, transform: 'translateY(-110%)', fontSize: '9.5px', color: CHART.textMuted, background: 'rgba(255,255,255,0.7)', padding: '0 3px', borderRadius: 3, pointerEvents: 'none' }}>
            {compact(Math.round(max * g))}
          </span>
        ))}

        {hover !== null && series[hover] !== undefined && (
          <>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hx}%`, width: 1, background: color, opacity: 0.35, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: `${hx}%`, top: `${hy}%`, width: 11, height: 11, borderRadius: 6, background: color, border: '2px solid white', transform: 'translate(-50%, -50%)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', pointerEvents: 'none' }} />
            <div
              style={{
                position: 'absolute', top: 0, left: `${Math.min(82, Math.max(18, hx))}%`, transform: 'translate(-50%, -100%)',
                background: CHART.text, color: 'white', borderRadius: 8, padding: '5px 9px', fontSize: '11px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2,
              }}>
              <span style={{ opacity: 0.75 }}>{labels[hover]}</span> <b style={{ marginLeft: 4 }}>{series[hover].toLocaleString()}</b>
            </div>
          </>
        )}
      </div>

      {n > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '10.5px', color: CHART.textMuted }}>
          <span>{labels[0]}</span>
          {n > 4 && <span>{labels[Math.floor((n - 1) / 2)]}</span>}
          <span>{labels[n - 1]}</span>
        </div>
      )}
    </div>
  )
}

// ---------- Interactive bar chart ----------
export function BarChart({
  series,
  labels,
  color = CHART.green,
  height = 150,
}: {
  series: number[]
  labels: string[]
  color?: string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...series)
  const n = series.length

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: n > 45 ? 1 : 3, height }} onPointerLeave={() => setHover(null)}>
        {series.map((v, i) => (
          <div
            key={i}
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'pointer', touchAction: 'pan-y' }}>
            <div
              style={{
                width: '100%', height: `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%`, background: color,
                opacity: hover === null || hover === i ? 1 : 0.45, borderRadius: '3px 3px 0 0', transition: 'opacity 0.1s',
              }}
            />
          </div>
        ))}
      </div>
      {hover !== null && series[hover] !== undefined && (
        <div
          style={{
            position: 'absolute', top: -6, left: `${Math.min(85, Math.max(15, ((hover + 0.5) / n) * 100))}%`, transform: 'translate(-50%, -100%)',
            background: CHART.text, color: 'white', borderRadius: 8, padding: '5px 9px', fontSize: '11px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2,
          }}>
          <span style={{ opacity: 0.75 }}>{labels[hover]}</span> <b style={{ marginLeft: 4 }}>{series[hover].toLocaleString()}</b>
        </div>
      )}
      {n > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '10.5px', color: CHART.textMuted }}>
          <span>{labels[0]}</span>
          <span>{labels[n - 1]}</span>
        </div>
      )}
    </div>
  )
}

// ---------- Donut ----------
export function Donut({ data, centerLabel }: { data: { label: string; value: number }[]; centerLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  const size = 140
  const r = 52
  const c = 2 * Math.PI * r
  let offset = 0

  if (total === 0) {
    return <p style={{ fontSize: '12.5px', color: CHART.textMuted, padding: '24px 0', textAlign: 'center' }}>Nothing to show yet.</p>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CHART.bg} strokeWidth="18" />
          {data.map((d, i) => {
            const len = (d.value / total) * c
            const el = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={hover === i ? 22 : 18}
                strokeDasharray={`${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`}
                strokeDashoffset={-offset}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onPointerDown={() => setHover(i)}
                style={{ cursor: 'pointer', transition: 'stroke-width 0.12s' }}
              />
            )
            offset += len
            return el
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <p style={{ fontSize: '20px', fontWeight: 800, color: CHART.text }}>{hover === null ? total : data[hover].value}</p>
          <p style={{ fontSize: '10px', color: CHART.textMuted, textTransform: 'capitalize', maxWidth: 70, textAlign: 'center' }}>{hover === null ? centerLabel || 'Total' : data[hover].label}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 130 }}>
        {data.map((d, i) => (
          <div key={d.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: hover === null || hover === i ? 1 : 0.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: CHART.text, textTransform: 'capitalize', flex: 1 }}>{d.label}</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: CHART.text }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Trend badge ----------
export function TrendBadge({ total, prev }: { total: number; prev: number }) {
  const t = trend(total, prev)
  if (t.dir === 'flat') return <span style={{ fontSize: '11px', fontWeight: 700, color: CHART.textMuted }}>No change</span>
  if (t.dir === 'new') return <span style={{ fontSize: '11px', fontWeight: 700, color: CHART.blue }}>New</span>
  const up = t.dir === 'up'
  const color = up ? CHART.greenDark : CHART.red
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '11px', fontWeight: 800, color, background: up ? CHART.greenSoft : '#FEE2E2', borderRadius: 999, padding: '2px 7px' }}>
      <svg width="9" height="9" viewBox="0 0 10 10" style={{ transform: up ? undefined : 'rotate(180deg)' }}>
        <path d="M5 1.5 L9 7.5 H1 Z" fill={color} />
      </svg>
      {t.pct}%
    </span>
  )
}

// ---------- Sparkline ----------
export function Sparkline({ series, color = CHART.green }: { series: number[]; color?: string }) {
  const n = series.length
  if (n < 2) return <div style={{ height: 26 }} />
  const max = Math.max(1, ...series)
  const pts = series.map((v, i) => `${(i / (n - 1)) * 100},${24 - (v / max) * 22}`).join(' ')
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" width="100%" height="26" style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ---------- Range picker ----------
export function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: CHART.card, border: `1px solid ${CHART.border}`, borderRadius: 10, padding: 3 }}>
      {[7, 28, 90].map((d) => (
        <div
          key={d}
          onClick={() => onChange(d)}
          style={{
            padding: '6px 13px', borderRadius: 8, cursor: 'pointer', fontSize: '12px', fontWeight: 700,
            background: value === d ? CHART.green : 'transparent', color: value === d ? 'white' : CHART.textMuted,
          }}>
          {d}D
        </div>
      ))}
    </div>
  )
}

// ---------- Small inline chart icon (for menus) ----------
export function AnalyticsIcon({ size = 17, color = CHART.textMuted }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}
