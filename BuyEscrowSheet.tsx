import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icons'
import { COLORS } from './shared'
import {
  getMyWallet, placeOrder, getFxQuote, useMoney, DELIVERY_UNITS, addDuration, deliveryProblem, formatDeliveryDate,
} from './walletShared'
import type { DeliveryUnit } from './walletShared'
import type { Wallet, FxQuote } from './walletShared'

// Money in the currency the listing is priced in
const fmtIn = (value: number, cur: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${cur} ${value.toLocaleString()}`
  }
}

export type BuyListing = {
  id: string
  title: string
  price: number
  currency: string
  unit: string | null
  quantity: number | null
}

export default function BuyEscrowSheet({ listing, onClose }: { listing: BuyListing; onClose: () => void }) {
  const navigate = useNavigate()
  const money = useMoney()

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [qty, setQty] = useState('1')
  // Expected delivery: either an exact date and time, or "in X hours/days/weeks/months".
  const [mode, setMode] = useState<'duration' | 'date'>('duration')
  const [durAmount, setDurAmount] = useState('')
  const [durUnit, setDurUnit] = useState<DeliveryUnit>('hours')
  const [dateValue, setDateValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyWallet().then(setWallet).catch(() => setError('Could not load your wallet. Check your connection.'))
  }, [])

  const listingCur = (listing.currency || 'NGN').toUpperCase()
  const isNgn = listingCur === 'NGN'
  const q = Number(qty)
  const qtyValid = Number.isFinite(q) && q > 0 && (listing.quantity == null || q <= Number(listing.quantity))

  // A listing priced in another currency is paid in NGN at the current Farmxie rate; the server confirms the same rate when ordering.
  const [quote, setQuote] = useState<FxQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  useEffect(() => {
    if (isNgn || !qtyValid) { setQuote(null); setQuoteError(''); return }
    let cancelled = false
    const timer = setTimeout(() => {
      getFxQuote(listing.id, q)
        .then((r) => { if (!cancelled) { setQuote(r); setQuoteError('') } })
        .catch((e) => { if (!cancelled) { setQuote(null); setQuoteError((e as Error).message) } })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [isNgn, qtyValid, q, listing.id])

  const totalReady = qtyValid && (isNgn || !!quote)
  const total = !qtyValid ? 0 : isNgn ? Math.round(Number(listing.price) * q * 100) / 100 : quote?.amount_ngn ?? 0
  const enough = !!wallet && totalReady && wallet.available >= total
  const shortfall = wallet ? Math.max(0, total - wallet.available) : 0

  const durN = Number(durAmount)
  let deliveryAt: Date | null = null
  if (mode === 'duration') {
    if (Number.isFinite(durN) && durN > 0) deliveryAt = addDuration(new Date(), durN, durUnit)
  } else if (dateValue) {
    const d = new Date(dateValue)
    if (!Number.isNaN(d.getTime())) deliveryAt = d
  }
  const deliveryError = deliveryAt ? deliveryProblem(deliveryAt) : ''
  const deliveryOk = !!deliveryAt && !deliveryError

  const presets: { label: string; amount: number; unit: DeliveryUnit }[] = [
    { label: '6 hours', amount: 6, unit: 'hours' },
    { label: '1 day', amount: 1, unit: 'days' },
    { label: '3 days', amount: 3, unit: 'days' },
    { label: '1 week', amount: 1, unit: 'weeks' },
  ]
  const toLocalInput = (d: Date) => {
    const p2 = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
  }

  const pay = async () => {
    if (!deliveryAt || !deliveryOk) return
    setBusy(true)
    setError('')
    try {
      const res = await placeOrder(listing.id, q, deliveryAt, total)
      navigate(`/orders/${res.order_id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', padding: '18px 16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: COLORS.text }}>Buy with Escrow</p>
          <div onClick={onClose} style={{ cursor: 'pointer', display: 'flex' }}><Icon name="close" size={20} color={COLORS.textMuted} /></div>
        </div>

        <p style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text }}>{listing.title}</p>
        <p style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '2px' }}>
          {fmtIn(Number(listing.price), listingCur)}{listing.unit ? ` / ${listing.unit}` : ''}
        </p>

        {(
          <>
            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: '14px 0 6px' }}>
              Quantity{listing.unit ? ` (${listing.unit})` : ''}
            </p>
            <input
              type="number" inputMode="decimal" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '14px', boxSizing: 'border-box', background: COLORS.bg }}
            />
            {listing.quantity != null && (
              <p style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>{Number(listing.quantity).toLocaleString()} available</p>
            )}

            <p style={{ fontSize: '12px', fontWeight: 700, color: COLORS.text, margin: '14px 0 6px' }}>Expected delivery</p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {([['duration', 'In how long'], ['date', 'Date and time']] as const).map(([key, label]) => (
                <div key={key} onClick={() => setMode(key)} style={{
                  flex: 1, textAlign: 'center', padding: '8px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  background: mode === key ? COLORS.green : COLORS.bg, color: mode === key ? 'white' : COLORS.textMuted,
                  border: `1px solid ${mode === key ? COLORS.green : COLORS.border}`,
                }}>{label}</div>
              ))}
            </div>

            {mode === 'duration' ? (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number" inputMode="decimal" min="1" value={durAmount} onChange={(e) => setDurAmount(e.target.value)} placeholder="e.g. 5"
                    style={{ width: '90px', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '14px', boxSizing: 'border-box', background: COLORS.bg }}
                  />
                  <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                    {DELIVERY_UNITS.map((u) => (
                      <div key={u.value} onClick={() => setDurUnit(u.value)} style={{
                        flex: 1, textAlign: 'center', padding: '11px 2px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                        background: durUnit === u.value ? '#ECFDF3' : COLORS.bg, color: durUnit === u.value ? COLORS.green : COLORS.textMuted,
                        border: `1px solid ${durUnit === u.value ? COLORS.green : COLORS.border}`,
                      }}>{u.label}</div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {presets.map((pr) => (
                    <span key={pr.label} onClick={() => { setDurAmount(String(pr.amount)); setDurUnit(pr.unit) }} style={{ fontSize: '11.5px', fontWeight: 700, color: COLORS.green, background: '#ECFDF3', padding: '5px 10px', borderRadius: '999px', cursor: 'pointer' }}>{pr.label}</span>
                  ))}
                </div>
              </>
            ) : (
              <input
                type="datetime-local" value={dateValue} min={toLocalInput(new Date(Date.now() + 3600_000))} onChange={(e) => setDateValue(e.target.value)}
                style={{ width: '100%', padding: '11px 12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '14px', boxSizing: 'border-box', background: COLORS.bg }}
              />
            )}

            {deliveryAt && !deliveryError && (
              <p style={{ fontSize: '12px', color: COLORS.text, marginTop: '8px', fontWeight: 600 }}>The seller should deliver by {formatDeliveryDate(deliveryAt)}.</p>
            )}
            {deliveryError && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '8px' }}>{deliveryError}</p>}

            <div style={{ background: COLORS.bg, borderRadius: '12px', padding: '12px', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {!isNgn && quote && qtyValid && <Row label={`Price (${listingCur})`} value={fmtIn(quote.orig_amount, listingCur)} />}
              {!isNgn && quote && qtyValid && <Row label="Exchange rate" value={`1 ${listingCur} = ${money.formatNgn(quote.rate)}`} />}
              <Row label="Total to pay (NGN)" value={totalReady ? money.formatNgn(total) : qtyValid && !isNgn && !quoteError ? '...' : '-'} bold />
              {money.isForeign && money.currency !== listingCur && totalReady && <Row label={`In ${money.currency}`} value={`≈ ${money.format(total)}`} />}
              <Row label="Your wallet" value={wallet ? money.formatNgn(wallet.available) : '...'} />
            </div>
            {!isNgn && quoteError && <p style={{ fontSize: '12px', color: '#B91C1C', marginTop: '8px', lineHeight: 1.5 }}>{quoteError}</p>}
            {!isNgn && quote && (
              <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '8px', lineHeight: 1.5 }}>
                This listing is priced in {listingCur}. You pay in NGN at the rate above, and that rate is locked when you place the order.
              </p>
            )}

            <p style={{ fontSize: '11.5px', color: COLORS.textMuted, marginTop: '12px', lineHeight: 1.5 }}>
              Your money is held in escrow. You get a code. Give it to the seller only after you receive your goods, then the payment is released. You cannot cancel before the expected delivery time. If the goods have not arrived after that time, you can cancel and your money returns to your wallet.
            </p>

            {error && <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '10px' }}>{error}</p>}

            {wallet && totalReady && !enough ? (
              <>
                <p style={{ fontSize: '12px', color: '#B45309', marginTop: '10px', fontWeight: 600 }}>
                  You need {money.formatNgn(shortfall)} more in your wallet.
                </p>
                <div onClick={() => navigate('/wallet')} style={{ marginTop: '10px', textAlign: 'center', padding: '13px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                  Top up wallet
                </div>
              </>
            ) : (
              <div
                onClick={busy || !totalReady || !wallet || !deliveryOk ? undefined : pay}
                style={{ marginTop: '14px', textAlign: 'center', padding: '13px', borderRadius: '10px', background: COLORS.green, color: 'white', fontSize: '13px', fontWeight: 800, cursor: busy || !totalReady || !wallet || !deliveryOk ? 'default' : 'pointer', opacity: busy || !totalReady || !wallet || !deliveryOk ? 0.6 : 1 }}>
                {busy ? 'Placing order...' : 'Pay with Escrow'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <p style={{ fontSize: '12px', color: COLORS.textMuted }}>{label}</p>
      <p style={{ fontSize: bold ? '14px' : '12px', fontWeight: bold ? 800 : 700, color: COLORS.text }}>{value}</p>
    </div>
  )
}
