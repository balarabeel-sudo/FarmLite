import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7', red: '#DC2626', blue: '#2563EB', amber: '#B45309' }

type AdminAd = {
  id: string
  company_id: string
  company_name: string
  logo_url: string | null
  target_type: 'listing' | 'company'
  listing_title: string | null
  headline: string
  body: string | null
  image_url: string | null
  audience_roles: string[]
  locations: string[]
  days: number
  amount: number
  currency: string
  status: 'pending_review' | 'approved' | 'rejected' | 'active' | 'cancelled'
  review_note: string | null
  starts_at: string | null
  ends_at: string | null
  created_at: string
  impressions: number
  clicks: number
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending_review: { bg: '#FEF3C7', color: '#92400E', label: 'In review' },
  approved: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Approved, unpaid' },
  rejected: { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  active: { bg: '#DCFCE7', color: '#166534', label: 'Running' },
  cancelled: { bg: '#E5E7EB', color: '#4B5563', label: 'Cancelled' },
}

const FILTERS: { key: string; label: string }[] = [
  { key: 'pending_review', label: 'In review' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Running' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n) } catch { return `${c} ${n}` }
}

// Route: /admin/ads  (needs the ads.review permission)
// Every company ad is checked here before the company can pay for it.
export default function AdsPage() {
  const staff = useStaff()
  const canReview = staff.permissions.has('ads.review')
  const [filter, setFilter] = useState('pending_review')
  const [ads, setAds] = useState<AdminAd[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState('')

  const load = async () => {
    setError(false)
    setLoading(true)
    const { data, error: e } = await supabase.rpc('ads_admin_list', { p_status: filter === 'all' ? null : filter })
    if (e) setError(true)
    else setAds((data || []) as AdminAd[])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const stop = async (ad: AdminAd) => {
    const note = window.prompt('Why is this running ad being stopped? The company will see this message.')
    if (!note || note.trim().length < 3) return
    setBusy(ad.id)
    const { error: e } = await supabase.rpc('ad_admin_stop', { p_ad: ad.id, p_note: note })
    setBusy('')
    if (e) {
      window.alert(e.message.includes('not_active') ? 'This ad is no longer running.' : e.message)
      return load()
    }
    await logAdminAction('Stopped running company ad', { type: 'ad', id: ad.id, label: `${ad.company_name}: ${ad.headline}` })
    load()
  }

  const review = async (ad: AdminAd, approve: boolean) => {
    let note: string | null = null
    if (!approve) {
      note = window.prompt('Why is this ad rejected? The company will see this message.')
      if (!note || note.trim().length < 3) return
    } else if (!window.confirm(`Approve "${ad.headline}" from ${ad.company_name}? The company can then pay to run it.`)) return

    setBusy(ad.id)
    const { error: e } = await supabase.rpc('ad_review', { p_ad: ad.id, p_approve: approve, p_note: note })
    setBusy('')
    if (e) {
      window.alert(e.message.includes('not_pending') ? 'This ad was already reviewed.' : e.message)
      return load()
    }
    await logAdminAction(approve ? 'Approved company ad' : 'Rejected company ad', { type: 'ad', id: ad.id, label: `${ad.company_name}: ${ad.headline}` })
    load()
  }

  return (
    <AdminLayout title="Ads">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map((f) => (
          <div key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            background: filter === f.key ? A.green : A.surface, color: filter === f.key ? 'white' : A.textMuted,
            border: `1px solid ${filter === f.key ? A.green : A.border}`,
          }}>{f.label}</div>
        ))}
        {staff.permissions.has('ads.manage_pricing') && (
          <Link to="/admin/ads/pricing" style={{ marginLeft: 'auto', fontSize: '12.5px', fontWeight: 700, color: A.green, textDecoration: 'none' }}>Manage ad prices</Link>
        )}
      </div>

      <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px' }}>
        {loading ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>Loading ads...</p>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '10px' }}>Could not load ads.</p>
            <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
          </div>
        ) : ads.length === 0 ? (
          <p style={{ padding: '20px', fontSize: '13px', color: A.textMuted }}>No ads in this list.</p>
        ) : (
          ads.map((ad, i) => {
            const st = STATUS_STYLE[ad.status]
            return (
              <div key={ad.id} style={{ display: 'flex', gap: '16px', padding: '16px 18px', borderTop: i === 0 ? 'none' : `1px solid ${A.border}`, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: 96, height: 96, borderRadius: 10, background: A.bg, overflow: 'hidden', flexShrink: 0 }}>
                  {ad.image_url && <img src={ad.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <p style={{ fontSize: '11.5px', color: A.textMuted, fontWeight: 700 }}>{ad.company_name} · {ad.target_type === 'listing' ? `Listing${ad.listing_title ? `: ${ad.listing_title}` : ''}` : 'Company page'}</p>
                  <p style={{ fontSize: '14.5px', fontWeight: 800, color: A.text, marginTop: 3 }}>{ad.headline}</p>
                  {ad.body && <p style={{ fontSize: '12.5px', color: A.text, marginTop: 3, lineHeight: 1.5 }}>{ad.body}</p>}
                  <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: 8 }}>
                    Audience: {ad.audience_roles.length ? ad.audience_roles.join(', ') : 'everyone'} · Location: {ad.locations.length ? ad.locations.join(', ') : 'everywhere'} · {ad.days} days · {money(ad.amount, ad.currency)}
                  </p>
                  {ad.review_note && <p style={{ fontSize: '11.5px', color: A.red, marginTop: 4 }}>Note: {ad.review_note}</p>}
                  {(ad.status === 'active' || ad.impressions > 0) && <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: 4 }}>{ad.impressions} impressions · {ad.clicks} clicks</p>}
                  {ad.starts_at && <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: 4 }}>Runs {new Date(ad.starts_at).toLocaleDateString()} to {ad.ends_at ? new Date(ad.ends_at).toLocaleDateString() : ''}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <span style={{ background: st.bg, color: st.color, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>{st.label}</span>
                  {canReview && ad.status === 'active' && new Date(ad.ends_at || 0).getTime() > Date.now() && (
                    <span onClick={busy ? undefined : () => stop(ad)} style={{ fontSize: '12.5px', fontWeight: 700, color: A.red, cursor: 'pointer', opacity: busy === ad.id ? 0.5 : 1 }}>Stop ad</span>
                  )}
                  {canReview && ad.status === 'pending_review' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span onClick={busy ? undefined : () => review(ad, true)} style={{ fontSize: '12.5px', fontWeight: 700, color: A.green, cursor: 'pointer', opacity: busy === ad.id ? 0.5 : 1 }}>Approve</span>
                      <span onClick={busy ? undefined : () => review(ad, false)} style={{ fontSize: '12.5px', fontWeight: 700, color: A.red, cursor: 'pointer', opacity: busy === ad.id ? 0.5 : 1 }}>Reject</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </AdminLayout>
  )
}
