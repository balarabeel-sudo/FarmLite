import type { CSSProperties, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../Icons'

// ---------------------------------------------------------------------------
// Privacy Policy
// Public on purpose (also reachable before sign up). The text describes only what the
// application really collects today, based on the code and the database schema.
//
// OWNER CHECKLIST BEFORE PUBLISHING
//  1. Fill every [PLACEHOLDER] below (company identity, privacy contact, dates).
//  2. Have a qualified Nigerian lawyer review the whole text against the NDPA 2023.
//  3. Set SHOW_DRAFT_FLAGS to false once reviewed to hide the review markers.
// Keep this page consistent with pages/TermsPage.tsx (minimum age, contact, deletion).
// ---------------------------------------------------------------------------

const SHOW_DRAFT_FLAGS = false

const EFFECTIVE_DATE = 'October 26, 2026'
const LAST_UPDATED = 'October 26, 2026'

// Fill these in when you want them shown in the Contact section. An empty value hides its row.
const LEGAL_NAME = ''
const REG_NUMBER = ''
const REG_ADDRESS = ''
const PRIVACY_EMAIL = ''
const DPO_NAME = ''

const COLORS = {
  bg: 'var(--fx-bg)',
  card: 'var(--fx-card)',
  border: 'var(--fx-border)',
  green: '#16A34A',
  greenDark: 'var(--fx-green-dark)',
  text: 'var(--fx-text)',
  textMuted: 'var(--fx-muted3)',
  amberBg: 'var(--fx-tint-amber2)',
  amberBorder: 'var(--fx-bd-amber)',
  amberText: 'var(--fx-amber-text)',
}

type Block = { p?: string; list?: string[]; sub?: string }
type Section = { id: string; title: string; review?: string; blocks: Block[] }

const SECTIONS: Section[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    blocks: [
      { p: 'Farmxie is an agriculture-focused platform that connects farmers, buyers, agricultural companies, equipment suppliers and experts. We want you to understand what personal information we collect, why we collect it, who can see it, and what choices you have.' },
      { p: 'This Privacy Policy applies to the Farmxie app and website. It should be read together with our Terms & Conditions. By using Farmxie you confirm that you have read this policy.' },
      { p: 'We handle personal information with care, collect what we need to run the platform, and do not sell your personal information.' },
    ],
  },
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    review: 'Confirm the full list of data categories and the lawful basis for each under the NDPA 2023.',
    blocks: [
      { sub: 'Information you give us', list: [
        'Account details: full name, username, email address and password (your password is handled by our sign-in system and is not visible to us). If you sign in with Google, we receive the basic details Google shares with us, such as your name and email address.',
        'Profile information: profile photo, cover photo, bio, role, location (a place you type yourself), country, phone and WhatsApp numbers, website and farm type, where you choose to add them.',
        'Content you create: posts, comments, photos, short videos, group content, listings for products and equipment, and messages you send to other users.',
        'Company information: business name, category, description, location and address, contact details, registration country, authority and number, a registration document, representative details, products, services and social links.',
        'Requests and reports: Farm Desk sourcing requests, reports you submit about content or users, and dispute reasons with photos you attach.',
        'FarmBot conversations: the questions you type to FarmBot and the answers it gives.',
        'Payment and bank details for withdrawals: bank name, account number and account name that you enter when you request a withdrawal.',
      ] },
      { sub: 'Information collected automatically', list: [
        'Activity and transaction records: wallet balance and transaction history, orders and order codes, Premium purchases and payment references, and advertising activity for companies.',
        'Usage information: likes, follows, saved items, notification choices, listing and company view counts, and FarmBot usage such as the topic of a question, whether it worked and how long it took.',
        'Presence: when you were last active in the app, which can be shown to other users, and whether your messages were delivered or read.',
        'Device information for notifications: if you turn on push notifications, we store a push address for your browser or device and its user-agent text so that we can send you alerts.',
        'Technical information: like most services, our hosting and service providers receive technical data such as your IP address, browser type and request logs when you use Farmxie.',
      ] },
      { p: 'Farmxie does not use your phone’s GPS or ask for your precise device location. Location on Farmxie is the text you type into your profile, listings or company page.' },
    ],
  },
  {
    id: 'how-we-use',
    title: 'How we use information',
    blocks: [
      { list: [
        'Create and manage your account and sign you in securely.',
        'Provide the features you use: profiles, posts, groups, messaging, marketplace, company pages, Farm Desk, Premium, wallet and FarmBot.',
        'Show your profile and content to other users as described in this policy.',
        'Operate the marketplace, including orders, escrow, disputes and withdrawals.',
        'Process payments and keep records of transactions.',
        'Provide FarmBot AI answers and enforce daily usage limits.',
        'Send notifications you have not turned off, such as messages, comments, orders and account updates.',
        'Prevent fraud, abuse and misuse, review reports, and enforce our Terms & Conditions.',
        'Improve reliability and understand how features are used, mostly through summaries and counts.',
        'Respond to support requests and meet legal obligations.',
      ] },
    ],
  },
  {
    id: 'public-information',
    title: 'Public and shared information',
    review: 'Uploaded photos and videos are stored in publicly readable storage. Counsel should confirm how this is described.',
    blocks: [
      { p: 'Farmxie is a social platform, so some information is visible to others:' },
      { list: [
        'Your profile: name, username, photo, cover, bio, role, verification and Premium badges, follower counts and the other details you add may be visible to other users.',
        'Your posts, comments, group activity, short videos, marketplace listings and equipment listings are visible to other users.',
        'Company pages, including business details and contact details that the company adds, are visible to users.',
        'Your last-active time may be visible to other users.',
        'Messages are visible to you and the person you message. They are not shown on your public profile.',
        'Your wallet, orders, bank details, FarmBot conversations and notification settings are private to your account and are not shown on your profile.',
      ] },
      { p: 'Photos and videos you upload are stored in storage that can be opened by anyone who has the file link. Do not upload documents or images that you do not want others to be able to open if the link is shared. Content you share can be copied or shared by other people.' },
    ],
  },
  {
    id: 'sharing',
    title: 'How we share information',
    review: 'Confirm processor agreements and roles of each provider with counsel.',
    blocks: [
      { p: 'We do not sell your personal information. We share it only in these ways:' },
      { sub: 'With other users', list: [
        'As described in the section on public and shared information, and as needed for a transaction, such as showing a seller the buyer’s order details.',
      ] },
      { sub: 'With service providers that help us run Farmxie', list: [
        'Supabase: database, sign-in, file storage and backend functions.',
        'Vercel: hosting of the app.',
        'Brevo: sending some account and staff-invitation emails.',
        'Google: sign-in with Google, if you choose it, and the AI model behind FarmBot (see the FarmBot section).',
        'A public exchange-rate service, which receives a standard web request from your device when the app fetches currency rates for display. No account details are sent in that request.',
        'Push notification services run by your browser or device maker, which deliver the alerts you turn on.',
        'These providers may only use information to provide services to us and under their own terms.',
      ] },
      { sub: 'With payment providers', list: [
        'Paystack processes wallet top-ups, Premium and advertising payments, and bank payouts for withdrawals. We share the information needed to process these, such as amount, reference, email and bank account details for a withdrawal.',
      ] },
      { sub: 'With authorities and for protection', list: [
        'We may disclose information when the law, a court or a competent authority requires it, or when needed to protect users, prevent fraud or defend legal claims. We try to disclose only what is needed.',
      ] },
      { p: 'If Farmxie is ever sold or reorganised, personal information may be transferred to the new owner, who must continue to protect it under this policy or tell you of changes.' },
    ],
  },
  {
    id: 'security',
    title: 'Data storage and security',
    review: 'Do not describe certifications or encryption standards unless verified by the technical owner.',
    blocks: [
      { p: 'Your information is stored in our Supabase database and storage, and the app is hosted on Vercel. We use access controls so that users can reach only the information they are allowed to see, and only authorised staff can use the admin tools. Connections to Farmxie use HTTPS.' },
      { p: 'No online service can be completely secure, and we cannot guarantee absolute security. Please use a strong password, keep it private, and tell us quickly if you suspect unauthorised access to your account.' },
    ],
  },
  {
    id: 'retention',
    title: 'Data retention',
    review: 'Specific retention periods have not been set. They must be defined with counsel and applied in practice.',
    blocks: [
      { p: 'We keep personal information for as long as your account is active and as long as needed for the purposes in this policy. How long we keep something depends on factors such as:' },
      { list: [
        'whether you still have an account or content;',
        'the type of information, for example posts versus transaction records;',
        'legal, tax, accounting and regulatory requirements;',
        'security, fraud prevention and dispute needs, including open orders, reports or investigations.',
      ] },
      { p: 'Some records, such as wallet transactions, orders and payment references, may need to be kept even after you ask for deletion. We keep them for as long as needed for legal, accounting, dispute and security purposes.' },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies and similar technologies',
    review: 'Confirm whether any consent notice is needed for stored items and the push service.',
    blocks: [
      { p: 'Farmxie uses browser storage and similar technologies only for features of the app. We do not currently use advertising cookies or third-party analytics trackers in the app code.' },
      { list: [
        'Sign-in session: our sign-in system keeps you signed in on your device.',
        'Local preferences: your chosen language and currency, whether you hide your wallet balance, and a short-lived cache of currency rates are saved in your browser.',
        'Temporary session data: some payment steps keep a reference in your browser for a short time so that they can finish after a redirect.',
        'App service worker: it supports app installation and push notifications.',
      ] },
      { p: 'You can clear this data in your browser settings, but some features may then stop working or will ask you to sign in again.' },
    ],
  },
  {
    id: 'farmbot',
    title: 'FarmBot AI and third-party services',
    review: 'Confirm the AI provider’s data terms (training, retention, location of processing) before publishing.',
    blocks: [
      { p: 'When you use FarmBot, the text of your questions (and recent conversation context needed to answer) is sent to an AI model provided by Google, through our backend, so that an answer can be generated. Our current provider is Google’s Gemini service.' },
      { list: [
        'We store your FarmBot conversations in your account so that you can see your history, and we record limited usage information such as the topic of a question, whether it succeeded and how long it took.',
        'Authorised staff may review FarmBot usage records to run, secure and improve the service and to check for misuse.',
        'We cannot promise that conversations are never stored or processed by the AI provider. Please do not enter sensitive personal information, passwords, bank details or confidential business information into FarmBot.',
        'FarmBot answers are for information only, as explained in the Terms & Conditions.',
      ] },
      { p: 'Other third-party services listed in the sharing section handle information under their own privacy terms.' },
    ],
  },
  {
    id: 'payments',
    title: 'Payments and financial information',
    review: 'Confirm roles of Farmxie and Paystack, and any regulatory record-keeping duties for wallet records.',
    blocks: [
      { list: [
        'Card payments are handled by Paystack on its own payment page. Farmxie does not receive or store your full card number.',
        'Farmxie stores wallet balances, wallet transactions, orders, escrow status, Premium and advertising payment records and references.',
        'For withdrawals, Farmxie stores the bank name, account number and account name you enter, the amount and the status, and shares the needed details with Paystack to make the payout. Authorised staff review withdrawal requests.',
        'Dispute evidence, such as written reasons and photos you add, is visible to the people involved and to authorised staff who resolve the dispute.',
      ] },
    ],
  },
  {
    id: 'rights',
    title: 'Your privacy rights',
    review: 'Rights, response times and exceptions must follow the NDPA 2023 and be confirmed by counsel.',
    blocks: [
      { p: 'Depending on the law that applies to you, including the Nigeria Data Protection Act 2023, you may have the right to:' },
      { list: [
        'access the personal information we hold about you;',
        'correct information that is wrong or incomplete (you can edit most profile details yourself in the app);',
        'ask us to delete your information;',
        'ask for a copy of your information;',
        'object to, or ask us to limit, certain uses of your information;',
        'withdraw your consent where we rely on it, for example for push notifications, which you can turn off in the notification settings;',
        'complain to the Nigeria Data Protection Commission if you think your rights were not respected.',
      ] },
      { p: 'These rights are not absolute and some exceptions apply, for example where we must keep records by law or to resolve a dispute. To make a request, contact us using the details at the end of this policy. We may need to confirm your identity first.' },
    ],
  },
  {
    id: 'account-deletion',
    title: 'Account deletion',
    review: 'There is no in-app account deletion yet. The approved deletion process must be defined before publishing.',
    blocks: [
      { p: 'Farmxie does not yet have a button to delete your account inside the app. To ask for your account to be deleted, use Contact Support on the Help & Support page. We may need to confirm that the request really comes from you, and we will reply as soon as we reasonably can.' },
      { p: 'When deletion is processed, we will remove or anonymise personal information we no longer need. Some information may be kept for the reasons in the data retention section, such as transaction records, open disputes, or legal and security needs. Posts and messages that you shared with others may remain visible to the other people involved until they are removed.' },
    ],
  },
  {
    id: 'children',
    title: 'Children’s privacy',
    review: 'The minimum age must match the Terms & Conditions and Nigerian law, including rules for children’s data.',
    blocks: [
      { p: 'Minimum age for Farmxie: you must be at least 18 years old to create an account.' },
      { p: 'Farmxie is not intended for children below that age, and we do not knowingly collect their personal information. If you believe a child has given us personal information, contact us and we will take steps to remove it.' },
    ],
  },
  {
    id: 'transfers',
    title: 'International data transfers',
    review: 'Cross-border transfer safeguards under the NDPA 2023 need confirmation by counsel.',
    blocks: [
      { p: 'Farmxie does not store all data in Nigeria. Our database and storage are hosted with Supabase in the eu-west-1 region (Europe), the app is delivered through Vercel’s global network, and providers such as Google, Brevo and Paystack may process information in other countries.' },
      { p: 'When information is transferred outside Nigeria, we rely on providers that apply data-protection safeguards and on the legal grounds permitted by applicable law. By using Farmxie you understand that your information may be processed in these locations.' },
    ],
  },
  {
    id: 'updates',
    title: 'Policy updates',
    blocks: [
      { p: 'We may update this policy when our practices or the law change. For important changes we will tell you through the app, by notification or by email, and we will update the “Last updated” date above.' },
      { p: 'Changes take effect on the date stated in the notice, normally after we give you reasonable notice, unless a faster change is required by law or for security. If you keep using Farmxie after that date, the updated policy applies to you.' },
    ],
  },
  {
    id: 'contact',
    title: 'Contact and privacy requests',
    review: 'Registered identity, privacy contact and any NDPA registration or DPO details must be provided by the owner.',
    blocks: [
      { p: 'For questions about this policy, or to make a privacy request, contact us using the details below.' },
    ],
  },
]

function Ph({ children }: { children: ReactNode }) {
  return <mark style={{ background: 'var(--fx-tint-amber)', color: COLORS.amberText, padding: '0 4px', borderRadius: '4px', fontWeight: 700 }}>{children}</mark>
}

// Turns "[PLACEHOLDER]" text into highlighted placeholders so the owner cannot miss them
function renderText(text: string): ReactNode {
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) => (/^\[[^\]]+\]$/.test(part) ? <Ph key={i}>{part}</Ph> : <span key={i}>{part}</span>))
}

export default function PrivacyPage() {
  const navigate = useNavigate()

  const goBack = () => {
    // Opened directly (for example from a shared link): there is no history to go back to
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    try { window.history.replaceState(window.history.state, '', `#${id}`) } catch { /* ignore */ }
    el.focus({ preventScroll: true })
  }

  const body: CSSProperties = { fontSize: '14.5px', lineHeight: 1.7, color: COLORS.text }
  const linkStyle: CSSProperties = { color: COLORS.greenDark, fontWeight: 700 }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: COLORS.card,
        position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          style={{ cursor: 'pointer', display: 'flex', background: 'none', border: 'none', padding: 0 }}>
          <Icon name="arrowLeft" size={22} color={COLORS.text} />
        </button>
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Privacy Policy</p>
      </div>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '20px 16px 48px' }}>
        <h1 style={{ fontSize: '26px', lineHeight: 1.25, fontWeight: 800, color: COLORS.text }}>Privacy Policy</h1>
        <p style={{ ...body, color: COLORS.textMuted, marginTop: '10px' }}>
          This policy explains what personal information Farmxie collects, how we use and share it, how we protect it, and the choices you have. See also our{' '}
          <Link to="/terms" style={linkStyle}>Terms &amp; Conditions</Link>.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: '12px', fontSize: '12.5px', color: COLORS.textMuted }}>
          <span><strong style={{ color: COLORS.text }}>Effective date:</strong> {renderText(EFFECTIVE_DATE)}</span>
          <span><strong style={{ color: COLORS.text }}>Last updated:</strong> {LAST_UPDATED}</span>
        </div>

        {SHOW_DRAFT_FLAGS && (
          <div role="note" style={{ marginTop: '16px', background: COLORS.amberBg, border: `1px solid ${COLORS.amberBorder}`, borderRadius: '12px', padding: '12px 14px', fontSize: '12.5px', lineHeight: 1.55, color: COLORS.amberText }}>
            <strong>Draft for owner review.</strong> This text has not been approved by a lawyer. Highlighted [PLACEHOLDERS] must be completed, and sections marked &ldquo;Legal review&rdquo; must be checked against the Nigeria Data Protection Act 2023 before publication.
          </div>
        )}

        <nav aria-label="Table of contents" style={{ marginTop: '22px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>Contents</p>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2px 20px' }}>
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => { e.preventDefault(); jump(s.id) }}
                  style={{ display: 'block', padding: '7px 0', fontSize: '14px', color: COLORS.greenDark, textDecoration: 'none', fontWeight: 600 }}>
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {SECTIONS.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            tabIndex={-1}
            aria-labelledby={`${s.id}-h`}
            style={{ marginTop: '28px', scrollMarginTop: '76px', outline: 'none' }}>
            <h2 id={`${s.id}-h`} style={{ fontSize: '19px', lineHeight: 1.3, fontWeight: 800, color: COLORS.text }}>
              {i + 1}. {s.title}
            </h2>
            {SHOW_DRAFT_FLAGS && s.review && (
              <p style={{ marginTop: '8px', display: 'inline-block', background: COLORS.amberBg, border: `1px solid ${COLORS.amberBorder}`, color: COLORS.amberText, borderRadius: '8px', padding: '4px 10px', fontSize: '11.5px', fontWeight: 700, lineHeight: 1.45 }}>
                Legal review: {s.review}
              </p>
            )}
            {s.blocks.map((b, bi) => (
              <div key={bi} style={{ marginTop: '10px' }}>
                {b.sub && <h3 style={{ fontSize: '15px', fontWeight: 800, color: COLORS.greenDark, marginBottom: '6px' }}>{b.sub}</h3>}
                {b.p && <p style={body}>{renderText(b.p)}</p>}
                {b.list && (
                  <ul style={{ ...body, margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
                    {b.list.map((item, li) => <li key={li}>{renderText(item)}</li>)}
                  </ul>
                )}
              </div>
            ))}

            {s.id === 'contact' && (
              <div style={{ marginTop: '14px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px', display: 'grid', gap: '6px', ...body }}>
                {LEGAL_NAME && <p><strong>Company:</strong> {LEGAL_NAME}</p>}
                {REG_NUMBER && <p><strong>Registration number:</strong> {REG_NUMBER}</p>}
                {REG_ADDRESS && <p><strong>Registered office:</strong> {REG_ADDRESS}</p>}
                {PRIVACY_EMAIL && <p><strong>Privacy contact:</strong> {PRIVACY_EMAIL}</p>}
                {DPO_NAME && <p><strong>Data protection officer:</strong> {DPO_NAME}</p>}
                <p>
                  <strong>Related:</strong>{' '}
                  <Link to="/terms" style={linkStyle}>Terms &amp; Conditions</Link>
                  {' '}| <Link to="/help" style={linkStyle}>Help &amp; Support</Link>
                </p>
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}
