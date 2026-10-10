import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import Icon from '../Icons'
import PremiumTick from '../PremiumTick'
import { isPremiumActive } from '../premiumShared'
import type { CompanyCtx } from './CompanyLayout'

const COLORS = {
  bg: '#F8FAF6',
  card: '#FFFFFF',
  border: '#E5EFE5',
  green: '#16A34A',
  greenDark: '#166534',
  greenSoft: '#DCFCE7',
  gold: '#F59E0B',
  text: '#1A2E1A',
  textMuted: '#5B6B5B',
  red: '#B91C1C',
}

type Listing = {
  id: string
  title: string
  images: string[] | null
  status: string
  is_featured: boolean
  is_hidden_by_admin: boolean
}

const ERRORS: Record<string, string> = {
  premium_required: 'Featured Visibility is a Company Premium tool.',
  company_not_verified: 'Your company must be verified before it can be featured.',
  listing_not_available: 'Only available listings can be featured.',
  limit_reached: 'You have used all your featured slots. Remove one to add another.',
  not_found: 'This item was not found.',
}

// Route: /company/featured
// "Boost your company": Company Premium owners choose which listings (and the company page) appear in the
// Featured sections of the Marketplace. Free companies see the tool with the upgrade path.
export default function CompanyFeaturedPage() {
  const { company } = useOutletContext<CompanyCtx>()
  const navigate = useNavigate()
  const premium = isPremiumActive(company.is_premium, company.premium_until)
  const verified = company.status === 'verified'

  const [listings, setListings] = useState<Listing[]>([])
  const [companyFeatured, setCompanyFeatured] = useState(false)
  const [limit, setLimit] = useState(3)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [lRes, cRes, limRes] = await Promise.all([
      supabase.from('marketplace_listings').select('id, title, images, status, is_featured, is_hidden_by_admin').eq('company_id', company.id).order('created_at', { ascending: false }),
      supabase.from('companies').select('is_featured').eq('id', company.id).maybeSingle(),
      supabase.from('app_limits').select('premium_value').eq('key', 'featured_listings').maybeSingle(),
    ])
    setListings((lRes.data || []) as Listing[])
    setCompanyFeatured(!!(cRes.data as any)?.is_featured)
    if (limRes.data && typeof (limRes.data as any).premium_value === 'number') setLimit((limRes.data as any).premium_value)
    setLoading(false)
  }, [company.id])

  useEffect(() => { load() }, [load])

  const errorText = (e: { message?: string } | null) => {
    const key = Object.keys(ERRORS).find((k) => e?.message?.includes(k))
    return key ? ERRORS[key] : 'Something went wrong. Please try again.'
  }

  const toggleListing = async (l: Listing) => {
    if (busyId) return
    setBusyId(l.id)
    setMessage(null)
    const next = !l.is_featured
    const { error } = await supabase.rpc('set_listing_featured', { p_listing: l.id, p_featured: next })
    setBusyId(null)
    if (error) return setMessage({ kind: 'error', text: errorText(error) })
    setListings((prev) => prev.map((x) => (x.id === l.id ? { ...x, is_featured: next } : x)))
    setMessage({ kind: 'ok', text: next ? 'Listing featured.' : 'Listing removed from Featured.' })
  }

  const toggleCompany = async () => {
    if (busyId) return
    setBusyId('company')
    setMessage(null)
    const next = !companyFeatured
    const { error } = await supabase.rpc('set_company_featured', { p_company: company.id, p_featured: next })
    setBusyId(null)
    if (error) return setMessage({ kind: 'error', text: errorText(error) })
    setCompanyFeatured(next)
    setMessage({ kind: 'ok', text: next ? 'Your company is now featured.' : 'Your company was removed from Featured.' })
  }

  const used = listings.filter((l) => l.is_featured).length
  const full = used >= limit
  // Flags stay saved when Premium ends, but nothing is shown to customers until Premium is active again.
  const paused = !premium && (used > 0 || companyFeatured)

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: '11px', fontWeight: 800, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Company Premium</p>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: COLORS.text, marginTop: 2 }}>Featured Visibility</h1>
        <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 3 }}>Boost your company: choose what customers see first on the Marketplace</p>
      </div>

      {!premium && (
        <Banner tone="blue">
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 800, color: COLORS.text }}>Featured Visibility is a Company Premium tool</p>
            <p style={{ fontSize: '12.5px', color: COLORS.textMuted, marginTop: 3, lineHeight: 1.5 }}>Upgrade to feature up to {limit} listings and your company page in the Featured sections of the Marketplace.</p>
          </div>
          <div onClick={() => navigate('/company/premium')} style={{ padding: '10px 18px', borderRadius: 12, background: '#1877F2', color: 'white', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>Upgrade to Company Premium</div>
        </Banner>
      )}
      {paused && <Banner tone="amber"><p style={{ fontSize: '12.5px', color: '#92400E', fontWeight: 600 }}>Your featured items are paused. They will show again as soon as Company Premium is active.</p></Banner>}
      {premium && !verified && <Banner tone="amber"><p style={{ fontSize: '12.5px', color: '#92400E', fontWeight: 600 }}>Your company must be verified before anything can be featured.</p></Banner>}
      {message && <Banner tone={message.kind === 'ok' ? 'green' : 'red'}><p style={{ fontSize: '12.5px', fontWeight: 700, color: message.kind === 'ok' ? COLORS.greenDark : COLORS.red }}>{message.text}</p></Banner>}

      <Card title="How it works">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <Step n="1" title="Choose what to feature">Pick up to {limit} listings, and your company page, to appear in Featured on the Marketplace.</Step>
          <Step n="2" title="Customers see it first">Featured items appear in their own row at the top with a Featured label, shown fairly in rotation with other companies.</Step>
          <Step n="3" title="Stays while Premium is active">Featured pauses on its own when Premium ends and returns when you renew. No ad budget needed.</Step>
        </div>
      </Card>

      <Card title="Your company page" hint="Appears in Featured companies, with your logo and blue tick.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.greenSoft, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {company.logo_url ? <img src={company.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="building" size={22} color={COLORS.green} />}
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ fontSize: '14px', fontWeight: 800, color: COLORS.text }}>{company.name}</p>
              {premium && <PremiumTick size={16} />}
            </div>
            <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 2 }}>{companyFeatured ? 'Featured in company discovery' : 'Not featured'}</p>
          </div>
          <Action
            label={companyFeatured ? 'Remove' : 'Feature my company'}
            on={companyFeatured}
            disabled={!premium || !verified}
            locked={!premium}
            busy={busyId === 'company'}
            onClick={toggleCompany}
          />
        </div>
      </Card>

      <Card title="Your listings" hint={`${used} of ${limit} featured slots used`}>
        {loading ? (
          <p style={{ fontSize: '13px', color: COLORS.textMuted }}>Loading…</p>
        ) : listings.length === 0 ? (
          <p style={{ fontSize: '13px', color: COLORS.textMuted, lineHeight: 1.5 }}>You have no company listings yet. Create a listing in the Marketplace first, then come back to feature it.</p>
        ) : (
          listings.map((l, i) => {
            const eligible = l.status === 'available' && !l.is_hidden_by_admin
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${COLORS.bg}`, flexWrap: 'wrap' }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: COLORS.greenSoft, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {l.images?.[0] ? <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="leaf" size={20} color={COLORS.green} />}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.text }}>{l.title}</p>
                  <p style={{ fontSize: '11.5px', color: l.is_featured ? COLORS.gold : COLORS.textMuted, fontWeight: l.is_featured ? 800 : 500, marginTop: 2 }}>
                    {l.is_featured ? '★ Featured' : eligible ? 'Available' : l.is_hidden_by_admin ? 'Hidden by Farmxie' : `Not available (${l.status})`}
                  </p>
                </div>
                <Action
                  label={l.is_featured ? 'Remove' : 'Feature'}
                  on={l.is_featured}
                  disabled={!l.is_featured && (!premium || !verified || !eligible || full)}
                  locked={!premium && !l.is_featured}
                  busy={busyId === l.id}
                  onClick={() => toggleListing(l)}
                />
              </div>
            )
          })
        )}
        {premium && full && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 10 }}>All {limit} slots are in use. Remove a featured listing to feature another.</p>}
      </Card>
    </div>
  )
}

function Action({ label, on, disabled, locked, busy, onClick }: { label: string; on: boolean; disabled: boolean; locked: boolean; busy: boolean; onClick: () => void }) {
  const inactive = disabled || busy
  return (
    <div role="button" aria-disabled={inactive} onClick={inactive ? undefined : onClick} style={{
      padding: '9px 18px', borderRadius: 10, fontSize: '12.5px', fontWeight: 800, cursor: inactive ? 'default' : 'pointer', whiteSpace: 'nowrap',
      background: on ? COLORS.card : inactive ? '#E5EFE5' : COLORS.green,
      color: on ? COLORS.text : inactive ? COLORS.textMuted : 'white',
      border: on ? `1px solid ${COLORS.border}` : 'none', opacity: busy ? 0.6 : 1,
    }}>
      {busy ? 'Saving…' : locked ? 'Premium' : label}
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, background: COLORS.greenSoft, color: COLORS.greenDark, fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 800, color: COLORS.text }}>{title}</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.5, marginTop: 3 }}>{children}</p>
      </div>
    </div>
  )
}

function Banner({ tone, children }: { tone: 'blue' | 'amber' | 'green' | 'red'; children: ReactNode }) {
  const map = { blue: ['#EFF6FF', '#BFDBFE'], amber: ['#FEF3C7', '#FDE68A'], green: [COLORS.greenSoft, '#BBF7D0'], red: ['#FEE2E2', '#FECACA'] }[tone]
  return <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: map[0], border: `1px solid ${map[1]}`, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>{children}</div>
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>{title}</p>
      {hint && <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: 3 }}>{hint}</p>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  )
}
