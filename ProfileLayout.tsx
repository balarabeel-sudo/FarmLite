import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Icon from './Icons'
import PremiumTick from './PremiumTick'

// Shared X-style layout pieces used by the public User profile (pages/UserProfilePage.tsx)
// and the public Company page (pages/CompanyDetailsPage.tsx), so both look and behave the same.

export const PCOLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-dark)',
  greenSoft: 'var(--fx-tint-green)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted)',
}

const HEADER_HEIGHT = 56
const AVATAR = 72
const BTN = 32

export function ProfileShell({ children }: { children: ReactNode }) {
  return (
    <div className="fx-profile" style={{ minHeight: '100vh', background: PCOLORS.bg, maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Browsers give every <p> a big default margin; here each text sets its own spacing, so it is switched off */}
      <style>{'.fx-profile p { margin: 0; }'}</style>
      {children}
    </div>
  )
}

// Back arrow + name + "N posts", like the X profile header.
export function ProfileHeader({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 16px', height: `${HEADER_HEIGHT}px`, boxSizing: 'border-box', background: PCOLORS.card, position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div role="button" aria-label="Back" onClick={onBack} style={{ cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
        <Icon name="arrowLeft" size={22} color={PCOLORS.text} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '16px', fontWeight: 800, color: PCOLORS.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
        {subtitle && <p style={{ fontSize: '12px', color: PCOLORS.textMuted, lineHeight: 1.2, marginTop: '2px' }}>{subtitle}</p>}
      </div>
    </div>
  )
}

// Wide 3:1 cover, like X.
export function ProfileCover({ src }: { src?: string | null }) {
  return (
    <div style={{ width: '100%', aspectRatio: '3 / 1', background: src ? 'var(--fx-border)' : 'linear-gradient(135deg, var(--fx-tint-green) 0%, var(--fx-bd-green) 55%, #86EFAC 100%)', position: 'relative', overflow: 'hidden' }}>
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ position: 'absolute', right: '-12px', bottom: '-18px', opacity: 0.35 }}><Icon name="leaf" size={110} color={PCOLORS.green} /></div>}
    </div>
  )
}

// Photo (full circle, overlapping the cover) on the left, action buttons on the right.
// The photo has its own stacking level: the cover is a positioned element and would otherwise paint over the top half of it.
export function ProfileTop({ image, alt, fallbackIcon, actions }: { image?: string | null; alt: string; fallbackIcon: string; actions: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '0 16px' }}>
      <div style={{
        position: 'relative', zIndex: 2, marginTop: `-${AVATAR / 2}px`, width: `${AVATAR}px`, height: `${AVATAR}px`, borderRadius: '50%', flexShrink: 0,
        border: `3px solid ${PCOLORS.bg}`, boxSizing: 'border-box', background: PCOLORS.greenSoft, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {image
          ? <img src={image} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <Icon name={fallbackIcon} size={28} color={PCOLORS.green} />}
      </div>
      {/* One row, never wraps: keeps Follow level with the other buttons on every phone width */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '10px', flexWrap: 'nowrap', flexShrink: 0 }}>{actions}</div>
    </div>
  )
}

export function RoundIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <div role="button" aria-label={label} onClick={onClick} style={{
      width: `${BTN}px`, height: `${BTN}px`, borderRadius: '50%', border: `1px solid ${PCOLORS.border}`, background: PCOLORS.card,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

export function PillButton({ onClick, filled, disabled, children }: { onClick: () => void; filled: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <div role="button" aria-disabled={disabled} onClick={disabled ? undefined : onClick} style={{
      height: `${BTN}px`, padding: '0 16px', borderRadius: '999px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexShrink: 0,
      fontWeight: 700, fontSize: '12.5px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
      background: filled ? PCOLORS.green : PCOLORS.card, color: filled ? 'white' : PCOLORS.text,
      border: `1px solid ${filled ? PCOLORS.green : PCOLORS.border}`,
    }}>
      {children}
    </div>
  )
}

export function DotsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={PCOLORS.text} aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
  )
}

export type MenuItem = { label: string; onClick: () => void; danger?: boolean }

// The "..." button with its dropdown.
export function DotsMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <RoundIconButton label="More options" onClick={() => setOpen((o) => !o)}><DotsIcon /></RoundIconButton>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div style={{ position: 'absolute', right: 0, top: `${BTN + 6}px`, zIndex: 21, background: PCOLORS.card, border: `1px solid ${PCOLORS.border}`, borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', minWidth: '190px', overflow: 'hidden' }}>
            {items.map((it) => (
              <div key={it.label} onClick={() => { setOpen(false); it.onClick() }} style={{ padding: '12px 14px', fontSize: '13px', fontWeight: 600, color: it.danger ? '#DC2626' : PCOLORS.text, cursor: 'pointer' }}>
                {it.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Name + green "verified" check + blue Premium tick.
// Owner without Premium sees a blue tick with "Upgrade" in front of the name row.
export function NameRow({ name, verified, verifiedLabel, premium, premiumLabel, onUpgrade }: {
  name: string
  verified?: boolean
  verifiedLabel?: string
  premium: boolean
  premiumLabel: string
  onUpgrade?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <p style={{ fontSize: '18px', fontWeight: 800, color: PCOLORS.text, lineHeight: 1.25, wordBreak: 'break-word' }}>{name}</p>
      {verified && <span title={verifiedLabel || 'Verified'} style={{ display: 'flex' }}><Icon name="checkCircle" size={16} color={PCOLORS.green} /></span>}
      {premium && <PremiumTick size={18} label={premiumLabel} />}
      {!premium && onUpgrade && (
        <div role="button" onClick={onUpgrade} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px 2px 5px', borderRadius: '999px', background: 'var(--fx-tint-blue)', border: '1px solid var(--fx-bd-blue)', color: 'var(--fx-blue-text2)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
          <PremiumTick size={14} /> Upgrade
        </div>
      )}
    </div>
  )
}

// Bio / description: 13px, folded to 4 lines with "Show more" when it is long.
export function BioText({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 170 || text.split('\n').length > 4
  const folded = long && !open
  return (
    <div style={{ marginTop: '8px' }}>
      <p style={{
        fontSize: '13px', lineHeight: 1.5, color: PCOLORS.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        ...(folded ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
      }}>{text}</p>
      {long && (
        <span role="button" onClick={() => setOpen((o) => !o)} style={{ display: 'inline-block', marginTop: '3px', fontSize: '12.5px', fontWeight: 700, color: PCOLORS.green, cursor: 'pointer' }}>
          {open ? 'Show less' : 'Show more'}
        </span>
      )}
    </div>
  )
}

export function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PCOLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

// Location / website / joined, in one wrapping row like X.
export function MetaRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: '10px' }}>{children}</div>
}

export function MetaItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: PCOLORS.textMuted, minWidth: 0 }}>
      {icon}
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}

// "12 Following  34 Followers" style counts.
export function CountsRow({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', marginTop: '10px' }}>
      {items.map((it) => (
        <div key={it.label} style={{ fontSize: '12.5px', color: PCOLORS.textMuted }}>
          <span style={{ fontWeight: 800, color: PCOLORS.text }}>{it.value}</span> {it.label}
        </div>
      ))}
    </div>
  )
}

// Equal-width tabs with a thick underline under the active one.
export function ProfileTabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${PCOLORS.border}`, marginTop: '14px' }}>
      {tabs.map((t) => {
        const on = active === t.key
        return (
          <div key={t.key} role="tab" aria-selected={on} onClick={() => onChange(t.key)} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', paddingTop: '13px' }}>
            <span style={{ display: 'inline-block', paddingBottom: '11px', fontSize: '13px', fontWeight: on ? 800 : 600, color: on ? PCOLORS.text : PCOLORS.textMuted, borderBottom: `4px solid ${on ? PCOLORS.green : 'transparent'}`, borderRadius: '2px' }}>
              {t.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Search bar shown under the header while searching inside a profile.
export function ProfileSearchBar({ value, onChange, onClose, placeholder }: { value: string; onChange: (v: string) => void; onClose: () => void; placeholder: string }) {
  return (
    <div style={{ position: 'sticky', top: `${HEADER_HEIGHT}px`, zIndex: 9, background: PCOLORS.bg, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: `1px solid ${PCOLORS.border}` }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: PCOLORS.card, border: `1px solid ${PCOLORS.border}`, borderRadius: '999px', padding: '0 14px', height: '40px' }}>
        <Icon name="search" size={16} color={PCOLORS.textMuted} />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', color: PCOLORS.text }}
        />
        {value && (
          <div role="button" aria-label="Clear" onClick={() => onChange('')} style={{ display: 'flex', cursor: 'pointer' }}>
            <Icon name="close" size={16} color={PCOLORS.textMuted} />
          </div>
        )}
      </div>
      <div role="button" onClick={onClose} style={{ fontSize: '13px', fontWeight: 700, color: PCOLORS.green, cursor: 'pointer' }}>Cancel</div>
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: '12px', fontWeight: 800, color: PCOLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '4px 0 10px' }}>{children}</p>
}

export function EmptyCard({ text, icon }: { text: string; icon?: string }) {
  return (
    <div style={{ background: PCOLORS.card, borderRadius: '14px', padding: '28px 16px', textAlign: 'center', marginBottom: '12px' }}>
      {icon && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><Icon name={icon} size={26} color={PCOLORS.textMuted} /></div>}
      <p style={{ fontSize: '12.5px', color: PCOLORS.textMuted }}>{text}</p>
    </div>
  )
}

export function AboutRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', borderBottom: `1px solid ${PCOLORS.bg}` }}>
      <p style={{ fontSize: '12px', color: PCOLORS.textMuted, textTransform: 'capitalize', flexShrink: 0 }}>{label}</p>
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12.5px', fontWeight: 600, color: PCOLORS.green, textDecoration: 'none', textAlign: 'right', wordBreak: 'break-word' }}>{value}</a>
        : <p style={{ fontSize: '12.5px', fontWeight: 600, color: PCOLORS.text, textAlign: 'right', wordBreak: 'break-word' }}>{value}</p>}
    </div>
  )
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: PCOLORS.card, borderRadius: '14px', padding: '14px', marginBottom: '12px' }}>
      <p style={{ fontSize: '13px', fontWeight: 800, color: PCOLORS.text, marginBottom: '8px' }}>{title}</p>
      {children}
    </div>
  )
}

export function Tags({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {items.map((t) => (
        <span key={t} style={{ background: PCOLORS.greenSoft, color: PCOLORS.greenDark, fontSize: '11.5px', fontWeight: 700, padding: '5px 10px', borderRadius: '999px' }}>{t}</span>
      ))}
    </div>
  )
}

// 3-column photo grid.
export function PhotoGrid({ images, empty }: { images: string[]; empty: string }) {
  if (images.length === 0) return <EmptyCard icon="leaf" text={empty} />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
      {images.map((src, i) => (
        <a key={`${src}-${i}`} href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', background: 'var(--fx-border)', borderRadius: '8px', overflow: 'hidden' }}>
          <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </a>
      ))}
    </div>
  )
}

export type ListingCardData = { id: string; title: string; price: number; unit: string | null; location?: string | null; images: string[] | null }

// 2-column marketplace card grid (same look as the Marketplace).
export function ListingGrid({ listings, formatPrice, onOpen, by }: { listings: ListingCardData[]; formatPrice: (n: number) => string; onOpen: (id: string) => void; by?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      {listings.map((l) => (
        <div key={l.id} onClick={() => onOpen(l.id)} style={{ background: PCOLORS.card, borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
          <div style={{ width: '100%', height: '90px', background: 'var(--fx-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {l.images?.[0] ? <img src={l.images[0]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={22} color={PCOLORS.green} />}
          </div>
          <div style={{ padding: '9px' }}>
            <p style={{ fontSize: '11.5px', fontWeight: 700, color: PCOLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
            <p style={{ fontSize: '12px', fontWeight: 800, color: PCOLORS.green, marginTop: '3px' }}>{formatPrice(Number(l.price))}{l.unit ? `/${l.unit}` : ''}</p>
            {l.location && <p style={{ fontSize: '10.5px', color: PCOLORS.textMuted, marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.location}</p>}
            {by && <p style={{ fontSize: '10px', color: PCOLORS.textMuted, marginTop: '3px' }}>by {by}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export const softLink: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', borderRadius: '10px',
  background: PCOLORS.greenSoft, color: PCOLORS.greenDark, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none',
}

// "Link copied" toast + copy helper.
export function useCopyLink() {
  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked */ }
  }
  const toast = copied ? (
    <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: '#1F2F21', color: 'white', fontSize: '12px', fontWeight: 600, padding: '9px 16px', borderRadius: '999px', zIndex: 30 }}>
      Link copied
    </div>
  ) : null
  return { copy, toast }
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

// Makes user text safe inside an ILIKE pattern.
export function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

// 1200 -> 1.2K, 10500 -> 10.5K
export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}
