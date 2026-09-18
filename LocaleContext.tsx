import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Language = 'en' | 'ha'
export type Currency = 'NGN' | 'USD' | 'GHS' | 'KES'

const CURRENCIES: { code: Currency; symbol: string; flag: string }[] = [
  { code: 'NGN', symbol: '₦', flag: '🇳🇬' },
  { code: 'USD', symbol: '$', flag: '🌐' },
  { code: 'GHS', symbol: 'GH₵', flag: '🇬🇭' },
  { code: 'KES', symbol: 'KSh', flag: '🇰🇪' },
]

// Add more keys here as new screens need translation. Every key must exist
// in both "en" and "ha" or the fallback (English) is used silently.
const STRINGS = {
  en: {
    home: 'Home',
    marketplace: 'Marketplace',
    companies: 'Companies',
    groups: 'Groups',
    equipment: 'Equipment',
    saved: 'Saved',
    farmbot: 'FarmBot AI',
    profile: 'Profile',
    welcomeBack: 'Welcome back,',
    welcomeSubtitle: "Let's grow your farm and business today.",
    quickActions: 'Quick Actions',
    featuredToday: 'Featured Today',
    feed: 'Feed',
    viewAll: 'View all',
    signOut: 'Sign Out',
    editProfile: 'Edit Profile',
  },
  ha: {
    home: 'Gida',
    marketplace: 'Kasuwa',
    companies: 'Kamfanoni',
    groups: 'Kungiyoyi',
    equipment: 'Kayan Aiki',
    saved: 'Adana',
    farmbot: 'FarmBot AI',
    profile: 'Bayani',
    welcomeBack: 'Barka da dawowa,',
    welcomeSubtitle: 'Bari mu bunkasa gonarka da kasuwancinka yau.',
    quickActions: 'Ayyuka Masu Sauri',
    featuredToday: 'Fitattu A Yau',
    feed: 'Sabbin Labarai',
    viewAll: 'Duba duka',
    signOut: 'Fita',
    editProfile: 'Gyara Bayani',
  },
} as const

export type TranslationKey = keyof typeof STRINGS['en']

type LocaleContextValue = {
  language: Language
  currency: Currency
  currencies: typeof CURRENCIES
  setLanguage: (lang: Language) => void
  setCurrency: (cur: Currency) => void
  t: (key: TranslationKey) => string
  formatPrice: (amount: number) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const LANG_KEY = 'farmlite_language'
const CURRENCY_KEY = 'farmlite_currency'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')
  const [currency, setCurrencyState] = useState<Currency>('NGN')

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(LANG_KEY) as Language | null
      const savedCurrency = localStorage.getItem(CURRENCY_KEY) as Currency | null
      if (savedLang) setLanguageState(savedLang)
      if (savedCurrency) setCurrencyState(savedCurrency)
    } catch {
      // localStorage unavailable (e.g. private browsing) - defaults stand
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try { localStorage.setItem(LANG_KEY, lang) } catch {}
  }

  const setCurrency = (cur: Currency) => {
    setCurrencyState(cur)
    try { localStorage.setItem(CURRENCY_KEY, cur) } catch {}
  }

  const t = (key: TranslationKey) => STRINGS[language][key] ?? STRINGS.en[key]

  // NOTE: this only changes the displayed symbol/label, it does NOT convert
  // the underlying numeric value between currencies. Listings are stored in
  // whatever currency the seller chose (see marketplace_listings.currency);
  // real conversion needs a live exchange-rate source, which is a separate
  // task once this UI ships.
  const formatPrice = (amount: number) => {
    const meta = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0]
    return `${meta.symbol}${amount.toLocaleString()}`
  }

  return (
    <LocaleContext.Provider value={{ language, currency, currencies: CURRENCIES, setLanguage, setCurrency, t, formatPrice }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>')
  return ctx
}
