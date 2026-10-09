import type { ReactNode } from 'react'
import type { Feature, Included } from './premiumShared'

const C = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  bg: '#F8FAF6',
  rowAlt: '#F6FAF5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  text: '#1A2E1A',
  muted: '#5B6B5B',
  red: '#DC2626',
  gold: '#B8860B',
  goldSoft: '#FEF3C7',
}

// Simple line icons used by the comparison rows
const ICONS: Record<string, ReactNode> = {
  bot: (<><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V5M9.5 13h.01M14.5 13h.01M9 16.5h6" /></>),
  box: (<><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>),
  play: (<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5l5 2.5-5 2.5z" /></>),
  bars: (<path d="M5 20v-8M12 20V4M19 20v-5" />),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>),
  eye: (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  cloud: (<><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 20 10a4 4 0 0 1-1 8" /><path d="M12 12v7M9 15l3-3 3 3" /></>),
  bell: (<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></>),
  cart: (<><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.5 12h11l2-8H6" /></>),
  crown: (<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />),
  building: (<><path d="M4 21V5l8-2v18M12 9h8v12M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2.5.6 4 2.2 4 5" /></>),
  megaphone: (<><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M16 9a4 4 0 0 1 0 6" /></>),
  file: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>),
  headset: (<><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 14h3v5H4zM17 14h3v5h-3z" /></>),
}

function LineIcon({ name, size = 16, color = C.greenDark }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {ICONS[name] || ICONS.crown}
    </svg>
  )
}

function Tick({ size = 18 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size / 2, background: C.greenSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </span>
  )
}

function Cross({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.6" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M6 6l12 12M18 6L6 18" /></svg>
  )
}

function SoonPill({ label = 'Soon' }: { label?: string }) {
  return (
    <span style={{ display: 'inline-block', fontSize: '8.5px', fontWeight: 800, color: C.gold, background: C.goldSoft, borderRadius: 6, padding: '1px 5px', letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

const GRID = 'minmax(0, 1.55fr) minmax(0, 0.8fr) minmax(0, 1fr)'

// FREE vs PREMIUM banner
export function VersusBanner({ company }: { company: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, position: 'relative', marginBottom: 18 }}>
      <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px 0 0 16px', padding: '16px 14px 16px 14px', minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: '#EEF2EE', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <LineIcon name="user" size={16} color={C.muted} />
        </div>
        <p style={{ fontSize: '10.5px', fontWeight: 800, color: C.muted, letterSpacing: '0.5px' }}>{company ? 'FREE COMPANY' : 'FREE'}</p>
        <p style={{ fontSize: '15px', fontWeight: 800, color: C.text, margin: '2px 0 6px' }}>Basic</p>
        <p style={{ fontSize: '11.5px', color: C.muted, lineHeight: 1.45 }}>
          {company ? 'Basic tools to establish your company on Farmxie.' : 'Start building.'}
        </p>
      </div>
      <div style={{ flex: 1.12, background: C.greenDark, border: `1px solid ${C.gold}`, borderRadius: '0 16px 16px 0', padding: '16px 14px', minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <LineIcon name="crown" size={17} color="#F5D060" />
        </div>
        <p style={{ fontSize: '10.5px', fontWeight: 800, color: '#F5D060', letterSpacing: '0.5px' }}>{company ? 'PREMIUM COMPANY' : 'PREMIUM'}</p>
        <p style={{ fontSize: '15px', fontWeight: 800, color: 'white', margin: '2px 0 6px' }}>{company ? 'Business' : 'Pro'}</p>
        <p style={{ fontSize: '11.5px', color: '#D1FAE5', lineHeight: 1.45 }}>
          {company ? 'More tools, more insights and more opportunities.' : 'Build more. Understand more. Reach more.'}
        </p>
      </div>
      <div style={{ position: 'absolute', left: '47%', top: '50%', transform: 'translate(-50%, -50%)', width: 28, height: 28, borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: 800, color: C.muted }}>
        VS
      </div>
    </div>
  )
}

// Features | Free | Premium
export function ComparisonTable({ features, company }: { features: Feature[]; company: boolean }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '12px 10px', borderBottom: `1px solid ${C.border}` }}>
        <p style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>Features</p>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '12px', fontWeight: 800, color: C.text }}>Free</p>
          <p style={{ fontSize: '9.5px', color: C.muted }}>{company ? '(Basic)' : '(Basic)'}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '12px', fontWeight: 800, color: C.greenDark }}>Premium</p>
          <p style={{ fontSize: '9.5px', color: C.gold, fontWeight: 700 }}>{company ? '(Business)' : '(Pro)'}</p>
        </div>
      </div>

      {features.map((f, i) => (
        <div key={f.title} style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '10px 10px', background: i % 2 === 0 ? C.rowAlt : C.card, columnGap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 30, height: 30, borderRadius: 15, background: C.greenSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LineIcon name={f.icon} size={15} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '11.5px', fontWeight: 800, color: C.text, lineHeight: 1.25 }}>{f.title}</p>
              <p style={{ fontSize: '9.5px', color: C.muted, lineHeight: 1.3, marginTop: 1 }}>{f.sub}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 0 }}>
            {f.free === 'No' ? <Cross /> : <span style={{ width: 8, height: 8, borderRadius: 4, background: '#D5DDD5', flexShrink: 0 }} />}
            <span style={{ fontSize: '10.5px', color: C.muted, fontWeight: 600 }}>{f.free}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Tick />
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: C.greenDark }}>{f.premium}</span>
            </div>
            {!f.live && <SoonPill label={f.soonLabel || 'Soon'} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// "Everything included" numbered grid
export function IncludedGrid({ items }: { items: Included[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      {items.map((it, i) => (
        <div key={it.title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: C.gold }}>{String(i + 1).padStart(2, '0')}</span>
            {it.live ? <Tick size={16} /> : <SoonPill />}
          </div>
          <p style={{ fontSize: '12.5px', fontWeight: 800, color: C.text, lineHeight: 1.3 }}>{it.title}</p>
        </div>
      ))}
    </div>
  )
}

// Small gold pill above the page title
export function PremiumPill({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.6px', color: C.gold, background: C.goldSoft, borderRadius: 999, padding: '4px 10px' }}>
      <LineIcon name="crown" size={11} color={C.gold} />
      {label}
    </span>
  )
}
