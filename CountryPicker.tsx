import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Icon from './Icons'
import { COLORS, inputStyle } from './shared'
import { POPULAR_CODES, flagEmoji, formatDial, getCountry, searchCountries } from './countryData'
import type { Country } from './countryData'

type PickerProps = {
  open: boolean
  onClose: () => void
  onSelect: (c: Country) => void
  selected?: string | null // ISO code of the country that is selected now
  title?: string
  showDial?: boolean
}

// A searchable list of countries in a bottom sheet (a centered dialog on wide screens).
// Search by name, ISO code or dial code: "nig", "ng", "234" and "+234" all find Nigeria.
export default function CountryPicker({ open, onClose, onSelect, selected, title = 'Select country', showDial = true }: PickerProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open])

  const results = useMemo(() => searchCountries(query), [query])
  const popular = useMemo(() => POPULAR_CODES.map((c) => getCountry(c)).filter((c): c is Country => !!c), [])

  if (!open) return null

  const searching = query.trim() !== ''
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768

  const overlay: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: wide ? 'center' : 'flex-end', justifyContent: 'center',
  }
  const sheet: CSSProperties = {
    width: '100%', maxWidth: '480px', height: wide ? '70vh' : '82vh', background: COLORS.card,
    borderRadius: wide ? '20px' : '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
  }

  const pick = (c: Country) => onSelect(c)

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={sheet} role="dialog" aria-label={title}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 10px' }}>
          <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>{title}</p>
          <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }} aria-label="Close">
            <Icon name="close" size={20} color={COLORS.textMuted} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 16px 8px', padding: '0 12px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: COLORS.bg }}>
          <Icon name="search" size={16} color={COLORS.textMuted} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country or code"
            autoComplete="off"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', padding: '12px 0', fontSize: '16px', color: COLORS.text }}
          />
          {searching && (
            <div onClick={() => setQuery('')} style={{ cursor: 'pointer', display: 'flex' }} aria-label="Clear search">
              <Icon name="close" size={15} color={COLORS.textMuted} />
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '12px' }}>
          {!searching && (
            <>
              <p style={sectionLabel}>Popular</p>
              {popular.map((c) => <Row key={`p-${c.code}`} c={c} selected={selected} onPick={pick} showDial={showDial} />)}
              <p style={sectionLabel}>All countries</p>
            </>
          )}
          {results.map((c) => <Row key={c.code} c={c} selected={selected} onPick={pick} showDial={showDial} />)}
          {results.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: '13px', color: COLORS.textMuted, padding: '30px 16px' }}>
              No country found. Check the spelling or try the country code.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const sectionLabel: CSSProperties = {
  fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: COLORS.textMuted, padding: '10px 18px 4px',
}

function Row({ c, selected, onPick, showDial }: { c: Country; selected?: string | null; onPick: (c: Country) => void; showDial: boolean }) {
  const on = !!selected && selected.toUpperCase() === c.code
  return (
    <div
      onClick={() => onPick(c)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 18px', cursor: 'pointer', background: on ? 'var(--fx-tint-green3)' : 'transparent' }}
    >
      <span style={{ fontSize: '22px', width: '28px', textAlign: 'center', flexShrink: 0 }}>{flagEmoji(c.code)}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: on ? 800 : 600, color: COLORS.text }}>{c.name}</span>
      {showDial && <span style={{ fontSize: '12.5px', color: COLORS.textMuted, flexShrink: 0 }}>{formatDial(c)}</span>}
      {on && <Icon name="check" size={16} color={COLORS.green} />}
    </div>
  )
}

// A field that looks like the other inputs and opens the picker when tapped.
// value is the ISO code ("NG"); onChange gets the whole country.
export function CountryField({
  value, onChange, placeholder = 'Select your country', disabled, title, style,
}: {
  value?: string | null
  onChange: (c: Country) => void
  placeholder?: string
  disabled?: boolean
  title?: string
  style?: CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const c = getCountry(value)
  return (
    <>
      <div
        role="button"
        onClick={disabled ? undefined : () => setOpen(true)}
        style={{
          ...inputStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1, color: c ? COLORS.text : COLORS.textMuted, ...style,
        }}
      >
        <span style={{ fontSize: '18px' }}>{c ? flagEmoji(c.code) : '🌐'}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>{c ? c.name : placeholder}</span>
        <Icon name="chevronDown" size={16} color={COLORS.textMuted} />
      </div>
      <CountryPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(x) => { onChange(x); setOpen(false) }}
        selected={value}
        title={title}
        showDial={false}
      />
    </>
  )
}
