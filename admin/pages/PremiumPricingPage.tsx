import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../supabaseClient'
import AdminLayout from '../AdminLayout'
import { useStaff } from '../AdminStaffContext'
import { logAdminAction } from '../adminAuth'
import { CountryField } from '../../CountryPicker'
import { flagEmoji } from '../../countryData'
import type { Country } from '../../countryData'

const A = { surface: '#FFFFFF', border: '#E3E7E3', green: '#16A34A', text: '#0F1A0F', textMuted: '#6B7280', bg: '#F7F8F7', red: '#DC2626' }

type Audience = 'user' | 'company'
type PriceRow = { audience: Audience; country: string; country_code: string | null; currency: string; months: number; amount: number; active: boolean }
type CurrencyRow = { currency: string; enabled: boolean; note?: string | null }
type Group = { key: string; audience: Audience; country: string; code: string; currency: string; m1: string; m3: string; m6: string; active: boolean }
type Mismatch = { id: string; audience: string; price_country: string; card_country: string; months: number; amount: number; currency: string; paid_at: string; who: string; username: string }

const ERRORS: Record<string, string> = {
  invalid_price: 'Every price must be a number greater than 0.',
  invalid_currency: 'The currency must be a 3-letter code, for example NGN.',
  invalid_country: 'Choose a country, or use International.',
  not_allowed: 'You do not have permission to do this.',
}
const errorText = (e: { message?: string } | null) => {
  const k = Object.keys(ERRORS).find((x) => e?.message?.includes(x))
  return k ? ERRORS[k] : e?.message || 'Something went wrong.'
}

function toGroups(rows: PriceRow[]): Group[] {
  const map = new Map<string, Group>()
  rows.forEach((r) => {
    const key = `${r.audience}|${r.country.toLowerCase()}`
    const g = map.get(key) || { key, audience: r.audience, country: r.country, code: r.country_code || '', currency: r.currency, m1: '', m3: '', m6: '', active: true }
    if (r.months === 1) g.m1 = String(r.amount)
    if (r.months === 3) g.m3 = String(r.amount)
    if (r.months === 6) g.m6 = String(r.amount)
    g.active = g.active && r.active
    map.set(key, g)
  })
  return Array.from(map.values())
}

// Route: /admin/premium-pricing  (needs the premium.manage_pricing permission)
// Premium prices per country, which currencies can be paid, and payments where the card country differs.
export default function PremiumPricingPage() {
  const staff = useStaff()
  const allowed = staff.permissions.has('premium.manage_pricing')
  const [audience, setAudience] = useState<Audience>('user')
  const [groups, setGroups] = useState<Group[]>([])
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([])
  const [mismatches, setMismatches] = useState<Mismatch[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [draft, setDraft] = useState<Group>({ key: 'new', audience: 'user', country: '', code: '', currency: 'NGN', m1: '', m3: '', m6: '', active: true })

  const load = async () => {
    setLoadError(false)
    setLoading(true)
    const [p, m] = await Promise.all([supabase.rpc('admin_premium_prices'), supabase.rpc('admin_premium_mismatches')])
    if (p.error) setLoadError(true)
    else {
      setGroups(toGroups(((p.data as any)?.prices || []) as PriceRow[]))
      setCurrencies(((p.data as any)?.currencies || []) as CurrencyRow[])
    }
    if (!m.error) setMismatches((m.data || []) as Mismatch[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const edit = (key: string, patch: Partial<Group>) =>
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)))

  const save = async (g: Group, isNew: boolean) => {
    setMessage(null)
    if (!g.country.trim()) return setMessage({ kind: 'error', text: ERRORS.invalid_country })
    const nums = [Number(g.m1), Number(g.m3), Number(g.m6)]
    if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return setMessage({ kind: 'error', text: ERRORS.invalid_price })
    setBusy(g.key)
    const { error: e } = await supabase.rpc('admin_premium_price_set', {
      p_audience: g.audience, p_country: g.country.trim(), p_country_code: g.code || null, p_currency: g.currency.trim().toUpperCase(),
      p_m1: nums[0], p_m3: nums[1], p_m6: nums[2], p_active: g.active,
    })
    setBusy('')
    if (e) return setMessage({ kind: 'error', text: errorText(e) })
    await logAdminAction(isNew ? 'Added Premium prices' : 'Updated Premium prices', {
      type: 'premium_prices', id: `${g.audience}:${g.country}`,
      label: `${g.audience} ${g.country}: ${g.currency} ${nums.join(' / ')}${g.active ? '' : ' (off)'}`,
    })
    setMessage({ kind: 'ok', text: `${g.country} saved.` })
    if (isNew) setDraft({ ...draft, country: '', code: '', m1: '', m3: '', m6: '' })
    load()
  }

  const turnOff = async (g: Group) => {
    if (!window.confirm(`Turn off Premium prices for ${g.country}? People there will see the International price instead.`)) return
    setBusy(g.key)
    const { error: e } = await supabase.rpc('admin_premium_price_deactivate', { p_audience: g.audience, p_country: g.country })
    setBusy('')
    if (e) return setMessage({ kind: 'error', text: errorText(e) })
    await logAdminAction('Turned off Premium prices', { type: 'premium_prices', id: `${g.audience}:${g.country}`, label: `${g.audience} ${g.country}` })
    load()
  }

  const toggleCurrency = async (c: CurrencyRow) => {
    const next = !c.enabled
    if (next && c.currency !== 'NGN' && !window.confirm(`Turn on ${c.currency}? Only do this after Paystack supports ${c.currency} on your account, otherwise payments in ${c.currency} will fail.`)) return
    setBusy(`cur-${c.currency}`)
    const { error: e } = await supabase.rpc('admin_premium_currency_set', { p_currency: c.currency, p_enabled: next })
    setBusy('')
    if (e) return setMessage({ kind: 'error', text: errorText(e) })
    await logAdminAction(next ? 'Enabled a Premium payment currency' : 'Disabled a Premium payment currency', { type: 'premium_prices', id: c.currency, label: c.currency })
    load()
  }

  const shown = groups.filter((g) => g.audience === audience)
  const enabled = new Set(currencies.filter((c) => c.enabled).map((c) => c.currency))
  const blocked = shown.filter((g) => g.active && !enabled.has(g.currency))

  const priceInputs = (g: Group, onChange: (patch: Partial<Group>) => void) => (
    <>
      {(['m1', 'm3', 'm6'] as const).map((k) => (
        <Field key={k} label={k === 'm1' ? '1 month' : k === 'm3' ? '3 months' : '6 months'}>
          <input value={g[k]} inputMode="decimal" onChange={(e) => onChange({ [k]: e.target.value })} style={{ ...input, width: 100 }} />
        </Field>
      ))}
    </>
  )

  return (
    <AdminLayout title="Premium Pricing">
      {!allowed && <p style={{ fontSize: '13px', color: A.textMuted }}>You do not have permission to manage Premium prices.</p>}

      {allowed && (
        <>
          {message && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: message.kind === 'ok' ? '#DCFCE7' : '#FEE2E2', color: message.kind === 'ok' ? '#166534' : '#991B1B' }}>
              {message.text}
            </div>
          )}
          {loadError && <p style={{ fontSize: '13px', color: A.red, marginBottom: '12px' }}>Could not load the prices. Pull to refresh or try again.</p>}
          {blocked.length > 0 && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', background: '#FEF3C7', color: '#92400E' }}>
              {blocked.map((g) => g.country).join(', ')}: priced in a currency that is not enabled for payment yet, so people there cannot pay.
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {(['user', 'company'] as Audience[]).map((a) => (
              <span key={a} role="button" onClick={() => { setAudience(a); setDraft((d) => ({ ...d, audience: a })) }} style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                background: audience === a ? A.green : A.surface, color: audience === a ? '#fff' : A.text, border: `1px solid ${audience === a ? A.green : A.border}`,
              }}>{a === 'user' ? 'People' : 'Companies'}</span>
            ))}
          </div>

          <Card title="Prices by country" hint='Each country has a price for 1, 3 and 6 months. A country with no price, or one that is turned off, uses the "International" price. Changes apply to new payments only.'>
            {loading && <p style={{ fontSize: '13px', color: A.textMuted }}>Loading...</p>}
            {!loading && shown.length === 0 && <p style={{ fontSize: '13px', color: A.textMuted }}>No prices yet.</p>}
            {shown.map((g) => (
              <div key={g.key} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '12px 0', borderTop: `1px solid ${A.border}` }}>
                <Field label="Country">
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: A.text, minWidth: 130, padding: '8px 0' }}>
                    {g.code ? flagEmoji(g.code) : '🌐'} {g.country}
                  </p>
                </Field>
                <Field label="Currency">
                  <input value={g.currency} maxLength={3} onChange={(e) => edit(g.key, { currency: e.target.value.toUpperCase() })} style={{ ...input, width: 70 }} />
                </Field>
                {priceInputs(g, (patch) => edit(g.key, patch))}
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px', color: A.text, padding: '8px 0' }}>
                  <input type="checkbox" checked={g.active} onChange={(e) => edit(g.key, { active: e.target.checked })} /> On
                </label>
                <Btn onClick={() => save(g, false)} disabled={busy === g.key}>{busy === g.key ? 'Saving...' : 'Save'}</Btn>
                {g.active && g.country.toLowerCase() !== 'international' && (
                  <span role="button" onClick={() => turnOff(g)} style={{ fontSize: '12px', fontWeight: 700, color: A.red, cursor: 'pointer', padding: '8px 4px' }}>Turn off</span>
                )}
              </div>
            ))}
          </Card>

          <Card title="Add a country" hint='Pick a country, or choose "International" for every country without its own price.'>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Field label="Country">
                <div style={{ width: 220 }}>
                  <CountryField
                    value={draft.code || null}
                    placeholder={draft.country || 'Select country'}
                    onChange={(c: Country) => setDraft({ ...draft, country: c.name, code: c.code })}
                    style={{ marginBottom: 0 }}
                  />
                </div>
              </Field>
              <span role="button" onClick={() => setDraft({ ...draft, country: 'International', code: '' })} style={{ fontSize: '12px', fontWeight: 700, color: A.green, cursor: 'pointer', padding: '10px 2px' }}>Use International</span>
              <Field label="Currency">
                <input value={draft.currency} maxLength={3} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} style={{ ...input, width: 70 }} />
              </Field>
              {priceInputs(draft, (patch) => setDraft({ ...draft, ...patch }))}
              <Btn onClick={() => save({ ...draft, audience }, true)} disabled={busy === 'new'}>{busy === 'new' ? 'Saving...' : 'Add'}</Btn>
            </div>
            {draft.country && <p style={{ fontSize: '12px', color: A.textMuted, marginTop: '8px' }}>Selected: {draft.country}</p>}
          </Card>

          <Card title="Payment currencies" hint="Only currencies turned on here can be charged. Paystack currently supports NGN on this account. Turn on another currency only after Paystack enables it.">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {currencies.map((c) => (
                <span key={c.currency} role="button" onClick={() => toggleCurrency(c)} style={{
                  padding: '8px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
                  background: c.enabled ? '#DCFCE7' : A.bg, color: c.enabled ? '#166534' : A.textMuted, border: `1px solid ${c.enabled ? '#86EFAC' : A.border}`,
                }}>{c.currency} {c.enabled ? 'on' : 'off'}</span>
              ))}
            </div>
          </Card>

          <Card title="Country mismatch" hint="Payments where the country of the card is different from the country that set the price. This is only a flag for you to review; the payment still went through.">
            {mismatches.length === 0 && <p style={{ fontSize: '13px', color: A.textMuted }}>No mismatches.</p>}
            {mismatches.map((m) => (
              <div key={m.id} style={{ padding: '10px 0', borderTop: `1px solid ${A.border}`, fontSize: '13px', color: A.text }}>
                <p style={{ fontWeight: 700 }}>{m.who || 'Unknown'}{m.username ? ` (@${m.username})` : ''} <span style={{ color: A.textMuted, fontWeight: 600 }}>· {m.audience}</span></p>
                <p style={{ color: A.textMuted, fontSize: '12px', marginTop: '2px' }}>
                  Price country: {m.price_country} · Card country: {m.card_country || 'unknown'} · {m.currency} {m.amount} for {m.months} mo · {new Date(m.paid_at).toLocaleDateString()}
                </p>
              </div>
            ))}
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
