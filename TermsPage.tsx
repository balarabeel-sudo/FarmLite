import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icons'

// ---------------------------------------------------------------------------
// Terms & Conditions
// Public on purpose (also linked from Sign Up). Content describes only what the
// platform really does today. Anything not built yet is labelled "planned".
//
// OWNER CHECKLIST BEFORE PUBLISHING
//  1. Fill every [PLACEHOLDER] below (company identity, contact, dates).
//  2. Have a qualified Nigerian lawyer review the whole text.
//  3. Set SHOW_DRAFT_FLAGS to false once reviewed to hide the review markers.
// ---------------------------------------------------------------------------

const SHOW_DRAFT_FLAGS = true

const EFFECTIVE_DATE = '[EFFECTIVE DATE: to be set by the owner at publication]'
const LAST_UPDATED = 'October 15, 2026 (draft)'

const LEGAL_NAME = '[REGISTERED COMPANY NAME]'
const REG_NUMBER = '[CAC REGISTRATION NUMBER]'
const REG_ADDRESS = '[REGISTERED OFFICE ADDRESS]'
const CONTACT_EMAIL = '[OFFICIAL LEGAL CONTACT EMAIL]'
const SUPPORT_EMAIL = '[SUPPORT EMAIL]'
const GOVERNING_STATE = '[STATE / COURT JURISDICTION IN NIGERIA]'

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

type Block = { p?: string; list?: string[]; sub?: string; ph?: boolean }
type Section = { id: string; title: string; review?: string; blocks: Block[] }

const SECTIONS: Section[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    blocks: [
      { p: 'Farmxie is an agriculture-focused digital platform that connects farmers, buyers, agricultural businesses, agricultural experts, equipment suppliers and other participants in the agricultural ecosystem.' },
      { p: 'Through Farmxie you can create an account and profile, share posts and join community discussions, buy and sell products in the Marketplace, browse company pages and equipment, join groups, ask the FarmBot AI assistant questions, use a wallet, request sourcing help through Farm Desk, and subscribe to Premium.' },
      { p: 'By creating an account or by accessing or using Farmxie, you agree to these Terms & Conditions and to any additional rules shown inside a specific feature (for example Marketplace or Premium rules). If you do not agree, please do not use the platform.' },
      { p: 'Our handling of personal data is described separately in the Farmxie Privacy Policy.' },
    ],
  },
  {
    id: 'eligibility',
    title: 'Eligibility and account responsibilities',
    review: 'Minimum age and handling of minors must be confirmed with counsel under Nigerian law.',
    blocks: [
      { p: 'To use Farmxie you must be able to enter into a binding agreement under the laws that apply to you. You may not use Farmxie if you have been permanently removed from it, or if the law prohibits you from using it.' },
      { p: 'Minimum age: [MINIMUM AGE TO BE CONFIRMED BY THE OWNER AFTER LEGAL REVIEW].', ph: true },
      { sub: 'Your account', list: [
        'Give accurate and current information when you register, and keep it up to date.',
        'Keep your password and login details private. Tell us promptly if you think someone else has accessed your account.',
        'You are responsible for activity carried out through your account, unless it results from our own error.',
        'One person should not run multiple accounts to avoid a restriction or to mislead others.',
        'If you act for a business, you confirm that you are authorised to act for it.',
      ] },
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    blocks: [
      { p: 'Farmxie must remain a safe and trustworthy place for agriculture. You agree not to:' },
      { list: [
        'commit or attempt fraud, run scams, or take payment for goods or services you do not intend to deliver;',
        'impersonate another person, company, expert or Farmxie staff, or falsely claim a badge, qualification or affiliation;',
        'harass, threaten, bully, discriminate against or otherwise abuse other users;',
        'post misleading agricultural claims, including false claims about yield, quality, origin, certification, disease control or the effect of a product;',
        'list, advertise or trade illegal, counterfeit, banned, unsafe or restricted products, including agrochemicals, seeds, animals or equipment that you are not legally allowed to sell;',
        'upload malicious code, scrape the platform at scale, or try to access accounts, data or systems you are not authorised to use;',
        'manipulate likes, reviews, reports, rankings or advertising results;',
        'use Farmxie or FarmBot to break the law or to harm people, animals or the environment.',
      ] },
    ],
  },
  {
    id: 'user-content',
    title: 'User-generated content',
    review: 'Licence scope and takedown wording should be reviewed together with the Privacy Policy.',
    blocks: [
      { p: 'You keep ownership of the content you create and post on Farmxie, such as text, photos, videos, listings and messages. Farmxie does not claim ownership of your original content.' },
      { p: 'To run the service, you give Farmxie a non-exclusive, worldwide, royalty-free licence to host, store, display, reproduce for technical purposes and distribute your content inside Farmxie, in line with your privacy and visibility choices. This licence exists only so that the platform can operate, and it ends when your content is deleted, except where copies are retained for a limited time in backups or where the content has been shared by other users.' },
      { p: 'You confirm that you own your content or have the right to post it, and that it does not break the law or the rights of others.' },
      { sub: 'When content may be removed', list: [
        'it breaks these Terms or our policies;',
        'it is reported and found to be harmful, unlawful, misleading or infringing;',
        'we are required to remove it by law or by a competent authority;',
        'it creates a risk of harm to users or to the platform.',
      ] },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace rules',
    review: 'Marketplace liability, consumer protection and refund wording need legal review.',
    blocks: [
      { p: 'The Marketplace lets users list and buy agricultural products and equipment. Farmxie provides the space for listings and, where described in the Payments section, tools that help with payment. Unless clearly stated otherwise, the sale is an agreement between the buyer and the seller, not with Farmxie.' },
      { sub: 'Sellers must', list: [
        'describe products honestly and completely, including type, quantity, quality, condition and location;',
        'show a fair price and keep availability up to date, removing or marking items that are sold;',
        'have the legal right to sell the product and comply with applicable rules for it;',
        'deliver what was agreed, within the agreed time, and respond to buyers in good faith.',
      ] },
      { sub: 'Buyers must', list: [
        'read the listing carefully and ask questions before ordering;',
        'pay for what they order and cooperate on delivery or pick-up;',
        'inspect goods on delivery and raise any problem promptly.',
      ] },
      { sub: 'Delivery, cancellations, refunds and disputes', list: [
        'Delivery arrangements are agreed between buyer and seller. Farmxie does not carry or deliver goods.',
        'For orders paid through escrow, the rules in the Payments section apply to cancellation, release and refund.',
        'For other transactions, refunds and returns are decided between buyer and seller, and nothing here removes any right you have under the law.',
        'You can report a listing or a user. Farmxie may review reports and take the actions described under Moderation and enforcement.',
      ] },
      { p: 'Farmxie does not guarantee any seller, product, transaction or agricultural claim, and does not inspect goods, unless a specific verification process stated on the platform says otherwise. A verification badge confirms only what the badge itself says it confirms.' },
    ],
  },
  {
    id: 'payments',
    title: 'Payments, wallet and escrow',
    review: 'Payments, escrow, wallet and any regulated-activity questions (for example licensing) must be confirmed by counsel before launch.',
    blocks: [
      { p: 'This section describes only the features that exist in Farmxie today. Features are clearly separated into available and planned.' },
      { sub: 'Available today', list: [
        'Wallet: every account has a wallet. You can top up through our payment partner Paystack. Wallet amounts are held in Nigerian Naira (NGN); other currencies shown in the app are for display only, using approximate exchange rates. When you buy a listing priced in another currency with Escrow, you pay in NGN at the exchange rate shown at checkout, and that rate is locked when you place the order.',
        'Escrow: when you pay for a Marketplace order from your wallet, the amount is held in escrow instead of going to the seller at once. The buyer sets an expected delivery time when ordering. The seller receives the money after the buyer gives the seller the order code and the seller verifies it.',
        'Cancellation: the buyer cannot cancel before the expected delivery time. After that time, if the seller has not delivered, the buyer can cancel and the held amount is returned to the buyer’s wallet.',
        'Disputes: either side can open a dispute with a written reason and up to four photos. Farmxie staff review the evidence and decide whether the money is released to the seller or refunded to the buyer. That decision is final within the platform, without limiting your legal rights.',
        'Farm Desk: for sourcing requests, staff may request a payment which you can pay from your wallet. Refunds to your wallet are made by staff where appropriate.',
        'Withdrawals: you can request a withdrawal from your wallet to a bank account. The minimum is NGN 1,000. The amount leaves your wallet when you request it and is returned if the request is cancelled, rejected or fails. Withdrawals are reviewed and approved by Farmxie staff before they are paid.',
      ] },
      { sub: 'Fees', list: [
        'At the date of these Terms, Farmxie does not charge a transaction fee on wallet top-ups, escrow orders or withdrawals. Your bank or payment provider may charge its own fees.',
        'If Farmxie introduces fees in future, they will be shown before you confirm the action and these Terms will be updated.',
      ] },
      { sub: 'Important notes', list: [
        'Escrow protects an order only while the money is held in a Farmxie order. It is not a guarantee of product quality, and it does not cover payments made outside Farmxie.',
        'Escrow money is not automatically released or refunded after a long time with no action. Open a dispute if there is a problem.',
        'Never pay a seller outside Farmxie for an escrow order. Farmxie cannot help with money sent outside the platform.',
        'Payment processing is handled by Paystack and is subject to its own terms. The payment service may currently be running in a test or limited mode; [OWNER: confirm live payment status before publication].',
      ] },
      { sub: 'Planned, not yet available', list: [
        'Automatic release or refund of escrow after a set time.',
        'Additional payment methods and any fee schedule.',
      ] },
    ],
  },
  {
    id: 'premium',
    title: 'Premium subscriptions',
    review: 'Subscription terms, refunds and consumer-protection wording need legal review.',
    blocks: [
      { p: 'Farmxie offers two Premium products: Farmxie Premium for individual users and Farmxie Company Premium for company accounts.' },
      { sub: 'Duration and price', list: [
        'You can buy 1, 3 or 6 months. Premium is a prepaid period, paid once through our payment partner Paystack.',
        'Prices for Nigeria are NGN 1,500 / 4,000 / 7,500 for Farmxie Premium (1 / 3 / 6 months) and NGN 15,000 / 40,000 / 75,000 for Farmxie Company Premium. The exact price and currency are shown on the order summary before you pay and may differ by country.',
      ] },
      { sub: 'Renewal and cancellation', list: [
        'Premium does not renew automatically. When your period ends, Premium stops unless you buy another period.',
        'Because Premium is prepaid and does not renew by itself, there is nothing to cancel. You simply choose not to buy again.',
      ] },
      { sub: 'Benefits', list: [
        'Benefits are listed on the Premium page. Examples include a higher number of active listings, more FarmBot messages per day, more listing photos, a Premium badge and, for users, longer short videos (up to 60 seconds).',
        'Some benefits on the Premium page are marked “Coming soon”. Those are not available yet and are not promised for any date.',
        'Premium does not guarantee sales, views, rankings or results.',
      ] },
      { sub: 'When Premium ends', list: [
        'Your content is not deleted. Items above a free limit stay visible, but you cannot add new ones until you are back under the limit.',
        'Premium-only creation, such as short videos, stops until you renew.',
      ] },
      { sub: 'Refunds and changes', list: [
        'Premium is activated only after your payment is confirmed. Refund requests are reviewed case by case, for example for a payment taken but Premium not activated, and nothing here limits your legal rights. [OWNER: confirm the refund policy after legal review].',
        'We may change Premium features, limits or prices for future purchases. Changes will not reduce a period you have already paid for without a fair remedy.',
      ] },
    ],
  },
  {
    id: 'farmbot',
    title: 'FarmBot AI',
    review: 'AI-related disclaimers and liability wording should be reviewed by counsel.',
    blocks: [
      { p: 'FarmBot is an AI assistant that gives general agricultural information. Its answers are generated automatically and are provided for information only.' },
      { list: [
        'FarmBot can make mistakes, may be out of date, and may not suit your soil, climate, crop, animals or local rules.',
        'FarmBot is not a replacement for a qualified agronomist, veterinarian, extension officer or other professional. Verify important advice, especially on chemicals, doses, animal health, food safety and finances, with a qualified person before acting.',
        'We do not guarantee that any FarmBot answer is accurate, complete or reliable.',
        'There are daily message limits, which are higher for Premium. Please do not share sensitive personal information in FarmBot chats.',
      ] },
    ],
  },
  {
    id: 'companies',
    title: 'Companies and professionals',
    review: 'Verification and badge wording should match the real verification process once finalised.',
    blocks: [
      { p: 'Companies, agribusinesses and professionals that appear on Farmxie must provide accurate information and keep it current. This includes legal name, registration details, contact details, products and services.' },
      { list: [
        'Product, service and performance claims must be truthful and supportable. Do not claim certifications you do not hold.',
        'Companies must treat customers fairly and handle their orders, messages and complaints responsibly.',
        'Company advertising on Farmxie must follow the rules shown in the advertising tools and is reviewed before it runs.',
        'Companies are responsible for the actions of anyone they allow to act for them.',
      ] },
      { sub: 'Badges', list: [
        'Verified: Farmxie has checked the business information submitted for registration. It is not an endorsement of the company’s products or a guarantee of its conduct.',
        'Premium: a paid subscription badge. It does not mean Farmxie has checked or endorsed the company.',
        'Trusted Partner: granted by Farmxie to selected partners and cannot be bought.',
        'Badges can be removed if the conditions for them stop being met or if these Terms are broken.',
      ] },
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation and enforcement',
    review: 'There is no formal appeals feature yet. Confirm the appeal process and timelines with counsel before publishing.',
    blocks: [
      { p: 'Users can report accounts, posts, comments, listings, groups, companies and other content. Farmxie staff may review reports and other signals, and may take action that is reasonable for the situation, such as:' },
      { list: [
        'removing or hiding content or listings;',
        'warning a user;',
        'limiting features, or suspending or removing a group or account;',
        'removing badges;',
        'holding or reviewing a related wallet or escrow transaction;',
        'passing information to the authorities where the law requires or allows it.',
      ] },
      { p: 'We aim to act fairly and in proportion to the harm. Where it is safe and lawful, we will tell you what action was taken and why.' },
      { sub: 'Appeals', list: [
        'Appeals are currently handled by contacting us. If you think a decision was wrong, write to the support contact below with your account details and an explanation, and we will review it.',
        'A dedicated in-app appeals process is planned but is not available yet.',
        'Appeal response time: [TO BE CONFIRMED BY THE OWNER].',
      ] },
    ],
  },
  {
    id: 'liability',
    title: 'Disclaimers and limitation of liability',
    review: 'High-risk section. Limits on liability must be reviewed so they do not conflict with Nigerian consumer-protection law.',
    blocks: [
      { p: 'Farmxie is provided on an “as available” basis. We work to keep it running, but we do not promise that it will always be available, error-free or secure. We may carry out maintenance or pause features when needed.' },
      { list: [
        'Third-party conduct: users, sellers, buyers, companies and experts are responsible for what they say and do. Farmxie is not responsible for their conduct, listings, claims or content, except where the law says otherwise.',
        'Agricultural risk: farming involves risks such as weather, pests, disease, price changes and delivery delays. You are responsible for your own decisions, and Farmxie does not guarantee any result, yield, price or profit.',
        'Third-party services, such as payment, email and AI providers, have their own terms and may fail or change.',
      ] },
      { p: 'To the fullest extent the law allows, Farmxie is not liable for indirect or consequential loss, or for loss of profit, crops, livestock or business that results from using the platform. Our total liability for a claim relating to the service is limited to the amount you paid to Farmxie for the service in the 12 months before the claim, or [AMOUNT TO BE CONFIRMED BY COUNSEL], whichever applies under the law.' },
      { p: 'Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law, including liability for fraud, for death or personal injury caused by negligence, or any rights you have as a consumer.' },
    ],
  },
  {
    id: 'termination',
    title: 'Termination',
    blocks: [
      { list: [
        'You may stop using Farmxie at any time. To close your account, contact us using the details below. [OWNER: confirm whether in-app account deletion will be added].',
        'We may suspend or end your access if you break these Terms, put others at risk, misuse payments, or if the law requires it. Where practical, we will give notice and a reason.',
        'If an account is closed, access to it ends. Some information may be kept where needed for legal, security, accounting or dispute purposes, as explained in the Privacy Policy.',
        'Any money in your wallet that belongs to you can be withdrawn under the withdrawal rules, unless it is subject to an open dispute, investigation or legal requirement.',
        'Sections that by their nature should continue, such as those on content licence, disputes, liability and governing law, continue after termination.',
      ] },
    ],
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    blocks: [
      { p: 'We may update these Terms as Farmxie grows or the law changes. When we make an important change, we will tell you through the app, by notification or by email, and update the “Last updated” date above.' },
      { p: 'Changes take effect on the date stated in the notice, which will normally be at least [NOTICE PERIOD TO BE CONFIRMED] days after we tell you, except where a change is needed sooner for legal or security reasons. If you keep using Farmxie after the effective date, you accept the updated Terms. If you do not agree, you can stop using Farmxie and close your account.' },
    ],
  },
  {
    id: 'governing-law',
    title: 'Governing law and contact',
    review: 'Governing law, jurisdiction, dispute resolution and Nigerian data-protection (NDPA) compliance details must be completed and approved by counsel.',
    blocks: [
      { p: `These Terms are governed by the laws of the Federal Republic of Nigeria. Courts in ${GOVERNING_STATE} will handle disputes, without limiting any right you may have to bring a claim in another place where the law gives you that right.`, ph: true },
      { p: 'We encourage you to contact us first so that we can try to resolve a problem informally.' },
    ],
  },
]

const PLACEHOLDER_BG = 'var(--fx-tint-amber)'

function Ph({ children }: { children: ReactNode }) {
  return <mark style={{ background: PLACEHOLDER_BG, color: COLORS.amberText, padding: '0 4px', borderRadius: '4px', fontWeight: 700 }}>{children}</mark>
}

// Turns "[PLACEHOLDER]" text into highlighted placeholders so the owner cannot miss them
function renderText(text: string): ReactNode {
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) => (/^\[[^\]]+\]$/.test(part) ? <Ph key={i}>{part}</Ph> : <span key={i}>{part}</span>))
}

export default function TermsPage() {
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
        <p style={{ fontSize: '16px', fontWeight: 800, color: COLORS.text }}>Terms &amp; Conditions</p>
      </div>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '20px 16px 48px' }}>
        <h1 style={{ fontSize: '26px', lineHeight: 1.25, fontWeight: 800, color: COLORS.text }}>Terms &amp; Conditions</h1>
        <p style={{ ...body, color: COLORS.textMuted, marginTop: '10px' }}>
          These terms explain the rules for using Farmxie: what you can expect from us and what we expect from you. Please read them carefully.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: '12px', fontSize: '12.5px', color: COLORS.textMuted }}>
          <span><strong style={{ color: COLORS.text }}>Effective date:</strong> {renderText(EFFECTIVE_DATE)}</span>
          <span><strong style={{ color: COLORS.text }}>Last updated:</strong> {LAST_UPDATED}</span>
        </div>

        {SHOW_DRAFT_FLAGS && (
          <div role="note" style={{ marginTop: '16px', background: COLORS.amberBg, border: `1px solid ${COLORS.amberBorder}`, borderRadius: '12px', padding: '12px 14px', fontSize: '12.5px', lineHeight: 1.55, color: COLORS.amberText }}>
            <strong>Draft for owner review.</strong> This text has not been approved by a lawyer. Highlighted [PLACEHOLDERS] must be completed, and sections marked &ldquo;Legal review&rdquo; must be checked before publication.
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

            {s.id === 'governing-law' && (
              <div style={{ marginTop: '14px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '14px', padding: '16px', display: 'grid', gap: '6px', ...body }}>
                <p><strong>Company:</strong> {renderText(LEGAL_NAME)}</p>
                <p><strong>Registration number:</strong> {renderText(REG_NUMBER)}</p>
                <p><strong>Registered office:</strong> {renderText(REG_ADDRESS)}</p>
                <p><strong>Legal contact:</strong> {renderText(CONTACT_EMAIL)}</p>
                <p><strong>Support:</strong> {renderText(SUPPORT_EMAIL)}</p>
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}
