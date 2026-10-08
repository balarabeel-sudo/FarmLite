import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7', red: '#DC2626', amber: '#B45309' }

type PriceRow = { country: string; days: 3 | 7 | 14; amount: number; currency: string; active: boolean }
type Region = { country: string; currency: string; p3: string; p7: string; p14: string; active: boolean; dirty: boolean }

const ERRORS: Record<string, string> = {
  invalid_region: 'Enter a region name (2 to 60 characters).',
  invalid_currency: 'The currency must be a 3-letter code, for example NGN.',
  invalid_price: 'Every price must be a number greater than 0.',
  invalid_percent: 'The discount must be between 0 and 90.',
  not_allowed: 'You do not have permission to do this.',
}
const errorText = (e: { message?: string } | null) => {
  const k = Object.keys(ERRORS).find((x) => e?.message?.includes(x))
  return k ? ERRORS[k] : e?.message || 'Something went wrong.'
}

function toRegions(rows: PriceRow[]): Region[] {
  const map = new Map<string, Region>()
  rows.forEach((r) => {
    const key = r.country.toLowerCase()
    const cur = map.get(key) || { country: r.country, currency: r.currency, p3: '', p7: '', p14: '', active: r.active, dirty: false }
    if (r.days === 3) cur.p3 = String(r.amount)
    if (r.days === 7) cur.p7 = String(r.amount)
    if (r.days === 14) cur.p14 = String(r.amount)
    cur.active = cur.active && r.active
    map.set(key, cur)
  })
  return Array.from(map.values()).sort((a, b) => a.country.localeCompare(b.country))
}

// Route: /admin/ads/pricing  (needs the ads.manage_pricing permission)
// Ad prices per region for the 3, 7 and 14 day packages, plus the Premium discount.
export default function AdPricingPage() {
  const staff = useStaff()
  const allowed = staff.permissions.has('ads.manage_pricing')
  const [regions, setRegions] = useState<Region[]>([])
  const [discount, setDiscount] = useState('0')
  const [discountSaved, setDiscountSaved] = useState('0')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [draft, setDraft] = useState({ country: '', currency: 'NGN', p3: '', p7: '', p14: '' })

  const load = async () => {
    setError(false)
    setLoading(true)
    const { data, error: e } = await supabase.rpc('ad_prices_admin')
    if (e) setError(true)
    else {
      setRegions(toRegions(((data as any)?.prices || []) as PriceRow[]))
      const d = String((data as any)?.discount_percent ?? 0)
      setDiscount(d)
      setDiscountSaved(d)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const edit = (country: string, patch: Partial<Region>) =>
    setRegions((prev) => prev.map((r) => (r.country === country ? { ...r, ...patch, dirty: true } : r)))

  const saveRegion = async (r: Pick<Region, 'country' | 'currency' | 'p3' | 'p7' | 'p14' | 'active'>, isNew = false) => {
    setMessage(null)
    const nums = [Number(r.p3), Number(r.p7), Number(r.p14)]
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return setMessage({ kind: 'error', text: ERRORS.invalid_price })
    setBusy(r.country || 'new')
    const { error: e } = await supabase.rpc('ad_region_set', {
      p_country: r.country, p_currency: r.currency, p_p3: nums[0], p_p7: nums[1], p_p14: nums[2], p_active: r.active,
    })
    setBusy('')
    if (e) return setMessage({ kind: 'error', text: errorText(e) })
    await logAdminAction(isNew ? 'Added ad prices for a region' : 'Updated ad prices for a region', { type: 'ad_prices', id: r.country, label: `${r.country}: ${r.currency} ${nums.join(' / ')}${r.active ? '' : ' (off)'}` })
    setMessage({ kind: 'ok', text: `${r.country} saved.` })
    if (isNew) setDraft({ country: '', currency: draft.currency, p3: '', p7: '', p14: '' })
    load()
  }

  const removeRegion = async (country: string) => {
    if (!window.confirm(`Delete all ad prices for ${country}? Companies there will no longer be able to create ads until a price exists.`)) return
    setBusy(country)
    const { error: e } = await supabase.rpc('ad_region_delete', { p_country: country })
    setBusy('')
    if (e) return setMessage({ kind: 'error', text: errorText(e) })
    await logAdminAction('Deleted ad prices for a region', { type: 'ad_prices', id: country, label: country })
    load()
  }

  const saveDiscount = async () => {
    setMessage(null)
    const n = Number(discount)
    if (!Number.isFinite(n) || n < 0 || n > 90) return setMessage({ kind: 'error', text: ERRORS.invalid_percent })
    setBusy('discount')
    const { error: e } = await supabase.rpc('ad_discount_set', { p_percent: n })
    setBusy('')
    if (e) return setMessage({ kind: 'error', text: errorText(e) })
    await logAdminAction('Changed Premium ad discount', { type: 'ad_prices', id: 'discount', label: `${n}%` })
    setDiscountSaved(String(n))
    setMessage({ kind: 'ok', text: 'Premium discount saved.' })
  }

  const hasNonNgn = regions.some((r) => r.active && r.currency !== 'NGN')

  return (
    <AdminLayout title="Ad Pricing">
      <div style={{ marginBottom: '14px' }}>
        <Link to="/admin/ads" style={{ fontSize: '12.5px', fontWeight: 700, color: A.green, textDecoration: 'none' }}>‹ Back to ads</Link>
      </div>

      {!allowed && <p style={{ fontSize: '13px', color: A.textMuted }}>You do not have permission to manage ad prices.</p>}

      {allowed && (
        <>
          {message && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: message.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: message.kind === 'ok' ? '#166534' : '#991B1B' }}>
              {message.text}
            </div>
          )}
          {hasNonNgn && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', background: '#FEF3C7', color: '#92400E' }}>
              A region is priced in a currency other than NGN. Payments are only enabled for NGN right now, so companies in that region will not be able to pay.
            </div>
          )}

          <Card title="Premium discount" hint="Percent taken off every ad for companies with an active Company Premium. Use 0 for no discount.">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={discount} inputMode="decimal" onChange={(e) => setDiscount(e.target.value)} style={{ ...input, width: 90 }} />
              <span style={{ fontSize: '13px', color: A.textMuted }}>%</span>
              <Btn onClick={saveDiscount} disabled={busy === 'discount' || discount === discountSaved}>{busy === 'discount' ? 'Saving...' : 'Save'}</Btn>
            </div>
          </Card>

          <Card title="Prices by region" hint='The region name must match the country a company lists on its profile (for example "Nigeria"). Add a region called "Default" for every other country. Prices are per package, for 3, 7 and 14 days.'>
            {loading ? (
              <p style={{ fontSize: '13px', color: A.textMuted }}>Loading prices...</p>
            ) : error ? (
              <div>
                <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '8px' }}>Could not load prices.</p>
                <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead>
                    <tr>{['Region', 'Currency', '3 days', '7 days', '14 days', 'On', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', padding: '8px 8px' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {regions.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: '14px 8px', fontSize: '13px', color: A.textMuted }}>No regions yet. Add one below. Until you do, companies cannot create ads.</td></tr>
                    )}
                    {regions.map((r) => (
                      <tr key={r.country} style={{ borderTop: `1px solid ${A.border}` }}>
                        <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 700, color: A.text }}>{r.country}</td>
                        <td style={{ padding: '6px 8px' }}><input value={r.currency} maxLength={3} onChange={(e) => edit(r.country, { currency: e.target.value.toUpperCase() })} style={{ ...input, width: 70 }} /></td>
                        <td style={{ padding: '6px 8px' }}><input value={r.p3} inputMode="decimal" onChange={(e) => edit(r.country, { p3: e.target.value })} style={{ ...input, width: 110 }} /></td>
                        <td style={{ padding: '6px 8px' }}><input value={r.p7} inputMode="decimal" onChange={(e) => edit(r.country, { p7: e.target.value })} style={{ ...input, width: 110 }} /></td>
                        <td style={{ padding: '6px 8px' }}><input value={r.p14} inputMode="decimal" onChange={(e) => edit(r.country, { p14: e.target.value })} style={{ ...input, width: 110 }} /></td>
                        <td style={{ padding: '6px 8px' }}><input type="checkbox" checked={r.active} onChange={(e) => edit(r.country, { active: e.target.checked })} /></td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <Btn onClick={() => saveRegion(r)} disabled={!r.dirty || busy === r.country}>{busy === r.country ? 'Saving...' : 'Save'}</Btn>
                          <span onClick={busy ? undefined : () => removeRegion(r.country)} style={{ marginLeft: 12, fontSize: '12.5px', fontWeight: 700, color: A.red, cursor: 'pointer' }}>Delete</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Add a region">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Region (country)"><input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="Ghana or Default" style={{ ...input, width: 170 }} /></Field>
              <Field label="Currency"><input value={draft.currency} maxLength={3} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} style={{ ...input, width: 70 }} /></Field>
              <Field label="3 days"><input value={draft.p3} inputMode="decimal" onChange={(e) => setDraft({ ...draft, p3: e.target.value })} style={{ ...input, width: 110 }} /></Field>
              <Field label="7 days"><input value={draft.p7} inputMode="decimal" onChange={(e) => setDraft({ ...draft, p7: e.target.value })} style={{ ...input, width: 110 }} /></Field>
              <Field label="14 days"><input value={draft.p14} inputMode="decimal" onChange={(e) => setDraft({ ...draft, p14: e.target.value })} style={{ ...input, width: 110 }} /></Field>
              <Btn onClick={() => saveRegion({ ...draft, active: true }, true)} disabled={busy === 'new' || !draft.country.trim()}>{busy === 'new' ? 'Adding...' : 'Add region'}</Btn>
            </div>
            <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: '10px' }}>New regions are switched on straight away. Untick "On" in the table to hide a region without deleting it.</p>
          </Card>
        </>
      )}
    </AdminLayout>
  )
}

function Card({ title, hint, children }: { title: string; hint?: string; children: any }) {
  return (
    <div style={{ background: A.surface, border: `1px solid ${A.border}`, borderRadius: '10px', padding: '18px 20px', marginBottom: '16px' }}>
      <p style={{ fontSize: '14px', fontWeight: 800, color: A.text }}>{title}</p>
      {hint && <p style={{ fontSize: '12px', color: A.textMuted, marginTop: '3px', lineHeight: 1.5, maxWidth: 720 }}>{hint}</p>}
      <div style={{ marginTop: '14px' }}>{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 700, color: A.textMuted, marginBottom: '5px' }}>{label}</p>
      {children}
    </div>
  )
}

function Btn({ children, onClick, disabled }: { children: any; onClick: () => void; disabled?: boolean }) {
  return (
    <span role="button" onClick={disabled ? undefined : onClick} style={{
      display: 'inline-block', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
      background: disabled ? '#C9E9D2' : A.green, color: 'white', cursor: disabled ? 'default' : 'pointer',
    }}>{children}</span>
  )
}

const input: CSSProperties = { boxSizing: 'border-box', border: `1px solid ${A.border}`, borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: A.text, background: '#fff', outline: 'none' }
