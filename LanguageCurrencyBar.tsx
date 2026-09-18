import { useLocale, Language, Currency } from './LocaleContext'
import Icon from './Icons'

const COLORS = {
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  text: '#1A2E1A',
}

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ha', label: 'Hausa' },
  { code: 'en', label: 'English' },
]

export default function LanguageCurrencyBar() {
  const { language, currency, currencies, setLanguage, setCurrency } = useLocale()

  return (
    <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '8px 10px' }}>
        <Icon name="globe" size={15} color={COLORS.green} />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{ border: 'none', background: 'transparent', fontSize: '12.5px', fontWeight: 700, color: COLORS.text, flex: 1, outline: 'none' }}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '8px 10px' }}>
        <Icon name="currency" size={15} color={COLORS.green} />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          style={{ border: 'none', background: 'transparent', fontSize: '12.5px', fontWeight: 700, color: COLORS.text, flex: 1, outline: 'none' }}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
