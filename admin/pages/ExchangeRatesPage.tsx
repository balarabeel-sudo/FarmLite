import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', red: '#DC2626', amber: '#B45309' }

// A rate older than this stops being used for escrow (the database enforces the same 72 hours).
const FRESH_MS = 72 * 60 * 60 * 1000

type RateRow = { currency: string; ngn_per_unit: number; active: boolean; updated_at: string }
type Draft = { currency: string; rate: string; active: boolean; dirty: boolean }

const ERRORS: Record<string, string> = {
  invalid_currency: 'Use a 3-letter currency code such as USD. NGN does not need a rate.',
  invalid_rate: 'The rate must be a number greater than 0.',
  not_allowed: 'You do not have permission to do this.',
}
const errorText = (e: { message?: string } | null) => {
  const k = Object.keys(ERRORS).find((x) => e?.message?.includes(x))
  return k ? ERRORS[k] : e?.message || 'Something went wrong.'
}

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
}

// Route: /admin/exchange-rates  (view: wallet.view, change: wallet.manage)
// Rates used to pay for listings that are priced in another currency. Money is always held in NGN.
export default function ExchangeRatesPage() {
  const staff = useStaff()
  const canView = staff.permissions.has('wallet.view')
  const canManage = staff.permissions.has('wallet.manage')
  const [rows, setRows] = useState<(RateRow & { draft: Draft })[]>([])
  const [listingCounts, setListingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [newRow, setNewRow] = useState({ currency: '', rate: '' })

  const load = async () => {
    setError(false)
    setLoading(true)
    const [ratesRes, listingsRes] = await Promise.all([
      supabase.from('fx_rates').select('currency, ngn_per_unit, active, updated_at').order('currency'),
      supabase.from('marketplace_listings').select('currency').eq('status', 'available').limit(2000),
    ])
    if (ratesRes.error) setError(true)
    else {
      setRows(((ratesRes.data || []) as any[]).map((r) => ({
        currency: r.currency, ngn_per_unit: Number(r.ngn_per_unit), active: r.active, updated_at: r.updated_at,
        draft: { currency: r.currency, rate: String(Number(r.ngn_per_unit)), active: r.active, dirty: false },
      })))
    }
    const counts: Record<string, number> = {}
    ;((listingsRes.data || []) as any[]).forEach((l) => {
      const c = String(l.currency || 'NGN').toUpperCase()
      if (c !== 'NGN') counts[c] = (counts[c] || 0) + 1
    })
    setListingCounts(counts)
    setLoading(false)
  }

  useEffect(() => { if (canView) load() }, [canView])

  const edit = (currency: string, patch: Partial<Draft>) =>
    setRows((prev) => prev.map((r) => (r.currency === currency ? { ...r, draft: { ...r.draft, ...patch, dirty: true } } : r)))

  const save = async (currency: string, rateText: string, active: boolean, isNew = false) => {
    setMessage(null)
    const rate = Number(rateText)
    if (!Number.isFinite(rate) || rate <= 0) return setMessage({ kind: 'error', text: ERRORS.invalid_rate })
    setBusy(currency || 'new')
    const { error: e } = await supabase.rpc('fx_rate_set', { p_currency: currency, p_rate: rate, p_active: active })
    setBusy('')
    if (e) return setMessage({ kind: 'error', text: errorText(e) })
    await logAdminAction(isNew ? 'Added an exchange rate' : 'Updated an exchange rate', { type: 'fx_rates', id: currency.toUpperCase(), label: `1 ${currency.toUpperCase()} = NGN ${rate}${active ? '' : ' (off)'}` })
    setMessage({ kind: 'ok', text: `${currency.toUpperCase()} saved.` })
    if (isNew) setNewRow({ currency: '', rate: '' })
    load()
  }

  // Currencies used by available listings that have no usable rate yet
  const usable = new Set(rows.filter((r) => r.active && Date.now() - new Date(r.updated_at).getTime() < FRESH_MS).map((r) => r.currency))
  const missing = Object.keys(listingCounts).filter((c) => !usable.has(c))

  return (
    <AdminLayout title="Exchange Rates">
      {!canView && <p style={{ fontSize: '13px', color: A.textMuted }}>You do not have permission to view exchange rates.</p>}

      {canView && (
        <>
          {message && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: message.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: message.kind === 'ok' ? '#166534' : '#991B1B' }}>
              {message.text}
            </div>
          )}
          {missing.length > 0 && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', background: '#FEF3C7', color: '#92400E', lineHeight: 1.5 }}>
              Escrow is switched off for listings priced in {missing.map((c) => `${c} (${listingCounts[c]} listing${listingCounts[c] === 1 ? '' : 's'})`).join(', ')}, because there is no active rate updated in the last 72 hours.
            </div>
          )}

          <Card title="Rates" hint="How many Naira one unit of the currency is worth, for example 1 USD = 1500 NGN. Buyers pay in NGN at this rate, and the rate is locked on each order. Include your margin in the rate. A rate that is not updated for 72 hours stops being used, so escrow for that currency pauses until you save it again.">
            {loading ? (
              <p style={{ fontSize: '13px', color: A.textMuted }}>Loading rates...</p>
            ) : error ? (
              <div>
                <p style={{ fontSize: '13px', color: A.textMuted, marginBottom: '8px' }}>Could not load rates.</p>
                <span onClick={load} style={{ fontSize: '13px', fontWeight: 700, color: A.green, cursor: 'pointer' }}>Try again</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr>{['Currency', 'NGN per 1 unit', 'On', 'Updated', 'Listings', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontSize: '11px', fontWeight: 700, color: A.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', padding: '8px 8px' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '14px 8px', fontSize: '13px', color: A.textMuted }}>No rates yet. Add one below. Until you do, escrow works only for listings priced in NGN.</td></tr>
                    )}
                    {rows.map((r) => {
                      const stale = Date.now() - new Date(r.updated_at).getTime() >= FRESH_MS
                      return (
                        <tr key={r.currency} style={{ borderTop: `1px solid ${A.border}` }}>
                          <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: 700, color: A.text }}>{r.currency}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <input disabled={!canManage} value={r.draft.rate} inputMode="decimal" onChange={(e) => edit(r.currency, { rate: e.target.value })} style={{ ...input, width: 130 }} />
                          </td>
                          <td style={{ padding: '6px 8px' }}><input disabled={!canManage} type="checkbox" checked={r.draft.active} onChange={(e) => edit(r.currency, { active: e.target.checked })} /></td>
                          <td style={{ padding: '10px 8px', fontSize: '12.5px', color: stale ? A.amber : A.textMuted, fontWeight: stale ? 700 : 500 }}>
                            {ago(r.updated_at)}{stale ? ' · expired' : ''}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: '12.5px', color: A.textMuted }}>{listingCounts[r.currency] || 0}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            {canManage && <Btn onClick={() => save(r.currency, r.draft.rate, r.draft.active)} disabled={busy === r.currency || (!r.draft.dirty && !stale)}>{busy === r.currency ? 'Saving...' : stale && !r.draft.dirty ? 'Confirm rate' : 'Save'}</Btn>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {canManage && (
            <Card title="Add a currency">
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="Currency code"><input value={newRow.currency} maxLength={3} onChange={(e) => setNewRow({ ...newRow, currency: e.target.value.toUpperCase() })} placeholder="USD" style={{ ...input, width: 90 }} /></Field>
                <Field label="NGN per 1 unit"><input value={newRow.rate} inputMode="decimal" onChange={(e) => setNewRow({ ...newRow, rate: e.target.value })} placeholder="1500" style={{ ...input, width: 130 }} /></Field>
                <Btn onClick={() => save(newRow.currency, newRow.rate, true, true)} disabled={busy === 'new' || newRow.currency.trim().length !== 3 || !newRow.rate.trim()}>{busy === 'new' ? 'Adding...' : 'Add rate'}</Btn>
              </div>
              <p style={{ fontSize: '11.5px', color: A.textMuted, marginTop: '10px' }}>Wallets and payouts stay in NGN. These rates only decide how much Naira a buyer pays for a listing priced in another currency.</p>
            </Card>
          )}
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
