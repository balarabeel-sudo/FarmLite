import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Language = 'en' | 'fr' | 'ha' | 'ar' | 'zh'
export type Currency = 'NGN' | 'USD' | 'GHS' | 'KES'

// Each language is shown by its own name so people can always find theirs.
export const LANGUAGES: { code: Language; name: string; english: string; rtl?: boolean }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'fr', name: 'Français', english: 'French' },
  { code: 'ha', name: 'Hausa', english: 'Hausa' },
  { code: 'ar', name: 'العربية', english: 'Arabic', rtl: true },
  { code: 'zh', name: '中文', english: 'Chinese' },
]

const CURRENCIES: { code: Currency; symbol: string; flag: string }[] = [
  { code: 'NGN', symbol: '₦', flag: '🇳🇬' },
  { code: 'USD', symbol: '$', flag: '🌐' },
  { code: 'GHS', symbol: 'GH₵', flag: '🇬🇭' },
  { code: 'KES', symbol: 'KSh', flag: '🇰🇪' },
]

// English is the base. A key added here must be added to every other language below
// (TypeScript will refuse to build until it is). Screens that do not call t() yet stay in English.
const en = {
  // Navigation and Home
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
  market: 'Market',
  messages: 'Messages',
  account: 'Account',
  notifications: 'Notifications',
  videos: 'Videos',
  all: 'All',
  products: 'Products',
  update: 'Update',
  farmDeskTagline: "Tell Farmxie what you need. We'll help you find it.",
  postShortVideo: 'Post a short video',
  postShortVideoSub: 'Share a short video with the Farmxie community.',
  noVideos: 'No videos yet. Be the first to post one!',
  // Account page
  myProfile: 'My Profile',
  farmxieUser: 'Farmxie user',
  wallet: 'Wallet',
  myAds: 'My Ads',
  farmbotHistory: 'FarmBot History',
  analytics: 'Analytics',
  settings: 'Settings',
  appearance: 'Appearance',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  privacySecurity: 'Privacy & Security',
  currency: 'Currency',
  language: 'Language',
  helpSupport: 'Help & Support',
  terms: 'Terms & Conditions',
  privacyPolicy: 'Privacy Policy',
  deleteAccount: 'Delete account',
  logOut: 'Log out',
  comingSoon: 'Coming soon',
  switchCompany: 'Switch to Company Dashboard',
  openAdmin: 'Open Admin Console',
  premiumExpired: 'Premium Expired',
  unlockMore: 'Unlock more tools and insights.',
  premiumActiveText: 'Your Premium membership is active.',
  activeUntil: 'Active until {date}',
  endedOn: 'Ended on {date}. Your data is safe.',
  upgradePremium: 'Upgrade to Premium',
  extendPremium: 'Extend Premium',
  renewPremium: 'Renew Premium',
  viewBenefits: 'View Benefits',
} as const

export type TranslationKey = keyof typeof en
type Dict = Record<TranslationKey, string>

const fr: Dict = {
  home: 'Accueil',
  marketplace: 'Marché',
  companies: 'Entreprises',
  groups: 'Groupes',
  equipment: 'Équipement',
  saved: 'Enregistrés',
  farmbot: 'FarmBot IA',
  profile: 'Profil',
  welcomeBack: 'Bon retour,',
  welcomeSubtitle: "Faisons grandir votre ferme et votre activité aujourd'hui.",
  quickActions: 'Actions rapides',
  featuredToday: "À la une aujourd'hui",
  feed: "Fil d'actualité",
  viewAll: 'Voir tout',
  signOut: 'Se déconnecter',
  editProfile: 'Modifier le profil',
  market: 'Marché',
  messages: 'Messages',
  account: 'Compte',
  notifications: 'Notifications',
  videos: 'Vidéos',
  all: 'Tout',
  products: 'Produits',
  update: 'Nouveautés',
  farmDeskTagline: 'Dites à Farmxie ce dont vous avez besoin. Nous vous aidons à le trouver.',
  postShortVideo: 'Publier une courte vidéo',
  postShortVideoSub: 'Partagez une courte vidéo avec la communauté Farmxie.',
  noVideos: "Aucune vidéo pour l'instant. Soyez le premier à en publier une !",
  myProfile: 'Mon profil',
  farmxieUser: 'Utilisateur Farmxie',
  wallet: 'Portefeuille',
  myAds: 'Mes annonces',
  farmbotHistory: 'Historique FarmBot',
  analytics: 'Statistiques',
  settings: 'Paramètres',
  appearance: 'Apparence',
  light: 'Clair',
  dark: 'Sombre',
  system: 'Système',
  privacySecurity: 'Confidentialité et sécurité',
  currency: 'Devise',
  language: 'Langue',
  helpSupport: 'Aide et assistance',
  terms: 'Conditions générales',
  privacyPolicy: 'Politique de confidentialité',
  deleteAccount: 'Supprimer le compte',
  logOut: 'Se déconnecter',
  comingSoon: 'Bientôt',
  switchCompany: "Passer au tableau de bord de l'entreprise",
  openAdmin: "Ouvrir la console d'administration",
  premiumExpired: 'Premium expiré',
  unlockMore: "Débloquez plus d'outils et d'analyses.",
  premiumActiveText: 'Votre abonnement Premium est actif.',
  activeUntil: "Actif jusqu'au {date}",
  endedOn: 'Terminé le {date}. Vos données sont en sécurité.',
  upgradePremium: 'Passer à Premium',
  extendPremium: 'Prolonger Premium',
  renewPremium: 'Renouveler Premium',
  viewBenefits: 'Voir les avantages',
}

const ha: Dict = {
  home: 'Gida',
  marketplace: 'Kasuwa',
  companies: 'Kamfanoni',
  groups: 'Ƙungiyoyi',
  equipment: 'Kayan aiki',
  saved: 'Abubuwan da aka ajiye',
  farmbot: 'FarmBot AI',
  profile: 'Bayanan martaba',
  welcomeBack: 'Barka da dawowa,',
  welcomeSubtitle: 'Mu bunƙasa gonarka da kasuwancinka yau.',
  quickActions: 'Hanyoyi masu sauri',
  featuredToday: 'Zaɓaɓɓu na yau',
  feed: 'Labarai',
  viewAll: 'Duba duka',
  signOut: 'Fita',
  editProfile: 'Gyara bayanan martaba',
  market: 'Kasuwa',
  messages: 'Saƙonni',
  account: 'Asusu',
  notifications: 'Sanarwa',
  videos: 'Bidiyo',
  all: 'Duka',
  products: 'Kayayyaki',
  update: 'Sabbi',
  farmDeskTagline: 'Faɗa wa Farmxie abin da kake buƙata. Za mu taimaka maka ka same shi.',
  postShortVideo: 'Saka gajeren bidiyo',
  postShortVideoSub: 'Raba gajeren bidiyo da al’ummar Farmxie.',
  noVideos: 'Babu bidiyo tukuna. Ka zama na farko da zai saka!',
  myProfile: 'Bayanan martaba na',
  farmxieUser: 'Mai amfani da Farmxie',
  wallet: 'Walat',
  myAds: 'Tallace-tallacena',
  farmbotHistory: 'Tarihin FarmBot',
  analytics: 'Alƙaluma',
  settings: 'Saituna',
  appearance: 'Bayyanar app',
  light: 'Haske',
  dark: 'Duhu',
  system: 'Na waya',
  privacySecurity: 'Sirri da Tsaro',
  currency: 'Kuɗi',
  language: 'Harshe',
  helpSupport: 'Taimako',
  terms: 'Sharuɗɗa da Ƙa’idoji',
  privacyPolicy: 'Manufar Sirri',
  deleteAccount: 'Share asusu',
  logOut: 'Fita',
  comingSoon: 'Nan ba da jimawa ba',
  switchCompany: 'Koma Dashboard ɗin Kamfani',
  openAdmin: 'Buɗe Dashboard ɗin Admin',
  premiumExpired: 'Premium ya ƙare',
  unlockMore: 'Buɗe ƙarin kayan aiki da bayanai.',
  premiumActiveText: 'Memba ɗin Premium naka yana aiki.',
  activeUntil: 'Yana aiki har zuwa {date}',
  endedOn: 'Ya ƙare a {date}. Bayananka suna nan lafiya.',
  upgradePremium: 'Haɓaka zuwa Premium',
  extendPremium: 'Ƙara wa’adin Premium',
  renewPremium: 'Sabunta Premium',
  viewBenefits: 'Duba amfanin',
}

const ar: Dict = {
  home: 'الرئيسية',
  marketplace: 'السوق',
  companies: 'الشركات',
  groups: 'المجموعات',
  equipment: 'المعدات',
  saved: 'المحفوظات',
  farmbot: 'FarmBot الذكي',
  profile: 'الملف الشخصي',
  welcomeBack: 'مرحبًا بعودتك،',
  welcomeSubtitle: 'لننمِّ مزرعتك وأعمالك اليوم.',
  quickActions: 'إجراءات سريعة',
  featuredToday: 'مميز اليوم',
  feed: 'آخر المنشورات',
  viewAll: 'عرض الكل',
  signOut: 'تسجيل الخروج',
  editProfile: 'تعديل الملف الشخصي',
  market: 'السوق',
  messages: 'الرسائل',
  account: 'الحساب',
  notifications: 'الإشعارات',
  videos: 'الفيديوهات',
  all: 'الكل',
  products: 'المنتجات',
  update: 'التحديثات',
  farmDeskTagline: 'أخبر Farmxie بما تحتاجه. سنساعدك في العثور عليه.',
  postShortVideo: 'انشر فيديو قصيرًا',
  postShortVideoSub: 'شارك فيديو قصيرًا مع مجتمع Farmxie.',
  noVideos: 'لا توجد فيديوهات بعد. كن أول من ينشر!',
  myProfile: 'ملفي الشخصي',
  farmxieUser: 'مستخدم Farmxie',
  wallet: 'المحفظة',
  myAds: 'إعلاناتي',
  farmbotHistory: 'سجل FarmBot',
  analytics: 'التحليلات',
  settings: 'الإعدادات',
  appearance: 'المظهر',
  light: 'فاتح',
  dark: 'داكن',
  system: 'النظام',
  privacySecurity: 'الخصوصية والأمان',
  currency: 'العملة',
  language: 'اللغة',
  helpSupport: 'المساعدة والدعم',
  terms: 'الشروط والأحكام',
  privacyPolicy: 'سياسة الخصوصية',
  deleteAccount: 'حذف الحساب',
  logOut: 'تسجيل الخروج',
  comingSoon: 'قريبًا',
  switchCompany: 'التبديل إلى لوحة الشركة',
  openAdmin: 'فتح لوحة الإدارة',
  premiumExpired: 'انتهى اشتراك Premium',
  unlockMore: 'افتح المزيد من الأدوات والتحليلات.',
  premiumActiveText: 'عضويتك في Premium نشطة.',
  activeUntil: 'نشط حتى {date}',
  endedOn: 'انتهى في {date}. بياناتك آمنة.',
  upgradePremium: 'الترقية إلى Premium',
  extendPremium: 'تمديد Premium',
  renewPremium: 'تجديد Premium',
  viewBenefits: 'عرض المزايا',
}

const zh: Dict = {
  home: '首页',
  marketplace: '市场',
  companies: '企业',
  groups: '群组',
  equipment: '设备',
  saved: '已保存',
  farmbot: 'FarmBot 智能助手',
  profile: '个人资料',
  welcomeBack: '欢迎回来，',
  welcomeSubtitle: '今天一起发展你的农场和事业。',
  quickActions: '快捷操作',
  featuredToday: '今日精选',
  feed: '动态',
  viewAll: '查看全部',
  signOut: '退出登录',
  editProfile: '编辑资料',
  market: '市场',
  messages: '消息',
  account: '账户',
  notifications: '通知',
  videos: '视频',
  all: '全部',
  products: '产品',
  update: '更新',
  farmDeskTagline: '告诉 Farmxie 你需要什么，我们帮你找到。',
  postShortVideo: '发布短视频',
  postShortVideoSub: '与 Farmxie 社区分享一段短视频。',
  noVideos: '还没有视频，快来发布第一个吧！',
  myProfile: '我的资料',
  farmxieUser: 'Farmxie 用户',
  wallet: '钱包',
  myAds: '我的广告',
  farmbotHistory: 'FarmBot 历史记录',
  analytics: '数据分析',
  settings: '设置',
  appearance: '外观',
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
  privacySecurity: '隐私与安全',
  currency: '货币',
  language: '语言',
  helpSupport: '帮助与支持',
  terms: '条款与条件',
  privacyPolicy: '隐私政策',
  deleteAccount: '删除账户',
  logOut: '退出登录',
  comingSoon: '即将推出',
  switchCompany: '切换到企业仪表盘',
  openAdmin: '打开管理控制台',
  premiumExpired: 'Premium 已过期',
  unlockMore: '解锁更多工具和数据洞察。',
  premiumActiveText: '你的 Premium 会员已生效。',
  activeUntil: '有效期至 {date}',
  endedOn: '已于 {date} 结束。你的数据是安全的。',
  upgradePremium: '升级到 Premium',
  extendPremium: '延长 Premium',
  renewPremium: '续订 Premium',
  viewBenefits: '查看权益',
}

const DICTS: Record<Language, Dict> = { en, fr, ha, ar, zh }

type LocaleContextValue = {
  language: Language
  currency: Currency
  currencies: typeof CURRENCIES
  languages: typeof LANGUAGES
  dir: 'ltr' | 'rtl'
  setLanguage: (lang: Language) => void
  setCurrency: (cur: Currency) => void
  t: (key: TranslationKey, vars?: Record<string, string>) => string
  formatPrice: (amount: number) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const LANG_KEY = 'farmlite_language'
const CURRENCY_KEY = 'farmlite_currency'

function isLanguage(v: unknown): v is Language {
  return typeof v === 'string' && LANGUAGES.some((l) => l.code === v)
}

// Read the saved choice before the first paint so the app never flashes English first.
function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // localStorage unavailable (e.g. private browsing) - English stands
  }
  return 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readLanguage)
  const [currency, setCurrencyState] = useState<Currency>('NGN')

  useEffect(() => {
    try {
      const savedCurrency = localStorage.getItem(CURRENCY_KEY) as Currency | null
      if (savedCurrency) setCurrencyState(savedCurrency)
    } catch {
      // localStorage unavailable - defaults stand
    }
  }, [])

  const dir: 'ltr' | 'rtl' = LANGUAGES.find((l) => l.code === language)?.rtl ? 'rtl' : 'ltr'

  // Tell the browser which language the page is in, and flip the layout for Arabic.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [language, dir])

  const setLanguage = (lang: Language) => {
    if (!isLanguage(lang)) return
    setLanguageState(lang)
    try { localStorage.setItem(LANG_KEY, lang) } catch {}
  }

  const setCurrency = (cur: Currency) => {
    setCurrencyState(cur)
    try { localStorage.setItem(CURRENCY_KEY, cur) } catch {}
  }

  const t = (key: TranslationKey, vars?: Record<string, string>) => {
    let text: string = DICTS[language][key] ?? en[key]
    if (vars) {
      for (const name of Object.keys(vars)) text = text.split(`{${name}}`).join(vars[name])
    }
    return text
  }

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
    <LocaleContext.Provider value={{ language, currency, currencies: CURRENCIES, languages: LANGUAGES, dir, setLanguage, setCurrency, t, formatPrice }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>')
  return ctx
}
