import type { CSSProperties } from 'react'
import type { Feature, PriceRow } from './premiumShared'
import { formatMoney, savingPercent } from './premiumShared'

// The Premium comparison view: one clean card (Features | Free | Pro) with check marks,
// and a slider to pick how long the plan lasts.

const C = {
  card: 'var(--fx-card)',
  border: 'var(--fx-grey2)',
  track: 'var(--fx-grey2)',
  text: 'var(--fx-text)',
  muted: '#667066',
  free: '#8C938C',
  pro: '#1877F2',
  green: '#16A34A',
  gold: '#B8860B',
  goldSoft: 'var(--fx-tint-amber)',
}

const COLS = 'minmax(0, 1fr) 56px 56px'

function Check({ color, label }: { color: string; label: string }) {
  return (
    <svg role="img" aria-label={label} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.8l5 5L19.5 7" />
    </svg>
  )
}

function Dash() {
  return (
    <svg role="img" aria-label="Not included" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.free} strokeWidth="2.6" strokeLinecap="round">
      <path d="M6 12h12" />
    </svg>
  )
}

// Features | Free | Pro
// grey check = included in Free, dash = not in Free, blue check = included in Pro.
// Limits (numbers) are never shown here; they are enforced in the database only.
export function PlanTable({ features, proLabel }: { features: Feature[]; proLabel: string }) {
  const head: CSSProperties = { fontSize: '15px', fontWeight: 700, color: C.text }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '6px 18px 10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, alignItems: 'center', padding: '18px 0 12px' }}>
        <span style={head}>Features</span>
        <span style={{ ...head, textAlign: 'center' }}>Free</span>
        <span style={{ ...head, textAlign: 'center' }}>{proLabel}</span>
      </div>

      {features.map((f) => {
        const freeNo = f.free === 'No' || f.free === '0'
        return (
          <div key={f.title} style={{ display: 'grid', gridTemplateColumns: COLS, columnGap: 6, alignItems: 'center', padding: '14px 0' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '15.5px', fontWeight: 500, color: C.text, lineHeight: 1.3 }}>
                {f.title}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: C.muted, lineHeight: 1.35 }}>{f.sub}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              {freeNo ? <Dash /> : <Check color={C.free} label="Included in Free" />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Check color={C.pro} label={`Included in ${proLabel}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const RANGE_CSS = `
.fx-range { -webkit-appearance: none; appearance: none; width: 100%; height: 30px; margin: 0; background: transparent; cursor: pointer; }
.fx-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(to right, ${C.green} 0, ${C.green} var(--fx-pct), ${C.track} var(--fx-pct), ${C.track} 100%); }
.fx-range::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; margin-top: -10px; border-radius: 50%; background: var(--fx-card); border: 2px solid ${C.green}; box-shadow: 0 2px 6px rgba(0,0,0,0.18); }
.fx-range::-moz-range-track { height: 6px; border-radius: 3px; background: ${C.track}; }
.fx-range::-moz-range-progress { height: 6px; border-radius: 3px; background: ${C.green}; }
.fx-range::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: var(--fx-card); border: 2px solid ${C.green}; box-shadow: 0 2px 6px rgba(0,0,0,0.18); }
.fx-range:focus-visible { outline: 2px solid ${C.green}; outline-offset: 4px; border-radius: 6px; }
`

// Slider to pick 1, 3 or 6 months. The prices come from the database; the saving is worked out from them.
export function DurationSlider({ prices, currency, months, onChange }: { prices: PriceRow[]; currency: string; months: number; onChange: (months: number) => void }) {
  const list = [...prices].sort((a, b) => a.months - b.months)
  const n = list.length
  const idx = Math.max(0, list.findIndex((p) => p.months === months))
  const ratio = n > 1 ? idx / (n - 1) : 0
  const cur = list[idx]
  const perMonth = cur ? Math.round(cur.amount / cur.months) : 0
  const monthsText = (m: number) => (m === 1 ? '1 month' : `${m} months`)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '18px 30px 12px', marginBottom: 14 }}>
      <style>{RANGE_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: C.text }}>Choose your plan length</p>
        {cur && <p style={{ margin: 0, fontSize: '12.5px', color: C.muted }}>{formatMoney(perMonth, currency)} / month</p>}
      </div>

      {n > 1 && (
        <>
          <input
            className="fx-range"
            type="range"
            min={0}
            max={n - 1}
            step={1}
            value={idx}
            onChange={(e) => onChange(list[Number(e.target.value)].months)}
            aria-label="Plan length"
            aria-valuetext={cur ? `${monthsText(cur.months)}, ${formatMoney(cur.amount, currency)}` : undefined}
            style={{ marginTop: 14, '--fx-pct': `calc(13px + (100% - 26px) * ${ratio})` } as CSSProperties}
          />
          <div style={{ position: 'relative', height: 46, marginTop: 2 }}>
            {list.map((p, i) => {
              const r = i / (n - 1)
              const selected = p.months === months
              const save = savingPercent(list, p.months)
              return (
                <button
                  key={p.months}
                  type="button"
                  onClick={() => onChange(p.months)}
                  style={{ position: 'absolute', top: 0, left: `calc(13px + (100% - 26px) * ${r})`, transform: 'translateX(-50%)', background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: selected ? 800 : 500, color: selected ? C.text : C.muted }}>{monthsText(p.months)}</span>
                  {save > 0 && <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: C.green, marginTop: 1 }}>Save {save}%</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
      {n === 1 && cur && <p style={{ margin: '10px 0 8px', fontSize: '13.5px', color: C.muted }}>{monthsText(cur.months)}</p>}
    </div>
  )
}
