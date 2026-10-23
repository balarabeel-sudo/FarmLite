import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Icon from './Icons'
import { COLORS } from './shared'
import CountryPicker from './CountryPicker'
import { buildE164, detectFromNumber, flagEmoji, formatDial, getCountry, parseE164 } from './countryData'
import type { Country } from './countryData'

type Props = {
  value: string // number in international format, e.g. "+2348012345678", or ""
  onChange: (e164: string) => void
  defaultCountry?: string // ISO code shown while no number is typed, e.g. the profile country
  placeholder?: string
  style?: CSSProperties
}

// A phone number field with a country-code button (flag and +234) like professional apps.
//  - Tap the code to choose another country from a searchable list.
//  - Type or paste a number that starts with + and the country is recognised automatically.
//  - A leading 0 on the local number is dropped, so 0801 234 5678 becomes +2348012345678.
export default function PhoneField({ value, onChange, defaultCountry = 'NG', placeholder = 'Phone number', style }: Props) {
  const initial = useMemo(() => parseE164(value), [])
  const [country, setCountry] = useState<Country>(() => initial.country || getCountry(defaultCountry) || (getCountry('NG') as Country))
  const [national, setNational] = useState(initial.national)
  const [open, setOpen] = useState(false)
  const lastEmitted = useRef(value)

  // Follow a change that comes from outside, for example when the saved profile finishes loading
  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    const p = parseE164(value)
    if (p.country) setCountry(p.country)
    setNational(p.national)
  }, [value])

  // With nothing typed yet, the code follows the default country
  useEffect(() => {
    if (national.trim() !== '') return
    const c = getCountry(defaultCountry)
    if (c) setCountry(c)
  }, [defaultCountry])

  const emit = (c: Country, n: string) => {
    const v = buildE164(c, n)
    lastEmitted.current = v
    onChange(v)
  }

  const handleInput = (raw: string) => {
    if (raw.trim().startsWith('+')) {
      const found = detectFromNumber(raw)
      if (found) {
        setCountry(found.country)
        setNational(found.national)
        emit(found.country, found.national)
      } else {
        // still typing the code after the +
        setNational(raw.replace(/[^\d+]/g, ''))
        emit(country, '')
      }
      return
    }
    const cleaned = raw.replace(/[^\d\s-]/g, '')
    setNational(cleaned)
    emit(country, cleaned)
  }

  const box: CSSProperties = {
    borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', ...style }}>
      <div
        role="button"
        onClick={() => setOpen(true)}
        aria-label="Choose country code"
        style={{ ...box, display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', cursor: 'pointer', flexShrink: 0 }}
      >
        <span style={{ fontSize: '18px' }}>{flagEmoji(country.code)}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{formatDial(country)}</span>
        <Icon name="chevronDown" size={14} color={COLORS.textMuted} />
      </div>
      <input
        value={national}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder}
        inputMode="tel"
        autoComplete="tel-national"
        style={{ ...box, flex: 1, minWidth: 0, padding: '10px 12px', fontSize: '13px', color: COLORS.text, outline: 'none' }}
      />
      <CountryPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(c) => {
          setCountry(c)
          setOpen(false)
          if (!national.startsWith('+')) emit(c, national)
        }}
        selected={country.code}
        title="Country code"
      />
    </div>
  )
}
