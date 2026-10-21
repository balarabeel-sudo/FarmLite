import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../Icons'
import { supabase } from '../supabaseClient'

// ---------------------------------------------------------------------------
// Help & Support
// - Help articles and FAQs below describe only features that exist in the app today.
// - Search really filters this content.
// - The "Contact Support" form is validated, but Farmxie has NO support backend yet
//   (no ticket table, no support email delivery). So the form never claims a request was
//   sent and never shows a ticket number. See submitSupportRequest() for the one place to
//   connect a real backend later.
// ---------------------------------------------------------------------------

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-dark)',
  greenSoft: 'var(--fx-tint-green3)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted3)',
  red: 'var(--fx-red-text)',
  redBg: 'var(--fx-tint-red2)',
  redBorder: 'var(--fx-bd-red)',
  amberBg: 'var(--fx-tint-amber2)',
  amberBorder: 'var(--fx-bd-amber)',
  amberText: 'var(--fx-amber-text)',
}

type Article = { id: string; cat: string; title: string; body: string[]; keywords?: string }
type Faq = { q: string; a: string; keywords?: string }

const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'account', label: 'Account & Profile', icon: 'user' },
  { id: 'marketplace', label: 'Marketplace', icon: 'cart' },
  { id: 'wallet', label: 'Wallet & Payments', icon: 'wallet' },
  { id: 'premium', label: 'Premium Membership', icon: 'crown' },
  { id: 'farmbot', label: 'FarmBot AI', icon: 'message' },
  { id: 'company', label: 'Company Pages', icon: 'building' },
  { id: 'community', label: 'Community & Groups', icon: 'users' },
  { id: 'safety', label: 'Safety & Security', icon: 'shield' },
]

const ARTICLES: Article[] = [
  // ---- Account & Profile
  { id: 'a1', cat: 'account', title: 'Creating an account', keywords: 'sign up register join google',
    body: [
      'Open the Sign Up page and enter your full name, email address and a password, then choose the role that fits you. A username is suggested from your name and you can change it.',
      'You can also continue with Google. Sign-in with TravelerCom and Telegram is shown on the page but is not available yet.',
      'You must accept the Terms to create an account.',
    ] },
  { id: 'a2', cat: 'account', title: 'Signing in', keywords: 'login log in email password google',
    body: [
      'Sign in with the email and password you registered with, or with Google if you created your account that way.',
      'If sign-in fails, check the email address for typing mistakes and make sure Caps Lock is off.',
    ] },
  { id: 'a3', cat: 'account', title: 'Resetting a password', keywords: 'forgot password reset recover',
    body: [
      'The sign-in page has a "Forgot password?" link, but the password reset page is not available yet, so a password cannot be reset from inside the app at the moment.',
      'If you signed in with Google, your password is managed by your Google account.',
    ] },
  { id: 'a4', cat: 'account', title: 'Updating profile information', keywords: 'edit profile photo cover bio username phone location',
    body: [
      'Go to Account, open My Profile, then choose Edit Profile. You can change your photo, cover photo, bio, location, phone and WhatsApp numbers, website and farm type.',
      'Your public profile shows what you add there. Your wallet, orders and bank details are private and are not shown on your profile.',
    ] },
  { id: 'a5', cat: 'account', title: 'Account security', keywords: 'password safe hacked protect',
    body: [
      'Use a strong password that you do not use anywhere else, and never share it or any code you receive with anyone, including people who say they work for Farmxie.',
      'Log out on shared devices using Account, then Log out. If you think someone else used your account, change your password in the place where you manage it and report it to support.',
    ] },

  // ---- Marketplace
  { id: 'm1', cat: 'marketplace', title: 'Creating product listings', keywords: 'sell add list product crop livestock seed equipment limit',
    body: [
      'Open the Sell page (Create Listing), pick a category and fill in the steps: details, price, photos, then review and publish. You can save a draft and finish later.',
      'Free accounts can have 3 active listings. Premium accounts can have 10.',
      'Describe your product honestly, with the real quantity, condition and price.',
    ] },
  { id: 'm2', cat: 'marketplace', title: 'Updating or removing listings', keywords: 'edit sold inactive delete listing status',
    body: [
      'Open Account, then My Profile, find your listing and choose edit. You can change the details and set the status, for example to Sold when the item is gone.',
      'Keep availability up to date so buyers are not misled.',
    ] },
  { id: 'm3', cat: 'marketplace', title: 'Uploading product images', keywords: 'photos pictures upload limit',
    body: [
      'Add photos in the photos step of the listing. Free accounts can add up to 5 photos per listing and Premium accounts up to 10.',
      'Use clear, recent photos of the real product. Photos you upload can be opened by anyone who has the file link.',
    ] },
  { id: 'm4', cat: 'marketplace', title: 'Contacting sellers', keywords: 'message chat buy seller dm',
    body: [
      'Open a listing and use the message option to chat with the seller inside Farmxie. Ask about quantity, quality and delivery before you pay.',
      'Keep your conversation and payment inside Farmxie so that escrow can protect the order.',
    ] },
  { id: 'm5', cat: 'marketplace', title: 'Reporting suspicious listings', keywords: 'report scam fake listing',
    body: [
      'Open the listing and choose "Report this listing", then pick a reason and add details. Our team reviews reports and may remove the listing.',
      'If you already paid for an order through Farmxie and there is a problem, open a dispute on the order instead (see Wallet & Payments).',
    ] },

  // ---- Wallet & Payments
  { id: 'w1', cat: 'wallet', title: 'Understanding wallet balances', keywords: 'balance available escrow pending held naira currency',
    body: [
      'Your wallet shows the money available to you and the money held in escrow for orders in progress. Wallet amounts are in Nigerian Naira (NGN); other currencies are shown for display only, using approximate rates.',
      'Money in escrow is not yet available to you or to the seller until the order is completed, cancelled or resolved.',
    ] },
  { id: 'w2', cat: 'wallet', title: 'Topping up and viewing transactions', keywords: 'top up fund deposit paystack history transactions',
    body: [
      'Open Wallet and choose Top Up. Payment is handled by Paystack. The maximum for one top-up is NGN 1,000,000.',
      'Choose History in your wallet to see your transactions, including escrow holds, releases, refunds and withdrawals.',
    ] },
  { id: 'w3', cat: 'wallet', title: 'Troubleshooting payment problems', keywords: 'payment failed not received missing paystack reference charged',
    body: [
      'If you paid but your balance did not change, return to the Wallet page and wait a moment: the payment is verified when you come back from the payment page.',
      'If it still does not appear, note the payment reference from your Paystack receipt or bank alert and keep it ready when you contact support.',
      'Never pay a seller outside Farmxie for an escrow order.',
    ] },
  { id: 'w4', cat: 'wallet', title: 'Understanding withdrawals', keywords: 'withdraw cash out bank minimum payout',
    body: [
      'In Wallet choose Withdraw, pick your bank and enter your account number. The minimum is NGN 1,000.',
      'The amount leaves your wallet when you request it. A staff member reviews the request before it is paid. If the request is cancelled, rejected or fails, the amount returns to your wallet.',
    ] },
  { id: 'w5', cat: 'wallet', title: 'Reporting transaction disputes', keywords: 'dispute escrow refund order cancel code deliver',
    body: [
      'Open Orders, choose the order and tap "Open dispute". Give a clear reason and add up to 4 photos. Staff review the evidence from both sides and decide whether the money is released to the seller or refunded to the buyer.',
      'Buyers set an expected delivery time when ordering. Before that time the order cannot be cancelled. After it, if the seller has not delivered, you can cancel and get the money back in your wallet.',
      'To complete a delivered order, the buyer gives the order code to the seller, who enters it on the order to receive payment. Only share the code when you have received the goods.',
    ] },

  // ---- Premium
  { id: 'p1', cat: 'premium', title: 'Understanding Premium benefits', keywords: 'premium benefits features badge limits videos',
    body: [
      'Farmxie Premium for users includes higher limits (10 active listings instead of 3, 10 photos per listing instead of 5, more FarmBot messages per day), a Premium badge and longer short videos (up to 60 seconds).',
      'The Premium page shows what is available now and marks anything that is "Coming soon". Premium does not guarantee sales, views or rankings.',
    ] },
  { id: 'p2', cat: 'premium', title: 'Upgrading a membership', keywords: 'upgrade buy subscribe premium pay',
    body: [
      'On the Account page use the Premium card, choose Upgrade, review the benefits, pick a duration and continue to payment. Premium turns on only after your payment is confirmed.',
      'Companies use Farmxie Company Premium from the company dashboard.',
    ] },
  { id: 'p3', cat: 'premium', title: 'Subscription duration and price', keywords: 'months price cost naira 1 3 6',
    body: [
      'You can buy 1, 3 or 6 months. For Nigeria, user Premium is NGN 1,500, 4,000 or 7,500, and Company Premium is NGN 15,000, 40,000 or 75,000. The exact price for your country is shown before you pay.',
    ] },
  { id: 'p4', cat: 'premium', title: 'Premium payment problems', keywords: 'premium payment failed not active charged',
    body: [
      'If you paid but Premium is not active, open the Premium page again; it checks your payment when you return. If it is still inactive, keep your payment reference and contact support.',
    ] },
  { id: 'p5', cat: 'premium', title: 'Cancellation and renewal', keywords: 'cancel renew auto renewal expire expired',
    body: [
      'Premium does not renew automatically. It is a prepaid period, so there is nothing to cancel. When it ends you can buy another period to renew.',
      'When Premium ends, your content is not deleted. Items above a free limit stay visible, but you cannot add new ones until you are under the limit.',
    ] },

  // ---- FarmBot
  { id: 'f1', cat: 'farmbot', title: 'How to use FarmBot', keywords: 'farmbot ai chat assistant limit messages daily',
    body: [
      'Open FarmBot from Account (FarmBot History) or the FarmBot page and type your question. Your past conversations are kept in your history.',
      'There is a daily message limit: 20 messages on a free account and 100 with Premium. The counter at the top shows how many you have used today.',
    ] },
  { id: 'f2', cat: 'farmbot', title: 'Asking agricultural questions', keywords: 'ask question crops pests livestock tips',
    body: [
      'Ask clear, specific questions and include useful details such as the crop or animal, your location and what you have already tried.',
      'Do not share passwords, bank details or other sensitive information in FarmBot.',
    ] },
  { id: 'f3', cat: 'farmbot', title: 'Understanding AI-generated information', keywords: 'ai accurate wrong verify professional advice',
    body: [
      'FarmBot is an AI assistant. Its answers are for information only and can be wrong or out of date.',
      'Verify important advice, especially about chemicals, doses, animal health and money, with a qualified agronomist, veterinarian or extension officer before you act.',
    ] },
  { id: 'f4', cat: 'farmbot', title: 'Reporting incorrect answers', keywords: 'wrong answer incorrect report feedback farmbot',
    body: [
      'FarmBot does not have a "report this answer" button yet. If an answer is harmful or clearly wrong, do not follow it, and tell us through Contact Support below, describing the question and the answer.',
    ] },

  // ---- Company Pages
  { id: 'c1', cat: 'company', title: 'Creating a company profile', keywords: 'register company business new page',
    body: [
      'From the Companies page choose to register a company. The steps ask for business information, registration details (country, authority, number and document), a representative and your company profile.',
      'Submit accurate information. The company starts under review.',
    ] },
  { id: 'c2', cat: 'company', title: 'Updating company information', keywords: 'edit company logo cover description contact',
    body: [
      'Company owners can switch to the company dashboard from the bottom of the Account page and use Edit to change the company profile, such as the logo, cover, description and contact details.',
    ] },
  { id: 'c3', cat: 'company', title: 'Displaying products and services', keywords: 'products services showcase featured',
    body: [
      'Add your products and services in the company profile so that they show on your company page. Keep claims truthful and do not claim certifications you do not hold.',
    ] },
  { id: 'c4', cat: 'company', title: 'Understanding company verification', keywords: 'verified badge trusted partner review pending rejected',
    body: [
      'A company is reviewed by Farmxie staff. The status can be pending, verified, rejected or needs review.',
      'Verified means Farmxie checked the business information submitted. Premium is a paid badge and is not an endorsement. Trusted Partner is granted by Farmxie and cannot be bought.',
    ] },
  { id: 'c5', cat: 'company', title: 'Premium company features', keywords: 'company premium ads featured analytics',
    body: [
      'Company Premium has its own page in the company dashboard, with the current benefits and any that are "Coming soon". Prepaid periods are 1, 3 or 6 months and do not renew automatically.',
    ] },

  // ---- Community & Groups
  { id: 'g1', cat: 'community', title: 'Creating posts', keywords: 'post share photo video update create',
    body: [
      'Use the + button in the bottom bar to write a post and add photos. You can also add a short video (Premium members can post longer ones).',
    ] },
  { id: 'g2', cat: 'community', title: 'Commenting and interacting', keywords: 'comment like reply follow save share',
    body: [
      'Open a post to like it, comment, reply to a comment, save it or share it. You can follow people and companies to see their updates.',
    ] },
  { id: 'g3', cat: 'community', title: 'Joining groups', keywords: 'group join create community',
    body: [
      'Open the Groups page, find a group and join it. You can also create your own group with a name and photo.',
    ] },
  { id: 'g4', cat: 'community', title: 'Reporting inappropriate content', keywords: 'report post comment video abuse harassment',
    body: [
      'Use the menu on a post, comment or video and choose Report, then choose a reason. Our team reviews reports and may remove content that breaks the rules.',
    ] },
  { id: 'g5', cat: 'community', title: 'Understanding community rules', keywords: 'rules guidelines behaviour allowed prohibited',
    body: [
      'Be respectful, be honest and keep agriculture claims truthful. Fraud, impersonation, harassment, illegal products and misleading claims are not allowed. See the Acceptable use section in the Terms & Conditions.',
      'A separate Community Guidelines page is not available yet.',
    ] },

  // ---- Safety & Security
  { id: 's1', cat: 'safety', title: 'Reporting suspicious accounts', keywords: 'fake account impersonation suspicious user report',
    body: [
      'You can report posts, comments, videos and listings from their menus. Reporting a user profile or company page directly is not available yet. For now, report their content, or describe the account in a support request.',
    ] },
  { id: 's2', cat: 'safety', title: 'Reporting scams', keywords: 'scam fraud money advance payment fake buyer',
    body: [
      'Warning signs include being asked to pay outside Farmxie, prices that are too good to be true, pressure to act fast and requests for your password or codes.',
      'Report the listing or post, and if money is in an escrow order, open a dispute on the order.',
    ] },
  { id: 's3', cat: 'safety', title: 'Protecting account credentials', keywords: 'password code secret share phishing',
    body: [
      'Never share your password, order code, or any verification code with anyone who is not the right person for the delivery. Farmxie staff will not ask for your password.',
    ] },
  { id: 's4', cat: 'safety', title: 'Understanding moderation decisions', keywords: 'moderation removed suspended banned appeal decision',
    body: [
      'Our team may remove content, limit features or suspend accounts that break the rules. See Moderation and enforcement in the Terms & Conditions.',
      'If you think a decision was wrong, contact support and explain. A dedicated in-app appeal process is not available yet.',
    ] },
]

const FAQS: Faq[] = [
  { q: 'Is Farmxie free to use?', a: 'Yes, creating an account, posting, browsing and using the marketplace are free. Premium is an optional paid upgrade with higher limits and extra features.', keywords: 'free cost price' },
  { q: 'Is my money safe when I buy on Farmxie?', a: 'When you pay for an order through your Farmxie wallet, the money is held in escrow until the order is completed, cancelled or resolved by staff. This does not guarantee product quality, and it does not cover payments made outside Farmxie.', keywords: 'escrow safe protection buy' },
  { q: 'How do I receive payment as a seller?', a: 'The buyer gives you the order code when the goods are delivered. Enter it on the order and the payment moves to your wallet. You can then request a withdrawal to your bank (minimum NGN 1,000).', keywords: 'seller payment code withdraw' },
  { q: 'How long does a withdrawal take?', a: 'Withdrawals are reviewed and approved by staff before they are paid. We have not set a fixed time, so please be patient and check the status in your wallet.', keywords: 'withdrawal time how long' },
  { q: 'Does Premium renew by itself?', a: 'No. Premium is prepaid for the period you choose (1, 3 or 6 months) and does not renew automatically.', keywords: 'premium renew automatic' },
  { q: 'What happens to my listings when Premium ends?', a: 'Nothing is deleted. If you have more than the free limit of 3 active listings, they stay visible, but you cannot add new ones until you are under the limit.', keywords: 'premium expire listings limit' },
  { q: 'Can I trust FarmBot answers?', a: 'FarmBot gives general information and can make mistakes. Always check important advice with a qualified agricultural professional.', keywords: 'farmbot trust ai accurate' },
  { q: 'Why can I not send more FarmBot messages?', a: 'There is a daily limit (20 on free accounts, 100 with Premium). It resets the next day.', keywords: 'farmbot limit messages' },
  { q: 'What does the Verified badge mean?', a: 'It means Farmxie checked the business information the company submitted. It is not a guarantee of the company’s products or conduct.', keywords: 'verified badge company' },
  { q: 'How do I report a problem with a seller?', a: 'Report the listing from its page. If you have an order in escrow, open a dispute on the order with a reason and photos.', keywords: 'report seller problem dispute' },
  { q: 'Can I delete my account?', a: 'There is no delete button in the app yet. See the Privacy Policy for the account deletion process once it is published.', keywords: 'delete account remove close' },
  { q: 'Who can see my information?', a: 'Your profile, posts, listings and company page can be seen by other users. Your wallet, orders, bank details and FarmBot chats are private to your account. Read the Privacy Policy for details.', keywords: 'privacy visible public' },
]

const SUPPORT_CATEGORIES = ['Account', 'Marketplace', 'Payments', 'Premium', 'FarmBot', 'Company Profile', 'Other']

type SupportInput = { subject: string; category: string; description: string }

// The single place to connect a real support backend (for example a support_tickets table with an
// RPC or Edge Function). Until that exists this must NOT report success and must NOT invent a ticket number.
async function submitSupportRequest(_input: SupportInput): Promise<{ ok: false; reason: 'not_configured' } | { ok: true; reference: string }> {
  return { ok: false, reason: 'not_configured' }
}

function matches(text: string, terms: string[]) {
  const hay = text.toLowerCase()
  return terms.every((t) => hay.includes(t))
}

function Accordion({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.bg}` }}>
      <h3 style={{ margin: 0 }}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-btn`}
          onClick={onToggle}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '14px', fontWeight: 700, color: COLORS.text, fontFamily: 'inherit' }}>
          <span style={{ flex: 1 }}>{title}</span>
          <span style={{ display: 'flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <Icon name="chevronDown" size={16} color={COLORS.textMuted} />
          </span>
        </button>
      </h3>
      {open && (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} style={{ padding: '0 14px 14px', fontSize: '13.5px', lineHeight: 1.65, color: COLORS.text, display: 'grid', gap: '8px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  const [supportEmail, setSupportEmail] = useState('')
  const [configLoaded, setConfigLoaded] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formNotice, setFormNotice] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)

  // Real support contact from Admin > Settings. Empty means support has not been configured yet.
  useEffect(() => {
    let alive = true
    supabase.rpc('get_platform_status').then(({ data, error }: { data: unknown; error: unknown }) => {
      if (!alive) return
      if (!error && data) {
        const email = (data as { support_email?: string }).support_email
        if (email) setSupportEmail(email)
      }
      setConfigLoaded(true)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!formOpen) return
    firstFieldRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const terms = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query])
  const searching = terms.length > 0

  const visibleArticles = useMemo(() => ARTICLES.filter((a) => {
    if (!searching && activeCat !== 'all' && a.cat !== activeCat) return false
    if (!searching) return true
    const catLabel = CATEGORIES.find((c) => c.id === a.cat)?.label ?? ''
    return matches(`${a.title} ${a.body.join(' ')} ${a.keywords ?? ''} ${catLabel}`, terms)
  }), [terms, searching, activeCat])

  const visibleFaqs = useMemo(() => FAQS.filter((f) => {
    if (!searching) return activeCat === 'all'
    return matches(`${f.q} ${f.a} ${f.keywords ?? ''}`, terms)
  }), [terms, searching, activeCat])

  const nothingFound = searching && visibleArticles.length === 0 && visibleFaqs.length === 0
  const toggle = (id: string) => setOpenIds((s) => ({ ...s, [id]: !s[id] }))
  const isOpen = (id: string) => !!openIds[id] || (searching && visibleArticles.length + visibleFaqs.length <= 3)

  const closeForm = () => {
    setFormOpen(false)
    openerRef.current?.focus()
  }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (subject.trim().length < 3) e.subject = 'Please enter a subject of at least 3 characters.'
    else if (subject.trim().length > 100) e.subject = 'The subject must be 100 characters or fewer.'
    if (!category) e.category = 'Please choose an issue category.'
    if (description.trim().length < 20) e.description = 'Please describe the problem in at least 20 characters so we can help.'
    else if (description.trim().length > 2000) e.description = 'The description must be 2000 characters or fewer.'
    return e
  }

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    setFormNotice(null)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return
    setSubmitting(true)
    try {
      const res = await submitSupportRequest({ subject: subject.trim(), category, description: description.trim() })
      if (res.ok) {
        setFormNotice({ kind: 'ok', text: `Your request was received. Reference: ${res.reference}` })
        setSubject(''); setCategory(''); setDescription('')
      } else {
        setFormNotice({
          kind: 'error',
          text: supportEmail
            ? `Support requests cannot be sent from the app yet, and nothing was sent. Please email ${supportEmail} instead.`
            : 'Support requests cannot be sent from the app yet, and nothing was sent. A support contact has not been set up.',
        })
      }
    } catch {
      setFormNotice({ kind: 'error', text: 'Something went wrong and your request was not sent. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const body: CSSProperties = { fontSize: '14px', lineHeight: 1.65, color: COLORS.text }
  const card: CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px' }
  const fieldBase: CSSProperties = { width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '11px 12px', fontSize: '14px', fontFamily: 'inherit', color: COLORS.text, background: 'var(--fx-card)', outline: 'none' }
  const linkStyle: CSSProperties = { color: COLORS.greenDark, fontWeight: 700 }
  const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? ''

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card,
        position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <button type="button" onClick={goBack} aria-label="Go back" style={{ cursor: 'pointer', display: 'flex', background: 'none', border: 'none', padding: 0 }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </button>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Help &amp; Support</p>
      </div>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '20px 16px 48px' }}>
        <h1 style={{ fontSize: '24px', lineHeight: 1.25, fontWeight: 800, color: COLORS.text }}>How can we help?</h1>
        <p style={{ ...body, color: COLORS.textMuted, marginTop: '8px' }}>
          Welcome to the Farmxie Help Center. Search for an answer or browse by topic.
        </p>

        <div style={{ position: 'relative', marginTop: '16px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}>
            <Icon name="search" size={18} color={COLORS.textMuted} />
          </span>
          <input
            type="search"
            aria-label="Search help articles and FAQs"
            placeholder="How can we help you?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...fieldBase, padding: '13px 12px 13px 38px', fontSize: '15px', borderRadius: '12px' }}
          />
        </div>

        {!searching && (
          <div role="tablist" aria-label="Help topics" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '14px 0 4px', WebkitOverflowScrolling: 'touch' }}>
            {[{ id: 'all', label: 'All topics', icon: 'helpCircle' }, ...CATEGORIES].map((c) => {
              const active = activeCat === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCat(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, padding: '8px 12px', borderRadius: '999px', cursor: 'pointer',
                    border: `1px solid ${active ? COLORS.green : COLORS.border}`, background: active ? COLORS.green : COLORS.card,
                    color: active ? '#fff' : COLORS.text, fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit',
                  }}>
                  <Icon name={c.icon} size={14} color={active ? '#fff' : COLORS.textMuted} />
                  {c.label}
                </button>
              )
            })}
          </div>
        )}

        <div aria-live="polite" style={{ marginTop: '10px' }}>
          {searching && !nothingFound && (
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted }}>
              {visibleArticles.length + visibleFaqs.length} result{visibleArticles.length + visibleFaqs.length === 1 ? '' : 's'} for &ldquo;{query.trim()}&rdquo;
            </p>
          )}
        </div>

        {nothingFound && (
          <div style={{ ...card, padding: '24px 16px', textAlign: 'center', marginTop: '10px' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>No results found</p>
            <p style={{ ...body, color: COLORS.textMuted, marginTop: '6px' }}>
              We could not find help for &ldquo;{query.trim()}&rdquo;. Try different words, or contact support below.
            </p>
            <button type="button" onClick={() => setQuery('')} style={{ marginTop: '12px', background: 'none', border: 'none', color: COLORS.green, fontWeight: 800, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Clear search
            </button>
          </div>
        )}

        {/* Help articles, grouped by category */}
        {(searching ? CATEGORIES : CATEGORIES.filter((c) => activeCat === 'all' || activeCat === c.id)).map((c) => {
          const items = visibleArticles.filter((a) => a.cat === c.id)
          if (items.length === 0) return null
          return (
            <section key={c.id} aria-labelledby={`cat-${c.id}`} style={{ marginTop: '20px' }}>
              <h2 id={`cat-${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                <Icon name={c.icon} size={15} color={COLORS.green} />
                {c.label}
              </h2>
              <div style={{ ...card, overflow: 'hidden' }}>
                {items.map((a) => (
                  <Accordion key={a.id} id={`art-${a.id}`} title={a.title} open={isOpen(a.id)} onToggle={() => toggle(a.id)}>
                    {a.body.map((para, i) => <p key={i}>{para}</p>)}
                  </Accordion>
                ))}
              </div>
            </section>
          )
        })}

        {/* FAQ */}
        <section aria-labelledby="faq-h" style={{ marginTop: '26px' }}>
          <h2 id="faq-h" style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text, marginBottom: '8px' }}>Frequently asked questions</h2>
          {visibleFaqs.length === 0 ? (
            !searching && activeCat !== 'all' ? (
              <p style={{ ...body, color: COLORS.textMuted }}>
                FAQs are shown under &ldquo;All topics&rdquo;.{' '}
                <button type="button" onClick={() => setActiveCat('all')} style={{ background: 'none', border: 'none', padding: 0, color: COLORS.green, fontWeight: 800, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>Show all</button>
              </p>
            ) : FAQS.length === 0 ? (
              <p style={{ ...body, color: COLORS.textMuted }}>No FAQs are available yet.</p>
            ) : (
              <p style={{ ...body, color: COLORS.textMuted }}>No FAQs match your search.</p>
            )
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {visibleFaqs.map((f, i) => (
                <Accordion key={f.q} id={`faq-${i}`} title={f.q} open={isOpen(`faq-${f.q}`)} onToggle={() => toggle(`faq-${f.q}`)}>
                  <p>{f.a}</p>
                </Accordion>
              ))}
            </div>
          )}
        </section>

        {/* Contact */}
        <section aria-labelledby="contact-h" style={{ ...card, marginTop: '26px', padding: '18px 16px' }}>
          <h2 id="contact-h" style={{ fontSize: '19px', fontWeight: 800, color: COLORS.text }}>Still need help?</h2>
          <p style={{ ...body, color: COLORS.textMuted, marginTop: '6px' }}>
            Tell us what went wrong and we will look into it.
          </p>

          {configLoaded && !supportEmail && (
            <div role="note" style={{ marginTop: '12px', background: COLORS.amberBg, border: `1px solid ${COLORS.amberBorder}`, color: COLORS.amberText, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', lineHeight: 1.5 }}>
              Support is not fully set up yet: no support contact has been configured, and requests cannot be sent from the app.
            </div>
          )}
          {supportEmail && (
            <p style={{ ...body, marginTop: '10px' }}>
              Support email: <a href={`mailto:${supportEmail}`} style={linkStyle}>{supportEmail}</a>
            </p>
          )}

          <button
            ref={openerRef}
            type="button"
            onClick={() => { setFormNotice(null); setFormOpen(true) }}
            style={{ marginTop: '14px', width: '100%', padding: '13px', background: COLORS.green, color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            Contact Support
          </button>

          <div style={{ marginTop: '16px', background: COLORS.greenSoft, border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.greenDark }}>Before you contact us</p>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px', ...body, fontSize: '13px', display: 'grid', gap: '4px' }}>
              <li>Describe the problem clearly: what you did, what you expected and what happened.</li>
              <li>Never share your password or any authentication code.</li>
              <li>For payment complaints, include the transaction or payment reference.</li>
              <li>Responses may take some time.</li>
            </ul>
          </div>
        </section>

        {/* Legal links */}
        <section aria-labelledby="legal-h" style={{ marginTop: '26px' }}>
          <h2 id="legal-h" style={{ fontSize: '13px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>Legal and policies</h2>
          <div style={{ ...card, padding: '14px 16px', display: 'grid', gap: '8px', ...body }}>
            <Link to="/terms" style={linkStyle}>Terms &amp; Conditions</Link>
            <Link to="/privacy" style={linkStyle}>Privacy Policy</Link>
            <p style={{ color: COLORS.textMuted }}>Community Guidelines: not available yet.</p>
          </div>
        </section>
      </main>

      {formOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeForm() }}>
          <div role="dialog" aria-modal="true" aria-labelledby="support-form-h" style={{ background: 'var(--fx-card)', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '18px 18px 0 0', padding: '18px 16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 id="support-form-h" style={{ fontSize: '18px', fontWeight: 800, color: COLORS.text }}>Contact Support</h2>
              <button type="button" onClick={closeForm} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}>
                <Icon name="close" size={20} color={COLORS.textMuted} />
              </button>
            </div>

            <div role="note" style={{ marginTop: '10px', background: COLORS.amberBg, border: `1px solid ${COLORS.amberBorder}`, color: COLORS.amberText, borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', lineHeight: 1.5 }}>
              Support requests cannot be sent from the app yet. You can fill in the form, but it will tell you honestly if it could not be sent.
            </div>

            <form onSubmit={onSubmit} noValidate style={{ marginTop: '14px', display: 'grid', gap: '14px' }}>
              <div>
                <label htmlFor="sp-subject" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Subject</label>
                <input
                  id="sp-subject"
                  ref={firstFieldRef}
                  value={subject}
                  maxLength={100}
                  onChange={(e) => setSubject(e.target.value)}
                  aria-invalid={!!errors.subject}
                  aria-describedby={errors.subject ? 'sp-subject-err' : undefined}
                  style={{ ...fieldBase, borderColor: errors.subject ? COLORS.red : COLORS.border }}
                />
                {errors.subject && <p id="sp-subject-err" role="alert" style={{ color: COLORS.red, fontSize: '12px', marginTop: '4px' }}>{errors.subject}</p>}
              </div>

              <div>
                <label htmlFor="sp-category" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Issue category</label>
                <select
                  id="sp-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-invalid={!!errors.category}
                  aria-describedby={errors.category ? 'sp-category-err' : undefined}
                  style={{ ...fieldBase, borderColor: errors.category ? COLORS.red : COLORS.border }}>
                  <option value="">Choose a category</option>
                  {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p id="sp-category-err" role="alert" style={{ color: COLORS.red, fontSize: '12px', marginTop: '4px' }}>{errors.category}</p>}
              </div>

              <div>
                <label htmlFor="sp-desc" style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: COLORS.text, marginBottom: '6px' }}>Description</label>
                <textarea
                  id="sp-desc"
                  rows={6}
                  value={description}
                  maxLength={2000}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? 'sp-desc-err' : 'sp-desc-hint'}
                  style={{ ...fieldBase, resize: 'vertical', borderColor: errors.description ? COLORS.red : COLORS.border }}
                />
                {errors.description
                  ? <p id="sp-desc-err" role="alert" style={{ color: COLORS.red, fontSize: '12px', marginTop: '4px' }}>{errors.description}</p>
                  : <p id="sp-desc-hint" style={{ color: COLORS.textMuted, fontSize: '12px', marginTop: '4px' }}>Do not include passwords or codes. Add a transaction reference for payment issues.</p>}
              </div>

              {formNotice && (
                <div
                  role={formNotice.kind === 'error' ? 'alert' : 'status'}
                  style={{
                    background: formNotice.kind === 'error' ? COLORS.redBg : COLORS.greenSoft,
                    border: `1px solid ${formNotice.kind === 'error' ? COLORS.redBorder : COLORS.border}`,
                    color: formNotice.kind === 'error' ? COLORS.red : COLORS.greenDark,
                    borderRadius: '10px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5, fontWeight: 600,
                  }}>
                  {formNotice.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ padding: '13px', background: submitting ? '#86EFAC' : COLORS.green, color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {submitting ? 'Sending...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
